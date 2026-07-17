-- Public game review read models. Reaction rows are aggregated inside these
-- SECURITY DEFINER functions so callers never receive reacting user identities.

create or replace function public.get_game_reviews_page(
  p_game_id integer,
  p_limit integer default 4,
  p_offset integer default 0
)
returns table (
  review_id uuid,
  game_id integer,
  author_id uuid,
  author_username text,
  author_name text,
  author_avatar_path text,
  score numeric,
  review_text text,
  published_at timestamp with time zone,
  edited_at timestamp with time zone,
  likes_count integer,
  dislikes_count integer,
  comments_count integer,
  liked_by_current_user boolean,
  disliked_by_current_user boolean,
  current_user_report_id uuid,
  current_user_report_reason text,
  current_user_report_description text,
  current_user_report_status text,
  current_user_report_created_at timestamp with time zone,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 4), 1), 20);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_user_id uuid := auth.uid();
begin
  if p_game_id is null then
    raise exception 'game_id_required' using errcode = '22023';
  end if;

  return query
  with selected_reviews as (
    select
      review.id as review_id,
      review.jogo_id as game_id,
      review.usuario_id as author_id,
      author.username as author_username,
      author.nome_completo as author_name,
      author.avatar_path as author_avatar_path,
      review.nota as score,
      review.texto_review as review_text,
      review.data_publicacao as published_at,
      review.editado_em as edited_at
    from public.avaliacoes as review
    join public.usuarios as author
      on author.id = review.usuario_id
    where review.jogo_id = p_game_id
      and review.data_publicacao is not null
  ),
  review_like_counts as (
    select
      reaction.avaliacao_id as review_id,
      count(*)::integer as likes_count,
      coalesce(
        bool_or(v_user_id is not null and reaction.usuario_id = v_user_id),
        false
      ) as liked_by_current_user
    from public.avaliacao_curtidas as reaction
    join selected_reviews as review
      on review.review_id = reaction.avaliacao_id
    group by reaction.avaliacao_id
  ),
  review_dislike_counts as (
    select
      reaction.avaliacao_id as review_id,
      count(*)::integer as dislikes_count,
      coalesce(
        bool_or(v_user_id is not null and reaction.usuario_id = v_user_id),
        false
      ) as disliked_by_current_user
    from public.avaliacao_deslikes as reaction
    join selected_reviews as review
      on review.review_id = reaction.avaliacao_id
    group by reaction.avaliacao_id
  ),
  review_comment_counts as (
    select
      comment.review_id,
      count(*)::integer as comments_count
    from public.comentarios as comment
    join selected_reviews as review
      on review.review_id = comment.review_id
    group by comment.review_id
  ),
  review_rows as (
    select
      review.review_id,
      review.game_id,
      review.author_id,
      review.author_username,
      review.author_name,
      review.author_avatar_path,
      review.score,
      review.review_text,
      review.published_at,
      review.edited_at,
      coalesce(likes.likes_count, 0)::integer as likes_count,
      coalesce(dislikes.dislikes_count, 0)::integer as dislikes_count,
      coalesce(comments.comments_count, 0)::integer as comments_count,
      coalesce(likes.liked_by_current_user, false) as liked_by_current_user,
      coalesce(dislikes.disliked_by_current_user, false) as disliked_by_current_user
    from selected_reviews as review
    left join review_like_counts as likes
      on likes.review_id = review.review_id
    left join review_dislike_counts as dislikes
      on dislikes.review_id = review.review_id
    left join review_comment_counts as comments
      on comments.review_id = review.review_id
  ),
  page_rows as (
    select
      review.*,
      count(*) over ()::bigint as total_count
    from review_rows as review
    order by
      review.likes_count desc,
      review.published_at desc nulls last,
      review.review_id desc
    limit v_limit
    offset v_offset
  ),
  current_user_reports as (
    select distinct on (report.avaliacao_id)
      report.avaliacao_id as review_id,
      report.id as report_id,
      report.motivo::text as report_reason,
      report.descricao as report_description,
      report.status::text as report_status,
      report.created_at as report_created_at
    from public.denuncias_conteudo as report
    join page_rows as review
      on review.review_id = report.avaliacao_id
    where v_user_id is not null
      and report.denunciante_id = v_user_id
      and report.tipo_conteudo = 'review'::public.tipo_denuncia_conteudo
    order by report.avaliacao_id, report.created_at desc, report.id desc
  )
  select
    review.review_id,
    review.game_id,
    review.author_id,
    review.author_username,
    review.author_name,
    review.author_avatar_path,
    review.score,
    review.review_text,
    review.published_at,
    review.edited_at,
    review.likes_count,
    review.dislikes_count,
    review.comments_count,
    review.liked_by_current_user,
    review.disliked_by_current_user,
    report.report_id as current_user_report_id,
    report.report_reason as current_user_report_reason,
    report.report_description as current_user_report_description,
    report.report_status as current_user_report_status,
    report.report_created_at as current_user_report_created_at,
    review.total_count
  from page_rows as review
  left join current_user_reports as report
    on report.review_id = review.review_id
  order by
    review.likes_count desc,
    review.published_at desc nulls last,
    review.review_id desc;
