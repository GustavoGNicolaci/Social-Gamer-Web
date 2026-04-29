import { supabase } from '../supabase-client'
import type { CatalogGamePreview } from './gameCatalogService'

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

export interface CommunityPost {
  id: string
  comunidade_id: string
  autor_id: string
  texto: string | null
  imagem_path: string | null
  curtidas_count: number
  dislikes_count: number
  comentarios_count: number
  created_at: string
  updated_at: string
  autor: CommunityAuthor | null
  comentarios: CommunityPostComment[]
  currentUserReaction: CommunityReactionType | null
  savedByCurrentUser: boolean
  canInteract: boolean
  canDelete: boolean
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
  limit?: number
}

export interface CommunityMembersOptions {
  search?: string
  limit?: number
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
  descricao?: string | null
  bannerPath?: string | null
  regras?: string | null
}

export interface ServiceResult<T> {
  data: T
  error: CommunityError | null
}

export interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
}

export type CommunityJoinAction = 'joined' | 'requested' | 'already_member' | 'already_pending'

interface AuthorRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

type Relation<T> = T | T[] | null

interface CommunityRow {
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

interface MemberRow {
  comunidade_id: string
  usuario_id: string
  cargo: CommunityRole
  entrou_em: string
  atualizado_em: string
  usuario?: Relation<AuthorRow>
}

interface PostRow {
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
  autor?: Relation<AuthorRow>
  comunidade?: Relation<Pick<CommunitySummary, 'id' | 'nome' | 'banner_path' | 'visibilidade'>>
}

interface CommentRow {
  id: string
  post_id: string
  comunidade_id: string
  autor_id: string
  texto: string
  created_at: string
  updated_at: string
  autor?: Relation<AuthorRow>
}

interface ReactionRow {
  post_id: string
  usuario_id: string
  tipo: CommunityReactionType
}

interface SavedPostRow {
  post_id: string
  usuario_id: string
}

interface JoinRequestRow {
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

interface ReportTargetPostRow {
  id: string
  texto: string | null
  imagem_path: string | null
  autor_id: string
  created_at: string
  autor?: Relation<AuthorRow>
}

interface ReportTargetCommentRow {
  id: string
  texto: string
  autor_id: string
  created_at: string
  autor?: Relation<AuthorRow>
}

interface ReportRow {
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

const COMMUNITY_SELECT = `
  id,
  nome,
  descricao,
  banner_path,
  tipo,
  jogo_id,
  categoria,
  regras,
  permissao_postagem,
  visibilidade,
  lider_id,
  membros_count,
  posts_count,
  created_at,
  updated_at,
  jogo:jogos(id, titulo, capa_url),
  lider:usuarios!comunidades_lider_id_fkey(id, username, nome_completo, avatar_path)
`

const MEMBER_SELECT = `
  comunidade_id,
  usuario_id,
  cargo,
  entrou_em,
  atualizado_em,
  usuario:usuarios!comunidade_membros_usuario_id_fkey(id, username, nome_completo, avatar_path)
`

const POST_SELECT = `
  id,
  comunidade_id,
  autor_id,
  texto,
  imagem_path,
  curtidas_count,
  dislikes_count,
  comentarios_count,
  created_at,
  updated_at,
  autor:usuarios!comunidade_posts_autor_id_fkey(id, username, nome_completo, avatar_path)
`

const PROFILE_POST_SELECT = `
  id,
  comunidade_id,
  autor_id,
  texto,
  imagem_path,
  curtidas_count,
  dislikes_count,
  comentarios_count,
  created_at,
  updated_at,
  autor:usuarios!comunidade_posts_autor_id_fkey(id, username, nome_completo, avatar_path),
  comunidade:comunidades(id, nome, banner_path, visibilidade)
`

const JOIN_REQUEST_SELECT = `
  id,
  comunidade_id,
  usuario_id,
  status,
  decidido_por,
  decidido_em,
  created_at,
  updated_at,
  usuario:usuarios!comunidade_solicitacoes_entrada_usuario_id_fkey(id, username, nome_completo, avatar_path),
  moderador:usuarios!comunidade_solicitacoes_entrada_decidido_por_fkey(id, username, nome_completo, avatar_path)
`

const REPORT_SELECT = `
  id,
  comunidade_id,
  denunciante_id,
  tipo_conteudo,
  post_id,
  comentario_id,
  motivo,
  descricao,
  status,
  created_at,
  updated_at,
  denunciante:usuarios!comunidade_denuncias_denunciante_id_fkey(id, username, nome_completo, avatar_path),
  post:comunidade_posts!comunidade_denuncias_post_id_fkey(
    id,
    texto,
    imagem_path,
    autor_id,
    created_at,
    autor:usuarios!comunidade_posts_autor_id_fkey(id, username, nome_completo, avatar_path)
  ),
  comentario:comunidade_post_comentarios!comunidade_denuncias_comentario_id_fkey(
    id,
    texto,
    autor_id,
    created_at,
    autor:usuarios!comunidade_post_comentarios_autor_id_fkey(id, username, nome_completo, avatar_path)
  )
`

function normalizeCommunityError(error: unknown, fallbackMessage: string): CommunityError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

function resolveRelation<T>(value: Relation<T> | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function normalizeNumber(value: number | string | null | undefined) {
  const normalizedValue = Number(value || 0)
  return Number.isFinite(normalizedValue) ? normalizedValue : 0
}

function normalizeAuthor(value: Relation<AuthorRow> | undefined): CommunityAuthor | null {
  const author = resolveRelation(value)
  return author ? { ...author } : null
}

function canRolePost(role: CommunityRole | null, permission: CommunityPostingPermission) {
  if (!role) return false
  if (permission === 'todos_membros') return true
  if (permission === 'somente_admins') return role === 'lider' || role === 'admin'
  return role === 'lider'
}

function normalizeCommunity(
  row: CommunityRow,
  currentUserRole: CommunityRole | null,
  currentUserJoinRequestStatus: CommunityJoinRequestStatus | null
): CommunitySummary {
  const visibility = row.visibilidade || 'publica'
  const canViewContent = visibility === 'publica' || Boolean(currentUserRole)

  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    banner_path: row.banner_path,
    tipo: row.tipo,
    jogo_id: row.jogo_id,
    categoria: row.categoria,
    regras: row.regras,
    permissao_postagem: row.permissao_postagem,
    visibilidade: visibility,
    lider_id: row.lider_id,
    membros_count: normalizeNumber(row.membros_count),
    posts_count: normalizeNumber(row.posts_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
    jogo: resolveRelation(row.jogo),
    lider: normalizeAuthor(row.lider),
    currentUserRole,
    currentUserJoinRequestStatus,
    canPost: canViewContent && canRolePost(currentUserRole, row.permissao_postagem),
    canViewContent,
  }
}

function normalizeMember(row: MemberRow): CommunityMember {
  return {
    comunidade_id: row.comunidade_id,
    usuario_id: row.usuario_id,
    cargo: row.cargo,
    entrou_em: row.entrou_em,
    atualizado_em: row.atualizado_em,
    usuario: normalizeAuthor(row.usuario),
  }
}

function normalizeComment(row: CommentRow): CommunityPostComment {
  return {
    id: row.id,
    post_id: row.post_id,
    comunidade_id: row.comunidade_id,
    autor_id: row.autor_id,
    texto: row.texto,
    created_at: row.created_at,
    updated_at: row.updated_at,
    autor: normalizeAuthor(row.autor),
  }
}

function normalizePost(
  row: PostRow,
  commentsByPostId: Map<string, CommunityPostComment[]>,
  reactionsByPostId: Map<string, CommunityReactionType>,
  savedPostIds: Set<string>,
  currentUserId: string | null | undefined,
  currentUserRole: CommunityRole | null
): CommunityPost {
  const isModerator = currentUserRole === 'lider' || currentUserRole === 'admin'

  return {
    id: row.id,
    comunidade_id: row.comunidade_id,
    autor_id: row.autor_id,
    texto: row.texto,
    imagem_path: row.imagem_path,
    curtidas_count: normalizeNumber(row.curtidas_count),
    dislikes_count: normalizeNumber(row.dislikes_count),
    comentarios_count: normalizeNumber(row.comentarios_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
    autor: normalizeAuthor(row.autor),
    comentarios: commentsByPostId.get(row.id) || [],
    currentUserReaction: reactionsByPostId.get(row.id) || null,
    savedByCurrentUser: savedPostIds.has(row.id),
    canInteract: Boolean(currentUserId && currentUserRole),
    canDelete: Boolean(currentUserId && (row.autor_id === currentUserId || isModerator)),
    comunidade: resolveRelation(row.comunidade),
  }
}

function normalizeJoinRequest(row: JoinRequestRow): CommunityJoinRequest {
  return {
    id: row.id,
    comunidade_id: row.comunidade_id,
    usuario_id: row.usuario_id,
    status: row.status,
    decidido_por: row.decidido_por,
    decidido_em: row.decidido_em,
    created_at: row.created_at,
    updated_at: row.updated_at,
    usuario: normalizeAuthor(row.usuario),
    moderador: normalizeAuthor(row.moderador),
  }
}

function normalizeReport(row: ReportRow): CommunityReport {
  const targetPost = resolveRelation(row.post)
  const targetComment = resolveRelation(row.comentario)
  const target = row.tipo_conteudo === 'post' ? targetPost : targetComment

  return {
    id: row.id,
    comunidade_id: row.comunidade_id,
    denunciante_id: row.denunciante_id,
    tipo_conteudo: row.tipo_conteudo,
    post_id: row.post_id,
    comentario_id: row.comentario_id,
    motivo: row.motivo,
    descricao: row.descricao,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    denunciante: normalizeAuthor(row.denunciante),
    targetText: target?.texto || null,
    targetImagePath: targetPost?.imagem_path || null,
    targetAuthor: normalizeAuthor(target?.autor),
    targetCreatedAt: target?.created_at || null,
  }
}

function normalizeSearch(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function getCurrentUserRoles(
  communityIds: string[],
  currentUserId?: string | null
): Promise<Map<string, CommunityRole>> {
  const roles = new Map<string, CommunityRole>()
  const uniqueIds = Array.from(new Set(communityIds.filter(Boolean)))

  if (!currentUserId || uniqueIds.length === 0) return roles

  const { data, error } = await supabase
    .from('comunidade_membros')
    .select('comunidade_id, cargo')
    .eq('usuario_id', currentUserId)
    .in('comunidade_id', uniqueIds)

  if (error) {
    console.error('Erro ao carregar cargos em comunidades:', error)
    return roles
  }

  ;((data || []) as Array<{ comunidade_id: string; cargo: CommunityRole }>).forEach(row => {
    roles.set(row.comunidade_id, row.cargo)
  })

  return roles
}

async function getCurrentUserJoinRequestStatuses(
  communityIds: string[],
  currentUserId?: string | null
): Promise<Map<string, CommunityJoinRequestStatus>> {
  const requests = new Map<string, CommunityJoinRequestStatus>()
  const uniqueIds = Array.from(new Set(communityIds.filter(Boolean)))

  if (!currentUserId || uniqueIds.length === 0) return requests

  const { data, error } = await supabase
    .from('comunidade_solicitacoes_entrada')
    .select('comunidade_id, status, created_at')
    .eq('usuario_id', currentUserId)
    .in('comunidade_id', uniqueIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao carregar solicitacoes de entrada:', error)
    return requests
  }

  ;((data || []) as Array<{ comunidade_id: string; status: CommunityJoinRequestStatus }>).forEach(row => {
    if (!requests.has(row.comunidade_id)) {
      requests.set(row.comunidade_id, row.status)
    }
  })

  return requests
}

async function getPostsInteractionState(
  postIds: string[],
  currentUserId?: string | null
) {
  const reactionsByPostId = new Map<string, CommunityReactionType>()
  const savedPostIds = new Set<string>()

  if (postIds.length === 0) {
    return { reactionsByPostId, savedPostIds, error: null }
  }

  const [reactionResponse, savedResponse] = await Promise.all([
    currentUserId
      ? supabase
          .from('comunidade_post_reacoes')
          .select('post_id, usuario_id, tipo')
          .eq('usuario_id', currentUserId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    currentUserId
      ? supabase
          .from('comunidade_post_salvos')
          .select('post_id, usuario_id')
          .eq('usuario_id', currentUserId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  ;((reactionResponse.data || []) as ReactionRow[]).forEach(row => {
    reactionsByPostId.set(row.post_id, row.tipo)
  })

  ;((savedResponse.data || []) as SavedPostRow[]).forEach(row => {
    savedPostIds.add(row.post_id)
  })

  return {
    reactionsByPostId,
    savedPostIds,
    error: reactionResponse.error || savedResponse.error,
  }
}

async function loadCommentsByPostId(postIds: string[]) {
  const commentsByPostId = new Map<string, CommunityPostComment[]>()

  if (postIds.length === 0) return { commentsByPostId, error: null }

  const { data, error } = await supabase
    .from('comunidade_post_comentarios')
    .select(`
      id,
      post_id,
      comunidade_id,
      autor_id,
      texto,
      created_at,
      updated_at,
      autor:usuarios!comunidade_post_comentarios_autor_id_fkey(id, username, nome_completo, avatar_path)
    `)
    .in('post_id', postIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return { commentsByPostId, error }

  ;((data || []) as CommentRow[]).forEach(row => {
    const currentComments = commentsByPostId.get(row.post_id) || []
    commentsByPostId.set(row.post_id, [...currentComments, normalizeComment(row)])
  })

  return { commentsByPostId, error: null }
}

async function normalizePosts(
  rows: PostRow[],
  currentUserId?: string | null,
  roleByCommunityId?: Map<string, CommunityRole>
) {
  const postIds = rows.map(row => row.id)
  const communityIds = rows.map(row => row.comunidade_id)
  const resolvedRoles =
    roleByCommunityId || await getCurrentUserRoles(communityIds, currentUserId)
  const [commentsResult, interactionResult] = await Promise.all([
    loadCommentsByPostId(postIds),
    getPostsInteractionState(postIds, currentUserId),
  ])

  return {
    data: rows.map(row =>
      normalizePost(
        row,
        commentsResult.commentsByPostId,
        interactionResult.reactionsByPostId,
        interactionResult.savedPostIds,
        currentUserId,
        resolvedRoles.get(row.comunidade_id) || null
      )
    ),
    error: commentsResult.error || interactionResult.error,
  }
}

export async function getCommunities(
  filters: CommunityListFilters = {},
  currentUserId?: string | null
): Promise<PaginatedServiceResult<CommunitySummary[]>> {
  try {
    const limit = Math.min(Math.max(filters.limit || 48, 1), 100)
    let query = supabase
      .from('comunidades')
      .select(COMMUNITY_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit)

    const search = filters.search?.trim()
    if (search) {
      const safeSearch = search.replaceAll('%', '\\%').replaceAll('_', '\\_')
      query = query.or(`nome.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`)
    }

    if (filters.tipo) query = query.eq('tipo', filters.tipo)
    if (filters.categoria) query = query.eq('categoria', filters.categoria)
    if (filters.gameId) query = query.eq('jogo_id', filters.gameId)

    const { data, error, count } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as comunidades.'),
        totalCount: null,
      }
    }

    const rows = (data || []) as CommunityRow[]
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles(rows.map(row => row.id), currentUserId),
      getCurrentUserJoinRequestStatuses(rows.map(row => row.id), currentUserId),
    ])

    return {
      data: rows.map(row =>
        normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null)
      ),
      error: null,
      totalCount: count,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar as comunidades.'),
      totalCount: null,
    }
  }
}

export async function getCommunityById(
  communityId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunitySummary | null>> {
  try {
    const { data, error } = await supabase
      .from('comunidades')
      .select(COMMUNITY_SELECT)
      .eq('id', communityId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeCommunityError(error, 'Nao foi possivel carregar a comunidade.'),
      }
    }

    if (!data) return { data: null, error: null }

    const row = data as CommunityRow
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles([row.id], currentUserId),
      getCurrentUserJoinRequestStatuses([row.id], currentUserId),
    ])

    return {
      data: normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null),
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar a comunidade.'),
    }
  }
}

export async function getCommunityMembers(
  communityId: string,
  options: CommunityMembersOptions = {}
): Promise<PaginatedServiceResult<CommunityMember[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidade_membros')
      .select(MEMBER_SELECT)
      .eq('comunidade_id', communityId)
      .order('cargo', { ascending: true })
      .order('entrou_em', { ascending: true })

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar os membros.'),
        totalCount: null,
      }
    }

