import { supabase } from '../../../supabase-client'
import { logClientError } from '../../../utils/clientLogging'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import {
  deleteStorageFiles,
  resolveCommunityPostImageUrls,
} from '../../../services/storageService'
import {
  mergeCommunityComments,
  normalizeComment,
  normalizeCommunityCommentReadRow,
  normalizeCommunityError,
  normalizeNumber,
  normalizePost,
  POST_SELECT,
  PROFILE_POST_SELECT,
  resolveRelation,
} from './mappers'
import { getCurrentUserRoles } from './membership'
import type {
  CommentRow,
  CommunityCommentAnchor,
  CommunityCommentAnchorRow,
  CommunityCommentReadRow,
  CommunityCommentTarget,
  CommunityMediaCleanupResult,
  CommunityPost,
  CommunityPostComment,
  CommunityPostCommentsPage,
  CommunityPostsOptions,
  CommunityReactionType,
  CommunityRole,
  PaginatedServiceResult,
  PostRow,
  ReactionRow,
  Relation,
  SavedPostRow,
  ServiceResult,
} from './types'

const COMMUNITY_COMMENT_PREVIEW_LIMIT = 3
const COMMUNITY_COMMENT_PAGE_LIMIT = 3
const COMMUNITY_COMMENT_MAX_PAGE_LIMIT = 20

