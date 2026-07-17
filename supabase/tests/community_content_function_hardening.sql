begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temporary table expected_community_content_functions (
  signature text primary key,
  function_name text not null unique
) on commit drop;

insert into expected_community_content_functions (signature, function_name)
values
  ('public.alterar_fixacao_post_comunidade(uuid,boolean)', 'alterar_fixacao_post_comunidade'),
  ('public.alternar_post_salvo(uuid)', 'alternar_post_salvo'),
  ('public.alternar_reacao_post(uuid,text)', 'alternar_reacao_post'),
  ('public.criar_comentario_comunidade(uuid,text)', 'criar_comentario_comunidade'),
  ('public.criar_post_comunidade(uuid,text,text)', 'criar_post_comunidade'),
  ('public.excluir_comentario_comunidade(uuid)', 'excluir_comentario_comunidade'),
  ('public.excluir_post_comunidade(uuid)', 'excluir_post_comunidade');

create temporary table expected_community_content_references (
  reference_name text primary key
) on commit drop;

insert into expected_community_content_references (reference_name)
values
  ('uid'),
  ('comunidades'),
  ('comunidade_posts'),
  ('comunidade_post_comentarios'),
  ('comunidade_post_reacoes'),
  ('comunidade_post_salvos'),
  ('comunidade_reacao_tipo'),
  ('get_comunidade_cargo'),
  ('is_comunidade_membro'),
  ('is_comunidade_moderador'),
  ('usuario_pode_moderar_comunidade');

create temporary table expected_public_content_read_models (
  signature text primary key,
  function_name text not null unique
) on commit drop;

insert into expected_public_content_read_models (signature, function_name)
values
  (
    'public.get_community_post_comment_previews(uuid[],integer)',
    'get_community_post_comment_previews'
  ),
  (
    'public.get_community_post_comments_page(uuid,integer,integer)',
    'get_community_post_comments_page'
  ),
  (
    'public.get_community_comment_anchor(uuid,uuid,integer)',
    'get_community_comment_anchor'
  );

select plan(16);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.proname in (
        select expected.function_name
        from expected_community_content_functions as expected
      )
  ),
  7,
  'the community content mutation allowlist has no unexpected overloads'
);

select ok(
  (
    select pg_catalog.bool_and(pg_catalog.to_regprocedure(expected.signature) is not null)
    from expected_community_content_functions as expected
  ),
  'all expected community content mutation signatures exist'
);

select ok(
  (
    select pg_catalog.bool_and(
      not pg_catalog.has_function_privilege('anon', expected.signature, 'execute')
    )
    from expected_community_content_functions as expected
  ),
  'anonymous users cannot execute community content mutations'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('authenticated', expected.signature, 'execute')
    )
    from expected_community_content_functions as expected
  ),
  'authenticated users can execute every allowlisted community content mutation'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('service_role', expected.signature, 'execute')
    )
    from expected_community_content_functions as expected
  ),
  'service-role backends retain the existing community content contract'
);

select ok(
  not exists (
    select 1
    from expected_community_content_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl_entry
    where acl_entry.privilege_type = 'EXECUTE'
      and acl_entry.grantee not in (
        procedure.proowner,
        'authenticated'::pg_catalog.regrole,
        'service_role'::pg_catalog.regrole
      )
  ),
  'no role outside the owner, authenticated and service-role allowlist has execute'
);

select ok(
  (
    select pg_catalog.bool_and(
      exists (
        select 1
        from unnest(procedure.proconfig) as setting(value)
        where setting.value in ('search_path=', 'search_path=""')
      )
    )
    from expected_community_content_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community content definers use an empty search_path'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.proowner = 'postgres'::pg_catalog.regrole)
    from expected_community_content_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community content definers retain the expected postgres owner'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.prosecdef)
    from expected_community_content_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community content mutations retain SECURITY DEFINER semantics'
);

select ok(
  not exists (
    select 1
    from expected_community_content_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
    cross join expected_community_content_references as reference
    where pg_catalog.regexp_count(
      pg_catalog.lower(procedure.prosrc),
      '\m' || reference.reference_name || '\M'
    ) > pg_catalog.regexp_count(
      pg_catalog.lower(procedure.prosrc),
      '(public|private|auth)[[:space:]]*\.[[:space:]]*\m'
        || reference.reference_name
        || '\M'
    )
  ),
  'all application relations, helpers and auth calls remain schema-qualified'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.proname in (
        select expected.function_name
        from expected_public_content_read_models as expected
      )
  ),
  3,
  'the deliberate public content read-model allowlist has no unexpected overloads'
);

select ok(
  (
    select pg_catalog.bool_and(pg_catalog.to_regprocedure(expected.signature) is not null)
    from expected_public_content_read_models as expected
  ),
  'all deliberate public content read-model signatures still exist'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('anon', expected.signature, 'execute')
    )
    from expected_public_content_read_models as expected
  ),
  'anonymous users retain access to the public community content read models'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('authenticated', expected.signature, 'execute')
    )
    from expected_public_content_read_models as expected
  ),
  'authenticated users retain access to the public community content read models'
);

select ok(
  (
    select pg_catalog.bool_and(not procedure.prosecdef)
    from expected_public_content_read_models as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'public community content read models remain SECURITY INVOKER'
);

select ok(
  (
    select pg_catalog.bool_and(
      exists (
        select 1
        from unnest(procedure.proconfig) as setting(value)
        where setting.value in ('search_path=', 'search_path=""')
      )
    )
    from expected_public_content_read_models as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'public community content read models retain an empty search_path'
);

select * from finish();
rollback;
