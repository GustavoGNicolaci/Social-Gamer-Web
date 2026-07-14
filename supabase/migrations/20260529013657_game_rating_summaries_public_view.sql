create or replace view public.game_rating_summaries
with (security_invoker = true)
as
select
  jogo_id,
  count(*)::integer as review_count,
  avg(nota)::numeric as average_rating
from public.avaliacoes
where jogo_id is not null
  and nota is not null
group by jogo_id;

revoke all on public.game_rating_summaries from public;
grant select on public.game_rating_summaries to anon, authenticated;;