    const search = normalizeSearch(options.search)
    const members = ((data || []) as MemberRow[]).map(normalizeMember)
    const filteredMembers = search
      ? members.filter(member => {
          const username = normalizeSearch(member.usuario?.username)
          const displayName = normalizeSearch(member.usuario?.nome_completo)
          const role = normalizeSearch(member.cargo)
          return username.includes(search) || displayName.includes(search) || role.includes(search)
        })
      : members

    return {
      data: filteredMembers.slice(0, options.limit || 200),
      error: null,
      totalCount: filteredMembers.length,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os membros.'),
      totalCount: null,
    }
  }
}

export async function getCommunityPosts(
  communityId: string,
  currentUserId?: string | null,
  currentUserRole?: CommunityRole | null,
  options: CommunityPostsOptions = {}
): Promise<PaginatedServiceResult<CommunityPost[]>> {
  try {
    const pageSize = Math.min(Math.max(options.pageSize || 12, 1), 30)
    const page = Math.max(options.page || 1, 1)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('comunidade_posts')
      .select(POST_SELECT, { count: 'exact' })
      .eq('comunidade_id', communityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar os posts.'),
        totalCount: null,
      }
    }

    const roleByCommunityId = new Map<string, CommunityRole>()
    if (currentUserRole) roleByCommunityId.set(communityId, currentUserRole)

    const normalizedPosts = await normalizePosts(
      (data || []) as PostRow[],
      currentUserId,
      roleByCommunityId
    )

    return {
      data: normalizedPosts.data,
      error: normalizedPosts.error
        ? normalizeCommunityError(normalizedPosts.error, 'Nao foi possivel carregar as interacoes dos posts.')
        : null,
      totalCount: count,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os posts.'),
      totalCount: null,
    }
  }
}

