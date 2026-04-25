import { supabase } from '../supabase-client'
import { isProfilePrivate } from '../utils/profilePrivacy'
import type { CatalogGamePreview } from './gameCatalogService'
import {
  getCommentLikeStates,
  getCommentDislikeStates,
  getCurrentUserContentReports,
  getReviewDislikeStates,
  getReviewLikeStates,
  getSingleReviewReactionState,
  rollbackInsertedLike,
  syncReviewLikeWithDislikeRemoval,
  type CurrentUserReportSummary,
  type ReviewReactionState,
} from './reviewInteractionsService'

export interface ReviewError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface ReviewAuthor {
  username: string
  avatar_path: string | null
}

export type ReviewGamePreview = Pick<CatalogGamePreview, 'id' | 'titulo' | 'capa_url'>

export interface ReviewComment {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: ReviewAuthor | null
  curtidas: number
  likedByCurrentUser: boolean
  canLike: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
  canDislike: boolean
  currentUserReport: CurrentUserReportSummary | null
}

export interface ReviewItem {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number
  texto_review: string | null
  curtidas: number
  data_publicacao: string
  editado_em: string | null
  usuario: ReviewAuthor | null
  comentarios: ReviewComment[]
  likedByCurrentUser: boolean
  canLike: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
  canDislike: boolean
  currentUserReport: CurrentUserReportSummary | null
}

export interface ProfileReviewItem extends ReviewItem {
  jogo: ReviewGamePreview | null
}

export interface RecentReviewActivity {
  id: string
  authorName: string
  authorAvatar: string | null
  gameTitle: string
  summary: string
  score: number | null
  publishedAt: string
}

interface ServiceResult<T> {
  data: T
  error: ReviewError | null
}

interface SaveReviewParams {
  userId: string
  gameId: number
  nota: number
  textoReview: string
}

interface ToggleReviewLikeParams {
  reviewId: string
  userId: string
  reviewAuthorId: string
  likedByCurrentUser: boolean
  dislikedByCurrentUser: boolean
  currentLikeCount: number
  currentDislikeCount: number
}

interface CreateReviewCommentParams {
  userId: string
  reviewId: string
  texto: string
}

interface DeleteReviewCommentParams {
  userId: string
  commentId: string
}

interface DeleteReviewParams {
  userId: string
  reviewId: string
}

interface GetProfileReviewsOptions {
  includePrivateAuthorReviews?: boolean
}

interface ReviewAuthorRow {
  username: string
  avatar_path: string | null
  configuracoes_privacidade?: Record<string, unknown> | null
}

type ReviewAuthorRelation = ReviewAuthorRow | ReviewAuthorRow[] | null
type ReviewGameRelation = ReviewGamePreview | ReviewGamePreview[] | null

interface ReviewCommentRow {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: ReviewAuthorRelation
}

interface ReviewRow {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number | string
  texto_review: string | null
  curtidas: number | string | null
  data_publicacao: string
  editado_em: string | null
  usuario: ReviewAuthorRelation
  comentarios?: ReviewCommentRow[] | null
  jogo?: ReviewGameRelation
}

interface RecentReviewActivityRow {
  id: string
  nota: number | null
  data_publicacao: string
  jogos: { titulo: string } | { titulo: string }[] | null
  usuarios: ReviewAuthorRelation
}

interface SaveReviewResult {
  status: 'created' | 'updated' | 'error'
  error: ReviewError | null
}

interface ToggleReviewLikeResult {
  status: 'liked' | 'unliked' | 'error'
  data: ReviewReactionState | null
  error: ReviewError | null
}

interface DeleteReviewResult {
  ok: boolean
  error: ReviewError | null
}

const GAME_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(username, avatar_path, configuracoes_privacidade),
  comentarios(
    id,
    usuario_id,
    review_id,
    texto,
    data_comentario,
    editado_em,
    usuario:usuarios(username, avatar_path)
  )
