-- Harden only the two notification mutations called by the authenticated
-- frontend. Their bodies already qualify the application table and auth.uid(),
-- so an empty function-level search_path preserves their behavior.

do $migration_guard$
declare
  v_signature text;
  v_function regprocedure;
  v_target_names constant text[] := array[
    'mark_all_notifications_read',
    'mark_notification_read'
  ];
  v_target_signatures constant text[] := array[
    'public.mark_all_notifications_read()',
    'public.mark_notification_read(uuid)'
  ];
  v_matching_count integer;
begin
  select count(*)::integer
  into v_matching_count
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.prokind = 'f'
    and procedure.proname = any (v_target_names);

  if v_matching_count <> cardinality(v_target_signatures) then
    raise exception
      'notification hardening allowlist mismatch: expected % functions, found %',
      cardinality(v_target_signatures),
      v_matching_count;
  end if;

  foreach v_signature in array v_target_signatures loop
    v_function := pg_catalog.to_regprocedure(v_signature);

    if v_function is null then
      raise exception 'notification function is missing: %', v_signature;
    end if;

    if not (
      select procedure.prosecdef
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) then
      raise exception 'notification function is not SECURITY DEFINER: %', v_signature;
    end if;

    if (
      select procedure.proowner
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) <> 'postgres'::pg_catalog.regrole then
      raise exception 'notification function has an unexpected owner: %', v_signature;
    end if;
  end loop;
end;
$migration_guard$;

alter function public.mark_all_notifications_read() set search_path = '';
alter function public.mark_notification_read(uuid) set search_path = '';

revoke all on function public.mark_all_notifications_read()
from public, anon, authenticated, service_role;
revoke all on function public.mark_notification_read(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.mark_all_notifications_read()
to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid)
to authenticated, service_role;
