create or replace function public.excluir_comunidade(p_comunidade_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_deleted_at timestamptz := now();
begin
  if not public.is_comunidade_lider(p_comunidade_id, auth.uid()) then
    raise exception 'Apenas o lider pode excluir a comunidade.';
  end if;

  update public.comunidades
  set deleted_at = v_deleted_at,
      updated_at = v_deleted_at
  where id = p_comunidade_id
    and deleted_at is null;

  if not found then
    return;
  end if;

  update public.comunidade_posts
  set deleted_at = v_deleted_at,
      updated_at = v_deleted_at
  where comunidade_id = p_comunidade_id
    and deleted_at is null;

  update public.comunidade_post_comentarios
  set deleted_at = v_deleted_at,
      updated_at = v_deleted_at
  where comunidade_id = p_comunidade_id
    and deleted_at is null;
end;
$function$;

with deleted_communities as (
  select id, deleted_at
  from public.comunidades
  where deleted_at is not null
)
update public.comunidade_posts p
set deleted_at = coalesce(p.deleted_at, dc.deleted_at, now()),
    updated_at = now()
from deleted_communities dc
where p.comunidade_id = dc.id
  and p.deleted_at is null;

with deleted_communities as (
  select id, deleted_at
  from public.comunidades
  where deleted_at is not null
)
update public.comunidade_post_comentarios c
set deleted_at = coalesce(c.deleted_at, dc.deleted_at, now()),
    updated_at = now()
from deleted_communities dc
where c.comunidade_id = dc.id
  and c.deleted_at is null;;