`

const PROFILE_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(username, avatar_path, configuracoes_privacidade),
  jogo:jogos(id, titulo, capa_url)
`

const RECENT_REVIEW_ACTIVITY_SELECT = `
  id,
  nota,
  data_publicacao,
  jogos!inner(titulo),
  usuarios!inner(username, avatar_path, configuracoes_privacidade)
`

function normalizeReviewError(error: unknown, fallbackMessage: string): ReviewError {
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

function resolveSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function shouldHideReviewByPrivacy(authorRelation: ReviewAuthorRelation) {
  return isProfilePrivate(resolveSingleRelation(authorRelation)?.configuracoes_privacidade)
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function compareByLikesAndTimestamp(
  leftLikes: number,
  rightLikes: number,
  leftTimestamp: string,
  rightTimestamp: string
) {
  if (rightLikes !== leftLikes) {
    return rightLikes - leftLikes
  }

  return getTimestamp(rightTimestamp) - getTimestamp(leftTimestamp)
}

export function sortCommentsByRelevance(comments: ReviewComment[]) {
  return [...comments].sort((leftComment, rightComment) =>
    compareByLikesAndTimestamp(
      leftComment.curtidas,
      rightComment.curtidas,
      leftComment.data_comentario,
      rightComment.data_comentario
    )
  )
}

export function sortReviewsByRelevance(reviews: ReviewItem[]) {
  return [...reviews].sort((leftReview, rightReview) =>
    compareByLikesAndTimestamp(
      leftReview.curtidas,
      rightReview.curtidas,
      leftReview.data_publicacao,
      rightReview.data_publicacao
    )
  )
}

function normalizeReviewComment(
  row: ReviewCommentRow,
  currentUserId?: string | null
): ReviewComment {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    review_id: row.review_id,
    texto: row.texto,
    data_comentario: row.data_comentario,
    editado_em: row.editado_em,
    usuario: resolveSingleRelation(row.usuario),
    curtidas: 0,
    likedByCurrentUser: false,
    canLike: Boolean(currentUserId) && currentUserId !== row.usuario_id,
    dislikes: 0,
    dislikedByCurrentUser: false,
    canDislike: Boolean(currentUserId) && currentUserId !== row.usuario_id,
    currentUserReport: null,
  }
}

function normalizeReviewItem(row: ReviewRow, currentUserId?: string | null): ReviewItem {
  const comentarios = sortCommentsByRelevance(
    (row.comentarios || []).map(comment => normalizeReviewComment(comment, currentUserId))
  )

  return {
    id: row.id,
    usuario_id: row.usuario_id,
    jogo_id: row.jogo_id,
    nota: Number(row.nota),
    texto_review: normalizeOptionalText(row.texto_review),
    curtidas: Number(row.curtidas || 0),
    data_publicacao: row.data_publicacao,
    editado_em: row.editado_em,
    usuario: resolveSingleRelation(row.usuario),
    comentarios,
    likedByCurrentUser: false,
    canLike: Boolean(currentUserId) && currentUserId !== row.usuario_id,
    dislikes: 0,
    dislikedByCurrentUser: false,
    canDislike: Boolean(currentUserId) && currentUserId !== row.usuario_id,
    currentUserReport: null,
  }
}

function normalizeProfileReviewItem(row: ReviewRow): ProfileReviewItem {
  return {
    ...normalizeReviewItem(row, null),
    jogo: resolveSingleRelation(row.jogo),
  }
}

function normalizeRecentReviewActivity(row: RecentReviewActivityRow): RecentReviewActivity {
  const reviewGame = resolveSingleRelation(row.jogos)
  const reviewUser = resolveSingleRelation(row.usuarios)

  return {
    id: row.id,
    authorName: reviewUser?.username || 'Usuario',
    authorAvatar: reviewUser?.avatar_path || null,
    gameTitle: reviewGame?.titulo || 'Jogo desconhecido',
    summary: 'Publicou uma review na comunidade.',
    score: row.nota ?? null,
    publishedAt: row.data_publicacao,
  }
}

export async function getReviewsByGameId(
  gameId: number,
  currentUserId?: string | null
): Promise<ServiceResult<ReviewItem[]>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(GAME_REVIEW_SELECT)
      .eq('jogo_id', gameId)
      .order('data_publicacao', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews deste jogo.'),
      }
    }

    const visibleReviewRows = ((data || []) as ReviewRow[]).filter(
      row => !shouldHideReviewByPrivacy(row.usuario)
    )
    const visibleReviews = visibleReviewRows.map(row => normalizeReviewItem(row, currentUserId))

    if (visibleReviews.length === 0) {
      return {
        data: visibleReviews,
        error: null,
      }
    }

    const reviewIds = visibleReviews.map(review => review.id)
    const commentIds = visibleReviews.flatMap(review => review.comentarios.map(comment => comment.id))

    const [
      likeStatesResult,
      dislikeStatesResult,
      commentLikeStatesResult,
      commentDislikeStatesResult,
      reportsResult,
    ] =
      await Promise.all([
        getReviewLikeStates(reviewIds, currentUserId),
        getReviewDislikeStates(reviewIds, currentUserId),
        getCommentLikeStates(commentIds, currentUserId),
        getCommentDislikeStates(commentIds, currentUserId),
        getCurrentUserContentReports(reviewIds, commentIds, currentUserId),
      ])

    const reviewsWithInteractionState = sortReviewsByRelevance(visibleReviews.map(review => {
      const likeState = likeStatesResult.data.get(review.id)
      const dislikeState = dislikeStatesResult.data.get(review.id)

      return {
        ...review,
        curtidas: likeStatesResult.error ? review.curtidas : likeState?.curtidas ?? review.curtidas,
        likedByCurrentUser: likeStatesResult.error
          ? review.likedByCurrentUser
          : likeState?.likedByCurrentUser ?? review.likedByCurrentUser,
        dislikes: dislikeStatesResult.error ? review.dislikes : dislikeState?.dislikes ?? review.dislikes,
        dislikedByCurrentUser: dislikeStatesResult.error
          ? review.dislikedByCurrentUser
          : dislikeState?.dislikedByCurrentUser ?? review.dislikedByCurrentUser,
        currentUserReport: reportsResult.error
          ? review.currentUserReport
          : reportsResult.data.reportsByReviewId.get(review.id) || review.currentUserReport,
        comentarios: sortCommentsByRelevance(review.comentarios.map(comment => {
          const commentLikeState = commentLikeStatesResult.data.get(comment.id)
          const commentDislikeState = commentDislikeStatesResult.data.get(comment.id)

          return {
            ...comment,
            curtidas: commentLikeStatesResult.error
              ? comment.curtidas
              : commentLikeState?.curtidas ?? comment.curtidas,
            likedByCurrentUser: commentLikeStatesResult.error
              ? comment.likedByCurrentUser
              : commentLikeState?.likedByCurrentUser ?? comment.likedByCurrentUser,
            dislikes: commentDislikeStatesResult.error
              ? comment.dislikes
              : commentDislikeState?.dislikes ?? comment.dislikes,
            dislikedByCurrentUser: commentDislikeStatesResult.error
              ? comment.dislikedByCurrentUser
              : commentDislikeState?.dislikedByCurrentUser ?? comment.dislikedByCurrentUser,
            currentUserReport: reportsResult.error
              ? comment.currentUserReport
              : reportsResult.data.reportsByCommentId.get(comment.id) || comment.currentUserReport,
          }
        })),
      }
    }))

    return {
      data: reviewsWithInteractionState,
      error:
        likeStatesResult.error ||
        dislikeStatesResult.error ||
        commentLikeStatesResult.error ||
        commentDislikeStatesResult.error ||
        reportsResult.error,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews deste jogo.'),
    }
  }
}