end;
$function$;

create or replace function public.get_review_comments_page(
  p_review_id uuid,
  p_limit integer default 4,
  p_offset integer default 0
)
returns table (
  comment_id uuid,
  review_id uuid,
  author_id uuid,
  author_username text,
  author_name text,
  author_avatar_path text,
  comment_text text,
  published_at timestamp with time zone,
  edited_at timestamp with time zone,
  likes_count integer,
  dislikes_count integer,
  liked_by_current_user boolean,
  disliked_by_current_user boolean,
  current_user_report_id uuid,
  current_user_report_reason text,
  current_user_report_description text,
  current_user_report_status text,
  current_user_report_created_at timestamp with time zone,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 4), 1), 20);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_user_id uuid := auth.uid();
begin
  if p_review_id is null then
    raise exception 'review_id_required' using errcode = '22023';
  end if;

  return query
  with selected_comments as (
    select
      comment.id as comment_id,
      comment.review_id,
      comment.usuario_id as author_id,
      author.username as author_username,
      author.nome_completo as author_name,
      author.avatar_path as author_avatar_path,
      comment.texto as comment_text,
      comment.data_comentario as published_at,
      comment.editado_em as edited_at
    from public.comentarios as comment
    join public.usuarios as author
      on author.id = comment.usuario_id
    where comment.review_id = p_review_id
  ),
  comment_like_counts as (
    select
      reaction.comentario_id as comment_id,
      count(*)::integer as likes_count,
      coalesce(
        bool_or(v_user_id is not null and reaction.usuario_id = v_user_id),
        false
      ) as liked_by_current_user
    from public.comentario_curtidas as reaction
    join selected_comments as comment
      on comment.comment_id = reaction.comentario_id
    group by reaction.comentario_id
  ),
  comment_dislike_counts as (
    select
      reaction.comentario_id as comment_id,
      count(*)::integer as dislikes_count,
      coalesce(
        bool_or(v_user_id is not null and reaction.usuario_id = v_user_id),
        false
      ) as disliked_by_current_user
    from public.comentario_deslikes as reaction
    join selected_comments as comment
      on comment.comment_id = reaction.comentario_id
    group by reaction.comentario_id
  ),
  comment_rows as (
    select
      comment.comment_id,
      comment.review_id,
      comment.author_id,
      comment.author_username,
      comment.author_name,
      comment.author_avatar_path,
      comment.comment_text,
      comment.published_at,
      comment.edited_at,
      coalesce(likes.likes_count, 0)::integer as likes_count,
      coalesce(dislikes.dislikes_count, 0)::integer as dislikes_count,
      coalesce(likes.liked_by_current_user, false) as liked_by_current_user,
      coalesce(dislikes.disliked_by_current_user, false) as disliked_by_current_user
    from selected_comments as comment
    left join comment_like_counts as likes
      on likes.comment_id = comment.comment_id
    left join comment_dislike_counts as dislikes
      on dislikes.comment_id = comment.comment_id
  ),
  page_rows as (
    select
      comment.*,
      count(*) over ()::bigint as total_count
    from comment_rows as comment
    order by
      comment.likes_count desc,
      comment.published_at desc,
      comment.comment_id desc
    limit v_limit
    offset v_offset
  ),
  current_user_reports as (
    select distinct on (report.comentario_id)
      report.comentario_id as comment_id,
      report.id as report_id,
      report.motivo::text as report_reason,
      report.descricao as report_description,
      report.status::text as report_status,
      report.created_at as report_created_at
    from public.denuncias_conteudo as report
    join page_rows as comment
      on comment.comment_id = report.comentario_id
    where v_user_id is not null
      and report.denunciante_id = v_user_id
      and report.tipo_conteudo = 'comment'::public.tipo_denuncia_conteudo
    order by report.comentario_id, report.created_at desc, report.id desc
  )
  select
    comment.comment_id,
    comment.review_id,
    comment.author_id,
    comment.author_username,
    comment.author_name,
    comment.author_avatar_path,
    comment.comment_text,
    comment.published_at,
    comment.edited_at,
    comment.likes_count,
    comment.dislikes_count,
    comment.liked_by_current_user,
    comment.disliked_by_current_user,
    report.report_id as current_user_report_id,
    report.report_reason as current_user_report_reason,
    report.report_description as current_user_report_description,
    report.report_status as current_user_report_status,
    report.report_created_at as current_user_report_created_at,
    comment.total_count
  from page_rows as comment
  left join current_user_reports as report
    on report.comment_id = comment.comment_id
  order by
    comment.likes_count desc,
    comment.published_at desc,
    comment.comment_id desc;
