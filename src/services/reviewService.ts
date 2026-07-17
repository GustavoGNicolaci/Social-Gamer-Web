import { supabase } from '../supabase-client'
import { translate } from '../i18n'
import type { Database } from '../types/supabase'
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
  type ReportReason,
  type ReportStatus,
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

export interface GameReviewsPageOptions {
  currentUserId?: string | null
  limit?: number
  offset?: number
  initialCommentsLimit?: number
}

export interface ReviewCommentsPageOptions {
  currentUserId?: string | null
  limit?: number
  offset?: number
}

export interface GameReviewsPageResult extends ServiceResult<ReviewItem[]> {
  totalCount: number | null
  hasMore: boolean
  nextOffset: number | null
  commentTotals: Record<string, number>
  fallbackUsed?: boolean
}

export interface ReviewCommentsPageResult extends ServiceResult<ReviewComment[]> {
  totalCount: number | null
  hasMore: boolean
  nextOffset: number | null
  fallbackUsed?: boolean
}

export interface GameReviewAnchor {
  targetType: 'review' | 'comment'
  reviewId: string
  commentId: string | null
  reviewOffset: number
  commentOffset: number | null
}

export interface GameReviewAnchorResult extends ServiceResult<GameReviewAnchor | null> {
  fallbackUsed?: boolean
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

type GameReviewPageRow =
  Database['public']['Functions']['get_game_reviews_page']['Returns'][number]
type ReviewCommentPageRow =
  Database['public']['Functions']['get_review_comments_page']['Returns'][number]
type GameReviewAnchorRow =
  Database['public']['Functions']['get_game_review_anchor']['Returns'][number]

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

const REVIEW_COMMENT_SELECT = `
  id,
  usuario_id,
  review_id,
  texto,
  data_comentario,
  editado_em,
  usuario:usuarios(id, username, avatar_path)
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

const OWN_GAME_REVIEW_SELECT = `
  id,
  usuario_id,
  jogo_id,
  nota,
  texto_review,
  curtidas,
  data_publicacao,
  editado_em,
  usuario:usuarios(id, username, avatar_path)
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
const DEFAULT_GAME_REVIEWS_PAGE_SIZE = 3
const DEFAULT_REVIEW_COMMENTS_PAGE_SIZE = 2
const MAX_GAME_REVIEW_READ_PAGE_SIZE = 20

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

function normalizeReadPageValue(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), 1), MAX_GAME_REVIEW_READ_PAGE_SIZE)
}

function normalizeReadOffset(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(Math.trunc(value), 0)
}