export async function getReviewsByUserId(
  userId: string,
  options: GetProfileReviewsOptions = {}
): Promise<ServiceResult<ProfileReviewItem[]>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(PROFILE_REVIEW_SELECT)
      .eq('usuario_id', userId)
      .order('data_publicacao', { ascending: false })

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews do perfil.'),
      }
    }

    const reviewRows = ((data || []) as ReviewRow[]).filter(row =>
      options.includePrivateAuthorReviews ? true : !shouldHideReviewByPrivacy(row.usuario)
    )

    return {
      data: reviewRows.map(normalizeProfileReviewItem),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
    }
  }
}

export async function getRecentPublicReviewActivities(
  limit = 6
): Promise<ServiceResult<RecentReviewActivity[]>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(RECENT_REVIEW_ACTIVITY_SELECT)
      .order('data_publicacao', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews recentes.'),
      }
    }

    const visibleActivities = ((data || []) as RecentReviewActivityRow[])
      .filter(row => !shouldHideReviewByPrivacy(row.usuarios))
      .map(normalizeRecentReviewActivity)

    return {
      data: visibleActivities,
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews recentes.'),
    }
  }
}

export async function saveReview({
  userId,
  gameId,
  nota,
  textoReview,
}: SaveReviewParams): Promise<SaveReviewResult> {
  const normalizedText = normalizeOptionalText(textoReview)

  try {
    const { data: existingReview, error: existingReviewError } = await supabase
      .from('avaliacoes')
      .select('id')
      .eq('usuario_id', userId)
      .eq('jogo_id', gameId)
      .maybeSingle()

    if (existingReviewError) {
      return {
        status: 'error',
        error: normalizeReviewError(
          existingReviewError,
          'Nao foi possivel verificar a review atual deste jogo.'
        ),
      }
    }

    if (existingReview?.id) {
      const { error } = await supabase
        .from('avaliacoes')
        .update({
          nota,
          texto_review: normalizedText,
        })
        .eq('id', existingReview.id)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          error: normalizeReviewError(error, 'Nao foi possivel atualizar a review deste jogo.'),
        }
      }

      return {
        status: 'updated',
        error: null,
      }
    }

    const { error } = await supabase.from('avaliacoes').insert({
      usuario_id: userId,
      jogo_id: gameId,
      nota,
      texto_review: normalizedText,
      curtidas: 0,
      data_publicacao: new Date().toISOString(),
    })

    if (error) {
      return {
        status: 'error',
        error: normalizeReviewError(error, 'Nao foi possivel criar a review deste jogo.'),
      }
    }

    return {
      status: 'created',
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      error: normalizeReviewError(error, 'Erro inesperado ao salvar a review deste jogo.'),
    }
  }
}

