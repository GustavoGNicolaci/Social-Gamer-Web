create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

alter table public.jogos
  add column if not exists slug text,
  add column if not exists descricao_curta text,
  add column if not exists source_primary text not null default 'manual',
  add column if not exists external_updated_at timestamp with time zone,
  add column if not exists status_importacao text not null default 'manual',
  add column if not exists nota_media_externa numeric(6, 2),
  add column if not exists nota_media_externa_count integer not null default 0,
  add column if not exists metadados jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now(),
  add column if not exists search_vector tsvector;

create or replace function private.set_jogos_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := to_tsvector(
    'simple',
    coalesce(new.titulo, '') || ' ' ||
    coalesce(new.descricao_curta, '') || ' ' ||
    coalesce(new.descricao, '') || ' ' ||
    coalesce(new.desenvolvedora, '') || ' ' ||
    coalesce(array_to_string(new.generos, ' '), '') || ' ' ||
    coalesce(array_to_string(new.plataformas, ' '), '')
  );

  return new;
end;
$$;

revoke all on function private.set_jogos_search_vector() from public, anon, authenticated;

update public.jogos
set search_vector = to_tsvector(
  'simple',
  coalesce(titulo, '') || ' ' ||
  coalesce(descricao_curta, '') || ' ' ||
  coalesce(descricao, '') || ' ' ||
  coalesce(desenvolvedora, '') || ' ' ||
  coalesce(array_to_string(generos, ' '), '') || ' ' ||
  coalesce(array_to_string(plataformas, ' '), '')
)
where search_vector is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jogos_source_primary_check'
      and conrelid = 'public.jogos'::regclass
  ) then
    alter table public.jogos
      add constraint jogos_source_primary_check
      check (source_primary in ('manual', 'igdb', 'rawg', 'steam', 'mobygames'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'jogos_status_importacao_check'
      and conrelid = 'public.jogos'::regclass
  ) then
    alter table public.jogos
      add constraint jogos_status_importacao_check
      check (status_importacao in ('manual', 'imported', 'pending', 'stale', 'error'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'jogos_nota_media_externa_count_check'
      and conrelid = 'public.jogos'::regclass
  ) then
    alter table public.jogos
      add constraint jogos_nota_media_externa_count_check
      check (nota_media_externa_count >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_jogos_search_vector'
      and tgrelid = 'public.jogos'::regclass
  ) then
    create trigger set_jogos_search_vector
      before insert or update of titulo, descricao_curta, descricao, desenvolvedora, generos, plataformas
      on public.jogos
      for each row
      execute function private.set_jogos_search_vector();
  end if;
end $$;

create unique index if not exists jogos_slug_unique_idx
  on public.jogos (slug)
  where slug is not null;

create index if not exists jogos_search_vector_idx
  on public.jogos using gin (search_vector);

create index if not exists jogos_source_primary_idx
  on public.jogos (source_primary);

create index if not exists jogos_status_importacao_idx
  on public.jogos (status_importacao);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_jogos_updated_at'
      and tgrelid = 'public.jogos'::regclass
  ) then
    create trigger set_jogos_updated_at
      before update on public.jogos
      for each row
      execute function private.set_updated_at();
  end if;
end $$;

create table if not exists public.game_external_ids (
  id bigint generated always as identity primary key,
  jogo_id integer not null references public.jogos(id) on delete cascade,
  provider text not null,
  external_id text not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint game_external_ids_provider_check
    check (provider in ('igdb', 'rawg', 'steam', 'mobygames', 'manual')),
  constraint game_external_ids_provider_external_id_key unique (provider, external_id)
);

create table if not exists public.plataformas (
  id bigint generated always as identity primary key,
  nome text not null,
  slug text not null unique,
  provider text,
  external_id text,
  logo_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.generos (
  id bigint generated always as identity primary key,
  nome text not null,
  slug text not null unique,
  provider text,
  external_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.empresas (
  id bigint generated always as identity primary key,
  nome text not null,
  slug text not null unique,
  provider text,
  external_id text,
  logo_url text,
  site_url text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.tags (
  id bigint generated always as identity primary key,
  nome text not null,
  slug text not null unique,
  provider text,
  external_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.modos_jogo (
  id bigint generated always as identity primary key,
  nome text not null,
  slug text not null unique,
  provider text,
  external_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.jogo_plataformas (
  jogo_id integer not null references public.jogos(id) on delete cascade,
  plataforma_id bigint not null references public.plataformas(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (jogo_id, plataforma_id)
);

create table if not exists public.jogo_generos (
  jogo_id integer not null references public.jogos(id) on delete cascade,
  genero_id bigint not null references public.generos(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (jogo_id, genero_id)
);

create table if not exists public.jogo_empresas (
  jogo_id integer not null references public.jogos(id) on delete cascade,
  empresa_id bigint not null references public.empresas(id) on delete cascade,
  papel text not null,
  created_at timestamp with time zone not null default now(),
  primary key (jogo_id, empresa_id, papel),
  constraint jogo_empresas_papel_check
    check (papel in ('developer', 'publisher', 'supporting', 'other'))
);

create table if not exists public.jogo_tags (
  jogo_id integer not null references public.jogos(id) on delete cascade,
  tag_id bigint not null references public.tags(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (jogo_id, tag_id)
);

create table if not exists public.jogo_modos_jogo (
  jogo_id integer not null references public.jogos(id) on delete cascade,
  modo_jogo_id bigint not null references public.modos_jogo(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (jogo_id, modo_jogo_id)
);

create table if not exists public.jogo_midias (
  id bigint generated always as identity primary key,
  jogo_id integer not null references public.jogos(id) on delete cascade,
  tipo text not null,
  url text not null,
  thumbnail_url text,
  provider text,
  external_media_id text,
  width integer,
  height integer,
  ordem integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint jogo_midias_tipo_check
    check (tipo in ('cover', 'screenshot', 'artwork', 'video')),
  constraint jogo_midias_width_check
    check (width is null or width > 0),
  constraint jogo_midias_height_check
    check (height is null or height > 0)
);

create table if not exists public.jogo_estatisticas (
  jogo_id integer primary key references public.jogos(id) on delete cascade,
  media_usuarios numeric(4, 2),
  reviews_count integer not null default 0,
  wishlist_count integer not null default 0,
  status_count integer not null default 0,
  popularidade_score numeric(12, 4) not null default 0,
  last_calculated_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint jogo_estatisticas_counts_check
    check (reviews_count >= 0 and wishlist_count >= 0 and status_count >= 0)
);

create unique index if not exists game_external_ids_jogo_provider_external_idx
  on public.game_external_ids (jogo_id, provider, external_id);

create index if not exists game_external_ids_jogo_id_idx
  on public.game_external_ids (jogo_id);

create unique index if not exists plataformas_provider_external_idx
  on public.plataformas (provider, external_id)
  where external_id is not null;

create unique index if not exists generos_provider_external_idx
  on public.generos (provider, external_id)
  where external_id is not null;

create unique index if not exists empresas_provider_external_idx
  on public.empresas (provider, external_id)
  where external_id is not null;

create unique index if not exists tags_provider_external_idx
  on public.tags (provider, external_id)
  where external_id is not null;

create unique index if not exists modos_jogo_provider_external_idx
  on public.modos_jogo (provider, external_id)
  where external_id is not null;

create index if not exists jogo_plataformas_plataforma_id_idx
  on public.jogo_plataformas (plataforma_id);

create index if not exists jogo_generos_genero_id_idx
  on public.jogo_generos (genero_id);

create index if not exists jogo_empresas_empresa_id_idx
  on public.jogo_empresas (empresa_id);

create index if not exists jogo_tags_tag_id_idx
  on public.jogo_tags (tag_id);

create index if not exists jogo_modos_jogo_modo_jogo_id_idx
  on public.jogo_modos_jogo (modo_jogo_id);

create index if not exists jogo_midias_jogo_id_tipo_idx
  on public.jogo_midias (jogo_id, tipo, ordem);

create unique index if not exists jogo_midias_provider_external_idx
  on public.jogo_midias (provider, external_media_id)
  where external_media_id is not null;

create index if not exists jogo_estatisticas_popularidade_idx
  on public.jogo_estatisticas (popularidade_score desc, jogo_id);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  display_name text,
  status text not null default 'connected',
  visibility text not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamp with time zone not null default now(),
  disconnected_at timestamp with time zone,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_integrations_provider_check
    check (provider in ('steam')),
  constraint user_integrations_status_check
    check (status in ('connected', 'disconnected', 'error')),
  constraint user_integrations_visibility_check
    check (visibility in ('private', 'followers', 'public')),
  constraint user_integrations_usuario_provider_key unique (usuario_id, provider),
  constraint user_integrations_provider_user_key unique (provider, provider_user_id)
);

create table if not exists public.steam_profiles (
  integration_id uuid primary key references public.user_integrations(id) on delete cascade,
  steam_id text not null unique,
  persona_name text,
  avatar_url text,
  profile_url text,
  country_code text,
  community_visibility_state integer,
  profile_state integer,
  last_profile_sync_at timestamp with time zone,
  raw_profile jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.steam_owned_games (
  id bigint generated always as identity primary key,
  integration_id uuid not null references public.user_integrations(id) on delete cascade,
  steam_appid integer not null,
  jogo_id integer references public.jogos(id) on delete set null,
  name text,
  playtime_forever_minutes integer not null default 0,
  playtime_2weeks_minutes integer,
  img_icon_url text,
  has_community_visible_stats boolean,
  visibility text not null default 'private',
  imported_status_suggestion text,
  raw_app jsonb not null default '{}'::jsonb,
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  last_synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint steam_owned_games_playtime_check
    check (playtime_forever_minutes >= 0 and (playtime_2weeks_minutes is null or playtime_2weeks_minutes >= 0)),
  constraint steam_owned_games_visibility_check
    check (visibility in ('private', 'followers', 'public')),
  constraint steam_owned_games_status_suggestion_check
    check (
      imported_status_suggestion is null
      or imported_status_suggestion in ('jogando', 'zerado', 'dropado', 'planejando', 'pausado')
    ),
  constraint steam_owned_games_integration_app_key unique (integration_id, steam_appid)
);

create table if not exists public.steam_app_achievements (
  id bigint generated always as identity primary key,
  steam_appid integer not null,
  jogo_id integer references public.jogos(id) on delete set null,
  api_name text not null,
  display_name text,
  description text,
  icon_url text,
  icon_gray_url text,
  hidden boolean not null default false,
  default_value integer,
  last_schema_sync_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint steam_app_achievements_app_api_key unique (steam_appid, api_name)
);

create table if not exists public.steam_user_achievements (
  id bigint generated always as identity primary key,
  integration_id uuid not null references public.user_integrations(id) on delete cascade,
  steam_appid integer not null,
  achievement_api_name text not null,
  achieved boolean not null default false,
  unlock_time timestamp with time zone,
  last_synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint steam_user_achievements_owned_game_fkey
    foreign key (integration_id, steam_appid)
    references public.steam_owned_games(integration_id, steam_appid)
    on delete cascade,
  constraint steam_user_achievements_app_achievement_fkey
    foreign key (steam_appid, achievement_api_name)
    references public.steam_app_achievements(steam_appid, api_name)
    on delete cascade,
  constraint steam_user_achievements_integration_app_api_key
    unique (integration_id, steam_appid, achievement_api_name)
);

create table if not exists public.steam_sync_logs (
  id bigint generated always as identity primary key,
  integration_id uuid references public.user_integrations(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  sync_type text not null,
  status text not null,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  games_seen integer not null default 0,
  games_upserted integer not null default 0,
  achievements_seen integer not null default 0,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint steam_sync_logs_status_check
    check (status in ('running', 'success', 'partial', 'failed')),
  constraint steam_sync_logs_type_check
    check (sync_type in ('profile', 'library', 'achievements', 'disconnect', 'full')),
  constraint steam_sync_logs_counts_check
    check (games_seen >= 0 and games_upserted >= 0 and achievements_seen >= 0)
);

create index if not exists user_integrations_usuario_id_idx
  on public.user_integrations (usuario_id);

create index if not exists steam_owned_games_jogo_id_idx
  on public.steam_owned_games (jogo_id);

create index if not exists steam_owned_games_steam_appid_idx
  on public.steam_owned_games (steam_appid);

create index if not exists steam_app_achievements_jogo_id_idx
  on public.steam_app_achievements (jogo_id);

create index if not exists steam_user_achievements_integration_idx
  on public.steam_user_achievements (integration_id);

create index if not exists steam_user_achievements_app_api_idx
  on public.steam_user_achievements (steam_appid, achievement_api_name);

create index if not exists steam_sync_logs_integration_started_idx
  on public.steam_sync_logs (integration_id, started_at desc);

create index if not exists steam_sync_logs_usuario_started_idx
  on public.steam_sync_logs (usuario_id, started_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'game_external_ids',
    'plataformas',
    'generos',
    'empresas',
    'tags',
    'modos_jogo',
    'jogo_midias',
    'user_integrations',
    'steam_profiles',
    'steam_owned_games',
    'steam_app_achievements',
    'steam_user_achievements'
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

alter table public.game_external_ids enable row level security;
alter table public.plataformas enable row level security;
alter table public.generos enable row level security;
alter table public.empresas enable row level security;
alter table public.tags enable row level security;
alter table public.modos_jogo enable row level security;
alter table public.jogo_plataformas enable row level security;
alter table public.jogo_generos enable row level security;
alter table public.jogo_empresas enable row level security;
alter table public.jogo_tags enable row level security;
alter table public.jogo_modos_jogo enable row level security;
alter table public.jogo_midias enable row level security;
alter table public.jogo_estatisticas enable row level security;
alter table public.user_integrations enable row level security;
alter table public.steam_profiles enable row level security;
alter table public.steam_owned_games enable row level security;
alter table public.steam_app_achievements enable row level security;
alter table public.steam_user_achievements enable row level security;
alter table public.steam_sync_logs enable row level security;

revoke all on table
  public.game_external_ids,
  public.plataformas,
  public.generos,
  public.empresas,
  public.tags,
  public.modos_jogo,
  public.jogo_plataformas,
  public.jogo_generos,
  public.jogo_empresas,
  public.jogo_tags,
  public.jogo_modos_jogo,
  public.jogo_midias,
  public.jogo_estatisticas,
  public.user_integrations,
  public.steam_profiles,
  public.steam_owned_games,
  public.steam_app_achievements,
  public.steam_user_achievements,
  public.steam_sync_logs
from anon, authenticated;

grant select on table
  public.game_external_ids,
  public.plataformas,
  public.generos,
  public.empresas,
  public.tags,
  public.modos_jogo,
  public.jogo_plataformas,
  public.jogo_generos,
  public.jogo_empresas,
  public.jogo_tags,
  public.jogo_modos_jogo,
  public.jogo_midias,
  public.jogo_estatisticas
to anon, authenticated;

grant all on table
  public.game_external_ids,
  public.plataformas,
  public.generos,
  public.empresas,
  public.tags,
  public.modos_jogo,
  public.jogo_plataformas,
  public.jogo_generos,
  public.jogo_empresas,
  public.jogo_tags,
  public.jogo_modos_jogo,
  public.jogo_midias,
  public.jogo_estatisticas,
  public.user_integrations,
  public.steam_profiles,
  public.steam_owned_games,
  public.steam_app_achievements,
  public.steam_user_achievements,
  public.steam_sync_logs
to service_role;

grant select, insert, update, delete on table public.user_integrations to authenticated;
grant select on table public.steam_profiles to authenticated;
grant select on table public.steam_owned_games to authenticated;
grant select on table public.steam_app_achievements to authenticated;
grant select on table public.steam_user_achievements to authenticated;
grant select on table public.steam_sync_logs to authenticated;

grant usage, select on all sequences in schema public to service_role;

do $$
declare
  catalog_table text;
begin
  foreach catalog_table in array array[
    'game_external_ids',
    'plataformas',
    'generos',
    'empresas',
    'tags',
    'modos_jogo',
    'jogo_plataformas',
    'jogo_generos',
    'jogo_empresas',
    'jogo_tags',
    'jogo_modos_jogo',
    'jogo_midias',
    'jogo_estatisticas',
    'steam_app_achievements'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = catalog_table
        and policyname = 'Public catalog read access'
    ) then
      execute format(
        'create policy "Public catalog read access" on public.%I for select to anon, authenticated using (true)',
        catalog_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_integrations'
      and policyname = 'Users can read own integrations'
  ) then
    create policy "Users can read own integrations"
      on public.user_integrations
      for select
      to authenticated
      using ((select auth.uid()) = usuario_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_integrations'
      and policyname = 'Users can insert own integrations'
  ) then
    create policy "Users can insert own integrations"
      on public.user_integrations
      for insert
      to authenticated
      with check ((select auth.uid()) = usuario_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_integrations'
      and policyname = 'Users can update own integrations'
  ) then
    create policy "Users can update own integrations"
      on public.user_integrations
      for update
      to authenticated
      using ((select auth.uid()) = usuario_id)
      with check ((select auth.uid()) = usuario_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_integrations'
      and policyname = 'Users can delete own integrations'
  ) then
    create policy "Users can delete own integrations"
      on public.user_integrations
      for delete
      to authenticated
      using ((select auth.uid()) = usuario_id);
  end if;
end $$;

do $$
declare
  owned_table text;
begin
  foreach owned_table in array array[
    'steam_profiles',
    'steam_owned_games',
    'steam_user_achievements'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = owned_table
        and policyname = 'Users can read own Steam data'
    ) then
      execute format(
        'create policy "Users can read own Steam data" on public.%I for select to authenticated using (
          exists (
            select 1
            from public.user_integrations ui
            where ui.id = integration_id
              and ui.usuario_id = (select auth.uid())
          )
        )',
        owned_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'steam_sync_logs'
      and policyname = 'Users can read own Steam sync logs'
  ) then
    create policy "Users can read own Steam sync logs"
      on public.steam_sync_logs
      for select
      to authenticated
      using (
        usuario_id = (select auth.uid())
        or exists (
          select 1
          from public.user_integrations ui
          where ui.id = integration_id
            and ui.usuario_id = (select auth.uid())
        )
      );
  end if;
end $$;

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
    where (
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
    where (
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
