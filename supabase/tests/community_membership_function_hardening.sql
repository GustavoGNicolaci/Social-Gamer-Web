begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temporary table expected_community_membership_functions (
  signature text primary key,
  function_name text not null unique
) on commit drop;

insert into expected_community_membership_functions (signature, function_name)
values
  ('public.alterar_cargo_membro(uuid,uuid,text)', 'alterar_cargo_membro'),
  ('public.aprovar_solicitacao_comunidade(uuid)', 'aprovar_solicitacao_comunidade'),
  ('public.cancelar_solicitacao_comunidade(uuid)', 'cancelar_solicitacao_comunidade'),
  ('public.entrar_comunidade(uuid)', 'entrar_comunidade'),
  ('public.expulsar_membro(uuid,uuid)', 'expulsar_membro'),
  ('public.recusar_solicitacao_comunidade(uuid)', 'recusar_solicitacao_comunidade'),
  ('public.sair_comunidade(uuid)', 'sair_comunidade'),
  ('public.solicitar_entrada_comunidade(uuid)', 'solicitar_entrada_comunidade'),
  ('public.transferir_lideranca(uuid,uuid)', 'transferir_lideranca');

select plan(12);

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
        from expected_community_membership_functions as expected
      )
  ),
  9,
  'the community membership mutation allowlist has no unexpected overloads'
);

select ok(
  (
    select pg_catalog.bool_and(pg_catalog.to_regprocedure(expected.signature) is not null)
    from expected_community_membership_functions as expected
  ),
  'all expected community membership mutation signatures exist'
);

select ok(
  (
    select pg_catalog.bool_and(
      not pg_catalog.has_function_privilege('anon', expected.signature, 'execute')
    )
    from expected_community_membership_functions as expected
  ),
  'anonymous users cannot execute community membership mutations'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('authenticated', expected.signature, 'execute')
    )
    from expected_community_membership_functions as expected
  ),
  'authenticated users can execute every allowlisted community membership mutation'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('service_role', expected.signature, 'execute')
    )
    from expected_community_membership_functions as expected
  ),
  'service-role backends retain the existing community membership contract'
);

select ok(
  not exists (
    select 1
    from expected_community_membership_functions as expected
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
    from expected_community_membership_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community membership definers use an empty search_path'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.proowner = 'postgres'::pg_catalog.regrole)
    from expected_community_membership_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community membership definers retain the expected postgres owner'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.prosecdef)
    from expected_community_membership_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all community membership mutations retain SECURITY DEFINER semantics'
);

select ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.get_community_members_page(uuid,text,integer,integer)',
    'execute'
  ),
  'the deliberate public community member read model remains executable anonymously'
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