export async function toggleReviewLike({
  reviewId,
  userId,
  reviewAuthorId,
  likedByCurrentUser,
  dislikedByCurrentUser,
  currentLikeCount,
  currentDislikeCount,
}: ToggleReviewLikeParams): Promise<ToggleReviewLikeResult> {
  if (userId === reviewAuthorId) {
    return {
      status: 'error',
      data: null,
      error: {
        message: 'Voce nao pode curtir a propria review.',
      },
    }
  }

  try {
    if (likedByCurrentUser) {
      const { error } = await supabase
        .from('avaliacao_curtidas')
        .delete()
        .eq('avaliacao_id', reviewId)
        .eq('usuario_id', userId)

      if (error) {
        return {
          status: 'error',
          data: null,
          error: normalizeReviewError(error, 'Nao foi possivel remover a curtida desta review.'),
        }
      }

      const reactionStateResult = await getSingleReviewReactionState(reviewId, userId)

      return {
        status: 'unliked',
        data: reactionStateResult.data || {
          curtidas: Math.max(currentLikeCount - 1, 0),
          likedByCurrentUser: false,
          dislikes: currentDislikeCount,
          dislikedByCurrentUser,
        },
        error: null,
      }
    }

    const { data: existingLikes, error: existingLikesError } = await supabase
      .from('avaliacao_curtidas')
      .select('avaliacao_id')
      .eq('avaliacao_id', reviewId)
      .eq('usuario_id', userId)
      .limit(1)

    if (existingLikesError) {
      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(
          existingLikesError,
          'Nao foi possivel verificar a curtida atual desta review.'
        ),
      }
    }

    if ((existingLikes || []).length > 0) {
      const reactionStateResult = await getSingleReviewReactionState(reviewId, userId)

      return {
        status: 'liked',
        data: reactionStateResult.data || {
          curtidas: Math.max(currentLikeCount, 1),
          likedByCurrentUser: true,
          dislikes: currentDislikeCount,
          dislikedByCurrentUser,
        },
        error: null,
      }
    }

    const { error } = await supabase.from('avaliacao_curtidas').insert({
      avaliacao_id: reviewId,
      usuario_id: userId,
    })

    if (error && error.code !== '23505') {
      return {
        status: 'error',
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel curtir esta review.'),
      }
    }

    if (dislikedByCurrentUser) {
      const syncResult = await syncReviewLikeWithDislikeRemoval(reviewId, userId)

      if (syncResult.error) {
        if (!error) {
          await rollbackInsertedLike(reviewId, userId)
        }

        return {
          status: 'error',
          data: null,
          error: normalizeReviewError(
            syncResult.error,
            'Nao foi possivel sincronizar curtida e dislike desta review.'
          ),
        }
      }
    }

    const reactionStateResult = await getSingleReviewReactionState(reviewId, userId)

    return {
      status: 'liked',
      data: reactionStateResult.data || {
        curtidas: currentLikeCount + 1,
        likedByCurrentUser: true,
        dislikes: Math.max(currentDislikeCount - (dislikedByCurrentUser ? 1 : 0), 0),
        dislikedByCurrentUser: false,
      },
      error: null,
    }
  } catch (error) {
    return {
      status: 'error',
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao atualizar a curtida desta review.'),
    }
  }
}

