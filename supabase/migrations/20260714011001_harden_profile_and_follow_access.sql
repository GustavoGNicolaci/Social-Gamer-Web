begin;

-- Public callers may continue to resolve the basic identity used throughout the
-- application, but private profile fields are available only through the
-- projections below. Column privileges are intentional defense in depth: RLS
-- controls rows, while these grants prevent selecting sensitive columns.
revoke all on table public.usuarios from anon, authenticated;
grant select (id, username, nome_completo, avatar_path, avatar_url, data_cadastro)
  on table public.usuarios to anon, authenticated;
grant insert, update on table public.usuarios to authenticated;

drop policy if exists "usuarios_select_public_profiles" on public.usuarios;
drop policy if exists "usuarios_select_public_identity" on public.usuarios;

create policy "usuarios_select_public_identity"
on public.usuarios for select
to anon, authenticated
using (true);

-- Followers are never publicly enumerable through the table. An authenticated
-- user may inspect only relationships in which they participate; public counts
-- and authorized connection lists are exposed by narrowly-scoped RPCs below.
revoke all on table public.seguidores from anon, authenticated;
grant select, insert, delete on table public.seguidores to authenticated;

drop policy if exists "seguidores_select_relationships" on public.seguidores;
drop policy if exists "seguidores_select_own_relationships" on public.seguidores;

create policy "seguidores_select_own_relationships"
on public.seguidores for select
to authenticated
using (
  seguidor_id = (select auth.uid())
  or seguido_id = (select auth.uid())
);

