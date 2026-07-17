import type { CatalogGamePreview } from '../../../services/gameCatalogService'

export type CommunityRole = 'lider' | 'admin' | 'membro'
export type CommunityPostingPermission = 'todos_membros' | 'somente_admins' | 'somente_lider'
export type CommunityReactionType = 'curtida' | 'dislike'
export type CommunityVisibility = 'publica' | 'privada'
export type CommunityJoinRequestStatus = 'pendente' | 'aprovada' | 'recusada' | 'cancelada'
export type CommunityReportTargetType = 'post' | 'comentario'
export type CommunityReportReason =
  | 'spam'
  | 'assedio_ou_ofensa'
  | 'conteudo_improprio'
  | 'informacao_enganosa'
  | 'discurso_de_odio'
  | 'outro'
export type CommunityReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export const COMMUNITY_CATEGORY_VALUES = [
  'rpg',
  'acao',
  'aventura',
  'fps',
  'tps',
  'estrategia',
  'simulacao',
  'corrida',
  'esportes',
  'terror',
  'sobrevivencia',
  'mundo_aberto',
  'indie',
  'multiplayer',
  'competitivo',
  'casual',
  'retro',
  'noticias',
  'guias_e_dicas',
  'discussao_geral',
] as const

export type CommunityCategoryValue = typeof COMMUNITY_CATEGORY_VALUES[number]

export const COMMUNITY_REPORT_REASONS: CommunityReportReason[] = [
  'spam',
  'assedio_ou_ofensa',
  'conteudo_improprio',
  'informacao_enganosa',
  'discurso_de_odio',
  'outro',
]

export interface CommunityError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface CommunityAuthor {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

export interface CommunitySummary {
  id: string
  nome: string
  descricao: string | null
  banner_path: string | null
  tipo: string | null
  jogo_id: number | null
  categoria: string | null
  regras: string | null
  permissao_postagem: CommunityPostingPermission
  visibilidade: CommunityVisibility
  lider_id: string
  membros_count: number
  posts_count: number
  created_at: string
  updated_at: string
  jogo: Pick<CatalogGamePreview, 'id' | 'titulo' | 'capa_url'> | null
  lider: CommunityAuthor | null
  currentUserRole: CommunityRole | null
  currentUserJoinRequestStatus: CommunityJoinRequestStatus | null
  canPost: boolean
  canViewContent: boolean
}

export interface CommunityMember {
  comunidade_id: string
  usuario_id: string
  cargo: CommunityRole
  entrou_em: string
  atualizado_em: string
  usuario: CommunityAuthor | null
}

export interface CommunityPostComment {
  id: string
  post_id: string
  comunidade_id: string
  autor_id: string
  texto: string
  created_at: string
  updated_at: string
  autor: CommunityAuthor | null
}

export interface CommunityPostCommentsPage {
  comments: CommunityPostComment[]
  totalCount: number | null
  nextOffset: number
}

export interface CommunityCommentAnchor {
  found: boolean
  commentOffset: number | null
  pageOffset: number | null
  totalCount: number
}

export interface CommunityCommentTarget {
  id: string
  postId: string
  communityId: string
}

export interface CommunityPost {
  id: string
  comunidade_id: string
  autor_id: string
  texto: string | null
  imagem_path: string | null
  imagem_url: string | null
  curtidas_count: number
  dislikes_count: number
  comentarios_count: number
  created_at: string
  updated_at: string
  fixado: boolean
  fixado_em: string | null
  fixado_por: string | null
  autor: CommunityAuthor | null
  comentarios: CommunityPostComment[]
  commentsNextOffset?: number
  currentUserReaction: CommunityReactionType | null
  savedByCurrentUser: boolean
  canInteract: boolean
  canDelete: boolean
  canPin: boolean
  comunidade?: Pick<CommunitySummary, 'id' | 'nome' | 'banner_path' | 'visibilidade'> | null
}

export interface CommunityJoinRequest {
  id: string
  comunidade_id: string
  usuario_id: string
  status: CommunityJoinRequestStatus
  decidido_por: string | null
  decidido_em: string | null
  created_at: string
  updated_at: string
  usuario: CommunityAuthor | null
  moderador: CommunityAuthor | null
}

export interface CommunityReport {
  id: string
  comunidade_id: string
  denunciante_id: string
  tipo_conteudo: CommunityReportTargetType
  post_id: string | null
  comentario_id: string | null
  motivo: CommunityReportReason
  descricao: string | null
  status: CommunityReportStatus
  created_at: string
  updated_at: string
  denunciante: CommunityAuthor | null
  targetText: string | null
  targetImagePath: string | null
  targetAuthor: CommunityAuthor | null
  targetCreatedAt: string | null
}

export interface CommunityListFilters {
  search?: string
  tipo?: string
  categoria?: string
  gameId?: number | null
  page?: number
  pageSize?: number
  limit?: number
}

export interface CommunityCreationQuota {
  limit: number
  createdCount: number
  remaining: number
  canCreate: boolean
}

export interface CommunityMembersOptions {
  search?: string
  limit?: number
  offset?: number
}

export interface CommunityPostsOptions {
  page?: number
  pageSize?: number
}

export interface CommunityReportsOptions {
  status?: CommunityReportStatus | 'all'
}

export interface CreateCommunityInput {
  nome: string
  descricao?: string | null
  bannerPath?: string | null
  tipo?: string | null
  jogoId?: number | null
  categoria?: string | null
  regras?: string | null
  permissaoPostagem?: CommunityPostingPermission
  visibilidade?: CommunityVisibility
}

export interface UpdateCommunityInput extends CreateCommunityInput {
  comunidadeId: string
}

export interface UpdateCommunityModeratedInput {
  comunidadeId: string
  currentUserId: string
  descricao?: string | null
  bannerPath?: string | null
  regras?: string | null
}

export interface ServiceResult<T> {
  data: T
  error: CommunityError | null
}

export interface CommunityMediaCleanupResult {
  deletedPaths: string[]
  failedPaths: string[]
}

export interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
}

