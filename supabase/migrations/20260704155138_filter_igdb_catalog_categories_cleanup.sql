delete from public.game_catalog_cache
where provider = 'igdb';

with disallowed_igdb_games as (
  select
    j.id,
    coalesce(
      j.metadados->'igdb'->>'game_type',
      j.metadados->'igdb'->>'category'
    )::integer as igdb_category
  from public.jogos j
  where j.source_primary = 'igdb'
    and coalesce(
      j.metadados->'igdb'->>'game_type',
      j.metadados->'igdb'->>'category'
    ) ~ '^[0-9]+$'
    and coalesce(
      j.metadados->'igdb'->>'game_type',
      j.metadados->'igdb'->>'category'
    )::integer not in (0, 1, 2, 4, 8, 9)
),
games_with_usage as (
  select d.id, d.igdb_category
  from disallowed_igdb_games d
  where exists (select 1 from public.avaliacoes a where a.jogo_id = d.id)
    or exists (select 1 from public.lista_desejos l where l.jogo_id = d.id)
    or exists (select 1 from public.status_jogo s where s.jogo_id = d.id)
    or exists (select 1 from public.comunidades c where c.jogo_id = d.id)
    or exists (select 1 from public.steam_owned_games so where so.jogo_id = d.id)
    or exists (select 1 from public.steam_app_achievements sa where sa.jogo_id = d.id)
)
update public.jogos j
set
  status_importacao = 'stale',
  updated_at = now(),
  metadados = jsonb_set(
    coalesce(j.metadados, '{}'::jsonb),
    '{igdb_catalog_cleanup}',
    jsonb_build_object(
      'reason', 'igdb_category_not_allowed',
      'category', g.igdb_category,
      'allowed_categories', jsonb_build_array(0, 1, 2, 4, 8, 9),
      'marked_stale_at', now()
    ),
    true
  )
from games_with_usage g
where j.id = g.id
  and coalesce(j.status_importacao, '') <> 'stale';

with disallowed_igdb_games as (
  select j.id
  from public.jogos j
  where j.source_primary = 'igdb'
    and coalesce(
      j.metadados->'igdb'->>'game_type',
      j.metadados->'igdb'->>'category'
    ) ~ '^[0-9]+$'
    and coalesce(
      j.metadados->'igdb'->>'game_type',
      j.metadados->'igdb'->>'category'
    )::integer not in (0, 1, 2, 4, 8, 9)
),
games_without_usage as (
  select d.id
  from disallowed_igdb_games d
  where not exists (select 1 from public.avaliacoes a where a.jogo_id = d.id)
    and not exists (select 1 from public.lista_desejos l where l.jogo_id = d.id)
    and not exists (select 1 from public.status_jogo s where s.jogo_id = d.id)
    and not exists (select 1 from public.comunidades c where c.jogo_id = d.id)
    and not exists (select 1 from public.steam_owned_games so where so.jogo_id = d.id)
    and not exists (select 1 from public.steam_app_achievements sa where sa.jogo_id = d.id)
)
delete from public.jogos j
using games_without_usage g
where j.id = g.id;

