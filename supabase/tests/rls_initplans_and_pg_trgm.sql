begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

-- Reference policies are created on the same relations so their parsed policy
-- trees can be compared exactly with the effective definitions.  The entire
-- test runs in a transaction and rolls these permissive references back.
create policy __contract_expected_reaction_01
  on public.avaliacao_curtidas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.avaliacoes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.usuario_id = (select auth.uid())
    )
  );

create policy __contract_expected_reaction_02
  on public.avaliacao_curtidas for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy __contract_expected_reaction_03
  on public.avaliacao_deslikes for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.avaliacoes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.usuario_id = (select auth.uid())
    )
  );

create policy __contract_expected_reaction_04
  on public.avaliacao_deslikes for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy __contract_expected_reaction_05
  on public.comentario_curtidas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.comentarios comentario
      where comentario.id = comentario_id
        and comentario.usuario_id = (select auth.uid())
    )
  );

create policy __contract_expected_reaction_06
  on public.comentario_curtidas for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy __contract_expected_reaction_07
  on public.comentario_deslikes for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.comentarios comentario
      where comentario.id = comentario_id
        and comentario.usuario_id = (select auth.uid())
    )
  );

create policy __contract_expected_reaction_08
  on public.comentario_deslikes for delete to authenticated
  using (usuario_id = (select auth.uid()));

create policy __contract_expected_report_01
  on public.denuncias_conteudo for insert to authenticated
  with check (denunciante_id = (select auth.uid()));

create policy __contract_expected_report_02
  on public.denuncias_conteudo for delete to authenticated
  using (denunciante_id = (select auth.uid()));

create policy __contract_expected_report_03
  on public.denuncias_perfil for insert to authenticated
  with check (
    denunciante_id = (select auth.uid())
    and denunciante_id <> usuario_denunciado_id
  );

create policy __contract_expected_report_04
  on public.denuncias_perfil for delete to authenticated
  using (denunciante_id = (select auth.uid()));

create policy __contract_expected_report_05
  on public.denuncias_conteudo for select to authenticated
  using ((select auth.uid()) = denunciante_id);

create policy __contract_expected_report_06
  on public.denuncias_perfil for select to authenticated
  using ((select auth.uid()) = denunciante_id);

create policy __contract_expected_profile_01
  on public.lista_desejos for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_02
  on public.lista_desejos for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_03
  on public.lista_desejos for delete to authenticated
  using ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_04
  on public.status_jogo for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_05
  on public.status_jogo for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_06
  on public.status_jogo for delete to authenticated
  using ((select auth.uid()) = usuario_id);

create policy __contract_expected_profile_07
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy __contract_expected_community_01
  on public.comunidade_post_reacoes for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy __contract_expected_community_02
  on public.comunidade_solicitacoes_entrada for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or private.is_comunidade_moderador(
      comunidade_id,
      (select auth.uid())
    )
  );

create policy __contract_expected_community_03
  on public.comunidade_denuncias for select to authenticated
  using (
    denunciante_id = (select auth.uid())
    or private.is_comunidade_moderador(
      comunidade_id,
      (select auth.uid())
    )
  );

create temporary table expected_policy_contracts (
  actual_name text not null,
  reference_name text not null,
  table_schema text not null,
  table_name text not null
) on commit drop;

insert into expected_policy_contracts (
  actual_name,
  reference_name,
  table_schema,
  table_name
)
values
  ('avaliacao_curtidas_insert_own', '__contract_expected_reaction_01', 'public', 'avaliacao_curtidas'),
  ('avaliacao_curtidas_delete_own', '__contract_expected_reaction_02', 'public', 'avaliacao_curtidas'),
  ('avaliacao_deslikes_insert_own', '__contract_expected_reaction_03', 'public', 'avaliacao_deslikes'),
  ('avaliacao_deslikes_delete_own', '__contract_expected_reaction_04', 'public', 'avaliacao_deslikes'),
  ('comentario_curtidas_insert_own', '__contract_expected_reaction_05', 'public', 'comentario_curtidas'),
  ('comentario_curtidas_delete_own', '__contract_expected_reaction_06', 'public', 'comentario_curtidas'),
  ('comentario_deslikes_insert_own', '__contract_expected_reaction_07', 'public', 'comentario_deslikes'),
  ('comentario_deslikes_delete_own', '__contract_expected_reaction_08', 'public', 'comentario_deslikes'),
  ('denuncias_conteudo_insert_own', '__contract_expected_report_01', 'public', 'denuncias_conteudo'),
  ('denuncias_conteudo_delete_own', '__contract_expected_report_02', 'public', 'denuncias_conteudo'),
  ('denuncias_conteudo_select_own', '__contract_expected_report_05', 'public', 'denuncias_conteudo'),
  ('denuncias_perfil_insert_own', '__contract_expected_report_03', 'public', 'denuncias_perfil'),
  ('denuncias_perfil_delete_own', '__contract_expected_report_04', 'public', 'denuncias_perfil'),
  ('denuncias_perfil_select_own', '__contract_expected_report_06', 'public', 'denuncias_perfil'),
  ('lista_desejos_insert_own', '__contract_expected_profile_01', 'public', 'lista_desejos'),
  ('lista_desejos_update_own', '__contract_expected_profile_02', 'public', 'lista_desejos'),
  ('lista_desejos_delete_own', '__contract_expected_profile_03', 'public', 'lista_desejos'),
  ('status_jogo_insert_own', '__contract_expected_profile_04', 'public', 'status_jogo'),
  ('status_jogo_update_own', '__contract_expected_profile_05', 'public', 'status_jogo'),
  ('status_jogo_delete_own', '__contract_expected_profile_06', 'public', 'status_jogo'),
  ('notifications_select_own', '__contract_expected_profile_07', 'public', 'notifications'),
  ('Reacoes proprias visiveis', '__contract_expected_community_01', 'public', 'comunidade_post_reacoes'),
  ('Solicitacoes visiveis para autor ou moderador', '__contract_expected_community_02', 'public', 'comunidade_solicitacoes_entrada'),
  ('Denuncias visiveis para denunciante ou moderador', '__contract_expected_community_03', 'public', 'comunidade_denuncias');

