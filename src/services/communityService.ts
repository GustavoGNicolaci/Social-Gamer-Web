import { supabase } from '../supabase-client'
import type { CatalogGamePreview } from './gameCatalogService'

export type CommunityRole = 'lider' | 'admin' | 'membro'
export type CommunityPostingPermission = 'todos_membros' | 'somente_admins' | 'somente_lider'
export type CommunityReactionType = 'curtida' | 'dislike'

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
  lider_id: string
  membros_count: number
  posts_count: number
  created_at: string
  updated_at: string
  jogo: Pick<CatalogGamePreview, 'id' | 'titulo' | 'capa_url'> | null
  lider: CommunityAuthor | null
  currentUserRole: CommunityRole | null
  canPost: boolean
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
  comunidade?: Pick<CommunitySummary, 'id' | 'nome' | 'banner_path'> | null
}

export interface CommunityListFilters {
  search?: string
  tipo?: string
  categoria?: string
  gameId?: number | null
  limit?: number
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
}

export interface UpdateCommunityInput extends CreateCommunityInput {
  comunidadeId: string
}

interface ServiceResult<T> {
  data: T
  error: CommunityError | null
}

interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
}

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
  comunidade?: Relation<Pick<CommunitySummary, 'id' | 'nome' | 'banner_path'>>
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
  comunidade:comunidades(id, nome, banner_path)
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

function normalizeCommunity(row: CommunityRow, currentUserRole: CommunityRole | null): CommunitySummary {
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
    lider_id: row.lider_id,
    membros_count: normalizeNumber(row.membros_count),
    posts_count: normalizeNumber(row.posts_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
    jogo: resolveRelation(row.jogo),
    lider: normalizeAuthor(row.lider),
    currentUserRole,
    canPost: canRolePost(currentUserRole, row.permissao_postagem),
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
    const roles = await getCurrentUserRoles(rows.map(row => row.id), currentUserId)

    return {
      data: rows.map(row => normalizeCommunity(row, roles.get(row.id) || null)),
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
    const roles = await getCurrentUserRoles([row.id], currentUserId)

    return {
      data: normalizeCommunity(row, roles.get(row.id) || null),
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
  communityId: string
): Promise<ServiceResult<CommunityMember[]>> {
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
      }
    }

    return {
      data: ((data || []) as MemberRow[]).map(normalizeMember),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os membros.'),
    }
  }
}

export async function getCommunityPosts(
  communityId: string,
  currentUserId?: string | null,
  currentUserRole?: CommunityRole | null
): Promise<ServiceResult<CommunityPost[]>> {
  try {
    const { data, error } = await supabase
      .from('comunidade_posts')
      .select(POST_SELECT)
      .eq('comunidade_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeCommunityError(error, 'Nao foi possivel carregar os posts.'),
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
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeCommunityError(error, 'Erro inesperado ao carregar os posts.'),
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
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel criar a comunidade.'),
    }
  }

  const row = data as CommunityRow
  return {
    data: normalizeCommunity(row, 'lider'),
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
  })

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel editar a comunidade.'),
    }
  }

  return {
    data: normalizeCommunity(data as CommunityRow, 'lider'),
    error: null,
  }
}

export async function joinCommunity(communityId: string): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('entrar_comunidade', {
    p_comunidade_id: communityId,
  })

  return {
    data: null,
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
    const roles = await getCurrentUserRoles(communityRows.map(row => row.id), currentUserId)

    return {
      data: communityRows.map(row => normalizeCommunity(row, roles.get(row.id) || null)),
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
