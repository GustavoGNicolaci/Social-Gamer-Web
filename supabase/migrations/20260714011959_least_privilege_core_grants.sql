-- Replace the broad ACLs captured from the remote baseline with the minimum
-- privileges used by the browser. RLS continues to restrict rows; these grants
-- remove table-owner operations (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) from
-- Data API roles entirely.

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

revoke all on table
  public.usuarios,
  public.jogos,
  public.avaliacoes,
  public.comentarios,
  public.avaliacao_curtidas,
  public.avaliacao_deslikes,
  public.comentario_curtidas,
  public.comentario_deslikes,
  public.seguidores,
  public.lista_desejos,
  public.status_jogo,
  public.notifications,
  public.comunidades,
  public.comunidade_membros,
  public.comunidade_posts,
  public.comunidade_post_comentarios,
  public.comunidade_post_reacoes,
  public.comunidade_post_salvos,
  public.comunidade_solicitacoes_entrada,
  public.comunidade_denuncias,
  public.denuncias_conteudo,
  public.denuncias_perfil
from public, anon, authenticated, service_role;

grant all on table
  public.usuarios,
  public.jogos,
  public.avaliacoes,
  public.comentarios,
  public.avaliacao_curtidas,
  public.avaliacao_deslikes,
  public.comentario_curtidas,
  public.comentario_deslikes,
  public.seguidores,
  public.lista_desejos,
  public.status_jogo,
  public.notifications,
  public.comunidades,
  public.comunidade_membros,
  public.comunidade_posts,
  public.comunidade_post_comentarios,
  public.comunidade_post_reacoes,
  public.comunidade_post_salvos,
  public.comunidade_solicitacoes_entrada,
  public.comunidade_denuncias,
  public.denuncias_conteudo,
  public.denuncias_perfil
to service_role;

-- Public identity projection. Sensitive profile fields remain available only
-- through get_my_profile/get_public_profile_by_username.
grant select (
  id,
  username,
  nome_completo,
  avatar_path,
  avatar_url,
  data_cadastro
) on table public.usuarios to anon, authenticated;

grant insert (
  id,
  username,
  nome_completo,
  avatar_path,
  avatar_url,
  bio,
  data_cadastro,
  configuracoes_privacidade
) on table public.usuarios to authenticated;

grant update (
  username,
  nome_completo,
  avatar_path,
  avatar_url,
  bio,
  configuracoes_privacidade
) on table public.usuarios to authenticated;

grant select on table public.jogos to anon, authenticated;

grant select on table public.avaliacoes, public.comentarios to anon, authenticated;
grant insert (usuario_id, jogo_id, nota, texto_review)
  on table public.avaliacoes to authenticated;
grant update (nota, texto_review)
  on table public.avaliacoes to authenticated;
grant delete on table public.avaliacoes to authenticated;

grant insert (usuario_id, review_id, texto)
  on table public.comentarios to authenticated;
grant delete on table public.comentarios to authenticated;

-- Reaction identities and writes stay behind the summary/toggle RPCs. This
-- also prevents callers from bypassing the atomic like/dislike invariant.

grant select on table public.seguidores to authenticated;
grant insert (seguidor_id, seguido_id) on table public.seguidores to authenticated;
grant delete on table public.seguidores to authenticated;

grant select on table public.lista_desejos, public.status_jogo to anon, authenticated;
grant insert, update, delete on table public.lista_desejos to authenticated;
grant insert (usuario_id, jogo_id, status, favorito)
  on table public.status_jogo to authenticated;
grant update (status, favorito)
  on table public.status_jogo to authenticated;
grant delete on table public.status_jogo to authenticated;

grant select on table public.notifications to authenticated;

grant select on table
  public.comunidades,
  public.comunidade_membros,
  public.comunidade_posts,
  public.comunidade_post_comentarios
to anon, authenticated;

grant select on table
  public.comunidade_post_reacoes,
  public.comunidade_post_salvos,
  public.comunidade_solicitacoes_entrada,
  public.comunidade_denuncias