create or replace function public.search_catalog_games(
  p_query text default null,
  p_genres text[] default '{}'::text[],
  p_platforms text[] default '{}'::text[],
  p_developers text[] default '{}'::text[],
  p_sort text default 'release-desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id integer,
  titulo text,
  capa_url text,
  desenvolvedora text,
  generos text[],
  data_lancamento date,
  plataformas text[],
  average_rating numeric,
  review_count integer,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with normalized as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as query,
      coalesce(p_genres, '{}'::text[]) as genres,
      coalesce(p_platforms, '{}'::text[]) as platforms,
      coalesce(p_developers, '{}'::text[]) as developers,
      coalesce(nullif(p_sort, ''), 'release-desc') as sort_value,
      greatest(1, least(coalesce(p_limit, 20), 100)) as page_limit,
      greatest(0, coalesce(p_offset, 0)) as page_offset
  ),
  filtered as (
    select
      j.id,
      j.titulo,
      j.capa_url,
      j.desenvolvedora,
      j.generos,
      j.data_lancamento,
      j.plataformas,
      coalesce(es.media_usuarios, gr.average_rating) as average_rating,
      coalesce(es.reviews_count, gr.review_count, 0)::integer as review_count,
      n.sort_value,
      count(*) over() as total_count
    from public.jogos j
    cross join normalized n
    left join public.game_rating_summaries gr on gr.jogo_id = j.id
    left join public.jogo_estatisticas es on es.jogo_id = j.id
    where coalesce(j.status_importacao, '') <> 'stale'
      and (
        n.query is null
        or j.search_vector @@ websearch_to_tsquery('simple', n.query)
        or j.titulo ilike '%' || n.query || '%'
      )
      and (
        cardinality(n.genres) = 0
        or coalesce(j.generos, '{}'::text[]) @> n.genres
      )
      and (
        cardinality(n.platforms) = 0
        or coalesce(j.plataformas, '{}'::text[]) @> n.platforms
      )
      and (
        cardinality(n.developers) = 0
        or j.desenvolvedora = any(n.developers)
      )
  )
  select
    filtered.id,
    filtered.titulo,
    filtered.capa_url,
    filtered.desenvolvedora,
    filtered.generos,
    filtered.data_lancamento,
    filtered.plataformas,
    filtered.average_rating,
    filtered.review_count,
    filtered.total_count
  from filtered
  order by
    case when sort_value = 'rating-desc' then average_rating end desc nulls last,
    case when sort_value = 'rating-asc' then average_rating end asc nulls last,
    case when sort_value = 'release-asc' then data_lancamento end asc nulls last,
    case when sort_value = 'release-desc' or sort_value not in ('release-asc', 'rating-desc', 'rating-asc')
      then data_lancamento
    end desc nulls last,
    titulo asc,
    id asc
  limit (select page_limit from normalized)
  offset (select page_offset from normalized);
$$;

revoke all on function public.search_catalog_games(text, text[], text[], text[], text, integer, integer)
  from public;
grant execute on function public.search_catalog_games(text, text[], text[], text[], text, integer, integer)
  to anon, authenticated, service_role;

