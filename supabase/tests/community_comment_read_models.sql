begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

select ok(
  to_regprocedure('public.get_community_post_comment_previews(uuid[],integer)') is not null,
  'community comment preview RPC exists'
);
select ok(
  to_regprocedure('public.get_community_post_comments_page(uuid,integer,integer)') is not null,
  'community comment page RPC exists'
);
select ok(
  to_regprocedure('public.get_community_comment_anchor(uuid,uuid,integer)') is not null,
  'community comment anchor RPC exists'
);

select ok(
  has_function_privilege('anon', 'public.get_community_post_comment_previews(uuid[],integer)', 'execute'),
  'anonymous users can request comment previews subject to RLS'
);
select ok(
  has_function_privilege('anon', 'public.get_community_post_comments_page(uuid,integer,integer)', 'execute'),
  'anonymous users can request comment pages subject to RLS'
);
select ok(
  has_function_privilege('anon', 'public.get_community_comment_anchor(uuid,uuid,integer)', 'execute'),
  'anonymous users can resolve visible comment anchors subject to RLS'
);
select ok(
  has_function_privilege('authenticated', 'public.get_community_post_comment_previews(uuid[],integer)', 'execute'),
  'authenticated users can request comment previews subject to RLS'
);
select ok(
  has_function_privilege('authenticated', 'public.get_community_post_comments_page(uuid,integer,integer)', 'execute'),
  'authenticated users can request comment pages subject to RLS'
);
select ok(
  has_function_privilege('authenticated', 'public.get_community_comment_anchor(uuid,uuid,integer)', 'execute'),
  'authenticated users can resolve visible comment anchors subject to RLS'
);

select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc procedure
    where procedure.oid = 'public.get_community_post_comment_previews(uuid[],integer)'::regprocedure
  ),
  'comment previews run as SECURITY INVOKER'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc procedure
    where procedure.oid = 'public.get_community_post_comments_page(uuid,integer,integer)'::regprocedure
  ),
  'comment pages run as SECURITY INVOKER'
);
select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc procedure
    where procedure.oid = 'public.get_community_comment_anchor(uuid,uuid,integer)'::regprocedure
  ),
  'comment anchors run as SECURITY INVOKER'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join unnest(coalesce(procedure.proconfig, array[]::text[])) config
    where procedure.oid = 'public.get_community_post_comment_previews(uuid[],integer)'::regprocedure
      and config in ('search_path=', 'search_path=""')
  ),
  'comment preview search_path is empty'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join unnest(coalesce(procedure.proconfig, array[]::text[])) config
    where procedure.oid = 'public.get_community_post_comments_page(uuid,integer,integer)'::regprocedure
      and config in ('search_path=', 'search_path=""')
  ),
  'comment page search_path is empty'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join unnest(coalesce(procedure.proconfig, array[]::text[])) config
    where procedure.oid = 'public.get_community_comment_anchor(uuid,uuid,integer)'::regprocedure
      and config in ('search_path=', 'search_path=""')
  ),
  'comment anchor search_path is empty'
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
values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'community-comments@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.usuarios (id, username, configuracoes_privacidade)
values ('30000000-0000-0000-0000-000000000001', 'community_comment_author', '{}'::jsonb);

insert into public.comunidades (
  id,
  nome,
  lider_id,
  visibilidade
)
values
  ('31000000-0000-0000-0000-000000000001', 'Public Comment Fixture', '30000000-0000-0000-0000-000000000001', 'publica'),
  ('31000000-0000-0000-0000-000000000002', 'Private Comment Fixture', '30000000-0000-0000-0000-000000000001', 'privada');

insert into public.comunidade_membros (comunidade_id, usuario_id, cargo)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'lider'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'lider');

insert into public.comunidade_posts (
  id,
  comunidade_id,
  autor_id,
  texto
)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Public post'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Private post');

