revoke all on public.game_rating_summaries from PUBLIC;
revoke all on public.game_rating_summaries from anon;
revoke all on public.game_rating_summaries from authenticated;

grant select on public.game_rating_summaries to anon, authenticated;;
