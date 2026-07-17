-- Reconcile profile-state policies with initplan-safe auth.uid() calls.  The
-- commands, authenticated role and existing ownership rules stay unchanged.

alter policy lista_desejos_insert_own
  on public.lista_desejos
  to authenticated
  with check ((select auth.uid()) = usuario_id);

alter policy lista_desejos_update_own
  on public.lista_desejos
  to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

alter policy lista_desejos_delete_own
  on public.lista_desejos
  to authenticated
  using ((select auth.uid()) = usuario_id);

alter policy status_jogo_insert_own
  on public.status_jogo
  to authenticated
  with check ((select auth.uid()) = usuario_id);

alter policy status_jogo_update_own
  on public.status_jogo
  to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

alter policy status_jogo_delete_own
  on public.status_jogo
  to authenticated
  using ((select auth.uid()) = usuario_id);

alter policy notifications_select_own
  on public.notifications
  to authenticated
  using (user_id = (select auth.uid()));
