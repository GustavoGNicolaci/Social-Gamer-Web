-- Keep all three policies explicitly scoped to authenticated users.  The
-- reaction policy is a reconciliation; the request/report policies repair the
-- direct auth.uid() calls introduced when their helpers moved to private.

alter policy "Reacoes proprias visiveis"
  on public.comunidade_post_reacoes
  to authenticated
  using (usuario_id = (select auth.uid()));

alter policy "Solicitacoes visiveis para autor ou moderador"
  on public.comunidade_solicitacoes_entrada
  to authenticated
  using (
    usuario_id = (select auth.uid())
    or private.is_comunidade_moderador(
      comunidade_id,
      (select auth.uid())
    )
  );

alter policy "Denuncias visiveis para denunciante ou moderador"
  on public.comunidade_denuncias
  to authenticated
  using (
    denunciante_id = (select auth.uid())
    or private.is_comunidade_moderador(
      comunidade_id,
      (select auth.uid())
    )
  );