function isMissingReviewReadRpc(error: ReviewError | null) {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

function normalizeCurrentUserReport(
  targetType: 'review' | 'comment',
  row: {
    current_user_report_id: string | null
    current_user_report_reason: string | null
    current_user_report_description: string | null
    current_user_report_status: string | null
    current_user_report_created_at: string | null
  }
): CurrentUserReportSummary | null {
  if (
    !row.current_user_report_id ||
    !row.current_user_report_reason ||
    !row.current_user_report_status ||
    !row.current_user_report_created_at
  ) {
    return null
  }

  return {
    id: row.current_user_report_id,
    targetType,
    reason: row.current_user_report_reason as ReportReason,
    description: normalizeOptionalText(row.current_user_report_description),
    status: row.current_user_report_status as ReportStatus,
    createdAt: row.current_user_report_created_at,
  }
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

function normalizeGameReviewPageRow(
  row: GameReviewPageRow,
  currentUserId: string | null | undefined,
  comments: ReviewComment[]
): ReviewItem {
  return {
    id: row.review_id,
    usuario_id: row.author_id,
    jogo_id: row.game_id,
    nota: Number(row.score),
    texto_review: normalizeOptionalText(row.review_text),
    curtidas: Math.max(Number(row.likes_count) || 0, 0),
    data_publicacao: row.published_at,
    editado_em: row.edited_at,
    usuario: {
      id: row.author_id,
      username: row.author_username?.trim() || row.author_name?.trim() || 'Usuario',
      avatar_path: row.author_avatar_path,
    },
    comentarios: comments,
    likedByCurrentUser: Boolean(row.liked_by_current_user),
    canLike: Boolean(currentUserId) && currentUserId !== row.author_id,
    dislikes: Math.max(Number(row.dislikes_count) || 0, 0),
    dislikedByCurrentUser: Boolean(row.disliked_by_current_user),
    canDislike: Boolean(currentUserId) && currentUserId !== row.author_id,
    currentUserReport: normalizeCurrentUserReport('review', row),
  }
}

function normalizeReviewCommentPageRow(
  row: ReviewCommentPageRow,
  currentUserId?: string | null
): ReviewComment {
  return {
    id: row.comment_id,
    usuario_id: row.author_id,
    review_id: row.review_id,
    texto: row.comment_text,
    data_comentario: row.published_at,
    editado_em: row.edited_at,
    usuario: {
      id: row.author_id,
      username: row.author_username?.trim() || row.author_name?.trim() || 'Usuario',
      avatar_path: row.author_avatar_path,
    },
    curtidas: Math.max(Number(row.likes_count) || 0, 0),
    likedByCurrentUser: Boolean(row.liked_by_current_user),
    canLike: Boolean(currentUserId) && currentUserId !== row.author_id,
    dislikes: Math.max(Number(row.dislikes_count) || 0, 0),
    dislikedByCurrentUser: Boolean(row.disliked_by_current_user),
    canDislike: Boolean(currentUserId) && currentUserId !== row.author_id,
    currentUserReport: normalizeCurrentUserReport('comment', row),
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

async function getReviewCommentsPageFromLegacyQuery(
  reviewId: string,
  options: Required<Pick<ReviewCommentsPageOptions, 'limit' | 'offset'>> & {
    currentUserId?: string | null
  }
): Promise<ReviewCommentsPageResult> {
  const { data, error } = await supabase
    .from('comentarios')
    .select(REVIEW_COMMENT_SELECT)
    .eq('review_id', reviewId)
    .order('data_comentario', { ascending: false })

  if (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Nao foi possivel carregar os comentarios desta review.'),
      totalCount: null,
      hasMore: false,
      nextOffset: null,
      fallbackUsed: true,
    }
  }

  const comments = ((data || []) as ReviewCommentRow[])
    .map(row => normalizeReviewComment(row, options.currentUserId))

  if (comments.length === 0) {
    return {
      data: [],
      error: null,
      totalCount: 0,
      hasMore: false,
      nextOffset: null,
      fallbackUsed: true,
    }
  }

  const commentIds = comments.map(comment => comment.id)
  const [reactionStatesResult, reportsResult] = await Promise.all([
    getReactionSummaryStates([], commentIds),
    getCurrentUserContentReports([], commentIds, options.currentUserId),
  ])
  const sortedComments = sortCommentsByRelevance(comments.map(comment => {
    const reactionState = reactionStatesResult.data.comments.get(comment.id)

    return {
      ...comment,
      curtidas: reactionStatesResult.error
        ? comment.curtidas
        : reactionState?.curtidas ?? comment.curtidas,
      likedByCurrentUser: reactionStatesResult.error
        ? comment.likedByCurrentUser
        : reactionState?.likedByCurrentUser ?? comment.likedByCurrentUser,
      dislikes: reactionStatesResult.error
        ? comment.dislikes
        : reactionState?.dislikes ?? comment.dislikes,
      dislikedByCurrentUser: reactionStatesResult.error
        ? comment.dislikedByCurrentUser
        : reactionState?.dislikedByCurrentUser ?? comment.dislikedByCurrentUser,
      currentUserReport: reportsResult.error
        ? comment.currentUserReport
        : reportsResult.data.reportsByCommentId.get(comment.id) || comment.currentUserReport,
    }
  }))
  const page = sortedComments.slice(options.offset, options.offset + options.limit)
  const nextOffset = options.offset + page.length
  const hasMore = nextOffset < sortedComments.length

  return {
    data: page,
    error: reactionStatesResult.error || reportsResult.error,
    totalCount: sortedComments.length,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
    fallbackUsed: true,
  }
}

export async function getReviewCommentsPage(
  reviewId: string,
  pageOptions: ReviewCommentsPageOptions = {}
): Promise<ReviewCommentsPageResult> {
  const limit = normalizeReadPageValue(pageOptions.limit, DEFAULT_REVIEW_COMMENTS_PAGE_SIZE)
  const offset = normalizeReadOffset(pageOptions.offset)

  try {
    const { data, error } = await supabase.rpc('get_review_comments_page', {
      p_review_id: reviewId,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      const normalizedError = normalizeReviewError(
        error,
        'Nao foi possivel carregar os comentarios desta review.'
      )

      if (isMissingReviewReadRpc(normalizedError)) {
        return getReviewCommentsPageFromLegacyQuery(reviewId, {
          currentUserId: pageOptions.currentUserId,
          limit,
          offset,
        })
      }

      return {
        data: [],
        error: normalizedError,
        totalCount: null,
        hasMore: false,
        nextOffset: null,
      }
    }

    const rows = (data || []) as ReviewCommentPageRow[]
    const comments = rows.map(row => normalizeReviewCommentPageRow(row, pageOptions.currentUserId))
    const totalCount = rows[0]?.total_count ?? (offset === 0 ? 0 : null)
    const nextOffset = offset + comments.length
    const hasMore = totalCount === null
      ? comments.length === limit
      : nextOffset < totalCount

    return {
      data: comments,
      error: null,
      totalCount,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(
        error,
        'Erro inesperado ao carregar os comentarios desta review.'
      ),
      totalCount: null,
      hasMore: false,
      nextOffset: null,
    }
  }
}

export async function getGameReviewsPage(
  gameId: number,
  pageOptions: GameReviewsPageOptions = {}
): Promise<GameReviewsPageResult> {
  const limit = normalizeReadPageValue(pageOptions.limit, DEFAULT_GAME_REVIEWS_PAGE_SIZE)
  const offset = normalizeReadOffset(pageOptions.offset)
  const initialCommentsLimit = normalizeReadPageValue(
    pageOptions.initialCommentsLimit,
    DEFAULT_REVIEW_COMMENTS_PAGE_SIZE
  )

  try {
    const { data, error } = await supabase.rpc('get_game_reviews_page', {
      p_game_id: gameId,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      const normalizedError = normalizeReviewError(
        error,
        'Nao foi possivel carregar as reviews deste jogo.'
      )

      if (isMissingReviewReadRpc(normalizedError)) {
        const legacyResult = await getReviewsByGameId(gameId, pageOptions.currentUserId)
        const reviews = legacyResult.data
          .slice(offset, offset + limit)
          .map(review => ({
            ...review,
            comentarios: review.comentarios.slice(0, initialCommentsLimit),
          }))
        const commentTotals = Object.fromEntries(
          legacyResult.data
            .slice(offset, offset + limit)
            .map(review => [review.id, review.comentarios.length])
        )
        const nextOffset = offset + reviews.length
        const hasMore = nextOffset < legacyResult.data.length

        return {
          data: reviews,
          error: legacyResult.error,
          totalCount: legacyResult.data.length,
          hasMore,
          nextOffset: hasMore ? nextOffset : null,
          commentTotals,
          fallbackUsed: true,
        }
      }

      return {
        data: [],
        error: normalizedError,
        totalCount: null,
        hasMore: false,
        nextOffset: null,
        commentTotals: {},
      }
    }

    const rows = (data || []) as GameReviewPageRow[]
    const commentPageResults = await Promise.all(rows.map(row => (
      Number(row.comments_count) > 0
        ? getReviewCommentsPage(row.review_id, {
            currentUserId: pageOptions.currentUserId,
            limit: initialCommentsLimit,
            offset: 0,
          })
        : Promise.resolve<ReviewCommentsPageResult>({
            data: [],
            error: null,
            totalCount: 0,
            hasMore: false,
            nextOffset: null,
          })
    )))
    const reviews = rows.map((row, index) => (
      normalizeGameReviewPageRow(row, pageOptions.currentUserId, commentPageResults[index].data)
    ))
    const commentTotals = Object.fromEntries(rows.map((row, index) => [
      row.review_id,
      commentPageResults[index].totalCount ?? Math.max(Number(row.comments_count) || 0, 0),
    ]))
    const totalCount = rows[0]?.total_count ?? (offset === 0 ? 0 : null)
    const nextOffset = offset + reviews.length
    const hasMore = totalCount === null
      ? reviews.length === limit
      : nextOffset < totalCount

    return {
      data: reviews,
      error: commentPageResults.find(result => result.error)?.error || null,
      totalCount,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      commentTotals,
      fallbackUsed: commentPageResults.some(result => result.fallbackUsed),
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeReviewError(error, 'Erro inesperado ao carregar as reviews deste jogo.'),
      totalCount: null,
      hasMore: false,
      nextOffset: null,
      commentTotals: {},
    }
  }
}

export async function resolveGameReviewAnchor(
  gameId: number,
  target: { reviewId?: string | null; commentId?: string | null }
): Promise<GameReviewAnchorResult> {
  try {
    const { data, error } = await supabase.rpc('get_game_review_anchor', {
      p_game_id: gameId,
      p_review_id: target.reviewId || null,
      p_comment_id: target.commentId || null,
    })

    if (error) {
      const normalizedError = normalizeReviewError(
        error,
        'Nao foi possivel localizar a contribuicao solicitada.'
      )

      if (isMissingReviewReadRpc(normalizedError)) {
        const legacyResult = await getReviewsByGameId(gameId)
        const reviewIndex = target.commentId
          ? legacyResult.data.findIndex(review => (
              review.comentarios.some(comment => comment.id === target.commentId)
            ))
          : legacyResult.data.findIndex(review => review.id === target.reviewId)

        if (reviewIndex < 0) {
          return {
            data: null,
            error: legacyResult.error,
            fallbackUsed: true,
          }
        }

        const review = legacyResult.data[reviewIndex]
        const commentIndex = target.commentId
          ? review.comentarios.findIndex(comment => comment.id === target.commentId)
          : -1

        return {
          data: {
            targetType: target.commentId ? 'comment' : 'review',
            reviewId: review.id,
            commentId: target.commentId || null,
            reviewOffset: reviewIndex,
            commentOffset: commentIndex >= 0 ? commentIndex : null,
          },
          error: legacyResult.error,
          fallbackUsed: true,
        }
      }

      return { data: null, error: normalizedError }
    }

    const row = ((data || []) as GameReviewAnchorRow[])[0]
    if (!row) return { data: null, error: null }

    return {
      data: {
        targetType: row.target_type === 'comment' ? 'comment' : 'review',
        reviewId: row.review_id,
        commentId: row.comment_id,
        reviewOffset: Math.max(Number(row.review_offset) || 0, 0),
        commentOffset:
          row.comment_offset === null ? null : Math.max(Number(row.comment_offset) || 0, 0),
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao localizar a contribuicao.'),
    }
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

export async function getReviewByGameAndUserId(
  gameId: number,
  userId: string
): Promise<ServiceResult<ReviewItem | null>> {
  try {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select(OWN_GAME_REVIEW_SELECT)
      .eq('jogo_id', gameId)
      .eq('usuario_id', userId)
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeReviewError(error, 'Nao foi possivel carregar a sua review deste jogo.'),
      }
    }

    if (!data || !isCompleteReviewRow(data as ReviewRow)) {
      return { data: null, error: null }
    }

    const review = normalizeReviewItem(data as ReviewRow & {
      usuario_id: string
      jogo_id: number
      nota: number | string
      data_publicacao: string
    }, userId)
    const [reactionStatesResult, reportsResult] = await Promise.all([
      getReactionSummaryStates([review.id], []),
      getCurrentUserContentReports([review.id], [], userId),
    ])
    const reactionState = reactionStatesResult.data.reviews.get(review.id)

    return {
      data: {
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
          ? null
          : reportsResult.data.reportsByReviewId.get(review.id) || null,
      },
      error: reactionStatesResult.error || reportsResult.error,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeReviewError(error, 'Erro inesperado ao carregar a sua review.'),
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
