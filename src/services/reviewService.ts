import { supabase } from '../supabase-client'
import { translate } from '../i18n'
import {
  normalizeReviewError,
  type ReviewError,
} from '../features/reviews/domain/reviewError'
import { getPerformanceNow, logPerformanceTiming } from '../utils/performanceDiagnostics'
import type { CatalogGamePreview } from './gameCatalogService'
import {
  getCurrentUserContentReports,
  getReactionSummaryStates,
  toggleContentReaction,
  type CurrentUserReportSummary,
  type ReviewReactionState,
} from './reviewInteractionsService'

export type { ReviewError } from '../features/reviews/domain/reviewError'

export interface ReviewAuthor {
  id?: string
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

export interface GameRatingSummary {
  gameId: number
  averageRating: number | null
  reviewCount: number
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
  currentUserId?: string | null
  includeRestrictedAuthorReviews?: boolean
}

interface GetProfileReviewsPageOptions extends GetProfileReviewsOptions {
  page?: number
  pageSize?: number
}

interface ProfileReviewsQueryTimings {
  totalMs: number
  queryMs: number
  normalizeMs: number
  requestCount: number
  privacyFilterMs: number
}

interface PaginatedServiceResult<T> extends ServiceResult<T> {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  timings: ProfileReviewsQueryTimings
}

interface ReviewAuthorRow {
  id?: string
  username: string
  avatar_path: string | null
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
  usuario_id: string | null
  jogo_id: number | null
  nota: number | string | null
  texto_review: string | null
  curtidas: number | string | null
  data_publicacao: string | null
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

interface GameRatingSummaryRow {
  jogo_id: number | string | null
  review_count: number | string | null
  average_rating: number | string | null
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
  usuario:usuarios(id, username, avatar_path),
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
  usuario:usuarios(id, username, avatar_path),
  jogo:jogos(id, titulo, capa_url)
`

const RECENT_REVIEW_ACTIVITY_SELECT = `
  id,
  nota,
  data_publicacao,
  jogos!inner(titulo),
  usuarios!inner(id, username, avatar_path)
`

const GAME_RATING_SUMMARY_SELECT = `
  jogo_id,
  review_count,
  average_rating
`

const DEFAULT_PROFILE_REVIEWS_PAGE_SIZE = 6

function resolveSingleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim() || ''
  return trimmedValue ? trimmedValue : null
}

function normalizeNumber(value: number | string | null | undefined) {
  const normalizedValue = Number(value)
  return Number.isFinite(normalizedValue) ? normalizedValue : null
}

function validateSaveReviewParams({ userId, gameId, nota }: SaveReviewParams): ReviewError | null {
  if (!userId.trim()) {
    return {
      message: 'Nao foi possivel identificar o usuario da review.',
    }
  }

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return {
      message: 'Nao foi possivel identificar o jogo da review.',
    }
  }

  if (!Number.isFinite(nota) || nota < 1 || nota > 10) {
    return {
      message: 'Escolha uma nota de 1 a 10 para publicar a review.',
    }
  }

  return null
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

function isCompleteReviewRow(
  row: ReviewRow
): row is ReviewRow & {
  usuario_id: string
  jogo_id: number
  nota: number | string
  data_publicacao: string
} {
  return Boolean(row.id && row.usuario_id && row.jogo_id && row.nota !== null && row.data_publicacao)
}

function normalizeReviewItem(
  row: ReviewRow & {
    usuario_id: string
    jogo_id: number
    nota: number | string
    data_publicacao: string
  },
  currentUserId?: string | null
): ReviewItem {
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

function normalizeProfileReviewItem(row: ReviewRow & {
  usuario_id: string
  jogo_id: number
  nota: number | string
  data_publicacao: string
}): ProfileReviewItem {
  return {
    ...normalizeReviewItem(row, null),
    jogo: resolveSingleRelation(row.jogo),
  }
}

function normalizeProfileReviewsPageOptions(options: GetProfileReviewsPageOptions = {}) {
  const page = Math.max(0, options.page || 0)
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_PROFILE_REVIEWS_PAGE_SIZE), 36)
  const from = page * pageSize
  const to = from + pageSize - 1

  return {
    ...options,
    page,
    pageSize,
    from,
    to,
  }
}

function buildProfileReviewsPageMetadata(
  totalCount: number | null,
  page: number,
  pageSize: number,
  itemCount: number
) {
  const loadedCount = page * pageSize + itemCount
  const hasMore = totalCount === null ? itemCount === pageSize : loadedCount < totalCount

  return {
    totalCount,
    hasMore,
    nextPage: hasMore ? page + 1 : null,
  }
}

function normalizeRecentReviewActivity(row: RecentReviewActivityRow): RecentReviewActivity {
  const reviewGame = resolveSingleRelation(row.jogos)
  const reviewUser = resolveSingleRelation(row.usuarios)

  return {
    id: row.id,
    authorName: reviewUser?.username || 'Usuario',
    authorAvatar: reviewUser?.avatar_path || null,
    gameTitle: reviewGame?.titulo || translate('common.unknownGame'),
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

    const gameReviews = ((data || []) as ReviewRow[])
      .filter(isCompleteReviewRow)
      .map(row => normalizeReviewItem(row, currentUserId))

    if (gameReviews.length === 0) {
      return {
        data: gameReviews,
        error: null,
      }
    }

    const reviewIds = gameReviews.map(review => review.id)
    const commentIds = gameReviews.flatMap(review => review.comentarios.map(comment => comment.id))

    const [reactionStatesResult, reportsResult] = await Promise.all([
      getReactionSummaryStates(reviewIds, commentIds),
      getCurrentUserContentReports(reviewIds, commentIds, currentUserId),
    ])

    const reviewsWithInteractionState = sortReviewsByRelevance(gameReviews.map(review => {
      const reactionState = reactionStatesResult.data.reviews.get(review.id)

      return {
        ...review,
        curtidas: reactionStatesResult.error
          ? review.curtidas
          : reactionState?.curtidas ?? review.curtidas,
        likedByCurrentUser: reactionStatesResult.error
          ? review.likedByCurrentUser
          : reactionState?.likedByCurrentUser ?? review.likedByCurrentUser,
        dislikes: reactionStatesResult.error
          ? review.dislikes
          : reactionState?.dislikes ?? review.dislikes,
        dislikedByCurrentUser: reactionStatesResult.error
          ? review.dislikedByCurrentUser
          : reactionState?.dislikedByCurrentUser ?? review.dislikedByCurrentUser,
        currentUserReport: reportsResult.error
          ? review.currentUserReport
          : reportsResult.data.reportsByReviewId.get(review.id) || review.currentUserReport,
        comentarios: sortCommentsByRelevance(review.comentarios.map(comment => {
          const commentReactionState = reactionStatesResult.data.comments.get(comment.id)

          return {
            ...comment,
            curtidas: reactionStatesResult.error
              ? comment.curtidas
              : commentReactionState?.curtidas ?? comment.curtidas,
            likedByCurrentUser: reactionStatesResult.error
              ? comment.likedByCurrentUser
              : commentReactionState?.likedByCurrentUser ?? comment.likedByCurrentUser,
            dislikes: reactionStatesResult.error
              ? comment.dislikes
              : commentReactionState?.dislikes ?? comment.dislikes,
            dislikedByCurrentUser: reactionStatesResult.error
              ? comment.dislikedByCurrentUser
              : commentReactionState?.dislikedByCurrentUser ?? comment.dislikedByCurrentUser,
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
        reactionStatesResult.error ||
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
  void options

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

    const reviewRows = (data || []) as ReviewRow[]

    return {
      data: reviewRows.filter(isCompleteReviewRow).map(normalizeProfileReviewItem),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
    }
  }
}

export async function getReviewsPageByUserId(
  userId: string,
  pageOptions: GetProfileReviewsPageOptions = {}
): Promise<PaginatedServiceResult<ProfileReviewItem[]>> {
  const options = normalizeProfileReviewsPageOptions(pageOptions)
  const startedAt = getPerformanceNow()
  const timings: ProfileReviewsQueryTimings = {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 0,
    privacyFilterMs: 0,
  }

  try {
    const queryStartedAt = getPerformanceNow()
    const { data, error, count } = await supabase
      .from('avaliacoes')
      .select(PROFILE_REVIEW_SELECT, { count: 'exact' })
      .eq('usuario_id', userId)
      .order('data_publicacao', { ascending: false })
      .range(options.from, options.to)

    timings.requestCount += 1
    timings.queryMs += getPerformanceNow() - queryStartedAt

    if (error) {
      timings.totalMs = getPerformanceNow() - startedAt
      logPerformanceTiming('profile.reviews.page', timings.totalMs, {
        userId,
        page: options.page,
        pageSize: options.pageSize,
        requestCount: timings.requestCount,
        hasError: true,
      })

      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews do perfil.'),
        totalCount: null,
        hasMore: false,
        nextPage: null,
        timings,
      }
    }

    // Profile visibility is decided before this query from the safe public
    // profile projection. Reviews themselves remain public contributions.
    const reviewRows = (data || []) as ReviewRow[]

    const normalizeStartedAt = getPerformanceNow()
    const items = reviewRows.filter(isCompleteReviewRow).map(normalizeProfileReviewItem)
    timings.normalizeMs += getPerformanceNow() - normalizeStartedAt
    timings.totalMs = getPerformanceNow() - startedAt

    const result: PaginatedServiceResult<ProfileReviewItem[]> = {
      data: items,
      error: null,
      ...buildProfileReviewsPageMetadata(count, options.page, options.pageSize, items.length),
      timings,
    }

    logPerformanceTiming('profile.reviews.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      requestCount: timings.requestCount,
      totalCount: result.totalCount,
      itemCount: result.data.length,
    })

    return result
  } catch (error) {
    timings.totalMs = getPerformanceNow() - startedAt
    logPerformanceTiming('profile.reviews.page', timings.totalMs, {
      userId,
      page: options.page,
      pageSize: options.pageSize,
      requestCount: timings.requestCount,
      hasError: true,
    })

    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews do perfil.'),
      totalCount: null,
      hasMore: false,
      nextPage: null,
      timings,
    }
  }
}

export async function getRecentPublicReviewActivities(
  limit = 6,
  currentUserId?: string | null
): Promise<ServiceResult<RecentReviewActivity[]>> {
  void currentUserId

  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(RECENT_REVIEW_ACTIVITY_SELECT)
      .order('data_publicacao', { ascending: false })
      .limit(Math.max(limit * 3, limit))

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as reviews recentes.'),
      }
    }

    const visibleActivities = ((data || []) as RecentReviewActivityRow[])
      .map(normalizeRecentReviewActivity)
      .slice(0, limit)

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

export async function getGameRatingSummaries(
  gameIds: number[]
): Promise<ServiceResult<GameRatingSummary[]>> {
  const normalizedGameIds = Array.from(
    new Set(gameIds.filter(gameId => Number.isInteger(gameId) && gameId > 0))
  )

  if (normalizedGameIds.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('game_rating_summaries')
      .select(GAME_RATING_SUMMARY_SELECT)
      .in('jogo_id', normalizedGameIds)

    if (error) {
      return {
        data: [],
        error: normalizeReviewError(error, 'Nao foi possivel carregar as notas do catalogo.'),
      }
    }

    const ratingSummariesByGameId = new Map<number, GameRatingSummary>()

    ;((data || []) as GameRatingSummaryRow[]).forEach(row => {
      const gameId = Number(row.jogo_id)
      const averageRating = normalizeNumber(row.average_rating)
      const reviewCount = normalizeNumber(row.review_count)

      if (!Number.isInteger(gameId)) {
        return
      }

      ratingSummariesByGameId.set(gameId, {
        gameId,
        averageRating,
        reviewCount: reviewCount === null ? 0 : Math.max(Math.trunc(reviewCount), 0),
      })
    })

    return {
      data: normalizedGameIds.map(gameId => {
        const summary = ratingSummariesByGameId.get(gameId)

        return {
          gameId,
          averageRating: summary?.averageRating ?? null,
          reviewCount: summary?.reviewCount || 0,
        }
      }),
      error: null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as notas do catalogo.'),
    }
  }
}

export async function saveReview({
  userId,
  gameId,
  nota,
  textoReview,
}: SaveReviewParams): Promise<SaveReviewResult> {
  const validationError = validateSaveReviewParams({ userId, gameId, nota, textoReview })

  if (validationError) {
    return {
      status: 'error',
      error: validationError,
    }
  }

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

  const result = await toggleContentReaction('review', reviewId, 'like')

  if (result.status !== 'liked' && result.status !== 'unliked') {
    return {
      status: 'error',
      data: result.data,
      error: result.error || { message: 'A review retornou um estado de reacao inesperado.' },
    }
  }

  return {
    status: result.status,
    data: result.data,
    error: result.error,
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
