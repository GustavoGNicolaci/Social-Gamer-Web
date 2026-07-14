-- Filter and paginate community members in Postgres instead of downloading the
-- full membership list to the browser. Authorization is checked explicitly
-- because this projection is SECURITY DEFINER.

create or replace function public.get_community_members_page(
  p_community_id uuid,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  comunidade_id uuid,
  usuario_id uuid,
  cargo public.comunidade_cargo,
  entrou_em timestamp with time zone,
  atualizado_em timestamp with time zone,
  user_id uuid,
  username text,
  nome_completo text,
  avatar_path text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 250);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_community_id is null then
    raise exception 'community_id_required' using errcode = '22023';
  end if;

  if not coalesce(
    public.can_ver_conteudo_comunidade(p_community_id, auth.uid()),
    false
  ) then
    return;
  end if;

  return query
    select
      member.comunidade_id,
      member.usuario_id,
      member.cargo,
      member.entrou_em,
      member.atualizado_em,
      profile.id,
      profile.username,
      profile.nome_completo,
      profile.avatar_path,
      count(*) over () as total_count
    from public.comunidade_membros member
    join public.usuarios profile on profile.id = member.usuario_id
    where member.comunidade_id = p_community_id
      and (
        v_search = ''
        or translate(
          lower(coalesce(profile.username, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ) like '%' || v_search || '%'
        or translate(
          lower(coalesce(profile.nome_completo, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'
        ) like '%' || v_search || '%'
        or member.cargo::text like '%' || v_search || '%'
      )
    order by member.cargo, member.entrou_em, member.usuario_id
    limit v_limit
    offset v_offset;
end;
$$;

revoke all on function public.get_community_members_page(uuid, text, integer, integer)
from public, anon, authenticated;

grant execute on function public.get_community_members_page(uuid, text, integer, integer)
to anon, authenticated, service_role;

comment on function public.get_community_members_page(uuid, text, integer, integer) is
  'Returns an authorized, filtered and paginated community member projection.';
