-- Keep wishlist priority assignment and reordering atomic. Both functions bind
-- writes to auth.uid(); callers cannot choose another user's list.

create or replace function public.add_own_wishlist_item(p_game_id integer)
returns table (
  id uuid,
  usuario_id uuid,
  jogo_id integer,
  adicionado_em timestamp with time zone,
  prioridade integer,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.lista_desejos%rowtype;
  v_next_priority integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_game_id is null or p_game_id <= 0 then
    raise exception 'invalid_game_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wishlist:' || v_user_id::text, 0)
  );

  select item.*
  into v_entry
  from public.lista_desejos item
  where item.usuario_id = v_user_id
    and item.jogo_id = p_game_id;

  if found then
    return query
      select
        v_entry.id,
        v_entry.usuario_id,
        v_entry.jogo_id,
        v_entry.adicionado_em,
        v_entry.prioridade,
        false;
    return;
  end if;

  -- Preserve the legacy display order when older rows still have a null
  -- priority: each such row already occupies one position at the end.
  select
    coalesce(max(item.prioridade), 0)
    + (count(*) filter (where item.prioridade is null))::integer
    + 1
  into v_next_priority
  from public.lista_desejos item
  where item.usuario_id = v_user_id;

  insert into public.lista_desejos (usuario_id, jogo_id, prioridade)
  values (v_user_id, p_game_id, v_next_priority)
  returning * into v_entry;

  return query
    select
      v_entry.id,
      v_entry.usuario_id,
      v_entry.jogo_id,
      v_entry.adicionado_em,
      v_entry.prioridade,
      true;
end;
$$;

create or replace function public.reorder_own_wishlist(p_item_ids uuid[])
returns table (
  id uuid,
  prioridade integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_ids uuid[] := coalesce(p_item_ids, '{}'::uuid[]);
  v_current_count integer;
  v_distinct_count integer;
  v_matched_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if cardinality(v_item_ids) > 1000 then
    raise exception 'wishlist_order_too_large' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_distinct_count
  from (select distinct item_id from unnest(v_item_ids) as ids(item_id)) unique_ids;

  if v_distinct_count <> cardinality(v_item_ids) then
    raise exception 'duplicate_wishlist_item' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wishlist:' || v_user_id::text, 0)
  );

  select count(*)::integer
  into v_current_count
  from public.lista_desejos item
  where item.usuario_id = v_user_id;

  select count(*)::integer
  into v_matched_count
  from public.lista_desejos item
  where item.usuario_id = v_user_id
    and item.id = any(v_item_ids);

  if v_current_count <> cardinality(v_item_ids) or v_matched_count <> v_current_count then
    raise exception 'wishlist_order_must_include_all_owned_items' using errcode = '22023';
  end if;

  update public.lista_desejos item
  set prioridade = ordered.priority
  from (
    select item_id, ordinality::integer as priority
    from unnest(v_item_ids) with ordinality as ids(item_id, ordinality)
  ) ordered
  where item.id = ordered.item_id
    and item.usuario_id = v_user_id;

  return query
    select item.id, item.prioridade
    from public.lista_desejos item
    where item.usuario_id = v_user_id
    order by item.prioridade, item.adicionado_em desc, item.id;
end;
$$;

create or replace function public.remove_own_wishlist_item(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_item_id is null then
    raise exception 'wishlist_item_id_required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wishlist:' || v_user_id::text, 0)
  );

  delete from public.lista_desejos item
  where item.id = p_item_id
    and item.usuario_id = v_user_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end;
$$;

revoke all on function public.add_own_wishlist_item(integer)
from public, anon, authenticated;
revoke all on function public.reorder_own_wishlist(uuid[])
from public, anon, authenticated;
revoke all on function public.remove_own_wishlist_item(uuid)
from public, anon, authenticated;

grant execute on function public.add_own_wishlist_item(integer)
to authenticated, service_role;
grant execute on function public.reorder_own_wishlist(uuid[])
to authenticated, service_role;
grant execute on function public.remove_own_wishlist_item(uuid)
to authenticated, service_role;

comment on function public.add_own_wishlist_item(integer) is
  'Adds the authenticated user wishlist item with a server-assigned priority.';
comment on function public.reorder_own_wishlist(uuid[]) is
  'Atomically rewrites the authenticated user complete wishlist order.';
comment on function public.remove_own_wishlist_item(uuid) is
  'Removes one authenticated user wishlist item under the shared wishlist lock.';