create or replace function public.get_catalog_facets(
  p_query text default null
)
returns table (
  category text,
  value text,
  result_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with normalized as (
    select nullif(btrim(coalesce(p_query, '')), '') as query
  ),
  filtered as (
    select j.generos, j.plataformas, j.desenvolvedora
    from public.jogos j
    cross join normalized n
    where coalesce(j.status_importacao, '') <> 'stale'
      and (
        n.query is null
        or j.search_vector @@ websearch_to_tsquery('simple', n.query)
        or j.titulo ilike '%' || n.query || '%'
      )
  ),
  facet_rows as (
    select 'genre'::text as category, btrim(genre.value) as value
    from filtered
    cross join lateral unnest(coalesce(filtered.generos, '{}'::text[])) as genre(value)
    union all
    select 'platform'::text as category, btrim(platform.value) as value
    from filtered
    cross join lateral unnest(coalesce(filtered.plataformas, '{}'::text[])) as platform(value)
    union all
    select 'developer'::text as category, btrim(filtered.desenvolvedora) as value
    from filtered
    where filtered.desenvolvedora is not null
  )
  select
    facet_rows.category,
    facet_rows.value,
    count(*) as result_count
  from facet_rows
  where facet_rows.value <> ''
  group by facet_rows.category, facet_rows.value
  order by facet_rows.category, facet_rows.value;
$$;

revoke all on function public.get_catalog_facets(text) from public;
grant execute on function public.get_catalog_facets(text) to anon, authenticated, service_role;

create or replace view public.jogos_lancamentos
with (security_invoker = true)
as
select
  j.id,
  j.titulo,
  j.slug,
  j.capa_url,
  j.data_lancamento,
  j.generos,
  j.plataformas,
  coalesce(es.media_usuarios, gr.average_rating) as average_rating,
  coalesce(es.reviews_count, gr.review_count, 0)::integer as review_count
from public.jogos j
left join public.jogo_estatisticas es on es.jogo_id = j.id
left join public.game_rating_summaries gr on gr.jogo_id = j.id
where j.data_lancamento is not null
  and coalesce(j.status_importacao, '') <> 'stale'
order by j.data_lancamento desc nulls last, j.id desc;

create or replace view public.jogos_populares
with (security_invoker = true)
as
select
  j.id,
  j.titulo,
  j.slug,
  j.capa_url,
  j.data_lancamento,
  j.generos,
  j.plataformas,
  coalesce(es.media_usuarios, gr.average_rating) as average_rating,
  coalesce(es.reviews_count, gr.review_count, 0)::integer as review_count,
  coalesce(es.popularidade_score, 0) as popularidade_score
from public.jogos j
left join public.jogo_estatisticas es on es.jogo_id = j.id
left join public.game_rating_summaries gr on gr.jogo_id = j.id
where coalesce(j.status_importacao, '') <> 'stale'
order by coalesce(es.popularidade_score, 0) desc, coalesce(es.reviews_count, gr.review_count, 0) desc, j.id desc;

create or replace view public.jogos_em_alta
with (security_invoker = true)
as
select
  j.id,
  j.titulo,
  j.slug,
  j.capa_url,
  j.data_lancamento,
  j.generos,
  j.plataformas,
  count(a.id)::integer as recent_review_count,
  max(a.data_publicacao) as latest_review_at,
  coalesce(es.media_usuarios, gr.average_rating) as average_rating,
  coalesce(es.reviews_count, gr.review_count, 0)::integer as review_count
from public.jogos j
left join public.avaliacoes a
  on a.jogo_id = j.id
  and a.data_publicacao >= now() - interval '30 days'
left join public.jogo_estatisticas es on es.jogo_id = j.id
left join public.game_rating_summaries gr on gr.jogo_id = j.id
where coalesce(j.status_importacao, '') <> 'stale'
group by
  j.id,
  j.titulo,
  j.slug,
  j.capa_url,
  j.data_lancamento,
  j.generos,
  j.plataformas,
  es.media_usuarios,
  es.reviews_count,
  gr.average_rating,
  gr.review_count
order by count(a.id) desc, max(a.data_publicacao) desc nulls last, j.id desc;

grant select on public.jogos_lancamentos to anon, authenticated;
grant select on public.jogos_populares to anon, authenticated;
grant select on public.jogos_em_alta to anon, authenticated;
grant select on public.jogos_lancamentos to service_role;
grant select on public.jogos_populares to service_role;
grant select on public.jogos_em_alta to service_role;

create or replace function public.get_home_active_communities(
  p_days_window integer default 7,
  p_limit integer default 6
)
returns table (
  community_id text,
  nome text,
  descricao text,
  banner_path text,
  tipo text,
  jogo_id bigint,
  jogo_title text,
  jogo_cover_url text,
  membros_count integer,
  posts_count integer,
  new_members_count integer,
  recent_posts_count integer,
  activity_score integer,
  created_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = 'public'
as $function$
declare
  community_active_filter text := '';
  post_active_filter text := '';
  query_sql text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comunidades'
      and column_name = 'deleted_at'
  ) then
    community_active_filter := 'and c.deleted_at is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comunidade_posts'
      and column_name = 'deleted_at'
  ) then
    post_active_filter := 'and cp.deleted_at is null';
  end if;

  query_sql := format($query$
    with recent_members as (
      select
        cm.comunidade_id,
        count(*)::integer as new_members_count
      from public.comunidade_membros cm
      where cm.entrou_em >= now() - make_interval(days => greatest($1, 1))
      group by cm.comunidade_id
    ),
    recent_posts as (
      select
        cp.comunidade_id,
        count(*)::integer as recent_posts_count
      from public.comunidade_posts cp
      where cp.created_at >= now() - make_interval(days => greatest($1, 1))
        %s
      group by cp.comunidade_id
    )
    select
      c.id::text as community_id,
      c.nome,
      c.descricao,
      c.banner_path,
      c.tipo,
      c.jogo_id::bigint,
      j.titulo as jogo_title,
      j.capa_url as jogo_cover_url,
      coalesce(c.membros_count, 0)::integer as membros_count,
      coalesce(c.posts_count, 0)::integer as posts_count,
      coalesce(rm.new_members_count, 0)::integer as new_members_count,
      coalesce(rp.recent_posts_count, 0)::integer as recent_posts_count,
      (
        coalesce(rm.new_members_count, 0) * 3 +
        coalesce(rp.recent_posts_count, 0) * 2 +
        coalesce(c.membros_count, 0)
      )::integer as activity_score,
      c.created_at
    from public.comunidades c
    left join public.jogos j on j.id = c.jogo_id
    left join recent_members rm on rm.comunidade_id = c.id
    left join recent_posts rp on rp.comunidade_id = c.id
    where coalesce(c.visibilidade, 'publica') = 'publica'
      and (
        c.jogo_id is null
        or j.id is null
        or coalesce(j.status_importacao, '') <> 'stale'
      )
      %s
    order by
      coalesce(rm.new_members_count, 0) desc,
      coalesce(rp.recent_posts_count, 0) desc,
      coalesce(c.membros_count, 0) desc,
      c.created_at desc
    limit greatest($2, 1)
  $query$, post_active_filter, community_active_filter);

  return query execute query_sql using p_days_window, p_limit;
