-- Durable, backend-only reservation ledger for paid/external catalog searches.
-- Cache hits are resolved before this reservation and do not consume another
-- slot. Every actual external attempt is recorded, including retries after a
-- cache/import failure. The advisory lock makes the 10/hour decision atomic
-- per user across Edge Function instances and regions.
create table public.game_import_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  query_hash text not null,
  attempted_at timestamp with time zone not null default now(),
  constraint game_import_attempts_query_hash_check
    check (query_hash ~ '^[0-9a-f]{64}$')
);

create index game_import_attempts_attempted_at_idx
  on public.game_import_attempts (attempted_at);
create index game_import_attempts_user_attempted_at_idx
  on public.game_import_attempts (user_id, attempted_at desc);

alter table public.game_import_attempts enable row level security;

revoke all on table public.game_import_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.game_import_attempts to service_role;

create or replace function public.reserve_game_import_attempt(
  p_user_id uuid,
  p_query_hash text,
  p_limit integer default 10,
  p_window_seconds integer default 3600
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamp with time zone,
  already_reserved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamp with time zone := now();
  v_window interval;
  v_used integer := 0;
  v_first_at timestamp with time zone;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  if p_query_hash is null or p_query_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_query_hash' using errcode = '22023';
  end if;

  if p_limit is null
    or p_window_seconds is null
    or p_limit < 1
    or p_limit > 100
    or p_window_seconds < 60
    or p_window_seconds > 86400
  then
    raise exception 'invalid_rate_limit_configuration' using errcode = '22023';
  end if;

  v_window := make_interval(secs => p_window_seconds);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('game-import:' || p_user_id::text, 0)
  );

  delete from public.game_import_attempts attempts
  where attempts.user_id = p_user_id
    and attempts.attempted_at <= v_now - v_window;

  select count(*)::integer, min(attempts.attempted_at)
  into v_used, v_first_at
  from public.game_import_attempts attempts
  where attempts.user_id = p_user_id
    and attempts.attempted_at > v_now - v_window;

  if v_used >= p_limit then
    return query
      select false, 0, coalesce(v_first_at, v_now) + v_window, false;
    return;
  end if;

  insert into public.game_import_attempts (user_id, query_hash, attempted_at)
  values (p_user_id, p_query_hash, v_now);

  v_used := v_used + 1;
  v_first_at := coalesce(v_first_at, v_now);

  return query
    select true, greatest(p_limit - v_used, 0), v_first_at + v_window, false;
end;
$$;

revoke all on function public.reserve_game_import_attempt(uuid, text, integer, integer)
from public, anon, authenticated;

grant execute on function public.reserve_game_import_attempt(uuid, text, integer, integer)
to service_role;

comment on table public.game_import_attempts is
  'Backend-only rolling-window ledger for authenticated IGDB import attempts.';

comment on function public.reserve_game_import_attempt(uuid, text, integer, integer) is
  'Atomically reserves one external catalog attempt for a user and rolling window.';