create or replace function public.get_my_profile()
returns table (
  id uuid,
  username text,
  nome_completo text,
  avatar_path text,
  avatar_url text,
  bio text,
  data_cadastro timestamptz,
  configuracoes_privacidade jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.username,
    u.nome_completo,
    u.avatar_path,
    u.avatar_url,
    u.bio,
    u.data_cadastro,
    u.configuracoes_privacidade
  from public.usuarios as u
  where auth.uid() is not null
    and u.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile() from public, anon, authenticated, service_role;
grant execute on function public.get_my_profile() to authenticated;

create or replace function public.get_public_profile_by_username(p_username text)
returns table (
  id uuid,
  username text,
  nome_completo text,
  avatar_path text,
  bio text,
  data_cadastro timestamptz,
  top_five_entries jsonb,
  followers_count bigint,
  following_count bigint,
  is_private boolean,
  privacy_mode text,
  can_view_restricted_content boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidate as (
    select
      u.id,
      u.username,
      u.nome_completo,
      u.avatar_path,
      u.bio,
      u.data_cadastro,
      u.configuracoes_privacidade,
      case
        when coalesce(u.configuracoes_privacidade ->> 'perfil_privado', 'false') = 'true'
          then 'private'
        when coalesce(u.configuracoes_privacidade ->> 'somente_amigos', 'false') = 'true'
          then 'friends'
        else 'public'
      end as privacy_mode,
      private.can_view_profile_restricted_content(u.id, auth.uid())
        as can_view_restricted_content
    from public.usuarios as u
    where u.username = btrim(p_username)
    limit 1
  )
  select
    c.id,
    c.username,
    c.nome_completo,
    c.avatar_path,
    case when c.can_view_restricted_content then c.bio else null end as bio,
    c.data_cadastro,
    case
      when c.can_view_restricted_content
        and jsonb_typeof(c.configuracoes_privacidade -> 'top5_jogos') = 'array'
        then c.configuracoes_privacidade -> 'top5_jogos'
      else '[]'::jsonb
    end as top_five_entries,
    (
      select count(*)
      from public.seguidores as follower
      where follower.seguido_id = c.id
    ) as followers_count,
    (
      select count(*)
      from public.seguidores as following
      where following.seguidor_id = c.id
    ) as following_count,
    c.privacy_mode = 'private' as is_private,
    c.privacy_mode,
    c.can_view_restricted_content
  from candidate as c;
$$;

revoke all on function public.get_public_profile_by_username(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile_by_username(text)
  to anon, authenticated, service_role;

create or replace function public.get_profile_follow_state(p_profile_id uuid)
returns table (
  is_following boolean,
  followers_count bigint,
  following_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when auth.uid() is null or auth.uid() = p_profile_id then false
      else exists (
        select 1
        from public.seguidores as relationship
        where relationship.seguidor_id = auth.uid()
          and relationship.seguido_id = p_profile_id
      )
    end as is_following,
    (
      select count(*)
      from public.seguidores as follower
      where follower.seguido_id = p_profile_id
    ) as followers_count,
    (
      select count(*)
      from public.seguidores as following
      where following.seguidor_id = p_profile_id
    ) as following_count;
$$;

revoke all on function public.get_profile_follow_state(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_profile_follow_state(uuid)
  to anon, authenticated, service_role;

create or replace function public.get_follow_relationship_map(p_user_ids uuid[])
returns table (
  user_id uuid,
  is_following boolean,
  is_mutual_friend boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with targets as (
    select distinct input.user_id
    from unnest(coalesce(p_user_ids[1:200], '{}'::uuid[])) as input(user_id)
    where input.user_id is not null
  ), relationships as (
    select
      target.user_id,
      exists (
        select 1
        from public.seguidores as viewer_follow
        where viewer_follow.seguidor_id = auth.uid()
          and viewer_follow.seguido_id = target.user_id
      ) as is_following,
      exists (
        select 1
        from public.seguidores as owner_follow
        where owner_follow.seguidor_id = target.user_id
          and owner_follow.seguido_id = auth.uid()
      ) as follows_viewer
    from targets as target
    where auth.uid() is not null
      and target.user_id <> auth.uid()
  )
  select
    relationship.user_id,
    relationship.is_following,
    relationship.is_following and relationship.follows_viewer as is_mutual_friend
  from relationships as relationship;
$$;

revoke all on function public.get_follow_relationship_map(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.get_follow_relationship_map(uuid[]) to authenticated;

create or replace function public.get_profile_connections(
  p_profile_id uuid,
  p_kind text,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  nome_completo text,
  avatar_path text,
  is_following boolean,
  relationship_started_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_kind is null or p_kind not in ('followers', 'following') then
    raise exception 'invalid_connection_kind' using errcode = '22023';
  end if;

  if not private.can_view_profile_restricted_content(p_profile_id, viewer_id) then
    return;
  end if;

  if p_kind = 'followers' then
    return query
    select
      u.id,
      u.username,
      u.nome_completo,
      u.avatar_path,
      case
        when viewer_id is null or viewer_id = u.id then false
        else exists (
          select 1
          from public.seguidores as viewer_follow
          where viewer_follow.seguidor_id = viewer_id
            and viewer_follow.seguido_id = u.id
        )
      end as is_following,
      relationship.data_inicio as relationship_started_at
    from public.seguidores as relationship
    join public.usuarios as u on u.id = relationship.seguidor_id
    where relationship.seguido_id = p_profile_id
    order by relationship.data_inicio desc, u.username
    limit safe_limit
    offset safe_offset;
  else
    return query
    select
      u.id,
      u.username,
      u.nome_completo,
      u.avatar_path,
      case
        when viewer_id is null or viewer_id = u.id then false
        else exists (
          select 1
          from public.seguidores as viewer_follow
          where viewer_follow.seguidor_id = viewer_id
            and viewer_follow.seguido_id = u.id
        )
      end as is_following,
      relationship.data_inicio as relationship_started_at
    from public.seguidores as relationship
    join public.usuarios as u on u.id = relationship.seguido_id
    where relationship.seguidor_id = p_profile_id
    order by relationship.data_inicio desc, u.username
    limit safe_limit
    offset safe_offset;
  end if;
end;
$$;

revoke all on function public.get_profile_connections(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_profile_connections(uuid, text, integer, integer)
  to anon, authenticated, service_role;

commit;
