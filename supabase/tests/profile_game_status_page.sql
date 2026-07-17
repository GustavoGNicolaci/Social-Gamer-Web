begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

select ok(
  to_regprocedure('public.get_profile_game_status_page(uuid,text[],text,integer,integer)') is not null,
  'profile status page RPC exists with the expected signature'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_profile_game_status_page(uuid,text[],text,integer,integer)',
    'execute'
  ),
  'anonymous viewers can request an RLS-authorized profile status page'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_profile_game_status_page(uuid,text[],text,integer,integer)',
    'execute'
  ),
  'authenticated viewers can request an RLS-authorized profile status page'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc procedure
    where procedure.oid =
      'public.get_profile_game_status_page(uuid,text[],text,integer,integer)'::regprocedure
  ),
  'profile status pagination runs as SECURITY INVOKER'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join unnest(coalesce(procedure.proconfig, array[]::text[])) config
    where procedure.oid =
        'public.get_profile_game_status_page(uuid,text[],text,integer,integer)'::regprocedure
      and config in ('search_path=', 'search_path=""')
  ),
  'profile status pagination has an empty search_path'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'status-public@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'status-private@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'status-limit@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'status-ties@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.usuarios (
  id,
  username,
  configuracoes_privacidade
)
values
  ('20000000-0000-0000-0000-000000000001', 'status_public_fixture', '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', 'status_private_fixture', '{"perfil_privado": true}'::jsonb),
  ('20000000-0000-0000-0000-000000000003', 'status_limit_fixture', '{}'::jsonb),
  ('20000000-0000-0000-0000-000000000004', 'status_ties_fixture', '{}'::jsonb);

insert into public.jogos (id, titulo)
values
  (91001, 'Alpha'),
  (91002, 'Zulu'),
  (91003, 'Beta'),
  (91004, 'Gamma'),
  (91005, 'Private'),
  (93001, 'Alpha Tie'),
  (93002, 'Alpha Tie'),
  (93003, 'Beta Tie'),
  (93004, 'Zulu Tie'),
  (93005, 'Null Date Tie');

insert into public.status_jogo (
  id,
  usuario_id,
  jogo_id,
  status,
  created_at,
  favorito
)
values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 91001, 'jogando', '2026-01-01T00:00:00Z', false),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 91002, 'zerado', '2026-01-02T00:00:00Z', true),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 91003, 'planejando', '2026-01-03T00:00:00Z', true),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 91004, 'dropado', '2026-01-04T00:00:00Z', false),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 91005, 'jogando', '2026-01-05T00:00:00Z', true),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000004', 93001, 'jogando', '2026-03-01T00:00:00Z', false),
  ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 93002, 'jogando', '2026-03-01T00:00:00Z', true),
  ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 93003, 'jogando', '2026-03-02T00:00:00Z', true),
  ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', 93004, 'jogando', '2026-03-02T00:00:00Z', false),
  ('21000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000004', 93005, 'jogando', null, false);

insert into public.jogos (id, titulo)
select 92000 + fixture.number, 'Limit Game ' || lpad(fixture.number::text, 2, '0')
from generate_series(1, 65) fixture(number);

insert into public.status_jogo (
  id,
  usuario_id,
  jogo_id,
  status,
  created_at,
  favorito
)
select
  gen_random_uuid(),
  '20000000-0000-0000-0000-000000000003'::uuid,
  92000 + fixture.number,
  'jogando',
  '2026-02-01T00:00:00Z'::timestamptz + fixture.number * interval '1 minute',
  false
from generate_series(1, 65) fixture(number);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select results_eq(
  $$
    select page.game_title
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      null,
      'recent',
      24,
      0
    ) page
  $$,
  $$ values ('Gamma'::text), ('Beta'::text), ('Zulu'::text), ('Alpha'::text) $$,
  'recent sort is global and stable before pagination'
);
select results_eq(
  $$
    select page.game_title
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      null,
      'oldest',
      24,
      0
    ) page
  $$,
  $$ values ('Alpha'::text), ('Zulu'::text), ('Beta'::text), ('Gamma'::text) $$,
  'oldest sort is global and stable before pagination'
);
select results_eq(
  $$
    select page.game_title
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      null,
      'favorites',
      24,
      0
    ) page
  $$,
  $$ values ('Beta'::text), ('Zulu'::text), ('Gamma'::text), ('Alpha'::text) $$,
  'favorites sort orders favorites first and then uses recency'
);
select results_eq(
  $$
    select page.game_title
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      null,
      'title',
      24,
      0
    ) page
  $$,
  $$ values ('Alpha'::text), ('Beta'::text), ('Gamma'::text), ('Zulu'::text) $$,
  'title sort happens in SQL before pagination'
);
select results_eq(
  $$
    select page.jogo_id
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000004', null, 'recent', 2, 0
    ) page
  $$,
  $$ values (93003), (93004) $$,
  'recent sort applies favorite and title tie-breakers before the first page boundary'
);
select results_eq(
  $$
    select page.jogo_id
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000004', null, 'recent', 2, 2
    ) page
  $$,
  $$ values (93002), (93001) $$,
  'recent sort keeps the second page stable after tied rows'
);
select results_eq(
  $$
    select page.jogo_id
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000004', null, 'oldest', 5, 0
    ) page
  $$,
  $$ values (93005), (93002), (93001), (93003), (93004) $$,
  'oldest sort treats a missing date as timestamp zero, then applies tie-breakers'
);
select results_eq(
  $$
    select page.jogo_id
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000004', null, 'favorites', 5, 0
    ) page
  $$,
  $$ values (93003), (93002), (93004), (93001), (93005) $$,
  'favorites sort applies recency and title tie-breakers'
);
select results_eq(
  $$
    select page.jogo_id
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000004', null, 'title', 5, 0
    ) page
  $$,
  $$ values (93002), (93001), (93003), (93005), (93004) $$,
  'title sort applies favorite and recency tie-breakers'
);
select results_eq(
  $$
    select page.game_title, page.total_count
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      array['jogando', 'INVALID', 'dropado'],
      'recent',
      24,
      0
    ) page
  $$,
  $$ values ('Gamma'::text, 2::bigint), ('Alpha'::text, 2::bigint) $$,
  'status filters ignore unknown values and report the filtered total'
);
select is(
  (
    select count(*)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000001',
      array_fill('INVALID'::text, array[32]) || array['dropado'::text],
      'recent',
      24,
      0
    )
  ),
  4::bigint,
  'status filters bound raw input before normalizing accepted values'
);
select is(
  (
    select count(*)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000002',
      null,
      'recent',
      24,
      0
    )
  ),
  0::bigint,
  'private profile status rows remain hidden anonymously through RLS'
);
select is(
  (
    select count(*)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000003',
      null,
      'recent',
      999,
      0
    )
  ),
  60::bigint,
  'profile status page clamps its maximum page size to 60'
);
select is(
  (
    select count(*)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000003',
      null,
      'recent',
      null,
      0
    )
  ),
  24::bigint,
  'profile status page uses the documented default page size'
);
select is(
  (
    select max(page.total_count)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000003',
      null,
      'recent',
      1,
      -10
    ) page
  ),
  65::bigint,
  'negative offsets are normalized and total_count remains global'
);

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.get_profile_game_status_page(
      '20000000-0000-0000-0000-000000000002',
      null,
      'recent',
      24,
      0
    )
  ),
  1::bigint,
  'profile owners can read their own private status page'
);

select * from finish();
rollback;
