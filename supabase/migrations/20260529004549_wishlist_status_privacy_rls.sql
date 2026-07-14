create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.can_view_profile_restricted_content(
  p_owner_id uuid,
  p_viewer_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      case
        when p_owner_id is null then false
        when p_viewer_id is not null and p_owner_id = p_viewer_id then true
        when coalesce(u.configuracoes_privacidade ->> 'perfil_privado', 'false') = 'true' then false
        when coalesce(u.configuracoes_privacidade ->> 'somente_amigos', 'false') = 'true' then
          p_viewer_id is not null
          and exists (
            select 1
            from public.seguidores viewer_follow
            where viewer_follow.seguidor_id = p_viewer_id
              and viewer_follow.seguido_id = p_owner_id
          )
          and exists (
            select 1
            from public.seguidores owner_follow
            where owner_follow.seguidor_id = p_owner_id
              and owner_follow.seguido_id = p_viewer_id
          )
        else true
      end
    from public.usuarios u
    where u.id = p_owner_id
  ), false);
$$;

revoke execute on function private.can_view_profile_restricted_content(uuid, uuid) from public;
grant execute on function private.can_view_profile_restricted_content(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.home_can_view_user_content(owner_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_profile_restricted_content(owner_id, viewer_id);
$$;

revoke execute on function public.home_can_view_user_content(uuid, uuid) from public, anon, authenticated;

alter policy "lista_desejos_public_read"
  on public.lista_desejos
  using (private.can_view_profile_restricted_content(usuario_id, (select auth.uid())));

alter policy "status_jogo_public_read"
  on public.status_jogo
  using (private.can_view_profile_restricted_content(usuario_id, (select auth.uid())));

create or replace function public.get_home_following_activities(activity_limit integer default 8)
returns table(
  activity_id text,
  activity_type text,
  review_id uuid,
  status_id uuid,
  author_id uuid,
  author_username text,
  author_name text,
  author_avatar_path text,
  game_id integer,
  game_title text,
  game_cover_url text,
  game_genres jsonb,
  score numeric,
  text_review text,
  status_value text,
  is_favorite boolean,
  activity_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id
  ),
  followed_users as (
    select s.seguido_id
    from public.seguidores s
    cross join viewer v
    where v.id is not null
      and s.seguidor_id = v.id
  ),
  activities as (
    select
      concat('review:', a.id::text) as activity_id,
      'review'::text as activity_type,
      a.id as review_id,
      null::uuid as status_id,
      u.id as author_id,
      u.username as author_username,
      coalesce(nullif(u.nome_completo, ''), u.username) as author_name,
      u.avatar_path as author_avatar_path,
      j.id as game_id,
      j.titulo as game_title,
      j.capa_url as game_cover_url,
      to_jsonb(j.generos) as game_genres,
      a.nota::numeric as score,
      a.texto_review as text_review,
      null::text as status_value,
      false as is_favorite,
      a.data_publicacao as activity_created_at
    from public.avaliacoes a
    join followed_users f on f.seguido_id = a.usuario_id
    join public.usuarios u on u.id = a.usuario_id
    join public.jogos j on j.id = a.jogo_id
    cross join viewer v
    where private.can_view_profile_restricted_content(a.usuario_id, v.id)

    union all

    select
      concat('status:', s.id::text) as activity_id,
      case when s.favorito then 'favorite' else 'status' end as activity_type,
      null::uuid as review_id,
      s.id as status_id,
      u.id as author_id,
      u.username as author_username,
      coalesce(nullif(u.nome_completo, ''), u.username) as author_name,
      u.avatar_path as author_avatar_path,
      j.id as game_id,
      j.titulo as game_title,
      j.capa_url as game_cover_url,
      to_jsonb(j.generos) as game_genres,
      null::numeric as score,
      null::text as text_review,
      s.status as status_value,
      coalesce(s.favorito, false) as is_favorite,
      s.created_at as activity_created_at
    from public.status_jogo s
    join followed_users f on f.seguido_id = s.usuario_id
    join public.usuarios u on u.id = s.usuario_id
    join public.jogos j on j.id = s.jogo_id
    cross join viewer v
    where private.can_view_profile_restricted_content(s.usuario_id, v.id)
  )
  select *
  from activities
  order by activity_created_at desc nulls last
  limit greatest(coalesce(activity_limit, 8), 0);
$$;;
