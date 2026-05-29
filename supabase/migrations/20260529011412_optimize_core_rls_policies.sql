begin;

-- usuarios
drop policy if exists "usuarios_public_read" on public.usuarios;
drop policy if exists "usuarios_select_public_profiles" on public.usuarios;
drop policy if exists "usuarios_insert_own_profile" on public.usuarios;
drop policy if exists "usuarios_update_own_account_settings" on public.usuarios;
drop policy if exists "usuarios_update_own_profile" on public.usuarios;

create policy "usuarios_select_public_profiles"
on public.usuarios for select
to anon, authenticated
using (true);

create policy "usuarios_insert_own_profile"
on public.usuarios for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "usuarios_update_own_profile"
on public.usuarios for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- seguidores
drop policy if exists "seguidores_public_read" on public.seguidores;
drop policy if exists "seguidores_select_relationships" on public.seguidores;
drop policy if exists "seguidores_insert_own" on public.seguidores;
drop policy if exists "seguidores_insert_own_relationship" on public.seguidores;
drop policy if exists "seguidores_delete_own" on public.seguidores;
drop policy if exists "seguidores_delete_own_relationship" on public.seguidores;

create policy "seguidores_select_relationships"
on public.seguidores for select
to anon, authenticated
using (true);

create policy "seguidores_insert_own_relationship"
on public.seguidores for insert
to authenticated
with check (
  seguidor_id = (select auth.uid())
  and seguido_id <> (select auth.uid())
);

create policy "seguidores_delete_own_relationship"
on public.seguidores for delete
to authenticated
using (seguidor_id = (select auth.uid()));

-- avaliacoes
drop policy if exists "Anyone can view reviews" on public.avaliacoes;
drop policy if exists "Users can view all reviews" on public.avaliacoes;
drop policy if exists "avaliacoes_select_all" on public.avaliacoes;
drop policy if exists "avaliacoes_select_public" on public.avaliacoes;
drop policy if exists "Users can create own reviews" on public.avaliacoes;
drop policy if exists "Users can insert their own reviews" on public.avaliacoes;
drop policy if exists "avaliacoes_insert_own" on public.avaliacoes;
drop policy if exists "Users can update own reviews" on public.avaliacoes;
drop policy if exists "Users can update their own reviews" on public.avaliacoes;
drop policy if exists "avaliacoes_update_own" on public.avaliacoes;
drop policy if exists "Users can delete their own reviews" on public.avaliacoes;
drop policy if exists "avaliacoes_delete_own" on public.avaliacoes;

create policy "avaliacoes_select_public"
on public.avaliacoes for select
to anon, authenticated
using (true);

create policy "avaliacoes_insert_own"
on public.avaliacoes for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy "avaliacoes_update_own"
on public.avaliacoes for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

create policy "avaliacoes_delete_own"
on public.avaliacoes for delete
to authenticated
using ((select auth.uid()) = usuario_id);

-- comentarios
drop policy if exists "comentarios_select_all" on public.comentarios;
drop policy if exists "comentarios_select_public" on public.comentarios;
drop policy if exists "Users can delete own comments" on public.comentarios;
drop policy if exists "comentarios_delete_own" on public.comentarios;
drop policy if exists "comentarios_insert_own" on public.comentarios;
drop policy if exists "comentarios_update_own" on public.comentarios;

create policy "comentarios_select_public"
on public.comentarios for select
to anon, authenticated
using (true);

create policy "comentarios_insert_own"
on public.comentarios for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create policy "comentarios_update_own"
on public.comentarios for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

create policy "comentarios_delete_own"
on public.comentarios for delete
to authenticated
using ((select auth.uid()) = usuario_id);

-- comunidade_post_salvos
drop policy if exists "Salvos proprios visiveis" on public.comunidade_post_salvos;
drop policy if exists "Usuario le seus posts salvos" on public.comunidade_post_salvos;
drop policy if exists "comunidade_post_salvos_select_own" on public.comunidade_post_salvos;

create policy "comunidade_post_salvos_select_own"
on public.comunidade_post_salvos for select
to authenticated
using (usuario_id = (select auth.uid()));

commit;
