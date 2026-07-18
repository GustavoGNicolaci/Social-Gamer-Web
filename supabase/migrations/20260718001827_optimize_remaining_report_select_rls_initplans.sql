-- Preserve the existing authenticated-only ownership checks while allowing
-- PostgreSQL to evaluate auth.uid() once per statement instead of once per row.

alter policy denuncias_conteudo_select_own
on public.denuncias_conteudo
to authenticated
using ((select auth.uid()) = denunciante_id);

alter policy denuncias_perfil_select_own
on public.denuncias_perfil
to authenticated
using ((select auth.uid()) = denunciante_id);