end;
$function$;

create or replace function public.get_home_featured_recent_reviewed_games(
  days_window integer default 30,
  games_limit integer default 4
)
returns table (
  game_id integer,
  game_title text,
  game_cover_url text,
  game_genres jsonb,
  release_date text,
  recent_review_count integer,
  total_review_count integer,
  average_rating numeric,
  latest_review_at timestamp with time zone
)
language sql
stable
security definer
set search_path = 'public'
as $function$
  with viewer as (
    select auth.uid() as id
  ),
  visible_reviews as (
    select
      a.jogo_id,
      a.nota::numeric as nota,
      a.data_publicacao
    from public.avaliacoes a
    cross join viewer v
    where public.home_can_view_user_content(a.usuario_id, v.id)
  ),
  recent_stats as (
    select
      vr.jogo_id,
      count(*)::integer as review_count,
      avg(vr.nota) as average_rating,
      max(vr.data_publicacao) as latest_review_at
    from visible_reviews vr
    where vr.data_publicacao >= now() - make_interval(days => greatest(coalesce(days_window, 30), 1))
    group by vr.jogo_id
  ),
  fallback_stats as (
    select
      vr.jogo_id,
      count(*)::integer as review_count,
      avg(vr.nota) as average_rating,
      max(vr.data_publicacao) as latest_review_at
    from visible_reviews vr
    group by vr.jogo_id
  ),
  ranked_games as (
    select
      0 as sort_bucket,
      rs.jogo_id,
      rs.review_count as recent_review_count,
      rs.review_count as total_review_count,
      rs.average_rating,
      rs.latest_review_at
    from recent_stats rs

    union all

    select
      1 as sort_bucket,
      fs.jogo_id,
      0 as recent_review_count,
      fs.review_count as total_review_count,
      fs.average_rating,
      fs.latest_review_at
    from fallback_stats fs
    where not exists (
      select 1
      from recent_stats rs
      where rs.jogo_id = fs.jogo_id
    )
  )
  select
    j.id as game_id,
    j.titulo as game_title,
    j.capa_url as game_cover_url,
    to_jsonb(j.generos) as game_genres,
    j.data_lancamento::text as release_date,
    rg.recent_review_count,
    rg.total_review_count,
    rg.average_rating,
    rg.latest_review_at
  from ranked_games rg
  join public.jogos j
    on j.id = rg.jogo_id
    and coalesce(j.status_importacao, '') <> 'stale'
  order by
    rg.sort_bucket asc,
    rg.total_review_count desc,
    rg.average_rating desc nulls last,
    rg.latest_review_at desc nulls last,
    j.titulo asc
  limit greatest(coalesce(games_limit, 4), 0);
$function$;

create or replace function public.get_home_following_activities(
  activity_limit integer default 8
)
returns table (
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
  activity_created_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $function$
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
      and coalesce(j.status_importacao, '') <> 'stale'

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
      and coalesce(j.status_importacao, '') <> 'stale'
  )
  select *
  from activities
  order by activity_created_at desc nulls last
  limit greatest(coalesce(activity_limit, 8), 0);
$function$;

create or replace function public.get_home_trending_reviews(
  min_likes integer default 20,
  review_limit integer default 6,
  excluded_review_ids uuid[] default '{}'::uuid[]
)
returns table (
  review_id uuid,
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
  likes_count integer,
  published_at timestamp with time zone
)
language sql
stable
security definer
set search_path = 'public'
as $function$
  with viewer as (
    select auth.uid() as id
  ),
  like_counts as (
    select
      ac.avaliacao_id,
      count(*)::integer as likes_count
    from public.avaliacao_curtidas ac
    group by ac.avaliacao_id
  )
  select
    a.id as review_id,
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
    lc.likes_count,
    a.data_publicacao as published_at
  from public.avaliacoes a
  join like_counts lc on lc.avaliacao_id = a.id
  join public.usuarios u on u.id = a.usuario_id
  join public.jogos j on j.id = a.jogo_id
  cross join viewer v
  where lc.likes_count > greatest(coalesce(min_likes, 20), 0)
    and not (a.id = any(coalesce(excluded_review_ids, '{}'::uuid[])))
    and public.home_can_view_user_content(a.usuario_id, v.id)
    and coalesce(j.status_importacao, '') <> 'stale'
  order by lc.likes_count desc, a.data_publicacao desc nulls last
  limit greatest(coalesce(review_limit, 6), 0);
$function$;
