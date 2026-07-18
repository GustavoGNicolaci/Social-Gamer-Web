begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

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
  (
    '00000000-0000-0000-0000-000000000000',
    '24000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'review-overview-user-1@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '24000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'review-overview-user-2@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '24000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'review-overview-user-3@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.usuarios (id, username, nome_completo)
values
  (
    '24000000-0000-0000-0000-000000000001',
    'review_overview_user_1',
    'Review Overview User 1'
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    'review_overview_user_2',
    'Review Overview User 2'
  ),
  (
    '24000000-0000-0000-0000-000000000003',
    'review_overview_user_3',
    'Review Overview User 3'
  );

insert into public.jogos (id, titulo)
values
  (940001, 'Review overview fixture'),
  (940002, 'Empty review overview fixture');

insert into public.avaliacoes (
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  data_publicacao
)
values
  (
    '24100000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-000000000001',
    940001,
    8,
    'Published review one',
    '2026-01-01 00:00:00+00'
  ),
  (
    '24100000-0000-0000-0000-000000000002',
    '24000000-0000-0000-0000-000000000002',
    940001,
    6,
    'Published review two',
    '2026-01-02 00:00:00+00'
  ),
  (
    '24100000-0000-0000-0000-000000000003',
    '24000000-0000-0000-0000-000000000003',
    940001,
    10,
    'Unpublished review',
    null
  );

-- The production write triggers intentionally publish every new review. Disable
-- only those normalizers inside this rolled-back fixture so the read model can
-- prove that a legacy/null publication row remains excluded.
alter table public.avaliacoes
  disable trigger avaliacoes_normalize_metadata;
alter table public.avaliacoes
  disable trigger avaliacoes_normalize_write;

update public.avaliacoes
set data_publicacao = null
where id = '24100000-0000-0000-0000-000000000003';

alter table public.avaliacoes
  enable trigger avaliacoes_normalize_metadata;
alter table public.avaliacoes
  enable trigger avaliacoes_normalize_write;

insert into public.comentarios (
  id,
  usuario_id,
  review_id,
  texto,
  data_comentario
)
values
  (
    '24200000-0000-0000-0000-000000000001',
    '24000000-0000-0000-0000-000000000001',
    '24100000-0000-0000-0000-000000000001',
    'Published review comment one',
    '2026-02-01 00:00:00+00'
  ),
  (
    '24200000-0000-0000-0000-000000000002',
    '24000000-0000-0000-0000-000000000001',
    '24100000-0000-0000-0000-000000000002',
    'Published review comment two',
    '2026-02-02 00:00:00+00'
  ),
  (
    '24200000-0000-0000-0000-000000000003',
    '24000000-0000-0000-0000-000000000001',
    '24100000-0000-0000-0000-000000000003',
    'Unpublished review comment',
    '2026-02-03 00:00:00+00'
  );

select ok(
  to_regprocedure('public.get_game_review_overview(integer)') is not null,
  'game review overview has the explicit integer signature'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_game_review_overview(integer)',
    'execute'
  ),
  'anonymous users can read the public game review overview'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_game_review_overview(integer)',
    'execute'
  ),
  'authenticated users can read the game review overview'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_game_review_overview(integer)',
    'execute'
  ),
  'service_role keeps an explicit game review overview grant'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f'::"char", procedure.proowner)
      )
    ) as privilege
    where procedure.oid = 'public.get_game_review_overview(integer)'::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC keeps no implicit execute grant on the game review overview'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.get_game_review_overview(integer)'::regprocedure
  ),
  'game review overview runs as SECURITY INVOKER'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.get_game_review_overview(integer)'::regprocedure
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting = 'search_path='
      )
  ),
  'game review overview uses an empty search_path'
);
select is(
  (
    select array_agg(output.key order by output.key)
    from (
      select jsonb_object_keys(to_jsonb(overview)) as key
      from (
        select *
        from public.get_game_review_overview(940001)
        limit 1
      ) as overview
    ) as output
  ),
  array[
    'average_rating',
    'comment_count',
    'game_id',
    'review_count'
  ]::text[],
  'game review overview exposes only the aggregate DTO'
);
select throws_ok(
  $$ select * from public.get_game_review_overview(null) $$,
  '22023',
  'p_game_id must be a positive integer',
  'game review overview rejects a null game id'
);
select throws_ok(
  $$ select * from public.get_game_review_overview(0) $$,
  '22023',
  'p_game_id must be a positive integer',
  'game review overview rejects a non-positive game id'
);
select results_eq(
  $$
    select
      overview.game_id,
      overview.review_count,
      overview.average_rating,
      overview.comment_count
    from public.get_game_review_overview(940002) as overview
  $$,
  $$ values (940002, 0::bigint, null::numeric, 0::bigint) $$,
  'a game without reviews returns zero counts and a null average'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select results_eq(
  $$
    select
      overview.game_id,
      overview.review_count,
      overview.average_rating,
      overview.comment_count
    from public.get_game_review_overview(940001) as overview
  $$,
  $$ values (940001, 2::bigint, 7::numeric, 2::bigint) $$,
  'anonymous overview counts only published reviews and their comments'
);
select is(
  (select count(*) from public.get_game_review_overview(940001)),
  1::bigint,
  'the overview returns exactly one row'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select results_eq(
  $$
    select
      overview.review_count,
      overview.average_rating,
      overview.comment_count
    from public.get_game_review_overview(940001) as overview
  $$,
  $$ values (2::bigint, 7::numeric, 2::bigint) $$,
  'authenticated overview preserves the same public aggregate'
);
select is(
  (
    select count(*)
    from public.get_game_review_overview(940001) as overview
    where overview.review_count = 3
       or overview.comment_count = 3
       or overview.average_rating <> 7
  ),
  0::bigint,
  'unpublished reviews and their comments never affect the overview'
);

select * from finish();
rollback;
