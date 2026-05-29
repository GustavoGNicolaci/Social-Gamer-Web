begin;

-- avaliacao_curtidas: keep avaliacao_curtidas_avaliacao_id_idx for avaliacao_id lookups.
drop index if exists public.avaliacao_curtidas_avaliacao_idx;
drop index if exists public.idx_home_avaliacao_curtidas_avaliacao;

-- avaliacao_curtidas: keep avaliacao_curtidas_usuario_id_idx for usuario_id lookups.
drop index if exists public.avaliacao_curtidas_usuario_idx;

-- avaliacao_curtidas: keep one unique rule for (avaliacao_id, usuario_id).
alter table if exists public.avaliacao_curtidas
  drop constraint if exists avaliacao_curtidas_avaliacao_id_usuario_id_key;
drop index if exists public.avaliacao_curtidas_unique_idx;

-- avaliacoes: keep idx_home_avaliacoes_jogo_data for (jogo_id, data_publicacao desc).
drop index if exists public.avaliacoes_jogo_publicacao_idx;

-- avaliacoes: keep idx_home_avaliacoes_usuario_data for (usuario_id, data_publicacao desc).
drop index if exists public.avaliacoes_usuario_publicacao_idx;
drop index if exists public.idx_avaliacoes_usuario_data_publicacao;

-- avaliacoes: keep one unique rule for (usuario_id, jogo_id).
alter table if exists public.avaliacoes
  drop constraint if exists avaliacoes_usuario_jogo_unique;

-- comunidade_posts: keep idx_comunidade_posts_feed.
drop index if exists public.comunidade_posts_feed_created_idx;

-- lista_desejos: keep lista_desejos_usuario_prioridade_idx.
drop index if exists public.idx_lista_desejos_usuario_prioridade_adicionado;

-- notifications: keep notifications_user_unread_idx.
drop index if exists public.notifications_user_unread_created_idx;

-- seguidores: keep seguidores_seguido_id_idx.
drop index if exists public.seguidores_seguido_idx;

-- seguidores: keep seguidores_seguido_seguidor_idx.
drop index if exists public.idx_home_seguidores_seguido_seguidor;

-- seguidores: keep seguidores_seguidor_seguido_idx.
drop index if exists public.idx_home_seguidores_seguidor_seguido;

-- seguidores: keep one unique rule for (seguidor_id, seguido_id).
alter table if exists public.seguidores
  drop constraint if exists seguidores_seguidor_id_seguido_id_key;

-- status_jogo: keep idx_status_jogo_usuario_created_at.
drop index if exists public.idx_home_status_jogo_usuario_created;

commit;
