-- Expose only an already-generated catalog translation that matches the exact
-- game, field, locale and source hash. The backing cache remains inaccessible
-- to Data API roles, and this function cannot write or trigger translation.
create or replace function public.get_catalog_translation(
  p_game_id integer,
  p_field text,
  p_target_locale text,
  p_source_hash text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select translations.translated_text
  from public.game_translations as translations
  where translations.jogo_id = p_game_id
    and translations.field = p_field
    and translations.target_locale = p_target_locale
    and translations.source_hash = p_source_hash
    and translations.status = 'ready'
    and p_field in ('description', 'short_description')
    and p_target_locale = 'pt-BR'
  limit 1;
$$;

revoke all on function public.get_catalog_translation(integer, text, text, text)
from public, anon, authenticated;

grant execute on function public.get_catalog_translation(integer, text, text, text)
to anon, authenticated, service_role;

comment on function public.get_catalog_translation(integer, text, text, text) is
  'Returns one ready catalog translation by exact source hash without exposing the backend translation cache.';
