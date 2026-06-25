create table if not exists public.game_catalog_cache (
  cache_key text primary key,
  provider text not null default 'igdb',
  request jsonb not null default '{}'::jsonb,
  game_ids integer[] not null default '{}'::integer[],
  has_next_page boolean not null default false,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint game_catalog_cache_provider_check
    check (provider in ('igdb')),
  constraint game_catalog_cache_game_ids_check
    check (array_position(game_ids, null) is null)
);

create table if not exists public.game_translations (
  id bigint generated always as identity primary key,
  jogo_id integer not null references public.jogos(id) on delete cascade,
  provider text not null default 'deepl',
  field text not null,
  source_locale text not null default 'en-US',
  target_locale text not null,
  source_hash text not null,
  translated_text text,
  status text not null default 'ready',
  error_message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint game_translations_provider_check
    check (provider in ('deepl')),
  constraint game_translations_field_check
    check (field in ('description', 'short_description')),
  constraint game_translations_source_locale_check
    check (source_locale in ('en-US')),
  constraint game_translations_target_locale_check
    check (target_locale in ('pt-BR')),
  constraint game_translations_status_check
    check (status in ('ready', 'error')),
  constraint game_translations_ready_text_check
    check (
      (status = 'ready' and translated_text is not null and btrim(translated_text) <> '')
      or status = 'error'
    ),
  constraint game_translations_unique_source
    unique (jogo_id, field, target_locale, source_hash)
);

create index if not exists game_catalog_cache_expires_at_idx
  on public.game_catalog_cache (expires_at);

create index if not exists game_catalog_cache_provider_expires_at_idx
  on public.game_catalog_cache (provider, expires_at);

create index if not exists game_translations_jogo_id_idx
  on public.game_translations (jogo_id);

create index if not exists game_translations_target_locale_idx
  on public.game_translations (target_locale);

create index if not exists game_translations_lookup_idx
  on public.game_translations (jogo_id, field, target_locale, source_hash);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'game_catalog_cache',
    'game_translations'
  ]
  loop
    if not exists (
      select 1 from pg_trigger
      where tgname = 'set_' || table_name || '_updated_at'
        and tgrelid = ('public.' || table_name)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
        'set_' || table_name || '_updated_at',
        table_name
      );
    end if;
  end loop;
end $$;

alter table public.game_catalog_cache enable row level security;
alter table public.game_translations enable row level security;

revoke all on table
  public.game_catalog_cache,
  public.game_translations
from anon, authenticated;

grant all on table
  public.game_catalog_cache,
  public.game_translations
to service_role;

grant usage, select on sequence public.game_translations_id_seq to service_role;

comment on table public.game_catalog_cache is
  'Backend-only cache for IGDB catalog/search responses. Frontend must use Edge Functions.';

comment on table public.game_translations is
  'Backend-only cache for localized game text generated from external providers.';
