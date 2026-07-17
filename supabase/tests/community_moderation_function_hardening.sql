begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temporary table expected_community_moderation_functions (
  signature text primary key,
  function_name text not null
) on commit drop;

insert into expected_community_moderation_functions (signature, function_name)
values
  (
    'public.alterar_permissao_postagem(uuid,public.comunidade_permissao_postagem)',
    'alterar_permissao_postagem'
  ),
  ('public.alterar_permissao_postagem(uuid,text)', 'alterar_permissao_postagem'),
  (
    'public.atualizar_status_denuncia_comunidade(uuid,public.comunidade_denuncia_status)',
    'atualizar_status_denuncia_comunidade'
  ),
  (
    'public.criar_denuncia_comunidade(uuid,public.comunidade_denuncia_tipo,uuid,public.comunidade_denuncia_motivo,text)',
    'criar_denuncia_comunidade'
  ),
  (
    'public.editar_comunidade_moderavel(uuid,text,text,text)',
    'editar_comunidade_moderavel'
  ),
  ('public.excluir_comunidade(uuid)', 'excluir_comunidade');

select plan(17);

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
        from expected_community_moderation_functions as expected
      )
  ),
  6,
  'the community moderation mutation allowlist has no unexpected overloads'
);

select ok(
  (
    select pg_catalog.bool_and(pg_catalog.to_regprocedure(expected.signature) is not null)
    from expected_community_moderation_functions as expected
  ),
  'all expected community moderation mutation signatures exist'
);

select ok(
  (
    select pg_catalog.bool_and(
      not pg_catalog.has_function_privilege('anon', expected.signature, 'execute')
    )
    from expected_community_moderation_functions as expected
  ),
  'anonymous users cannot execute community moderation mutations'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('authenticated', expected.signature, 'execute')
    )
    from expected_community_moderation_functions as expected
  ),
  'authenticated users can execute every allowlisted community moderation mutation'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('service_role', expected.signature, 'execute')
    )
    from expected_community_moderation_functions as expected
  ),
  'service-role backends retain the existing community moderation contract'
);

select ok(
  not exists (
    select 1
    from expected_community_moderation_functions as expected
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
    from expected_community_moderation_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community moderation definers use an empty search_path'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.proowner = 'postgres'::pg_catalog.regrole)
    from expected_community_moderation_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community moderation definers retain the expected postgres owner'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.prosecdef)
    from expected_community_moderation_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community moderation mutations retain SECURITY DEFINER semantics'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.criar_comunidade(text,text,text,text,bigint,text,text,text,public.comunidade_visibilidade)',
    'execute'
  ),
  'the authenticated community creation RPC remains executable'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.criar_comunidade(text,text,text,text,bigint,text,text,text,public.comunidade_visibilidade)',
    'execute'
  ),
  'the out-of-scope community creation RPC retains its service-role grant'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.entrar_comunidade(uuid)',
    'execute'
  ),
  'the previously hardened join RPC remains executable by authenticated users'
);

select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.criar_post_comunidade(uuid,text,text)',
    'execute'
  ),
  'the out-of-scope community content mutation remains executable by authenticated users'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.admin_delete_account_data(uuid)',
    'execute'
  ),
  'the legitimate administration RPC retains its service-role grant'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.admin_delete_account_data(uuid)',
    'execute'
  ),
  'the legitimate administration RPC remains unavailable to authenticated callers'
);

select ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.get_community_post_comment_previews(uuid[],integer)',
    'execute'
  ),
  'the deliberate public community comment read model remains executable anonymously'
);

select ok(
  not (
    select procedure.prosecdef
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.get_community_post_comment_previews(uuid[],integer)'::pg_catalog.regprocedure
  ),
  'the community comment read model remains SECURITY INVOKER'
);

select * from finish();
rollback;
