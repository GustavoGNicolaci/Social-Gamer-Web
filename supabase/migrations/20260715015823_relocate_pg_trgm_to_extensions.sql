-- pg_trgm was installed in public by the reconstructed baseline.  Moving the
-- extension relocates its objects while retaining the OIDs and dependencies
-- used by jogos_titulo_trgm_idx; the index must not be dropped or rebuilt.

create schema if not exists extensions;

do $$
declare
  current_extension_schema text;
begin
  select namespace.nspname
    into current_extension_schema
  from pg_catalog.pg_extension installed_extension
  join pg_catalog.pg_namespace namespace
    on namespace.oid = installed_extension.extnamespace
  where installed_extension.extname = 'pg_trgm';

  if current_extension_schema is null then
    raise exception using
      errcode = '55000',
      message = 'pg_trgm is missing; apply the catalog baseline before relocating it';
  elsif current_extension_schema = 'public' then
    execute 'alter extension pg_trgm set schema extensions';
  elsif current_extension_schema <> 'extensions' then
    raise exception using
      errcode = '55000',
      message = format(
        'pg_trgm is installed in unexpected schema %I; expected public or extensions',
        current_extension_schema
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index index_metadata
    join pg_catalog.pg_class index_relation
      on index_relation.oid = index_metadata.indexrelid
    join pg_catalog.pg_class table_relation
      on table_relation.oid = index_metadata.indrelid
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where index_relation.oid = to_regclass('public.jogos_titulo_trgm_idx')
      and table_namespace.nspname = 'public'
      and table_relation.relname = 'jogos'
      and index_metadata.indisvalid
      and index_metadata.indisready
  ) then
    raise exception using
      errcode = '55000',
      message = 'jogos_titulo_trgm_idx is missing, invalid, or not ready';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index index_metadata
    join pg_catalog.pg_class index_relation
      on index_relation.oid = index_metadata.indexrelid
    join pg_catalog.pg_opclass operator_class
      on operator_class.oid = any (index_metadata.indclass::oid[])
    join pg_catalog.pg_namespace operator_namespace
      on operator_namespace.oid = operator_class.opcnamespace
    where index_relation.oid = to_regclass('public.jogos_titulo_trgm_idx')
      and operator_class.opcname = 'gin_trgm_ops'
      and operator_namespace.nspname = 'extensions'
  ) then
    raise exception using
      errcode = '55000',
      message = 'jogos_titulo_trgm_idx no longer uses extensions.gin_trgm_ops';
  end if;
end;
$$;