function isMissingCommunityCommentReadModel(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return error.code === 'PGRST202' || error.code === '42883'
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

async function loadLegacyCommentsByPostId(postIds: string[]) {
  const commentsByPostId = new Map<string, CommunityPostComment[]>()
  const commentTotalsByPostId = new Map<string, number>()
  const commentNextOffsetsByPostId = new Map<string, number>()

  if (postIds.length === 0) {
    return {
      commentsByPostId,
      commentTotalsByPostId,
      commentNextOffsetsByPostId,
      error: null,
    }
  }

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
    .order('id', { ascending: true })

  if (error) {
    return {
      commentsByPostId,
      commentTotalsByPostId,
      commentNextOffsetsByPostId,
      error,
    }
  }

  ;((data || []) as CommentRow[]).forEach(row => {
    const currentComments = commentsByPostId.get(row.post_id) || []
    commentsByPostId.set(
      row.post_id,
      mergeCommunityComments(currentComments, [normalizeComment(row)])
    )
  })

  postIds.forEach(postId => {
    const loadedCount = commentsByPostId.get(postId)?.length || 0
    commentTotalsByPostId.set(postId, loadedCount)
    commentNextOffsetsByPostId.set(postId, loadedCount)
  })

  return {
    commentsByPostId,
    commentTotalsByPostId,
    commentNextOffsetsByPostId,
    error: null,
  }
}

async function loadCommentPreviewsByPostId(postIds: string[]) {
  const commentsByPostId = new Map<string, CommunityPostComment[]>()
  const commentTotalsByPostId = new Map<string, number>()
  const commentNextOffsetsByPostId = new Map<string, number>()
  const uniquePostIds = [...new Set(postIds)]

  if (uniquePostIds.length === 0) {
    return {
      commentsByPostId,
      commentTotalsByPostId,
      commentNextOffsetsByPostId,
      error: null,
    }
  }

  const { data, error } = await supabase.rpc('get_community_post_comment_previews', {
    p_post_ids: uniquePostIds,
    p_limit_per_post: COMMUNITY_COMMENT_PREVIEW_LIMIT,
  })

  if (error) {
    if (isMissingCommunityCommentReadModel(error)) {
      return loadLegacyCommentsByPostId(uniquePostIds)
    }

    return {
      commentsByPostId,
      commentTotalsByPostId,
      commentNextOffsetsByPostId,
      error,
    }
  }

  ;((data || []) as CommunityCommentReadRow[]).forEach(row => {
    const currentComments = commentsByPostId.get(row.post_id) || []
    commentsByPostId.set(
      row.post_id,
      mergeCommunityComments(currentComments, [normalizeCommunityCommentReadRow(row)])
    )
    commentTotalsByPostId.set(row.post_id, normalizeNumber(row.total_count))
  })

  uniquePostIds.forEach(postId => {
    commentNextOffsetsByPostId.set(postId, commentsByPostId.get(postId)?.length || 0)
  })

  return {
    commentsByPostId,
    commentTotalsByPostId,
    commentNextOffsetsByPostId,
    error: null,
  }
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
  const [commentsResult, interactionResult, imageUrlsByPath] = await Promise.all([
    loadCommentPreviewsByPostId(postIds),
    getPostsInteractionState(postIds, currentUserId),
    resolveCommunityPostImageUrls(rows.map(row => row.imagem_path)),
  ])

  return {
    data: rows.map(row =>
      normalizePost(
        row,
        commentsResult.commentsByPostId,
        interactionResult.reactionsByPostId,
        interactionResult.savedPostIds,
        imageUrlsByPath,
        currentUserId,
        resolvedRoles.get(row.comunidade_id) || null,
        commentsResult.commentTotalsByPostId,
        commentsResult.commentNextOffsetsByPostId
      )
    ),
    error: isSupabasePermissionError(commentsResult.error || interactionResult.error)
      ? null
      : commentsResult.error || interactionResult.error,
  }
}

async function getLegacyCommunityPostCommentsPage(
  postId: string,
  limit: number,
  offset: number
): Promise<ServiceResult<CommunityPostCommentsPage>> {
  const { data, error, count } = await supabase
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
    `, { count: 'exact' })
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return {
      data: { comments: [], totalCount: null, nextOffset: offset },
      error: normalizeCommunityError(error, 'Nao foi possivel carregar os comentarios.'),
    }
  }

  const comments = ((data || []) as CommentRow[]).map(normalizeComment)
  return {
    data: {
      comments,
      totalCount: count,
      nextOffset: offset + comments.length,
    },
    error: null,
  }
}

export async function getCommunityPostCommentsPage(
  postId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ServiceResult<CommunityPostCommentsPage>> {
  const limit = Math.min(
    Math.max(options.limit || COMMUNITY_COMMENT_PAGE_LIMIT, 1),
    COMMUNITY_COMMENT_MAX_PAGE_LIMIT
  )
  const offset = Math.max(options.offset || 0, 0)

  const { data, error } = await supabase.rpc('get_community_post_comments_page', {
    p_post_id: postId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    if (isMissingCommunityCommentReadModel(error)) {
      return getLegacyCommunityPostCommentsPage(postId, limit, offset)
    }

    return {
      data: { comments: [], totalCount: null, nextOffset: offset },
      error: normalizeCommunityError(error, 'Nao foi possivel carregar os comentarios.'),
    }
  }

  const rows = (data || []) as CommunityCommentReadRow[]
  const comments = rows.map(normalizeCommunityCommentReadRow)

  return {
    data: {
      comments,
      totalCount: rows.length > 0 ? normalizeNumber(rows[0].total_count) : null,
      nextOffset: offset + comments.length,
    },
    error: null,
  }
}

async function getLegacyCommunityCommentAnchor(
  postId: string,
  commentId: string,
  limit: number
): Promise<ServiceResult<CommunityCommentAnchor>> {
  const { data, error } = await supabase
    .from('comunidade_post_comentarios')
    .select('id')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return {
      data: { found: false, commentOffset: null, pageOffset: null, totalCount: 0 },
      error: normalizeCommunityError(error, 'Nao foi possivel localizar o comentario.'),
    }
  }

  const rows = (data || []) as Array<{ id: string }>
  const commentOffset = rows.findIndex(row => row.id === commentId)
  return {
    data: {
      found: commentOffset >= 0,
      commentOffset: commentOffset >= 0 ? commentOffset : null,
      pageOffset: commentOffset >= 0 ? Math.floor(commentOffset / limit) * limit : null,
      totalCount: rows.length,
    },
    error: null,
  }
}

export async function getCommunityCommentAnchor(
  postId: string,
  commentId: string,
  limit = COMMUNITY_COMMENT_PAGE_LIMIT
): Promise<ServiceResult<CommunityCommentAnchor>> {
  const normalizedLimit = Math.min(Math.max(limit, 1), COMMUNITY_COMMENT_MAX_PAGE_LIMIT)
  const { data, error } = await supabase.rpc('get_community_comment_anchor', {
    p_post_id: postId,
    p_comment_id: commentId,
    p_limit: normalizedLimit,
  })

  if (error) {
    if (isMissingCommunityCommentReadModel(error)) {
      return getLegacyCommunityCommentAnchor(postId, commentId, normalizedLimit)
    }

    return {
      data: { found: false, commentOffset: null, pageOffset: null, totalCount: 0 },
      error: normalizeCommunityError(error, 'Nao foi possivel localizar o comentario.'),
    }
  }

  const row = ((data || []) as CommunityCommentAnchorRow[])[0]
  return {
    data: row
      ? {
          found: row.found,
          commentOffset: row.comment_offset === null
            ? null
            : normalizeNumber(row.comment_offset),
          pageOffset: row.page_offset === null
            ? null
            : normalizeNumber(row.page_offset),
          totalCount: normalizeNumber(row.total_count),
        }
      : { found: false, commentOffset: null, pageOffset: null, totalCount: 0 },
    error: null,
  }
}

export async function getCommunityCommentTarget(
  commentId: string
): Promise<ServiceResult<CommunityCommentTarget | null>> {
  const { data, error } = await supabase
    .from('comunidade_post_comentarios')
    .select('id, post_id, comunidade_id')
    .eq('id', commentId)
    .is('deleted_at', null)
    .maybeSingle()

  return {
    data: data
      ? { id: data.id, postId: data.post_id, communityId: data.comunidade_id }
      : null,
    error: error
      ? normalizeCommunityError(error, 'Nao foi possivel localizar o comentario.')
      : null,
  }
}

export async function getCommunityPostById(
  postId: string,
  currentUserId?: string | null,
  currentUserRole?: CommunityRole | null
): Promise<ServiceResult<CommunityPost | null>> {
  const { data, error } = await supabase
    .from('comunidade_posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: normalizeCommunityError(error, 'Nao foi possivel carregar o post.'),
    }
  }

  if (!data) return { data: null, error: null }

  const row = data as PostRow
  const roleByCommunityId = currentUserRole
    ? new Map<string, CommunityRole>([[row.comunidade_id, currentUserRole]])
    : undefined
  const normalized = await normalizePosts([row], currentUserId, roleByCommunityId)

  return {
    data: normalized.data[0] || null,
    error: normalized.error
      ? normalizeCommunityError(normalized.error, 'Nao foi possivel carregar as interacoes do post.')
      : null,
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
      .order('fixado', { ascending: false })
      .order('fixado_em', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return {
        data: [],
        error: isSupabasePermissionError(error)
          ? null
          : normalizeCommunityError(error, 'Nao foi possivel carregar os posts.'),
        totalCount: null,
      }
    }

    const roleByCommunityId = currentUserRole
      ? new Map<string, CommunityRole>([[communityId, currentUserRole]])
      : undefined

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

async function getCommunityPostMediaPath(postId: string) {
  const { data, error } = await supabase
    .from('comunidade_posts')
    .select('imagem_path')
    .eq('id', postId)
    .maybeSingle()

  if (error) {
    if (!isSupabasePermissionError(error)) {
      logClientError('community.mediaCleanup.post.load', error)
    }
    return null
  }

  return data?.imagem_path || null
}

async function cleanupCommunityPostMedia(
  imagePath: string | null
): Promise<CommunityMediaCleanupResult> {
  const cleanupResult = await deleteStorageFiles([imagePath])
  return {
    deletedPaths: cleanupResult.deletedPaths,
    failedPaths: cleanupResult.failedPaths,
  }
}

export async function deleteCommunityPost(
  postId: string
): Promise<ServiceResult<CommunityMediaCleanupResult>> {
  const imagePath = await getCommunityPostMediaPath(postId)
  const { error } = await supabase.rpc('excluir_post_comunidade', {
    p_post_id: postId,
  })

  if (error) {
    return {
      data: { deletedPaths: [], failedPaths: [] },
      error: normalizeCommunityError(error, 'Nao foi possivel deletar o post.'),
    }
  }

  const cleanupResult = await cleanupCommunityPostMedia(imagePath)

  return {
    data: cleanupResult,
    error: null,
  }
}

export async function toggleCommunityPostPinned(
  postId: string,
  pinned: boolean
): Promise<ServiceResult<null>> {
  const { error } = await supabase.rpc('alterar_fixacao_post_comunidade', {
    p_post_id: postId,
    p_fixado: pinned,
  })

  return {
    data: null,
    error: error
      ? normalizeCommunityError(
          error,
          pinned ? 'Nao foi possivel fixar o post.' : 'Nao foi possivel desafixar o post.'
        )
      : null,
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
        error: isSupabasePermissionError(error)
          ? null
          : normalizeCommunityError(error, 'Nao foi possivel carregar os posts do perfil.'),
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