export type CommunityJoinAction = 'joined' | 'requested' | 'already_member' | 'already_pending'

export const COMMUNITY_CREATION_LIMIT = 3
export const COMMUNITY_CREATION_LIMIT_ERROR_CODE = 'SG_COMMUNITY_LIMIT_REACHED'

export interface AuthorRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

export type Relation<T> = T | T[] | null

export interface CommunityRow {
  id: string
  nome: string
  descricao: string | null
  banner_path: string | null
  tipo: string | null
  jogo_id: number | null
  categoria: string | null
  regras: string | null
  permissao_postagem: CommunityPostingPermission
  visibilidade: CommunityVisibility | null
  lider_id: string
  membros_count: number | string | null
  posts_count: number | string | null
  created_at: string
  updated_at: string
  jogo?: Relation<Pick<CatalogGamePreview, 'id' | 'titulo' | 'capa_url'>>
  lider?: Relation<AuthorRow>
}

export interface MemberRow {
  comunidade_id: string
  usuario_id: string
  cargo: CommunityRole
  entrou_em: string
  atualizado_em: string
  usuario?: Relation<AuthorRow>
}

export interface MemberPageRow {
  comunidade_id: string
  usuario_id: string
  cargo: CommunityRole
  entrou_em: string
  atualizado_em: string
  user_id: string
  username: string | null
  nome_completo: string | null
  avatar_path: string | null
  total_count: number | string
}

export interface PostRow {
  id: string
  comunidade_id: string
  autor_id: string
  texto: string | null
  imagem_path: string | null
  curtidas_count: number | string | null
  dislikes_count: number | string | null
  comentarios_count: number | string | null
  created_at: string
  updated_at: string
  fixado: boolean | null
  fixado_em: string | null
  fixado_por: string | null
  autor?: Relation<AuthorRow>
  comunidade?: Relation<Pick<CommunitySummary, 'id' | 'nome' | 'banner_path' | 'visibilidade'>>
}

export interface CommentRow {
  id: string
  post_id: string
  comunidade_id: string
  autor_id: string
  texto: string
  created_at: string
  updated_at: string
  autor?: Relation<AuthorRow>
}

export interface CommunityCommentReadRow {
  post_id: string
  id: string
  comunidade_id: string
  autor_id: string
  texto: string
  created_at: string
  updated_at: string
  author_username: string | null
  author_name: string | null
  author_avatar_path: string | null
  total_count: number | string
}

export interface CommunityCommentAnchorRow {
  found: boolean
  comment_offset: number | string | null
  page_offset: number | string | null
  total_count: number | string
}

export interface ReactionRow {
  post_id: string
  usuario_id: string
  tipo: CommunityReactionType
}

export interface SavedPostRow {
  post_id: string
  usuario_id: string
}

export interface JoinRequestRow {
  id: string
  comunidade_id: string
  usuario_id: string
  status: CommunityJoinRequestStatus
  decidido_por: string | null
  decidido_em: string | null
  created_at: string
  updated_at: string
  usuario?: Relation<AuthorRow>
  moderador?: Relation<AuthorRow>
}

export interface ReportTargetPostRow {
  id: string
  texto: string | null
  imagem_path: string | null
  autor_id: string
  created_at: string
  autor?: Relation<AuthorRow>
}

export interface ReportTargetCommentRow {
  id: string
  texto: string
  autor_id: string
  created_at: string
  autor?: Relation<AuthorRow>
}

export interface ReportRow {
  id: string
  comunidade_id: string
  denunciante_id: string
  tipo_conteudo: CommunityReportTargetType
  post_id: string | null
  comentario_id: string | null
  motivo: CommunityReportReason
  descricao: string | null
  status: CommunityReportStatus
  created_at: string
  updated_at: string
  denunciante?: Relation<AuthorRow>
  post?: Relation<ReportTargetPostRow>
  comentario?: Relation<ReportTargetCommentRow>
}
