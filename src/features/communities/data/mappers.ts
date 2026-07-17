import {
  COMMUNITY_CREATION_LIMIT,
  COMMUNITY_CREATION_LIMIT_ERROR_CODE,
  type AuthorRow,
  type CommentRow,
  type CommunityAuthor,
  type CommunityCommentReadRow,
  type CommunityCreationQuota,
  type CommunityError,
  type CommunityJoinRequest,
  type CommunityJoinRequestStatus,
  type CommunityMember,
  type CommunityPost,
  type CommunityPostComment,
  type CommunityPostingPermission,
  type CommunityReactionType,
  type CommunityReport,
  type CommunityRole,
  type CommunityRow,
  type JoinRequestRow,
  type MemberRow,
  type PostRow,
  type Relation,
  type ReportRow,
} from './types'

export const COMMUNITY_SELECT = `
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

export const POST_SELECT = `
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
  fixado,
  fixado_em,
  fixado_por,
  autor:usuarios!comunidade_posts_autor_id_fkey(id, username, nome_completo, avatar_path)
`

export const PROFILE_POST_SELECT = `
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
  fixado,
  fixado_em,
  fixado_por,
  autor:usuarios!comunidade_posts_autor_id_fkey(id, username, nome_completo, avatar_path),
  comunidade:comunidades(id, nome, banner_path, visibilidade)
`

export const JOIN_REQUEST_SELECT = `
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

export const REPORT_SELECT = `
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

export function normalizeCommunityError(error: unknown, fallbackMessage: string): CommunityError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    if (isCommunityCreationLimitError({ code, message, details, hint })) {
      return {
        code: COMMUNITY_CREATION_LIMIT_ERROR_CODE,
        message: COMMUNITY_CREATION_LIMIT_ERROR_CODE,
        details,
        hint,
      }
    }

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

export function isCommunityCreationLimitError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const details = 'details' in error && typeof error.details === 'string' ? error.details : ''
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''
  const combinedMessage = [code, message, details, hint].join(' ').toLowerCase()

  return (
    code === COMMUNITY_CREATION_LIMIT_ERROR_CODE ||
    combinedMessage.includes(COMMUNITY_CREATION_LIMIT_ERROR_CODE.toLowerCase()) ||
    combinedMessage.includes('community creation limit') ||
    combinedMessage.includes('limite de comunidades')
  )
}

export function resolveRelation<T>(value: Relation<T> | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export function normalizeNumber(value: number | string | null | undefined) {
  const normalizedValue = Number(value || 0)
  return Number.isFinite(normalizedValue) ? normalizedValue : 0
}

export function normalizeAuthor(value: Relation<AuthorRow> | undefined): CommunityAuthor | null {
  const author = resolveRelation(value)
  return author ? { ...author } : null
}

export function canRolePost(role: CommunityRole | null, permission: CommunityPostingPermission) {
  if (!role) return false
  if (permission === 'todos_membros') return true
  if (permission === 'somente_admins') return role === 'lider' || role === 'admin'
  return role === 'lider'
}

export function normalizeCommunity(
  row: CommunityRow,
  currentUserRole: CommunityRole | null,
  currentUserJoinRequestStatus: CommunityJoinRequestStatus | null
) {
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

export function normalizeMember(row: MemberRow): CommunityMember {
  return {
    comunidade_id: row.comunidade_id,
    usuario_id: row.usuario_id,
    cargo: row.cargo,
    entrou_em: row.entrou_em,
    atualizado_em: row.atualizado_em,
    usuario: normalizeAuthor(row.usuario),
  }
}

export function normalizeComment(row: CommentRow): CommunityPostComment {
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

export function normalizeCommunityCommentReadRow(
  row: CommunityCommentReadRow
): CommunityPostComment {
  return {
    id: row.id,
    post_id: row.post_id,
    comunidade_id: row.comunidade_id,
    autor_id: row.autor_id,
    texto: row.texto,
    created_at: row.created_at,
    updated_at: row.updated_at,
    autor: {
      id: row.autor_id,
      username: row.author_username || '',
      nome_completo: row.author_name,
      avatar_path: row.author_avatar_path,
    },
  }
}

export function mergeCommunityComments(
  currentComments: CommunityPostComment[],
  incomingComments: CommunityPostComment[]
) {
  const commentsById = new Map(
    currentComments.map(comment => [comment.id, comment])
  )

  incomingComments.forEach(comment => commentsById.set(comment.id, comment))

  return [...commentsById.values()].sort((left, right) => {
    const dateDelta = left.created_at.localeCompare(right.created_at)
    return dateDelta !== 0 ? dateDelta : left.id.localeCompare(right.id)
  })
}

export function normalizePost(
  row: PostRow,
  commentsByPostId: Map<string, CommunityPostComment[]>,
  reactionsByPostId: Map<string, CommunityReactionType>,
  savedPostIds: Set<string>,
  imageUrlsByPath: Map<string, string>,
  currentUserId: string | null | undefined,
  currentUserRole: CommunityRole | null,
  commentTotalsByPostId: Map<string, number> = new Map(),
  commentNextOffsetsByPostId: Map<string, number> = new Map()
): CommunityPost {
  const isModerator = currentUserRole === 'lider' || currentUserRole === 'admin'
  const imagePath = row.imagem_path

  return {
    id: row.id,
    comunidade_id: row.comunidade_id,
    autor_id: row.autor_id,
    texto: row.texto,
    imagem_path: imagePath,
    imagem_url: imagePath ? imageUrlsByPath.get(imagePath) || null : null,
    curtidas_count: normalizeNumber(row.curtidas_count),
    dislikes_count: normalizeNumber(row.dislikes_count),
    comentarios_count: commentTotalsByPostId.has(row.id)
      ? commentTotalsByPostId.get(row.id) || 0
      : normalizeNumber(row.comentarios_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
    fixado: Boolean(row.fixado),
    fixado_em: row.fixado_em,
    fixado_por: row.fixado_por,
    autor: normalizeAuthor(row.autor),
    comentarios: commentsByPostId.get(row.id) || [],
    commentsNextOffset: commentNextOffsetsByPostId.get(row.id) || 0,
    currentUserReaction: reactionsByPostId.get(row.id) || null,
    savedByCurrentUser: savedPostIds.has(row.id),
    canInteract: Boolean(currentUserId && currentUserRole),
    canDelete: Boolean(currentUserId && (row.autor_id === currentUserId || isModerator)),
    canPin: Boolean(currentUserId && isModerator),
    comunidade: resolveRelation(row.comunidade),
  }
}

export function normalizeJoinRequest(row: JoinRequestRow): CommunityJoinRequest {
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

export function normalizeReport(row: ReportRow): CommunityReport {
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

export function normalizeSearch(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function normalizeCommunityCreationQuota(
  createdCount: number | string | null | undefined
): CommunityCreationQuota {
  const normalizedCount = normalizeNumber(createdCount)
  const remaining = Math.max(COMMUNITY_CREATION_LIMIT - normalizedCount, 0)

  return {
    limit: COMMUNITY_CREATION_LIMIT,
    createdCount: normalizedCount,
    remaining,
    canCreate: normalizedCount < COMMUNITY_CREATION_LIMIT,
  }
}