end;
$function$;

create or replace function public.get_game_review_anchor(
  p_game_id integer,
  p_review_id uuid default null,
  p_comment_id uuid default null
)
returns table (
  target_type text,
  review_id uuid,
  comment_id uuid,
  review_offset bigint,
  comment_offset bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_resolved_review_id uuid;
begin
  if p_game_id is null then
    raise exception 'game_id_required' using errcode = '22023';
  end if;

  if p_review_id is null and p_comment_id is null then
    raise exception 'review_or_comment_id_required' using errcode = '22023';
  end if;

  if p_comment_id is not null then
    select comment.review_id
    into v_resolved_review_id
    from public.comentarios as comment
    join public.avaliacoes as review
      on review.id = comment.review_id
    where comment.id = p_comment_id
      and review.jogo_id = p_game_id
      and review.data_publicacao is not null
      and (p_review_id is null or comment.review_id = p_review_id);
  else
    select review.id
    into v_resolved_review_id
    from public.avaliacoes as review
    where review.id = p_review_id
      and review.jogo_id = p_game_id
      and review.data_publicacao is not null;
  end if;

  if v_resolved_review_id is null then
    return;
  end if;

  return query
  with review_rows as (
    select
      review.id as review_id,
      review.data_publicacao as published_at,
      (
        select count(*)::integer
        from public.avaliacao_curtidas as reaction
        where reaction.avaliacao_id = review.id
      ) as likes_count
    from public.avaliacoes as review
    where review.jogo_id = p_game_id
      and review.data_publicacao is not null
  ),
  ranked_reviews as (
    select
      review.review_id,
      row_number() over (
        order by
          review.likes_count desc,
          review.published_at desc nulls last,
          review.review_id desc
      ) - 1::bigint as review_offset
    from review_rows as review
  ),
  comment_rows as (
    select
      comment.id as comment_id,
      comment.data_comentario as published_at,
      (
        select count(*)::integer
        from public.comentario_curtidas as reaction
        where reaction.comentario_id = comment.id
      ) as likes_count
    from public.comentarios as comment
    where comment.review_id = v_resolved_review_id
  ),
  ranked_comments as (
    select
      comment.comment_id,
      row_number() over (
        order by
          comment.likes_count desc,
          comment.published_at desc,
          comment.comment_id desc
      ) - 1::bigint as comment_offset
    from comment_rows as comment
  )
  select
    case when p_comment_id is null then 'review'::text else 'comment'::text end,
    review.review_id,
    comment.comment_id,
    review.review_offset,
    comment.comment_offset
  from ranked_reviews as review
  left join ranked_comments as comment
    on p_comment_id is not null
   and comment.comment_id = p_comment_id
  where review.review_id = v_resolved_review_id
    and (p_comment_id is null or comment.comment_id is not null);
end;
$function$;

revoke all privileges on function public.get_game_reviews_page(integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.get_game_reviews_page(integer, integer, integer)
to anon, authenticated;

revoke all privileges on function public.get_review_comments_page(uuid, integer, integer)
from public, anon, authenticated;
grant execute on function public.get_review_comments_page(uuid, integer, integer)
to anon, authenticated;

revoke all privileges on function public.get_game_review_anchor(integer, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_game_review_anchor(integer, uuid, uuid)
to anon, authenticated;

comment on function public.get_game_reviews_page(integer, integer, integer) is
  'Returns one bounded public review page with aggregate interactions and only the caller report state.';
comment on function public.get_review_comments_page(uuid, integer, integer) is
  'Returns one bounded public comment page with aggregate interactions and only the caller report state.';
comment on function public.get_game_review_anchor(integer, uuid, uuid) is
  'Resolves zero-based review/comment offsets under the same stable relevance ordering used by the page functions.';
