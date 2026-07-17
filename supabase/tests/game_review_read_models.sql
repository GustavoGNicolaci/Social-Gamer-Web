begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

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
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  ('20000000-0000-0000-0000-' || lpad(fixture.number::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'review-user-' || fixture.number::text || '@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 25) as fixture(number);

insert into public.usuarios (
  id,
  username,
  nome_completo,
  avatar_path,
  configuracoes_privacidade
)
select
  ('20000000-0000-0000-0000-' || lpad(fixture.number::text, 12, '0'))::uuid,
  'review_user_' || fixture.number::text,
  'Review User ' || fixture.number::text,
  'avatars/' || fixture.number::text || '.webp',
  '{}'::jsonb
from generate_series(1, 25) as fixture(number);

insert into public.jogos (id, titulo)
values
  (910001, 'Review read model fixture'),
  (910002, 'Review anchor isolation fixture');

insert into public.avaliacoes (
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  data_publicacao
)
select
  ('21000000-0000-0000-0000-' || lpad(fixture.number::text, 12, '0'))::uuid,
  ('20000000-0000-0000-0000-' || lpad(fixture.number::text, 12, '0'))::uuid,
  910001,
  ((fixture.number % 10) + 1)::numeric,
  'Review fixture ' || fixture.number::text,
  '2026-01-01 00:00:00+00'::timestamp with time zone
    + fixture.number * interval '1 hour'
from generate_series(1, 25) as fixture(number);

insert into public.avaliacoes (
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  data_publicacao
)
values (
  '21000000-0000-0000-0000-000000000026',
  '20000000-0000-0000-0000-000000000001',
  910001,
  5,
  'Legacy review without publication date',
  null
);

insert into public.comentarios (
  id,
  usuario_id,
  review_id,
  texto,
  data_comentario
)
select
  ('22000000-0000-0000-0000-' || lpad(fixture.number::text, 12, '0'))::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '21000000-0000-0000-0000-000000000003'::uuid,
  'Comment fixture ' || fixture.number::text,
  '2026-02-01 00:00:00+00'::timestamp with time zone
    + fixture.number * interval '1 hour'
from generate_series(1, 25) as fixture(number);

insert into public.avaliacao_curtidas (avaliacao_id, usuario_id)
values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010'),
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000010'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000011'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000011'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000012'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000025');

insert into public.avaliacao_deslikes (avaliacao_id, usuario_id)
values
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000025');

insert into public.comentario_curtidas (comentario_id, usuario_id)
values
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010'),
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000010'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000011'),
  ('22000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000010'),
  ('22000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000011'),
  ('22000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000012'),
  ('22000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000025');

insert into public.comentario_deslikes (comentario_id, usuario_id)
values
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000025');

insert into public.denuncias_conteudo (
  id,
  denunciante_id,
  tipo_conteudo,
  avaliacao_id,
  comentario_id,
  motivo,
  descricao,
  status,
  created_at
)
values
  (
    '23000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000025',
    'review',
    '21000000-0000-0000-0000-000000000003',
    null,
    'spam',
    'Review report fixture',
    'pending',
    '2026-03-01 00:00:00+00'
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000025',
    'comment',
    null,
    '22000000-0000-0000-0000-000000000003',
    'conteudo_improprio',
    'Comment report fixture',
    'under_review',
    '2026-03-02 00:00:00+00'
  );

select ok(
  to_regprocedure('public.get_game_reviews_page(integer,integer,integer)') is not null,
  'game review page has the explicit integer/integer/integer signature'
);
select ok(
  to_regprocedure('public.get_review_comments_page(uuid,integer,integer)') is not null,
  'review comment page has the explicit uuid/integer/integer signature'
);
select ok(
  to_regprocedure('public.get_game_review_anchor(integer,uuid,uuid)') is not null,
  'game review anchor has the explicit game/review/comment signature'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_game_reviews_page(integer,integer,integer)',
    'execute'
  ),
  'anonymous users can read public game review pages'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_game_reviews_page(integer,integer,integer)',
    'execute'
  ),
  'authenticated users can read game review pages'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_review_comments_page(uuid,integer,integer)',
    'execute'
  ),
  'anonymous users can read public review comments'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_review_comments_page(uuid,integer,integer)',
    'execute'
  ),
  'authenticated users can read review comments'
);
select ok(
  has_function_privilege(
    'anon',
    'public.get_game_review_anchor(integer,uuid,uuid)',
    'execute'
  ),
  'anonymous deep links can resolve public review anchors'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_game_review_anchor(integer,uuid,uuid)',
    'execute'
  ),
  'authenticated deep links can resolve review anchors'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'public.get_game_reviews_page(integer,integer,integer)'::regprocedure,
      'public.get_review_comments_page(uuid,integer,integer)'::regprocedure,
      'public.get_game_review_anchor(integer,uuid,uuid)'::regprocedure
    )
      and procedure.prosecdef
  ),
  3::bigint,
  'all review read models run as SECURITY DEFINER'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'public.get_game_reviews_page(integer,integer,integer)'::regprocedure,
      'public.get_review_comments_page(uuid,integer,integer)'::regprocedure,
      'public.get_game_review_anchor(integer,uuid,uuid)'::regprocedure
    )
      and not exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting(value)
        where setting.value in ('search_path=', 'search_path=""')
      )
  ),
  'all review read models use an empty search_path'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'public.get_game_reviews_page(integer,integer,integer)'::regprocedure,
      'public.get_review_comments_page(uuid,integer,integer)'::regprocedure,
      'public.get_game_review_anchor(integer,uuid,uuid)'::regprocedure
    )
      and procedure.proowner <> 'postgres'::regrole
  ),
  'all review read models retain the expected postgres owner'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as privilege
    where procedure.oid in (
      'public.get_game_reviews_page(integer,integer,integer)'::regprocedure,
      'public.get_review_comments_page(uuid,integer,integer)'::regprocedure,
      'public.get_game_review_anchor(integer,uuid,uuid)'::regprocedure
    )
      and privilege.privilege_type = 'EXECUTE'
      and privilege.grantee not in (
        procedure.proowner,
        'anon'::regrole,
        'authenticated'::regrole
      )
  ),
  'review read model execute ACLs contain only owner, anon and authenticated'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral aclexplode(
      coalesce(procedure.proacl, acldefault('f'::"char", procedure.proowner))
    ) as privilege
    where procedure.oid in (
      'public.get_game_reviews_page(integer,integer,integer)'::regprocedure,
      'public.get_review_comments_page(uuid,integer,integer)'::regprocedure,
      'public.get_game_review_anchor(integer,uuid,uuid)'::regprocedure
    )
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  'PUBLIC keeps no implicit execute grant on review read models'
);

