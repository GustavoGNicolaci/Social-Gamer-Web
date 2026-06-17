export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Nullable<T> = T | null
export type Relation<T> = T | T[] | null

export type GameStatusValue = 'jogando' | 'zerado' | 'dropado' | 'planejando' | 'pausado'
export type CommunityRole = 'lider' | 'admin' | 'membro'
export type CommunityPostingPermission = 'todos_membros' | 'somente_admins' | 'somente_lider'
export type CommunityVisibility = 'publica' | 'privada'
export type CommunityReactionType = 'curtida' | 'dislike'
export type CommunityJoinRequestStatus = 'pendente' | 'aprovada' | 'recusada' | 'cancelada'
export type CommunityReportTargetType = 'post' | 'comentario'
export type CommunityReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'
export type ContentReportTargetType = 'review' | 'comment'
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export interface UsuarioRow {
  id: string
  username: Nullable<string>
  nome_completo: Nullable<string>
  avatar_url: Nullable<string>
  avatar_path: Nullable<string>
  bio: Nullable<string>
  data_cadastro: Nullable<string>
  configuracoes_privacidade: Nullable<Record<string, unknown>>
}

export interface JogoRow {
  id: number
  titulo: string
  capa_url: Nullable<string>
  desenvolvedora: Nullable<string[] | string>
  generos: Nullable<string[] | string>
  data_lancamento: Nullable<string>
  descricao: Nullable<string>
  plataformas: Nullable<string[] | string>
}

export interface AvaliacaoRow {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number | string
  texto_review: Nullable<string>
  curtidas: number | string | null
  data_publicacao: Nullable<string>
  editado_em: Nullable<string>
}

export interface ComentarioRow {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: Nullable<string>
}

export interface StatusJogoRow {
  id: string
  usuario_id: string
  jogo_id: number
  status: GameStatusValue
  created_at: Nullable<string>
  favorito: Nullable<boolean>
}

export interface ListaDesejosRow {
  id: string
  usuario_id: string
  jogo_id: number
  adicionado_em: string
  prioridade: number
}

export interface NotificationRow {
  id: string
  user_id: string
  actor_id: Nullable<string>
  type: string
  title: string
  message: Nullable<string>
  entity_type: Nullable<string>
  entity_id: Nullable<string>
  link: Nullable<string>
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: Nullable<string>
  created_at: string
  dedupe_key?: Nullable<string>
}

export interface ComunidadeRow {
  id: string
  nome: string
  descricao: Nullable<string>
  banner_path: Nullable<string>
  tipo: Nullable<string>
  jogo_id: Nullable<number>
  categoria: Nullable<string>
  regras: Nullable<string>
  permissao_postagem: CommunityPostingPermission
  visibilidade: CommunityVisibility
  lider_id: string
  membros_count: number | string
  posts_count: number | string
  created_at: string
  updated_at: string
  deleted_at?: Nullable<string>
}