to authenticated;

grant select, delete on table
  public.denuncias_conteudo,
  public.denuncias_perfil
to authenticated;

grant insert (
  denunciante_id,
  tipo_conteudo,
  avaliacao_id,
  comentario_id,
  motivo,
  descricao
) on table public.denuncias_conteudo to authenticated;

grant insert (
  denunciante_id,
  usuario_denunciado_id,
  motivo,
  descricao
) on table public.denuncias_perfil to authenticated;

revoke all on sequence public.jogos_id_seq from public, anon, authenticated, service_role;
grant all on sequence public.jogos_id_seq to service_role;

-- Public wrappers around internal authorization helpers are not application
-- APIs. Keep the functions for compatibility, but remove direct probing.
revoke all on function public.can_user_post_comunidade(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.can_ver_conteudo_comunidade(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.get_comunidade_cargo(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.is_comunidade_lider(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.is_comunidade_membro(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.is_comunidade_moderador(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.home_can_view_user_content(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.usuario_pode_moderar_comunidade(uuid)
from public, anon, authenticated;

grant execute on function public.can_user_post_comunidade(uuid, uuid) to service_role;
grant execute on function public.can_ver_conteudo_comunidade(uuid, uuid) to service_role;
grant execute on function public.get_comunidade_cargo(uuid, uuid) to service_role;
grant execute on function public.is_comunidade_lider(uuid, uuid) to service_role;
grant execute on function public.is_comunidade_membro(uuid, uuid) to service_role;
grant execute on function public.is_comunidade_moderador(uuid, uuid) to service_role;
grant execute on function public.home_can_view_user_content(uuid, uuid) to service_role;
grant execute on function public.usuario_pode_moderar_comunidade(uuid) to service_role;

-- Trigger-only functions must not be callable as Data API RPCs.
revoke all on function public.comunidade_comentarios_count_trigger()
from public, anon, authenticated;
revoke all on function public.comunidade_membros_count_trigger()
from public, anon, authenticated;
revoke all on function public.comunidade_posts_count_trigger()
from public, anon, authenticated;
revoke all on function public.comunidade_reacoes_count_trigger()
from public, anon, authenticated;
revoke all on function public.normalize_avaliacao_metadata()
from public, anon, authenticated;
revoke all on function public.normalize_avaliacao_write()
from public, anon, authenticated;
revoke all on function public.normalize_comentario_metadata()
from public, anon, authenticated;
revoke all on function public.normalize_comentario_write()
from public, anon, authenticated;
revoke all on function public.prevent_self_like_on_review()
from public, anon, authenticated;
revoke all on function public.prevent_self_review_like()
from public, anon, authenticated;
revoke all on function public.set_atualizado_em()
from public, anon, authenticated;
revoke all on function public.set_updated_at()
from public, anon, authenticated;
revoke all on function public.sync_avaliacao_curtidas_count()
from public, anon, authenticated;
revoke all on function public.sync_avaliacao_like_count()
from public, anon, authenticated;
revoke all on function public.touch_updated_at()
from public, anon, authenticated;

grant execute on function public.comunidade_comentarios_count_trigger() to service_role;
grant execute on function public.comunidade_membros_count_trigger() to service_role;
grant execute on function public.comunidade_posts_count_trigger() to service_role;
grant execute on function public.comunidade_reacoes_count_trigger() to service_role;
grant execute on function public.normalize_avaliacao_metadata() to service_role;
grant execute on function public.normalize_avaliacao_write() to service_role;
grant execute on function public.normalize_comentario_metadata() to service_role;
grant execute on function public.normalize_comentario_write() to service_role;
grant execute on function public.prevent_self_like_on_review() to service_role;
grant execute on function public.prevent_self_review_like() to service_role;
grant execute on function public.set_atualizado_em() to service_role;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.sync_avaliacao_curtidas_count() to service_role;
grant execute on function public.sync_avaliacao_like_count() to service_role;
grant execute on function public.touch_updated_at() to service_role;
