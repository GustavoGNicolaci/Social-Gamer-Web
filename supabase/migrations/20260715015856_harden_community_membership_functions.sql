-- Harden only the community membership mutations reconciled in
-- 20260714005856_reconcile_remote_runtime_objects.sql. Their bodies already
-- qualify every application relation/helper with public, private or auth, so
-- changing the function-level search_path does not change business behavior.

do $migration_guard$
declare
  v_signature text;
  v_function regprocedure;
  v_target_names constant text[] := array[
    'alterar_cargo_membro',
    'aprovar_solicitacao_comunidade',
    'cancelar_solicitacao_comunidade',
    'entrar_comunidade',
    'expulsar_membro',
    'recusar_solicitacao_comunidade',
    'sair_comunidade',
    'solicitar_entrada_comunidade',
    'transferir_lideranca'
  ];
  v_target_signatures constant text[] := array[
    'public.alterar_cargo_membro(uuid,uuid,text)',
    'public.aprovar_solicitacao_comunidade(uuid)',
    'public.cancelar_solicitacao_comunidade(uuid)',
    'public.entrar_comunidade(uuid)',
    'public.expulsar_membro(uuid,uuid)',
    'public.recusar_solicitacao_comunidade(uuid)',
    'public.sair_comunidade(uuid)',
    'public.solicitar_entrada_comunidade(uuid)',
    'public.transferir_lideranca(uuid,uuid)'
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
      'community membership hardening allowlist mismatch: expected % functions, found %',
      cardinality(v_target_signatures),
      v_matching_count;
  end if;

  foreach v_signature in array v_target_signatures loop
    v_function := pg_catalog.to_regprocedure(v_signature);

    if v_function is null then
      raise exception 'community membership function is missing: %', v_signature;
    end if;

    if not (
      select procedure.prosecdef
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) then
      raise exception 'community membership function is not SECURITY DEFINER: %', v_signature;
    end if;

    if (
      select procedure.proowner
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) <> 'postgres'::pg_catalog.regrole then
      raise exception 'community membership function has an unexpected owner: %', v_signature;
    end if;
  end loop;
end;
$migration_guard$;

alter function public.alterar_cargo_membro(uuid, uuid, text) set search_path = '';
alter function public.aprovar_solicitacao_comunidade(uuid) set search_path = '';
alter function public.cancelar_solicitacao_comunidade(uuid) set search_path = '';
alter function public.entrar_comunidade(uuid) set search_path = '';
alter function public.expulsar_membro(uuid, uuid) set search_path = '';
alter function public.recusar_solicitacao_comunidade(uuid) set search_path = '';
alter function public.sair_comunidade(uuid) set search_path = '';
alter function public.solicitar_entrada_comunidade(uuid) set search_path = '';
alter function public.transferir_lideranca(uuid, uuid) set search_path = '';

revoke all on function public.alterar_cargo_membro(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.aprovar_solicitacao_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.cancelar_solicitacao_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.entrar_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.expulsar_membro(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.recusar_solicitacao_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.sair_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.solicitar_entrada_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.transferir_lideranca(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.alterar_cargo_membro(uuid, uuid, text)
to authenticated, service_role;
grant execute on function public.aprovar_solicitacao_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.cancelar_solicitacao_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.entrar_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.expulsar_membro(uuid, uuid)
to authenticated, service_role;
grant execute on function public.recusar_solicitacao_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.sair_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.solicitar_entrada_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.transferir_lideranca(uuid, uuid)
to authenticated, service_role;