select results_eq(
  $$
    select
      contract.actual_name,
      actual.polcmd = reference.polcmd as command_matches,
      actual.polroles = reference.polroles as roles_match,
      actual.polpermissive = reference.polpermissive as permissive_matches
    from expected_policy_contracts contract
    join pg_catalog.pg_namespace namespace
      on namespace.nspname = contract.table_schema
    join pg_catalog.pg_class relation
      on relation.relnamespace = namespace.oid
     and relation.relname = contract.table_name
    join pg_catalog.pg_policy actual
      on actual.polrelid = relation.oid
     and actual.polname::text = contract.actual_name
    join pg_catalog.pg_policy reference
      on reference.polrelid = relation.oid
     and reference.polname::text = contract.reference_name
    order by contract.actual_name
  $$,
  $$
    select
      contract.actual_name,
      true as command_matches,
      true as roles_match,
      true as permissive_matches
    from expected_policy_contracts contract
    order by contract.actual_name
  $$,
  'the 24 policies retain their commands, authenticated role and permissive mode'
);

select results_eq(
  $$
    select
      contract.actual_name,
      pg_catalog.pg_get_expr(actual.polqual, relation.oid, false)
        is not distinct from
        pg_catalog.pg_get_expr(reference.polqual, relation.oid, false)
        as using_matches,
      pg_catalog.pg_get_expr(actual.polwithcheck, relation.oid, false)
        is not distinct from
        pg_catalog.pg_get_expr(reference.polwithcheck, relation.oid, false)
        as check_matches
    from expected_policy_contracts contract
    join pg_catalog.pg_namespace namespace
      on namespace.nspname = contract.table_schema
    join pg_catalog.pg_class relation
      on relation.relnamespace = namespace.oid
     and relation.relname = contract.table_name
    join pg_catalog.pg_policy actual
      on actual.polrelid = relation.oid
     and actual.polname::text = contract.actual_name
    join pg_catalog.pg_policy reference
      on reference.polrelid = relation.oid
     and reference.polname::text = contract.reference_name
    order by contract.actual_name
  $$,
  $$
    select
      contract.actual_name,
      true as using_matches,
      true as check_matches
    from expected_policy_contracts contract
    order by contract.actual_name
  $$,
  'the 24 effective USING and WITH CHECK trees match the initplan-safe contracts'
);

select is(
  (
    select namespace.nspname
    from pg_catalog.pg_extension installed_extension
    join pg_catalog.pg_namespace namespace
      on namespace.oid = installed_extension.extnamespace
    where installed_extension.extname = 'pg_trgm'
  ),
  'extensions',
  'pg_trgm is installed in the extensions schema'
);

select ok(
  coalesce((
    select
      index_metadata.indisvalid
      and index_metadata.indisready
      and table_namespace.nspname = 'public'
      and table_relation.relname = 'jogos'
    from pg_catalog.pg_index index_metadata
    join pg_catalog.pg_class index_relation
      on index_relation.oid = index_metadata.indexrelid
    join pg_catalog.pg_class table_relation
      on table_relation.oid = index_metadata.indrelid
    join pg_catalog.pg_namespace table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where index_relation.oid = to_regclass('public.jogos_titulo_trgm_idx')
  ), false),
  'jogos_titulo_trgm_idx remains valid, ready and attached to public.jogos'
);

select ok(
  exists (
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
  ),
  'jogos_titulo_trgm_idx still uses extensions.gin_trgm_ops'
);

select * from finish();
rollback;