export async function createCommunity(
  input: CreateCommunityInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('criar_comunidade', {
    p_nome: input.nome,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_tipo: input.tipo || null,
    p_jogo_id: input.jogoId || null,
    p_categoria: input.categoria || null,
    p_regras: input.regras || null,
    p_permissao_postagem: input.permissaoPostagem || 'todos_membros',
    p_visibilidade: input.visibilidade || 'publica',
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel criar a comunidade.'),
    }
  }

  const row = data as CommunityRow
  return {
    data: normalizeCommunity(row, 'lider', null),
    error: null,
  }
}

export async function updateCommunity(
  input: UpdateCommunityInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('editar_comunidade', {
    p_comunidade_id: input.comunidadeId,
    p_nome: input.nome,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_tipo: input.tipo || null,
    p_jogo_id: input.jogoId || null,
    p_categoria: input.categoria || null,
    p_regras: input.regras || null,
    p_visibilidade: input.visibilidade || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel editar a comunidade.'),
    }
  }

  return {
    data: normalizeCommunity(data as CommunityRow, 'lider', null),
    error: null,
  }
}

export async function updateCommunityModeratedDetails(
  input: UpdateCommunityModeratedInput
): Promise<ServiceResult<CommunitySummary | null>> {
  const { data, error } = await supabase.rpc('editar_comunidade_moderavel', {
    p_comunidade_id: input.comunidadeId,
    p_descricao: input.descricao || null,
    p_banner_path: input.bannerPath || null,
    p_regras: input.regras || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel editar a comunidade.'),
    }
  }

  const currentRole = await getCurrentUserRoles([input.comunidadeId])
  return {
    data: normalizeCommunity(data as CommunityRow, currentRole.get(input.comunidadeId) || null, null),
    error: null,
  }
}

