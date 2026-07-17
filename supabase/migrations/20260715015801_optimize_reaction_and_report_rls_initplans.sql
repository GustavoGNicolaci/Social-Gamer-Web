-- Reconcile the twelve reaction/report mutation policies captured in the
-- remote baseline.  Re-evaluating auth.uid() through a scalar subquery lets
-- PostgreSQL use an initplan without changing any authorization predicate.

alter policy avaliacao_curtidas_insert_own
  on public.avaliacao_curtidas
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.avaliacoes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.usuario_id = (select auth.uid())
    )
  );

alter policy avaliacao_curtidas_delete_own
  on public.avaliacao_curtidas
  to authenticated
  using (usuario_id = (select auth.uid()));

alter policy avaliacao_deslikes_insert_own
  on public.avaliacao_deslikes
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.avaliacoes avaliacao
      where avaliacao.id = avaliacao_id
        and avaliacao.usuario_id = (select auth.uid())
    )
  );

alter policy avaliacao_deslikes_delete_own
  on public.avaliacao_deslikes
  to authenticated
  using (usuario_id = (select auth.uid()));

alter policy comentario_curtidas_insert_own
  on public.comentario_curtidas
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.comentarios comentario
      where comentario.id = comentario_id
        and comentario.usuario_id = (select auth.uid())
    )
  );

alter policy comentario_curtidas_delete_own
  on public.comentario_curtidas
  to authenticated
  using (usuario_id = (select auth.uid()));

alter policy comentario_deslikes_insert_own
  on public.comentario_deslikes
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1
      from public.comentarios comentario
      where comentario.id = comentario_id
        and comentario.usuario_id = (select auth.uid())
    )
  );

alter policy comentario_deslikes_delete_own
  on public.comentario_deslikes
  to authenticated
  using (usuario_id = (select auth.uid()));

alter policy denuncias_conteudo_insert_own
  on public.denuncias_conteudo
  to authenticated
  with check (denunciante_id = (select auth.uid()));

alter policy denuncias_conteudo_delete_own
  on public.denuncias_conteudo
  to authenticated
  using (denunciante_id = (select auth.uid()));

alter policy denuncias_perfil_insert_own
  on public.denuncias_perfil
  to authenticated
  with check (
    denunciante_id = (select auth.uid())
    and denunciante_id <> usuario_denunciado_id
  );

alter policy denuncias_perfil_delete_own
  on public.denuncias_perfil
  to authenticated
  using (denunciante_id = (select auth.uid()));
