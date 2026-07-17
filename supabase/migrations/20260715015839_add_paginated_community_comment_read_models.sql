-- Paginated community comment read models. These functions deliberately run
-- with the caller's privileges so the existing community RLS remains the
-- source of truth for public and private communities.

create or replace function public.get_community_post_comment_previews(
  p_post_ids uuid[],
  p_limit_per_post integer default 2
)
returns table (
  post_id uuid,
  id uuid,
  comunidade_id uuid,
  autor_id uuid,
  texto text,
  created_at timestamptz,
  updated_at timestamptz,
  author_username text,
  author_name text,
  author_avatar_path text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested_input as materialized (
    select input.post_id, input.ordinality
    from unnest(coalesce(p_post_ids[1:30], array[]::uuid[]))
      with ordinality as input(post_id, ordinality)
    where input.post_id is not null
  ), requested_posts as (
    select input.post_id, min(input.ordinality) as input_order
    from requested_input input
    group by input.post_id
    order by min(input.ordinality)
  ), ranked_comments as (
    select
      requested.input_order,
      comment.post_id,
      comment.id,
      comment.comunidade_id,
      comment.autor_id,
      comment.texto,
      comment.created_at,
      comment.updated_at,
      author.username as author_username,
      author.nome_completo as author_name,
      author.avatar_path as author_avatar_path,
      count(*) over (partition by comment.post_id) as total_count,
      row_number() over (
        partition by comment.post_id
        order by comment.created_at asc, comment.id asc
      ) as row_number
    from requested_posts requested
    join public.comunidade_post_comentarios comment
      on comment.post_id = requested.post_id
    left join public.usuarios author
      on author.id = comment.autor_id
    where comment.deleted_at is null
  )
  select
    ranked.post_id,
    ranked.id,
    ranked.comunidade_id,
    ranked.autor_id,
    ranked.texto,
    ranked.created_at,
    ranked.updated_at,
    ranked.author_username,
    ranked.author_name,
    ranked.author_avatar_path,
    ranked.total_count
  from ranked_comments ranked
  where ranked.row_number <= least(greatest(coalesce(p_limit_per_post, 2), 1), 4)
  order by ranked.input_order, ranked.created_at asc, ranked.id asc;
$$;

create or replace function public.get_community_post_comments_page(
  p_post_id uuid,
  p_limit integer default 4,
  p_offset integer default 0
)
returns table (
  id uuid,
  post_id uuid,
  comunidade_id uuid,
  autor_id uuid,
  texto text,
  created_at timestamptz,
  updated_at timestamptz,
  author_username text,
  author_name text,
  author_avatar_path text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    comment.id,
    comment.post_id,
    comment.comunidade_id,
    comment.autor_id,
    comment.texto,
    comment.created_at,
    comment.updated_at,
    author.username as author_username,
    author.nome_completo as author_name,
    author.avatar_path as author_avatar_path,
    count(*) over () as total_count
  from public.comunidade_post_comentarios comment
  left join public.usuarios author
    on author.id = comment.autor_id
  where comment.post_id = p_post_id
    and comment.deleted_at is null
  order by comment.created_at asc, comment.id asc
  limit least(greatest(coalesce(p_limit, 4), 1), 20)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_community_comment_anchor(
  p_post_id uuid,
  p_comment_id uuid,
  p_limit integer default 4
)
returns table (
  found boolean,
  comment_offset bigint,
  page_offset bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target as (
    select comment.created_at, comment.id
    from public.comunidade_post_comentarios comment
    where comment.post_id = p_post_id
      and comment.id = p_comment_id
      and comment.deleted_at is null
  ), position as (
    select count(*)::bigint as comment_offset
    from public.comunidade_post_comentarios comment
    cross join target
    where comment.post_id = p_post_id
      and comment.deleted_at is null
      and (comment.created_at, comment.id) < (target.created_at, target.id)
  )
  select
    exists(select 1 from target) as found,
    case when exists(select 1 from target) then position.comment_offset else null end,
    case
      when exists(select 1 from target) then
        (position.comment_offset / least(greatest(coalesce(p_limit, 4), 1), 20))
        * least(greatest(coalesce(p_limit, 4), 1), 20)
      else null
    end as page_offset,
    (
      select count(*)::bigint
      from public.comunidade_post_comentarios comment
      where comment.post_id = p_post_id
        and comment.deleted_at is null
    ) as total_count
  from position;
$$;

revoke all on function public.get_community_post_comment_previews(uuid[], integer) from public;
revoke all on function public.get_community_post_comments_page(uuid, integer, integer) from public;
revoke all on function public.get_community_comment_anchor(uuid, uuid, integer) from public;

grant execute on function public.get_community_post_comment_previews(uuid[], integer)
  to anon, authenticated;
grant execute on function public.get_community_post_comments_page(uuid, integer, integer)
  to anon, authenticated;
grant execute on function public.get_community_comment_anchor(uuid, uuid, integer)
  to anon, authenticated;