export async function joinCommunity(
  communityId: string
): Promise<ServiceResult<CommunityJoinAction>> {
  const { data, error } = await supabase.rpc('entrar_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: (data as CommunityJoinAction) || 'joined',
    error: error ? normalizeCommunityError(error, 'Nao foi possivel entrar na comunidade.') : null,
  }
}

export async function leaveCommunity(communityId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('sair_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel sair da comunidade.') : null,
  }
}

export async function cancelCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('cancelar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel cancelar a solicitacao.') : null,
  }
}

export async function getCommunityJoinRequests(
  communityId: string,
  status: CommunityJoinRequestStatus | 'all' = 'pendente'
): Promise<ServiceResult<CommunityJoinRequest[]>> {
  try {
    let query = supabase
      .from('comunidade_solicitacoes_entrada')
      .select(JOIN_REQUEST_SELECT)
      .eq('comunidade_id', communityId)
      .order('created_at', { ascending: false })

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as solicitacoes.'),
      }
    }

    return {
      data: ((data || []) as JoinRequestRow[]).map(normalizeJoinRequest),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar as solicitacoes.'),
    }
  }
}

export async function approveCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('aprovar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel aprovar a solicitacao.') : null,
  }
}

export async function rejectCommunityJoinRequest(
  requestId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('recusar_solicitacao_comunidade', {
    p_solicitacao_id: requestId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel recusar a solicitacao.') : null,
  }
}

export async function updateCommunityPostingPermission(
  communityId: string,
  permission: CommunityPostingPermission
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('alterar_permissao_postagem', {
    p_comunidade_id: communityId,
    p_permissao: permission,
  })

  return {
    data: null,
    error: error
      ? normalizeCommunityError(error, 'Nao foi possivel alterar quem pode postar.')
      : null,
  }
}

export async function updateCommunityMemberRole(
  communityId: string,
  userId: string,
  role: Exclude<CommunityRole, 'lider'>
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('alterar_cargo_membro', {
    p_comunidade_id: communityId,
    p_usuario_id: userId,
    p_cargo: role,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel alterar o cargo.') : null,
  }
}

export async function removeCommunityMember(
  communityId: string,
  userId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('expulsar_membro', {
    p_comunidade_id: communityId,
    p_usuario_id: userId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel expulsar o membro.') : null,
  }
}

export async function transferCommunityLeadership(
  communityId: string,
  nextLeaderId: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('transferir_lideranca', {
    p_comunidade_id: communityId,
    p_novo_lider_id: nextLeaderId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel transferir a lideranca.') : null,
  }
}

export async function deleteCommunity(communityId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('excluir_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel excluir a comunidade.') : null,
  }
}

export async function createCommunityPost(
  communityId: string,
  texto?: string | null,
  imagePath?: string | null
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('criar_post_comunidade', {
    p_comunidade_id: communityId,
    p_texto: texto || null,
    p_imagem_path: imagePath || null,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel publicar o post.') : null,
  }
}

export async function deleteCommunityPost(postId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('excluir_post_comunidade', {
    p_post_id: postId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel deletar o post.') : null,
  }
}

export async function createCommunityComment(
  postId: string,
  texto: string
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('criar_comentario_comunidade', {
    p_post_id: postId,
    p_texto: texto,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel publicar o comentario.') : null,
  }
}

export async function deleteCommunityComment(commentId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('excluir_comentario_comunidade', {
    p_comentario_id: commentId,
  })

  return {
    data: null,
    error: error ? normalizeCommunityError(error, 'Nao foi possivel excluir o comentario.') : null,
  }
}

export async function toggleCommunityPostReaction(
  postId: string,
  reaction: CommunityReactionType
): Promise<ServiceResult<{
  curtidas_count: number
  dislikes_count: number
  reacao_atual: CommunityReactionType | null
} | null>> {
  const { data, error } = await supabase.rpc('alternar_reacao_post', {
    p_post_id: postId,
    p_tipo: reaction,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel atualizar a reacao.'),
    }
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    data: row
      ? {
          curtidas_count: normalizeNumber(row.curtidas_count),
          dislikes_count: normalizeNumber(row.dislikes_count),
          reacao_atual: row.reacao_atual || null,
        }
      : null,
    error: null,
  }
}

export async function toggleCommunityPostSave(
  postId: string
): Promise<ServiceResult<boolean>> {
  const { data, error } = await supabase.rpc('alternar_post_salvo', {
    p_post_id: postId,
  })

  return {
    data: Boolean(data),
    error: error ? normalizeCommunityError(error, 'Nao foi possivel salvar o post.') : null,
  }
}

export async function submitCommunityReport(input: {
  communityId: string
  targetType: CommunityReportTargetType
  targetId: string
  reason: CommunityReportReason
  description?: string | null
}): Promise<ServiceResult<CommunityReport | null>> {
  const { data, error } = await supabase.rpc('criar_denuncia_comunidade', {
    p_comunidade_id: input.communityId,
    p_tipo_conteudo: input.targetType,
    p_conteudo_id: input.targetId,
    p_motivo: input.reason,
    p_descricao: input.description || null,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel registrar a denuncia.'),
    }
  }

  return {
    data: data ? normalizeReport(data as ReportRow) : null,
    error: null,
  }
}

export async function getCommunityReports(
  communityId: string,
  options: CommunityReportsOptions = {}
): Promise<ServiceResult<CommunityReport[]>> {
  try {
    let query = supabase
      .from('comunidade_denuncias')
      .select(REPORT_SELECT)
      .eq('comunidade_id', communityId)
      .order('created_at', { ascending: false })

    if (options.status && options.status !== 'all') query = query.eq('status', options.status)

    const { data, error } = await query

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as denuncias.'),
      }
    }

    return {
      data: ((data || []) as ReportRow[]).map(normalizeReport),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar denuncias.'),
    }
  }
}

export async function updateCommunityReportStatus(
  reportId: string,
  status: CommunityReportStatus
): Promise<ServiceResult<CommunityReport | null>> {
  const { data, error } = await supabase.rpc('atualizar_status_denuncia_comunidade', {
    p_denuncia_id: reportId,
    p_status: status,
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel atualizar a denuncia.'),
    }
  }

  return {
    data: data ? normalizeReport(data as ReportRow) : null,
    error: null,
  }
}

export async function getCommunitiesByUserId(
  userId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunitySummary[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidade_membros')
      .select(`comunidade:comunidades(${COMMUNITY_SELECT})`)
      .eq('usuario_id', userId)
      .order('entrou_em', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar as comunidades do perfil.'),
      }
    }

    const communityRows = ((data || []) as Array<{ comunidade: Relation<CommunityRow> }>)
      .map(row => resolveRelation(row.comunidade))
      .filter((row): row is CommunityRow => Boolean(row))
    const [roles, requests] = await Promise.all([
      getCurrentUserRoles(communityRows.map(row => row.id), currentUserId),
      getCurrentUserJoinRequestStatuses(communityRows.map(row => row.id), currentUserId),
    ])

    return {
      data: communityRows.map(row =>
        normalizeCommunity(row, roles.get(row.id) || null, requests.get(row.id) || null)
      ),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar comunidades do perfil.'),
    }
  }
}

export async function getCommunityPostsByUserId(
  userId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunityPost[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidade_posts')
      .select(PROFILE_POST_SELECT)
      .eq('autor_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(24)

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar os posts do perfil.'),
      }
    }

    const normalizedPosts = await normalizePosts((data || []) as PostRow[], currentUserId)

    return {
      data: normalizedPosts.data,
      error: normalizedPosts.error
        ? normalizeCommunityError(normalizedPosts.error, 'Nao foi possivel carregar interacoes dos posts.')
        : null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar posts do perfil.'),
    }
  }
}

export async function getSavedCommunityPostsByUserId(
  userId: string,
  currentUserId?: string | null
): Promise<ServiceResult<CommunityPost[]>> {
  if (!currentUserId || currentUserId !== userId) {
    return {
      data: [],
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('comunidade_post_salvos')
      .select(`created_at, post:comunidade_posts(${PROFILE_POST_SELECT})`)
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(24)

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar posts salvos.'),
      }
    }

    const postRows = ((data || []) as Array<{ post: Relation<PostRow> }>)
      .map(row => resolveRelation(row.post))
      .filter((row): row is PostRow => Boolean(row))
    const normalizedPosts = await normalizePosts(postRows, currentUserId)

    return {
      data: normalizedPosts.data,
      error: normalizedPosts.error
        ? normalizeCommunityError(normalizedPosts.error, 'Nao foi possivel carregar interacoes dos salvos.')
        : null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar posts salvos.'),
    }
  }
}
