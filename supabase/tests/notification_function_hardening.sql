begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temporary table expected_notification_functions (
  signature text primary key,
  function_name text not null unique
) on commit drop;

insert into expected_notification_functions (signature, function_name)
values
  ('public.mark_all_notifications_read()', 'mark_all_notifications_read'),
  ('public.mark_notification_read(uuid)', 'mark_notification_read');

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
        from expected_notification_functions as expected
      )
  ),
  2,
  'the notification mutation allowlist has no unexpected overloads'
);

select ok(
  (
    select pg_catalog.bool_and(pg_catalog.to_regprocedure(expected.signature) is not null)
    from expected_notification_functions as expected
  ),
  'all expected notification mutation signatures exist'
);

select ok(
  (
    select pg_catalog.bool_and(
      not pg_catalog.has_function_privilege('anon', expected.signature, 'execute')
    )
    from expected_notification_functions as expected
  ),
  'anonymous users cannot execute notification mutations'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('authenticated', expected.signature, 'execute')
    )
    from expected_notification_functions as expected
  ),
  'authenticated users can execute every allowlisted notification mutation'
);

select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_function_privilege('service_role', expected.signature, 'execute')
    )
    from expected_notification_functions as expected
  ),
  'service-role backends retain the existing notification mutation contract'
);

select ok(
  not exists (
    select 1
    from expected_notification_functions as expected
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
    from expected_notification_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all notification definers use an empty search_path'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.proowner = 'postgres'::pg_catalog.regrole)
    from expected_notification_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all notification definers retain the expected postgres owner'
);

select ok(
  (
    select pg_catalog.bool_and(procedure.prosecdef)
    from expected_notification_functions as expected
    join pg_catalog.pg_proc as procedure
      on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  ),
  'all notification mutations retain SECURITY DEFINER semantics'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.create_notification(uuid,uuid,text,text,text,text,text,text,jsonb,text)',
    'execute'
  ),
  'the service-only notification creation helper keeps its execute grant'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_notification(uuid,uuid,text,text,text,text,text,text,jsonb,text)',
    'execute'
  ),
  'authenticated clients cannot call the notification creation helper directly'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'notifications'
      and policy.policyname = 'notifications_select_own'
  ),
  'the notification ownership RLS policy remains present'
);

select * from finish();
rollback;
