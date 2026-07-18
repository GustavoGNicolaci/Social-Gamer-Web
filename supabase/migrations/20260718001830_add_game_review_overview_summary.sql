create or replace function public.get_game_review_overview(
  p_game_id integer
)
returns table (
  game_id integer,
  review_count bigint,
  average_rating numeric,
  comment_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
rows 1
as $function$
begin
  if p_game_id is null or p_game_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_game_id must be a positive integer';
  end if;

  return query
  with visible_reviews as (
    select
      review.id,
      review.nota
    from public.avaliacoes as review
    where review.jogo_id = p_game_id
      and review.data_publicacao is not null
  ),
  review_summary as (
    select
      count(*)::bigint as review_count,
      avg(visible_review.nota)::numeric as average_rating
    from visible_reviews as visible_review
  ),
  comment_summary as (
    select count(comment.id)::bigint as comment_count
    from visible_reviews as visible_review
    join public.comentarios as comment
      on comment.review_id = visible_review.id
  )
  select
    p_game_id,
    review_summary.review_count,
    review_summary.average_rating,
    comment_summary.comment_count
  from review_summary
  cross join comment_summary;
end;
$function$;

revoke all privileges
on function public.get_game_review_overview(integer)
from public;

grant execute
on function public.get_game_review_overview(integer)
to anon, authenticated, service_role;

comment on function public.get_game_review_overview(integer) is
  'Returns the public review count, average score, and exact public comment count for one game.';