select is(
  (
    select array_agg(output.key order by output.key)
    from (
      select jsonb_object_keys(to_jsonb(page)) as key
      from (
        select *
        from public.get_game_reviews_page(910001, 1, 0)
        limit 1
      ) as page
    ) as output
  ),
  array[
    'author_avatar_path', 'author_id', 'author_name', 'author_username',
    'comments_count', 'current_user_report_created_at',
    'current_user_report_description', 'current_user_report_id',
    'current_user_report_reason', 'current_user_report_status',
    'disliked_by_current_user', 'dislikes_count', 'edited_at', 'game_id',
    'liked_by_current_user', 'likes_count', 'published_at', 'review_id',
    'review_text', 'score', 'total_count'
  ]::text[],
  'review page exposes only the explicit DTO and no reaction identity collection'
);
select is(
  (
    select array_agg(output.key order by output.key)
    from (
      select jsonb_object_keys(to_jsonb(page)) as key
      from (
        select *
        from public.get_review_comments_page(
          '21000000-0000-0000-0000-000000000003',
          1,
          0
        )
        limit 1
      ) as page
    ) as output
  ),
  array[
    'author_avatar_path', 'author_id', 'author_name', 'author_username',
    'comment_id', 'comment_text', 'current_user_report_created_at',
    'current_user_report_description', 'current_user_report_id',
    'current_user_report_reason', 'current_user_report_status',
    'disliked_by_current_user', 'dislikes_count', 'edited_at',
    'liked_by_current_user', 'likes_count', 'published_at', 'review_id',
    'total_count'
  ]::text[],
  'comment page exposes only the explicit DTO and no reaction identity collection'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select is(
  (select count(*) from public.get_game_reviews_page(910001, 999, -50)),
  20::bigint,
  'review page clamps limit to 20 and a negative offset to zero'
);
select results_eq(
  $$
    select page.review_id
    from public.get_game_reviews_page(910001, 0, -1) as page
  $$,
  $$ values ('21000000-0000-0000-0000-000000000003'::uuid) $$,
  'review page clamps a zero limit to one without skipping the first row'
);
select results_eq(
  $$
    select page.review_id
    from public.get_game_reviews_page(910001, 4, 0) as page
  $$,
  $$
    values
      ('21000000-0000-0000-0000-000000000003'::uuid),
      ('21000000-0000-0000-0000-000000000002'::uuid),
      ('21000000-0000-0000-0000-000000000001'::uuid),
      ('21000000-0000-0000-0000-000000000025'::uuid)
  $$,
  'reviews use stable likes, publication time and id ordering'
);
select results_eq(
  $$
    select
      page.author_id,
      page.author_username,
      page.author_name,
      page.author_avatar_path,
      page.likes_count,
      page.dislikes_count,
      page.comments_count,
      page.total_count
    from public.get_game_reviews_page(910001, 1, 0) as page
  $$,
  $$
    values (
      '20000000-0000-0000-0000-000000000003'::uuid,
      'review_user_3'::text,
      'Review User 3'::text,
      'avatars/3.webp'::text,
      4::integer,
      0::integer,
      25::integer,
      25::bigint
    )
  $$,
  'review page returns public author fields and aggregate counts'
);
select results_eq(
  $$
    select
      page.liked_by_current_user,
      page.disliked_by_current_user,
      page.current_user_report_id
    from public.get_game_reviews_page(910001, 1, 0) as page
  $$,
  $$ values (false, false, null::uuid) $$,
  'anonymous review pages expose no user-specific reaction or report state'
);

select is(
  (
    select count(*)
    from public.get_review_comments_page(
      '21000000-0000-0000-0000-000000000003',
      999,
      -50
    )
  ),
  20::bigint,
  'comment page clamps limit to 20 and a negative offset to zero'
);
select results_eq(
  $$
    select page.comment_id
    from public.get_review_comments_page(
      '21000000-0000-0000-0000-000000000003',
      0,
      -1
    ) as page
  $$,
  $$ values ('22000000-0000-0000-0000-000000000003'::uuid) $$,
  'comment page clamps a zero limit to one without skipping the first row'
);
select results_eq(
  $$
    select page.comment_id
    from public.get_review_comments_page(
      '21000000-0000-0000-0000-000000000003',
      4,
      0
    ) as page
  $$,
  $$
    values
      ('22000000-0000-0000-0000-000000000003'::uuid),
      ('22000000-0000-0000-0000-000000000002'::uuid),
      ('22000000-0000-0000-0000-000000000001'::uuid),
      ('22000000-0000-0000-0000-000000000025'::uuid)
  $$,
  'comments use stable likes, publication time and id ordering'
);
select results_eq(
  $$
    select
      page.author_id,
      page.author_username,
      page.likes_count,
      page.dislikes_count,
      page.total_count,
      page.liked_by_current_user,
      page.disliked_by_current_user,
      page.current_user_report_id
    from public.get_review_comments_page(
      '21000000-0000-0000-0000-000000000003',
      1,
      0
    ) as page
  $$,
  $$
    values (
      '20000000-0000-0000-0000-000000000001'::uuid,
      'review_user_1'::text,
      4::integer,
      0::integer,
      25::bigint,
      false,
      false,
      null::uuid
    )
  $$,
  'anonymous comment page returns public aggregates without caller state'
);

select results_eq(
  $$
    select
      anchor.target_type,
      anchor.review_id,
      anchor.comment_id,
      anchor.review_offset,
      anchor.comment_offset
    from public.get_game_review_anchor(
      910001,
      '21000000-0000-0000-0000-000000000001',
      null
    ) as anchor
  $$,
  $$
    values (
      'review'::text,
      '21000000-0000-0000-0000-000000000001'::uuid,
      null::uuid,
      2::bigint,
      null::bigint
    )
  $$,
  'review anchor returns its zero-based offset under page ordering'
);
select results_eq(
  $$
    select
      anchor.target_type,
      anchor.review_id,
      anchor.comment_id,
      anchor.review_offset,
      anchor.comment_offset
    from public.get_game_review_anchor(
      910001,
      null,
      '22000000-0000-0000-0000-000000000001'
    ) as anchor
  $$,
  $$
    values (
      'comment'::text,
      '21000000-0000-0000-0000-000000000003'::uuid,
      '22000000-0000-0000-0000-000000000001'::uuid,
      0::bigint,
      2::bigint
    )
  $$,
  'comment anchor resolves its parent review and both zero-based offsets'
);
select is(
  (
    select count(*)
    from public.get_game_review_anchor(
      910001,
      '21000000-0000-0000-0000-000000000002',
      '22000000-0000-0000-0000-000000000001'
    )
  ),
  0::bigint,
  'anchor rejects a comment that does not belong to the supplied review'
);
select is(
  (
    select count(*)
    from public.get_game_review_anchor(
      910002,
      '21000000-0000-0000-0000-000000000003',
      null
    )
  ),
  0::bigint,
  'anchor rejects a review that does not belong to the supplied game'
);
select is(
  (
    select count(*)
    from public.get_game_review_anchor(
      910001,
      '21000000-0000-0000-0000-000000000026',
      null
    )
  ),
  0::bigint,
  'review pages and anchors preserve the legacy exclusion of null publication dates'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000025',
  true
);
set local role authenticated;

select results_eq(
  $$
    select
      page.review_id,
      page.liked_by_current_user,
      page.disliked_by_current_user,
      page.current_user_report_id,
      page.current_user_report_reason,
      page.current_user_report_description,
      page.current_user_report_status
    from public.get_game_reviews_page(910001, 4, 0) as page
    where page.review_id in (
      '21000000-0000-0000-0000-000000000002',
      '21000000-0000-0000-0000-000000000003'
    )
    order by page.review_id
  $$,
  $$
    values
      (
        '21000000-0000-0000-0000-000000000002'::uuid,
        false,
        true,
        null::uuid,
        null::text,
        null::text,
        null::text
      ),
      (
        '21000000-0000-0000-0000-000000000003'::uuid,
        true,
        false,
        '23000000-0000-0000-0000-000000000001'::uuid,
        'spam'::text,
        'Review report fixture'::text,
        'pending'::text
      )
  $$,
  'authenticated review page returns only the current user reaction and report state'
);
select results_eq(
  $$
    select
      page.comment_id,
      page.liked_by_current_user,
      page.disliked_by_current_user,
      page.current_user_report_id,
      page.current_user_report_reason,
      page.current_user_report_description,
      page.current_user_report_status
    from public.get_review_comments_page(
      '21000000-0000-0000-0000-000000000003',
      4,
      0
    ) as page
    where page.comment_id in (
      '22000000-0000-0000-0000-000000000002',
      '22000000-0000-0000-0000-000000000003'
    )
    order by page.comment_id
  $$,
  $$
    values
      (
        '22000000-0000-0000-0000-000000000002'::uuid,
        false,
        true,
        null::uuid,
        null::text,
        null::text,
        null::text
      ),
      (
        '22000000-0000-0000-0000-000000000003'::uuid,
        true,
        false,
        '23000000-0000-0000-0000-000000000002'::uuid,
        'conteudo_improprio'::text,
        'Comment report fixture'::text,
        'under_review'::text
      )
  $$,
  'authenticated comment page returns only the current user reaction and report state'
);

select * from finish();
rollback;