export async function createReviewComment({
  userId,
  reviewId,
  texto,
}: CreateReviewCommentParams): Promise<ServiceResult<null>> {
  const normalizedText = texto.trim()

  if (!normalizedText) {
    return {
      data: null,
      error: {
        message: 'O comentario nao pode ser enviado vazio.',
      },
    }
  }

  try {
    const { error } = await supabase.from('comentarios').insert({
      usuario_id: userId,
      review_id: reviewId,
      texto: normalizedText,
      data_comentario: new Date().toISOString(),
    })

    if (error) {
      return {
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel publicar o comentario desta review.'),
      }
    }

    return {
      data: null,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao publicar o comentario desta review.'),
    }
  }
}

export async function deleteReviewComment({
  userId,
  commentId,
}: DeleteReviewCommentParams): Promise<DeleteReviewResult> {
  try {
    const { data, error } = await supabase
      .from('comentarios')
      .delete()
      .eq('id', commentId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        error: normalizeReviewError(error, 'Nao foi possivel apagar este comentario.'),
      }
    }

    if (!data) {
      return {
        ok: false,
        error: {
          message: 'Voce nao tem permissao para apagar este comentario ou ele nao existe mais.',
        },
      }
    }

    return {
      ok: true,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeReviewError(error, 'Erro inesperado ao apagar este comentario.'),
    }
  }
}

export async function deleteReview({
  userId,
  reviewId,
}: DeleteReviewParams): Promise<DeleteReviewResult> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .delete()
      .eq('id', reviewId)
      .eq('usuario_id', userId)
      .select('id')
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        error: normalizeReviewError(error, 'Nao foi possivel apagar esta review.'),
      }
    }

    if (!data) {
      return {
        ok: false,
        error: {
          message: 'Voce nao tem permissao para apagar esta review ou ela nao existe mais.',
        },
      }
    }

    return {
      ok: true,
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeReviewError(error, 'Erro inesperado ao apagar esta review.'),
    }
  }
}