insert into public.comunidade_post_comentarios (
  id,
  post_id,
  comunidade_id,
  autor_id,
  texto,
  created_at,
  updated_at
)
values
  ('33000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 01', '2026-03-01T00:00:01Z', '2026-03-01T00:00:01Z'),
  ('33000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 02', '2026-03-01T00:00:02Z', '2026-03-01T00:00:02Z'),
  ('33000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 03', '2026-03-01T00:00:03Z', '2026-03-01T00:00:03Z'),
  ('33000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 04', '2026-03-01T00:00:04Z', '2026-03-01T00:00:04Z'),
  ('33000000-0000-0000-0000-000000000005', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 05', '2026-03-01T00:00:05Z', '2026-03-01T00:00:05Z'),
  ('33000000-0000-0000-0000-000000000006', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Comment 06', '2026-03-01T00:00:06Z', '2026-03-01T00:00:06Z');

insert into public.comunidade_post_comentarios (
  id,
  post_id,
  comunidade_id,
  autor_id,
  texto,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  '32000000-0000-0000-0000-000000000001'::uuid,
  '31000000-0000-0000-0000-000000000001'::uuid,
  '30000000-0000-0000-0000-000000000001'::uuid,
  'Comment ' || lpad(fixture.number::text, 2, '0'),
  '2026-03-01T00:00:00Z'::timestamptz + fixture.number * interval '1 second',
  '2026-03-01T00:00:00Z'::timestamptz + fixture.number * interval '1 second'
from generate_series(7, 22) fixture(number);

insert into public.comunidade_post_comentarios (
  id,
  post_id,
  comunidade_id,
  autor_id,
  texto,
  created_at,
  updated_at,
  deleted_at
)
values
  ('33000000-0000-0000-0000-000000000099', '32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Deleted public comment', '2026-03-01T00:01:00Z', '2026-03-01T00:01:00Z', '2026-03-01T00:02:00Z'),
  ('33000000-0000-0000-0000-000000000100', '32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Private comment', '2026-03-01T00:00:01Z', '2026-03-01T00:00:01Z', null);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (
    select count(*)
    from public.get_community_post_comment_previews(
      array['32000000-0000-0000-0000-000000000001'::uuid],
      99
    )
  ),
  4::bigint,
  'comment previews clamp each post to four rows'
);
select is(
  (
    select max(preview.total_count)
    from public.get_community_post_comment_previews(
      array['32000000-0000-0000-0000-000000000001'::uuid],
      2
    ) preview
  ),
  22::bigint,
  'comment previews expose the visible non-deleted total'
);
select is(
  (
    select count(*)
    from public.get_community_post_comment_previews(
      array_fill(
        '32000000-0000-0000-0000-000000000099'::uuid,
        array[30]
      ) || array['32000000-0000-0000-0000-000000000001'::uuid],
      2
    )
  ),
  0::bigint,
  'comment previews bound raw post ids before deduplication and joins'
);
select is(
  (
    select count(*)
    from public.get_community_post_comments_page(
      '32000000-0000-0000-0000-000000000001',
      99,
      0
    )
  ),
  20::bigint,
  'comment pages clamp the maximum page size to 20'
);
select results_eq(
  $$
    select page.id
    from public.get_community_post_comments_page(
      '32000000-0000-0000-0000-000000000001',
      6,
      -10
    ) page
  $$,
  $$
    values
      ('33000000-0000-0000-0000-000000000001'::uuid),
      ('33000000-0000-0000-0000-000000000002'::uuid),
      ('33000000-0000-0000-0000-000000000003'::uuid),
      ('33000000-0000-0000-0000-000000000004'::uuid),
      ('33000000-0000-0000-0000-000000000005'::uuid),
      ('33000000-0000-0000-0000-000000000006'::uuid)
  $$,
  'comment pages preserve stable oldest-first ordering and clamp negative offsets'
);
select results_eq(
  $$
    select anchor.found, anchor.comment_offset, anchor.page_offset, anchor.total_count
    from public.get_community_comment_anchor(
      '32000000-0000-0000-0000-000000000001',
      '33000000-0000-0000-0000-000000000004',
      2
    ) anchor
  $$,
  $$ values (true, 3::bigint, 2::bigint, 22::bigint) $$,
  'comment anchors use the same stable ordering and resolve the containing page'
);
select is(
  (
    select count(*)
    from public.get_community_post_comments_page(
      '32000000-0000-0000-0000-000000000002',
      4,
      0
    )
  ),
  0::bigint,
  'SECURITY INVOKER keeps private community comments hidden anonymously'
);

select * from finish();
rollback;
