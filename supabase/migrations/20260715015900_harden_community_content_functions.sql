-- Harden only the community content mutations called by
-- src/features/communities/data/posts.ts. Their PL/pgSQL bodies already
-- qualify every application relation, helper and auth function with public,
-- private or auth, so an empty function search_path preserves behavior while
-- removing object-shadowing risk.

do $migration_guard$
declare
  v_signature text;
  v_function regprocedure;
  v_body text;
  v_reference text;
  v_target_names constant text[] := array[
    'alterar_fixacao_post_comunidade',
    'alternar_post_salvo',
    'alternar_reacao_post',
    'criar_comentario_comunidade',
    'criar_post_comunidade',
    'excluir_comentario_comunidade',
    'excluir_post_comunidade'
  ];
  v_target_signatures constant text[] := array[
    'public.alterar_fixacao_post_comunidade(uuid,boolean)',
    'public.alternar_post_salvo(uuid)',
    'public.alternar_reacao_post(uuid,text)',
    'public.criar_comentario_comunidade(uuid,text)',
    'public.criar_post_comunidade(uuid,text,text)',
    'public.excluir_comentario_comunidade(uuid)',
    'public.excluir_post_comunidade(uuid)'
  ];
  v_application_references constant text[] := array[
    'uid',
    'comunidades',
    'comunidade_posts',
    'comunidade_post_comentarios',
    'comunidade_post_reacoes',
    'comunidade_post_salvos',
    'comunidade_reacao_tipo',
    'get_comunidade_cargo',
    'is_comunidade_membro',
    'is_comunidade_moderador',
    'usuario_pode_moderar_comunidade'
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
      'community content hardening allowlist mismatch: expected % functions, found %',
      cardinality(v_target_signatures),
      v_matching_count;
  end if;

  foreach v_signature in array v_target_signatures loop
    v_function := pg_catalog.to_regprocedure(v_signature);

    if v_function is null then
      raise exception 'community content function is missing: %', v_signature;
    end if;

    select procedure.prosrc
    into v_body
    from pg_catalog.pg_proc as procedure
    where procedure.oid = v_function;

    if not (
      select procedure.prosecdef
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) then
      raise exception 'community content function is not SECURITY DEFINER: %', v_signature;
    end if;

    if (
      select procedure.proowner
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_function
    ) <> 'postgres'::pg_catalog.regrole then
      raise exception 'community content function has an unexpected owner: %', v_signature;
    end if;

    foreach v_reference in array v_application_references loop
      if pg_catalog.regexp_count(
        pg_catalog.lower(v_body),
        '\m' || v_reference || '\M'
      ) > pg_catalog.regexp_count(
        pg_catalog.lower(v_body),
        '(public|private|auth)[[:space:]]*\.[[:space:]]*\m'
          || v_reference
          || '\M'
      ) then
        raise exception
          'community content function contains an unqualified application reference (%): %',
          v_reference,
          v_signature;
      end if;
    end loop;
  end loop;
end;
$migration_guard$;

alter function public.alterar_fixacao_post_comunidade(uuid, boolean) set search_path = '';
alter function public.alternar_post_salvo(uuid) set search_path = '';
alter function public.alternar_reacao_post(uuid, text) set search_path = '';
alter function public.criar_comentario_comunidade(uuid, text) set search_path = '';
alter function public.criar_post_comunidade(uuid, text, text) set search_path = '';
alter function public.excluir_comentario_comunidade(uuid) set search_path = '';
alter function public.excluir_post_comunidade(uuid) set search_path = '';

revoke all on function public.alterar_fixacao_post_comunidade(uuid, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.alternar_post_salvo(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.alternar_reacao_post(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.criar_comentario_comunidade(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.criar_post_comunidade(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.excluir_comentario_comunidade(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.excluir_post_comunidade(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.alterar_fixacao_post_comunidade(uuid, boolean)
to authenticated, service_role;
grant execute on function public.alternar_post_salvo(uuid)
to authenticated, service_role;
grant execute on function public.alternar_reacao_post(uuid, text)
to authenticated, service_role;
grant execute on function public.criar_comentario_comunidade(uuid, text)
to authenticated, service_role;
grant execute on function public.criar_post_comunidade(uuid, text, text)
to authenticated, service_role;
grant execute on function public.excluir_comentario_comunidade(uuid)
to authenticated, service_role;
grant execute on function public.excluir_post_comunidade(uuid)
to authenticated, service_role;
