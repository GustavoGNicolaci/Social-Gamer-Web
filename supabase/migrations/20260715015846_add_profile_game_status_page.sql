-- Server-side sorting must happen before LIMIT/OFFSET. SECURITY INVOKER keeps
-- the profile privacy policy on status_jogo as the authorization boundary.

create or replace function public.get_profile_game_status_page(
  p_user_id uuid,
  p_statuses text[] default null,
  p_sort text default 'recent',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  usuario_id uuid,
  jogo_id integer,
  status text,
  created_at timestamptz,
  favorito boolean,
  game_title text,
  game_cover_url text,
  game_developer text,
  game_genres text[],
  game_release_date date,
  game_platforms text[],
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with normalized_input as (
    select
      case
        when lower(coalesce(p_sort, 'recent')) in ('recent', 'oldest', 'favorites', 'title')
          then lower(coalesce(p_sort, 'recent'))
        else 'recent'
      end as sort_value,
      least(greatest(coalesce(p_limit, 24), 1), 60) as page_limit,
      greatest(coalesce(p_offset, 0), 0) as page_offset,
      array(
        select distinct normalized_status
        from (
          select raw_input.status_value
          from unnest(coalesce(p_statuses[1:32], array[]::text[]))
            with ordinality as raw_input(status_value, ordinality)
          where raw_input.status_value is not null
        ) input
        cross join lateral (
          select lower(btrim(input.status_value)) as normalized_status
        ) normalized
        where normalized_status in ('jogando', 'zerado', 'dropado', 'planejando', 'pausado')
      ) as status_filters
  )
  select
    game_status.id,
    game_status.usuario_id,
    game_status.jogo_id,
    game_status.status,
    game_status.created_at,
    coalesce(game_status.favorito, false) as favorito,
    game.titulo as game_title,
    game.capa_url as game_cover_url,
    game.desenvolvedora as game_developer,
    game.generos as game_genres,
    game.data_lancamento as game_release_date,
    game.plataformas as game_platforms,
    count(*) over () as total_count
  from public.status_jogo game_status
  join public.jogos game
    on game.id = game_status.jogo_id
  cross join normalized_input input
  where game_status.usuario_id = p_user_id
    and (
      cardinality(input.status_filters) = 0
      or game_status.status = any(input.status_filters)
    )
  order by
    case when input.sort_value = 'favorites' then coalesce(game_status.favorito, false) end desc,
    case when input.sort_value = 'title' then lower(game.titulo) end asc nulls last,
    case when input.sort_value = 'oldest' then game_status.created_at end asc nulls first,
    case when input.sort_value = 'recent' then game_status.created_at end desc nulls last,
    case
      when input.sort_value in ('recent', 'oldest', 'title')
        then coalesce(game_status.favorito, false)
    end desc,
    case
      when input.sort_value in ('favorites', 'title')
        then game_status.created_at
    end desc nulls last,
    case
      when input.sort_value in ('recent', 'oldest', 'favorites')
        then lower(game.titulo)
    end asc nulls last,
    game_status.id desc
  limit (select page_limit from normalized_input)
  offset (select page_offset from normalized_input);
$$;

revoke all on function public.get_profile_game_status_page(uuid, text[], text, integer, integer)
  from public;
grant execute on function public.get_profile_game_status_page(uuid, text[], text, integer, integer)
  to anon, authenticated;
