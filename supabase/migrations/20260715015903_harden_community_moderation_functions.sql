-- Harden only moderation mutations called by the authenticated web client.
-- Community creation/join/content functions, public read models, trigger/helper
-- functions and service-role administration remain deliberately out of scope.
-- The reconciled bodies below already qualify every application relation and
-- helper with public, private or auth, so only function metadata and ACLs change.

do $migration_guard$
declare
  v_signature text;
  v_function regprocedure;
  v_target_names constant text[] := array[
    'alterar_permissao_postagem',
    'atualizar_status_denuncia_comunidade',
    'criar_denuncia_comunidade',
    'editar_comunidade_moderavel',
    'excluir_comunidade'
  ];
  v_target_signatures constant text[] := array[
    'public.alterar_permissao_postagem(uuid,public.comunidade_permissao_postagem)',
    'public.alterar_permissao_postagem(uuid,text)',
    'public.atualizar_status_denuncia_comunidade(uuid,public.comunidade_denuncia_status)',
    'public.criar_denuncia_comunidade(uuid,public.comunidade_denuncia_tipo,uuid,public.comunidade_denuncia_motivo,text)',
    'public.editar_comunidade_moderavel(uuid,text,text,text)',
    'public.excluir_comunidade(uuid)'
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
      'community moderation hardening allowlist mismatch: expected % functions, found %',
      cardinality(v_target_signatures),
      v_matching_count;
  end if;

  foreach v_signature in array v_target_signatures loop
    v_function := pg_catalog.to_regprocedure(v_signature);

    if v_function is null then
      raise exception 'community moderation function is missing: %', v_signature;
    end if;

    if not (
      select procedure.prosecdef
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) then
      raise exception 'community moderation function is not SECURITY DEFINER: %', v_signature;
    end if;

    if (
      select procedure.proowner
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) <> 'postgres'::pg_catalog.regrole then
      raise exception 'community moderation function has an unexpected owner: %', v_signature;
    end if;
  end loop;
end;
$migration_guard$;

alter function public.alterar_permissao_postagem(
  uuid,
  public.comunidade_permissao_postagem
) set search_path = '';
alter function public.alterar_permissao_postagem(uuid, text) set search_path = '';
alter function public.atualizar_status_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_status
) set search_path = '';
alter function public.criar_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_tipo,
  uuid,
  public.comunidade_denuncia_motivo,
  text
) set search_path = '';
alter function public.editar_comunidade_moderavel(uuid, text, text, text)
set search_path = '';
alter function public.excluir_comunidade(uuid) set search_path = '';

revoke all on function public.alterar_permissao_postagem(
  uuid,
  public.comunidade_permissao_postagem
) from public, anon, authenticated, service_role;
revoke all on function public.alterar_permissao_postagem(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.atualizar_status_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_status
) from public, anon, authenticated, service_role;
revoke all on function public.criar_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_tipo,
  uuid,
  public.comunidade_denuncia_motivo,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.editar_comunidade_moderavel(uuid, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.excluir_comunidade(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.alterar_permissao_postagem(
  uuid,
  public.comunidade_permissao_postagem
) to authenticated, service_role;
grant execute on function public.alterar_permissao_postagem(uuid, text)
to authenticated, service_role;
grant execute on function public.atualizar_status_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_status
) to authenticated, service_role;
grant execute on function public.criar_denuncia_comunidade(
  uuid,
  public.comunidade_denuncia_tipo,
  uuid,
  public.comunidade_denuncia_motivo,
  text
) to authenticated, service_role;
grant execute on function public.editar_comunidade_moderavel(uuid, text, text, text)
to authenticated, service_role;
grant execute on function public.excluir_comunidade(uuid)
to authenticated, service_role;
