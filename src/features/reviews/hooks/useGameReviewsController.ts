import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import type { TranslationParams } from '../../../i18n'
import {
  createReviewComment,
  deleteReview,
  deleteReviewComment,
  getGameRatingSummaries,
  getGameReviewsPage,
  getReviewByGameAndUserId,
  getReviewCommentsPage,
  resolveGameReviewAnchor,
  saveReview,
  toggleReviewLike,
  type GameRatingSummary,
  type ReviewComment,
  type ReviewError,
  type ReviewItem,
} from '../../../services/reviewService'
import {
  deleteContentReport,
  submitContentReport,
  toggleCommentDislike,
  toggleCommentLike,
  toggleReviewDislike,
  type CurrentUserReportSummary,
  type ReportReason,
  type ReportTargetType,
} from '../../../services/reviewInteractionsService'
import {
  isSupabaseDuplicateError,
  isSupabasePermissionError,
  isSupabaseStructureError,
} from '../../../utils/supabaseErrors'
import {
  applyCommentReactionState,
  applyContentReportState,
  applyReviewReactionState,
  createOptimisticDislikeTransition,
  createOptimisticLikeTransition,
  mergeCommentPagePreservingClientState,
  mergeRefreshedReviews,
  mergeReviewPagePreservingClientState,
  removeCommentForRollback,
  restoreCommentFromRollback,
} from '../domain/gameReviewState'

type FeedbackTone = 'success' | 'error' | 'info'

export interface ReviewFeedbackState {
  tone: FeedbackTone
  message: string
}

export interface GameReviewsOverviewController {
  reviews: ReviewItem[]
  ratingSummary: GameRatingSummary | null
  totalComments: number
  loading: boolean
}

export interface GameReviewsFormController {
  authenticated: boolean
  score: number
  setScore: (score: number) => void
  text: string
  setText: (text: string) => void
  submitting: boolean
  feedback: ReviewFeedbackState | null
  editing: boolean
  submit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
}

export interface GameReviewsListController {
  userId: string | null
  total: number
  visible: ReviewItem[]
  error: string | null
  commentCounts: Record<string, number>
  commentTotals: Record<string, number>
  commentText: Record<string, string>
  submittingComments: Record<string, boolean>
  pendingReviews: readonly string[]
  pendingComments: readonly string[]
  deletingReviews: readonly string[]
  loadingMoreReviews: boolean
  loadingComments: Record<string, boolean>
  hidden: number
}

export interface GameReviewReportTarget {
  targetType: ReportTargetType
  targetId: string
  authorName: string
  currentReport: CurrentUserReportSummary | null
}

export interface GameReviewsReportController {
  target: GameReviewReportTarget | null
  feedback: ReviewFeedbackState | null
  submitting: boolean
  removing: boolean
}

export interface GameReviewsActionsController {
  refreshReviews: () => Promise<unknown>
  reviewLike: (review: ReviewItem) => Promise<void>
  reviewDislike: (review: ReviewItem) => Promise<void>
  reviewDelete: (review: ReviewItem) => Promise<void>
  commentLike: (reviewId: string, comment: ReviewComment) => Promise<void>
  commentDislike: (reviewId: string, comment: ReviewComment) => Promise<void>
  commentDelete: (reviewId: string, comment: ReviewComment) => Promise<void>
  openReport: (targetType: ReportTargetType, targetId: string, reviewId: string) => void
  expandComments: (reviewId: string, totalComments: number) => Promise<void>
  submitComment: (
    reviewId: string,
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  expandReviews: () => Promise<void>
  closeReport: () => void
  submitReport: (payload: { reason: ReportReason; description: string }) => Promise<void>
  removeReport: () => Promise<void>
}

export interface GameReviewsSectionController {
  form: GameReviewsFormController
  list: GameReviewsListController
  report: GameReviewsReportController
  actions: GameReviewsActionsController
}

export interface GameReviewsController {
  overview: GameReviewsOverviewController
  section: GameReviewsSectionController
}

export interface ReportModalTargetState {
  targetType: ReportTargetType
  targetId: string
  reviewId: string
}

interface UseGameReviewsControllerOptions {
  gameId: number | null
  currentUserId: string | null
  locationHash: string
  t: (key: string, params?: TranslationParams) => string
}

type Translate = UseGameReviewsControllerOptions['t']

type ReviewAction =
  | 'load'
  | 'save'
  | 'comment'
  | 'comment_delete'
  | 'review_like'
  | 'review_dislike'
  | 'comment_like'
  | 'comment_dislike'
  | 'report'
  | 'report_delete'
  | 'delete'

export const INITIAL_VISIBLE_REVIEW_COUNT = 3
export const VISIBLE_REVIEW_BATCH_SIZE = 4
export const INITIAL_VISIBLE_COMMENT_COUNT = 2
export const VISIBLE_COMMENT_BATCH_SIZE = 4

export function getInitialVisibleCommentCount(totalComments: number) {
  return Math.min(Math.max(totalComments, 0), INITIAL_VISIBLE_COMMENT_COUNT)
}

function getEmptyRatingSummary(gameId: number): GameRatingSummary {
  return {
    gameId,
    averageRating: null,
    reviewCount: 0,
  }
}

function getReviewErrorMessage(t: Translate, error: ReviewError | null, action: ReviewAction) {
  if (!error) {
    return t(`game.details.reviewError.${action}.default`)
  }

  if (isSupabasePermissionError(error)) {
    return t(`game.details.reviewError.${action}.permission`)
  }

  if (isSupabaseDuplicateError(error)) {
    if (action === 'review_like' || action === 'comment_like' || action === 'report') {
      return t(`game.details.reviewError.${action}.duplicate`)
    }
    if (action === 'review_dislike' || action === 'comment_dislike') {
      return t('game.details.reviewError.dislike.duplicate')
    }
    return t('game.details.reviewError.save.duplicate')
  }

  if (isSupabaseStructureError(error)) {
    return t('game.details.reviewError.structure')
  }

  return error.message
}

function removeMapKey<T>(map: Record<string, T>, key: string) {
  const nextMap = { ...map }
  delete nextMap[key]
  return nextMap
}

function getTargetId(locationHash: string) {
  if (!locationHash) return ''

  try {
    return decodeURIComponent(locationHash.startsWith('#') ? locationHash.slice(1) : locationHash)
  } catch {
    return locationHash.startsWith('#') ? locationHash.slice(1) : locationHash
  }
}

export function useGameReviewsController({
  gameId,
  currentUserId,
  locationHash,
  t,
}: UseGameReviewsControllerOptions): GameReviewsController {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [ownReviewForForm, setOwnReviewForForm] = useState<ReviewItem | null>(null)
  const [ratingSummary, setRatingSummary] = useState<GameRatingSummary | null>(null)
  const [totalReviewCount, setTotalReviewCount] = useState(0)
  const [nextReviewOffset, setNextReviewOffset] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(Boolean(gameId))
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [nota, setNota] = useState(5)
  const [textoReview, setTextoReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState<ReviewFeedbackState | null>(null)
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({})
  const [visibleCommentsByReviewId, setVisibleCommentsByReviewId] = useState<Record<string, number>>({})
  const [commentTotalsByReviewId, setCommentTotalsByReviewId] = useState<Record<string, number>>({})
  const [nextCommentOffsetByReviewId, setNextCommentOffsetByReviewId] = useState<Record<string, number>>({})
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false)
  const [loadingCommentsByReviewId, setLoadingCommentsByReviewId] = useState<Record<string, boolean>>({})
  const [submittingComentario, setSubmittingComentario] = useState<Record<string, boolean>>({})
  const [pendingReviewReactionIds, setPendingReviewReactionIds] = useState<string[]>([])
  const [pendingCommentReactionIds, setPendingCommentReactionIds] = useState<string[]>([])
  const [deletingReviewIds, setDeletingReviewIds] = useState<string[]>([])
  const [reportModalTarget, setReportModalTarget] = useState<ReportModalTargetState | null>(null)
  const [reportModalFeedback, setReportModalFeedback] = useState<ReviewFeedbackState | null>(null)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [removingReport, setRemovingReport] = useState(false)

  const scopeKey = `${gameId ?? 'none'}:${currentUserId ?? 'anonymous'}`
  const scopeKeyRef = useRef(scopeKey)
  const mountedRef = useRef(false)
  const reviewsRequestVersionRef = useRef(0)
  const ratingRequestVersionRef = useRef(0)
  const paginationRequestVersionRef = useRef(0)
  const anchorRequestVersionRef = useRef(0)
  const loadingMoreReviewsRef = useRef<string | null>(null)
  const loadingCommentIdsRef = useRef(new Set<string>())
  const resolvedAnchorKeyRef = useRef('')
  const anchorRequestKeyRef = useRef('')

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    const loadingCommentIds = loadingCommentIdsRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      reviewsRequestVersionRef.current += 1
      ratingRequestVersionRef.current += 1
      paginationRequestVersionRef.current += 1
      anchorRequestVersionRef.current += 1
      loadingMoreReviewsRef.current = null
      loadingCommentIds.clear()
      anchorRequestKeyRef.current = ''
    }
  }, [])

  const isScopeActive = useCallback((expectedScopeKey: string) => (
    mountedRef.current && scopeKeyRef.current === expectedScopeKey
  ), [])

  const refreshReviews = useCallback(async (requestedGameId = gameId) => {
    if (!requestedGameId || requestedGameId !== gameId) {
      return {
        data: [] as ReviewItem[],
        error: null as ReviewError | null,
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
        commentTotals: {},
      }
    }

    const expectedScopeKey = scopeKey
    const requestVersion = ++reviewsRequestVersionRef.current
    const result = await getGameReviewsPage(requestedGameId, {
      currentUserId,
      limit: Math.min(Math.max(reviews.length, INITIAL_VISIBLE_REVIEW_COUNT), 20),
      offset: 0,
      initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
    })

    if (
      !isScopeActive(expectedScopeKey) ||
      requestVersion !== reviewsRequestVersionRef.current
    ) {
      return result
    }

    setReviews(currentReviews => (
      result.error && result.data.length === 0
        ? mergeRefreshedReviews(currentReviews, result)
        : mergeReviewPagePreservingClientState(currentReviews, result.data)
    ))
    const refreshedOwnReview = result.data.find(review => review.usuario_id === currentUserId)
    if (refreshedOwnReview) setOwnReviewForForm(refreshedOwnReview)
    setTotalReviewCount(current => result.totalCount ?? Math.max(current, result.data.length))
    setNextReviewOffset(current => Math.max(current, result.nextOffset ?? result.data.length))
    setCommentTotalsByReviewId(current => ({ ...current, ...(result.commentTotals || {}) }))
    setVisibleCommentsByReviewId(current => {
      const next = { ...current }
      result.data.forEach(review => {
        next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
      })
      return next
    })
    setNextCommentOffsetByReviewId(current => {
      const next = { ...current }
      result.data.forEach(review => {
        next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
      })
      return next
    })

    setReviewsError(
      result.error && result.data.length === 0
        ? getReviewErrorMessage(t, result.error, 'load')
        : null
    )

    return result
  }, [currentUserId, gameId, isScopeActive, reviews.length, scopeKey, t])

  const refreshRatingSummary = useCallback(async (requestedGameId = gameId) => {
    if (!requestedGameId || requestedGameId !== gameId) return null

    const expectedScopeKey = scopeKey
    const requestVersion = ++ratingRequestVersionRef.current
    const result = await getGameRatingSummaries([requestedGameId])

    if (
      !isScopeActive(expectedScopeKey) ||
      requestVersion !== ratingRequestVersionRef.current
    ) {
      return result
    }

    if (result.error) {
      console.error(t('game.details.reviewFeedback.ratingSummaryLoadLog'), result.error)
      setRatingSummary(null)
      return result
    }

    setRatingSummary(
      result.data.find(summary => summary.gameId === requestedGameId) ||
        getEmptyRatingSummary(requestedGameId)
    )
    return result
  }, [gameId, isScopeActive, scopeKey, t])

  useEffect(() => {
    const expectedScopeKey = scopeKey
    const reviewsRequestVersion = ++reviewsRequestVersionRef.current
    const ratingRequestVersion = ++ratingRequestVersionRef.current

    const loadReviews = async () => {
      setReviews([])
      setOwnReviewForForm(null)
      setRatingSummary(null)
      setTotalReviewCount(0)
      setNextReviewOffset(0)
      setReviewsError(null)
      setReviewFeedback(null)
      setComentarioTexto({})
      setVisibleCommentsByReviewId({})
      setCommentTotalsByReviewId({})
      setNextCommentOffsetByReviewId({})
      setLoadingMoreReviews(false)
      setLoadingCommentsByReviewId({})
      setSubmittingComentario({})
      setPendingReviewReactionIds([])
      setPendingCommentReactionIds([])
      setDeletingReviewIds([])
      setReportModalTarget(null)
      setReportModalFeedback(null)
      setSubmitting(false)
      setSubmittingReport(false)
      setRemovingReport(false)
      loadingMoreReviewsRef.current = null
      loadingCommentIdsRef.current.clear()
      resolvedAnchorKeyRef.current = ''
      anchorRequestKeyRef.current = ''
      paginationRequestVersionRef.current += 1
      anchorRequestVersionRef.current += 1

      if (!gameId) {
        setReviewsLoading(false)
        return
      }

      setReviewsLoading(true)

      const [reviewsResult, ratingResult, ownReviewResult] = await Promise.all([
        getGameReviewsPage(gameId, {
          currentUserId,
          limit: INITIAL_VISIBLE_REVIEW_COUNT,
          offset: 0,
          initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
        }),
        getGameRatingSummaries([gameId]),
        currentUserId
          ? getReviewByGameAndUserId(gameId, currentUserId)
          : Promise.resolve({ data: null, error: null }),
      ])

      if (
        !isScopeActive(expectedScopeKey) ||
        reviewsRequestVersion !== reviewsRequestVersionRef.current ||
        ratingRequestVersion !== ratingRequestVersionRef.current
      ) {
        return
      }

      setReviews(reviewsResult.data)
      setOwnReviewForForm(
        reviewsResult.data.find(review => review.usuario_id === currentUserId) ||
        ownReviewResult.data
      )
      setTotalReviewCount(reviewsResult.totalCount ?? reviewsResult.data.length)
      setNextReviewOffset(reviewsResult.nextOffset ?? reviewsResult.data.length)
      setCommentTotalsByReviewId(reviewsResult.commentTotals || {})
      setVisibleCommentsByReviewId(Object.fromEntries(
        reviewsResult.data.map(review => [review.id, review.comentarios.length])
      ))
      setNextCommentOffsetByReviewId(Object.fromEntries(
        reviewsResult.data.map(review => [review.id, review.comentarios.length])
      ))
      setReviewsError(
        reviewsResult.error && reviewsResult.data.length === 0
          ? getReviewErrorMessage(t, reviewsResult.error, 'load')
          : null
      )

      if (ratingResult.error) {
        console.error(t('game.details.reviewFeedback.ratingSummaryLoadLog'), ratingResult.error)
        setRatingSummary(null)
      } else {
        setRatingSummary(
          ratingResult.data.find(summary => summary.gameId === gameId) ||
            getEmptyRatingSummary(gameId)
        )
      }

      setReviewsLoading(false)
    }

    void loadReviews()
  }, [currentUserId, gameId, isScopeActive, scopeKey, t])

  const visibleReviews = reviews
  const hiddenReviewsCount = Math.max(totalReviewCount - reviews.length, 0)

  const currentUserReview = useMemo(() => {
    if (!currentUserId) return null
    return reviews.find(review => review.usuario_id === currentUserId) || ownReviewForForm
  }, [currentUserId, ownReviewForForm, reviews])

  const activeReportTarget = useMemo(() => {
    if (!reportModalTarget) return null

    if (reportModalTarget.targetType === 'review') {
      const review = reviews.find(item => item.id === reportModalTarget.targetId)
      if (!review) return null

      return {
        targetType: 'review' as const,
        targetId: review.id,
        reviewId: review.id,
        authorId: review.usuario_id,
        authorName: review.usuario?.username?.trim() || t('common.username'),
        currentReport: review.currentUserReport,
      }
    }

    const parentReview = reviews.find(item => item.id === reportModalTarget.reviewId)
    const comment = parentReview?.comentarios.find(item => item.id === reportModalTarget.targetId)
    if (!parentReview || !comment) return null

    return {
      targetType: 'comment' as const,
      targetId: comment.id,
      reviewId: parentReview.id,
      authorId: comment.usuario_id,
      authorName: comment.usuario?.username?.trim() || t('common.username'),
      currentReport: comment.currentUserReport,
    }
  }, [reportModalTarget, reviews, t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReviewFeedback(null)

      if (!currentUserId || !gameId) {
        setNota(5)
        setTextoReview('')
        return
      }

      if (currentUserReview) {
        setNota(currentUserReview.nota)
        setTextoReview(currentUserReview.texto_review || '')
        return
      }

      setNota(5)
      setTextoReview('')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [currentUserId, currentUserReview, gameId])

  useEffect(() => {
    const targetId = getTargetId(locationHash)
    if (!targetId || !gameId || reviewsLoading) return

    const targetReviewId = targetId.startsWith('review-')
      ? targetId.replace('review-', '')
      : null
    const targetCommentId = targetId.startsWith('comment-')
      ? targetId.replace('comment-', '')
      : null
    if (!targetReviewId && !targetCommentId) return

    const anchorKey = `${scopeKey}:${targetId}`
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      resolvedAnchorKeyRef.current = anchorKey
      const frameId = window.requestAnimationFrame(() => {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return () => window.cancelAnimationFrame(frameId)
    }

    if (
      resolvedAnchorKeyRef.current === anchorKey ||
      anchorRequestKeyRef.current === anchorKey
    ) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++anchorRequestVersionRef.current
    anchorRequestKeyRef.current = anchorKey

    const loadAnchor = async () => {
      try {
        const anchorResult = await resolveGameReviewAnchor(gameId, {
          reviewId: targetReviewId,
          commentId: targetCommentId,
        })
        if (
          !isScopeActive(expectedScopeKey) ||
          requestVersion !== anchorRequestVersionRef.current ||
          !anchorResult.data
        ) return

        const anchor = anchorResult.data
        let anchorReview = reviews.find(review => review.id === anchor.reviewId) || null

        if (!anchorReview) {
          const reviewPage = await getGameReviewsPage(gameId, {
            currentUserId,
            limit: 1,
            offset: anchor.reviewOffset,
            initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
          })
          if (
            !isScopeActive(expectedScopeKey) ||
            requestVersion !== anchorRequestVersionRef.current
          ) return

          anchorReview = reviewPage.data.find(review => review.id === anchor.reviewId) || null
          if (anchorReview) {
            setReviews(current => mergeReviewPagePreservingClientState(current, [anchorReview!]))
            setTotalReviewCount(current => reviewPage.totalCount ?? current)
            setCommentTotalsByReviewId(current => ({
              ...current,
              ...(reviewPage.commentTotals || {}),
            }))
            setVisibleCommentsByReviewId(current => ({
              ...current,
              [anchorReview!.id]: Math.max(
                current[anchorReview!.id] ?? 0,
                anchorReview!.comentarios.length
              ),
            }))
            setNextCommentOffsetByReviewId(current => ({
              ...current,
              [anchorReview!.id]: Math.max(
                current[anchorReview!.id] ?? 0,
                anchorReview!.comentarios.length
              ),
            }))
          }
        }

        if (!anchorReview) return

        if (
          targetCommentId &&
          anchorReview &&
          !anchorReview.comentarios.some(comment => comment.id === targetCommentId) &&
          anchor.commentOffset !== null
        ) {
          const commentPage = await getReviewCommentsPage(anchor.reviewId, {
            currentUserId,
            limit: 1,
            offset: anchor.commentOffset,
          })
          if (
            !isScopeActive(expectedScopeKey) ||
            requestVersion !== anchorRequestVersionRef.current
          ) return

          if (!commentPage.data.some(comment => comment.id === targetCommentId)) return

          setReviews(current => current.map(review => (
            review.id === anchor.reviewId
              ? {
                  ...review,
                  comentarios: mergeCommentPagePreservingClientState(
                    review.comentarios,
                    commentPage.data
                  ),
                }
              : review
          )))
          setCommentTotalsByReviewId(current => ({
            ...current,
            [anchor.reviewId]: commentPage.totalCount ?? current[anchor.reviewId] ?? 0,
          }))
          setVisibleCommentsByReviewId(current => ({
            ...current,
            [anchor.reviewId]: Math.max(
              current[anchor.reviewId] ?? 0,
              (anchorReview?.comentarios.length || 0) + commentPage.data.length
            ),
          }))
        }

        resolvedAnchorKeyRef.current = anchorKey
        window.setTimeout(() => {
          window.requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          })
        }, 0)
      } finally {
        if (anchorRequestKeyRef.current === anchorKey) {
          anchorRequestKeyRef.current = ''
        }
      }
    }

    void loadAnchor()
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    locationHash,
    reviews,
    reviewsLoading,
    scopeKey,
  ])

  const handleSubmitAvaliacao = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentUserId || !gameId) return

    const expectedScopeKey = scopeKey
    setSubmitting(true)
    setReviewFeedback(null)

    const saveResult = await saveReview({
      userId: currentUserId,
      gameId,
      nota,
      textoReview,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (saveResult.error) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, saveResult.error, 'save'),
      })
      setSubmitting(false)
      return
    }

    const [refreshResult] = await Promise.all([
      refreshReviews(gameId),
      refreshRatingSummary(gameId),
    ])

    if (!isScopeActive(expectedScopeKey)) return

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: t('game.details.reviewFeedback.saveRefreshFailed'),
      })
    } else {
      setReviewFeedback({
        tone: 'success',
        message:
          saveResult.status === 'updated'
            ? t('game.details.reviewFeedback.updated')
            : t('game.details.reviewFeedback.created'),
      })
    }

    setSubmitting(false)
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    nota,
    refreshRatingSummary,
    refreshReviews,
    scopeKey,
    t,
    textoReview,
  ])

  const handleSubmitComentario = useCallback(async (
    reviewId: string,
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    if (!currentUserId || !gameId) return

    const texto = comentarioTexto[reviewId]?.trim()
    if (!texto) return

    const expectedScopeKey = scopeKey
    setSubmittingComentario(current => ({ ...current, [reviewId]: true }))
    setReviewFeedback(null)

    const commentResult = await createReviewComment({
      userId: currentUserId,
      reviewId,
      texto,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (commentResult.error) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, commentResult.error, 'comment'),
      })
      setSubmittingComentario(current => ({ ...current, [reviewId]: false }))
      return
    }

    setComentarioTexto(current => ({ ...current, [reviewId]: '' }))
    const loadedCommentCount = reviews.find(review => review.id === reviewId)?.comentarios.length || 0
    const refreshResult = await getReviewCommentsPage(reviewId, {
      currentUserId,
      limit: Math.min(Math.max(loadedCommentCount + 1, INITIAL_VISIBLE_COMMENT_COUNT), 20),
      offset: 0,
    })

    if (!isScopeActive(expectedScopeKey)) return

    setReviews(current => current.map(review => (
      review.id === reviewId
        ? {
            ...review,
            comentarios: mergeCommentPagePreservingClientState(
              review.comentarios,
              refreshResult.data
            ),
          }
        : review
    )))
    setCommentTotalsByReviewId(current => ({
      ...current,
      [reviewId]: refreshResult.totalCount ?? current[reviewId] ?? loadedCommentCount + 1,
    }))
    setNextCommentOffsetByReviewId(current => ({
      ...current,
      [reviewId]: refreshResult.nextOffset ?? refreshResult.data.length,
    }))
    setVisibleCommentsByReviewId(current => ({
      ...current,
      [reviewId]: Math.max(current[reviewId] ?? 0, refreshResult.data.length),
    }))

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: t('game.details.reviewFeedback.commentRefreshFailed'),
      })
    }

    setSubmittingComentario(current => ({ ...current, [reviewId]: false }))
  }, [comentarioTexto, currentUserId, gameId, isScopeActive, reviews, scopeKey, t])

  const handleToggleReviewReaction = useCallback(async (
    review: ReviewItem,
    reactionType: 'like' | 'dislike'
  ) => {
    const isLike = reactionType === 'like'
    const canReact = isLike ? review.canLike : review.canDislike

    if (
      !currentUserId ||
      !gameId ||
      !canReact ||
      pendingReviewReactionIds.includes(review.id)
    ) return

    const expectedScopeKey = scopeKey
    const transition = isLike
      ? createOptimisticLikeTransition(review)
      : createOptimisticDislikeTransition(review)

    setPendingReviewReactionIds(current => (
      current.includes(review.id) ? current : [...current, review.id]
    ))
    setReviewFeedback(null)
    setReviews(current => applyReviewReactionState(current, review.id, transition.next))

    const toggleParams = {
      reviewId: review.id,
      userId: currentUserId,
      reviewAuthorId: review.usuario_id,
      likedByCurrentUser: review.likedByCurrentUser,
      dislikedByCurrentUser: review.dislikedByCurrentUser,
      currentLikeCount: review.curtidas,
      currentDislikeCount: review.dislikes,
    }
    const toggleResult = isLike
      ? await toggleReviewLike(toggleParams)
      : await toggleReviewDislike(toggleParams)

    if (!isScopeActive(expectedScopeKey)) return

    if (toggleResult.error) {
      setReviews(current => applyReviewReactionState(current, review.id, transition.previous))
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(
          t,
          toggleResult.error,
          isLike ? 'review_like' : 'review_dislike'
        ),
      })
      setPendingReviewReactionIds(current => current.filter(id => id !== review.id))
      return
    }

    if (toggleResult.data) {
      const nextReactionState = toggleResult.data
      setReviews(current => applyReviewReactionState(current, review.id, nextReactionState))
    }

    const refreshResult = await refreshReviews(gameId)
    if (!isScopeActive(expectedScopeKey)) return

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: t(`game.details.reviewFeedback.${reactionType}RefreshFailed`),
      })
    }

    setPendingReviewReactionIds(current => current.filter(id => id !== review.id))
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    pendingReviewReactionIds,
    refreshReviews,
    scopeKey,
    t,
  ])

  const handleToggleReviewLike = useCallback(
    (review: ReviewItem) => handleToggleReviewReaction(review, 'like'),
    [handleToggleReviewReaction]
  )
  const handleToggleReviewDislike = useCallback(
    (review: ReviewItem) => handleToggleReviewReaction(review, 'dislike'),
    [handleToggleReviewReaction]
  )

  const handleToggleCommentReaction = useCallback(async (
    reviewId: string,
    comment: ReviewComment,
    reactionType: 'like' | 'dislike'
  ) => {
    const isLike = reactionType === 'like'
    const canReact = isLike ? comment.canLike : comment.canDislike

    if (
      !currentUserId ||
      pendingCommentReactionIds.includes(comment.id) ||
      !canReact
    ) return

    const expectedScopeKey = scopeKey
    const transition = isLike
      ? createOptimisticLikeTransition(comment)
      : createOptimisticDislikeTransition(comment)

    setPendingCommentReactionIds(current => (
      current.includes(comment.id) ? current : [...current, comment.id]
    ))
    setReviewFeedback(null)
    setReviews(current => (
      applyCommentReactionState(current, reviewId, comment.id, transition.next)
    ))

    const toggleParams = {
      commentId: comment.id,
      userId: currentUserId,
      commentAuthorId: comment.usuario_id,
      likedByCurrentUser: comment.likedByCurrentUser,
      dislikedByCurrentUser: comment.dislikedByCurrentUser,
      currentLikeCount: comment.curtidas,
      currentDislikeCount: comment.dislikes,
    }
    const toggleResult = isLike
      ? await toggleCommentLike(toggleParams)
      : await toggleCommentDislike(toggleParams)

    if (!isScopeActive(expectedScopeKey)) return

    if (toggleResult.error) {
      setReviews(current => (
        applyCommentReactionState(current, reviewId, comment.id, transition.previous)
      ))
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(
          t,
          toggleResult.error,
          isLike ? 'comment_like' : 'comment_dislike'
        ),
      })
      setPendingCommentReactionIds(current => current.filter(id => id !== comment.id))
      return
    }

    if (toggleResult.data) {
      const nextReactionState = toggleResult.data
      setReviews(current => (
        applyCommentReactionState(current, reviewId, comment.id, nextReactionState)
      ))
    }

    setPendingCommentReactionIds(current => current.filter(id => id !== comment.id))
  }, [currentUserId, isScopeActive, pendingCommentReactionIds, scopeKey, t])

  const handleToggleCommentLike = useCallback(
    (reviewId: string, comment: ReviewComment) => (
      handleToggleCommentReaction(reviewId, comment, 'like')
    ),
    [handleToggleCommentReaction]
  )
  const handleToggleCommentDislike = useCallback(
    (reviewId: string, comment: ReviewComment) => (
      handleToggleCommentReaction(reviewId, comment, 'dislike')
    ),
    [handleToggleCommentReaction]
  )

  const handleOpenReportModal = useCallback((
    targetType: ReportTargetType,
    targetId: string,
    reviewId: string
  ) => {
    setReportModalTarget({ targetType, targetId, reviewId })
    setReportModalFeedback(null)
  }, [])

  const handleCloseReportModal = useCallback(() => {
    if (submittingReport || removingReport) return
    setReportModalTarget(null)
    setReportModalFeedback(null)
  }, [removingReport, submittingReport])

  const handleSubmitReport = useCallback(async ({
    reason,
    description,
  }: {
    reason: ReportReason
    description: string
  }) => {
    if (!currentUserId || !activeReportTarget) return

    const expectedScopeKey = scopeKey
    const submittedTarget = activeReportTarget
    setSubmittingReport(true)
    setReportModalFeedback(null)

    const reportResult = await submitContentReport({
      userId: currentUserId,
      targetType: submittedTarget.targetType,
      targetId: submittedTarget.targetId,
      targetAuthorId: submittedTarget.authorId,
      reason,
      description,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (reportResult.error) {
      setReportModalFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, reportResult.error, 'report'),
      })
      setSubmittingReport(false)
      return
    }

    if (reportResult.data) {
      setReviews(current => applyContentReportState(
        current,
        submittedTarget.reviewId,
        submittedTarget.targetType,
        submittedTarget.targetId,
        reportResult.data
      ))
    }

    setReportModalFeedback({
      tone: reportResult.status === 'already_exists' ? 'info' : 'success',
      message:
        reportResult.status === 'already_exists'
          ? t('game.details.reportAlreadyExists')
          : t('game.details.reportCreated'),
    })
    setSubmittingReport(false)
  }, [activeReportTarget, currentUserId, isScopeActive, scopeKey, t])

  const handleRemoveReport = useCallback(async () => {
    if (!currentUserId || !activeReportTarget?.currentReport) return

    const expectedScopeKey = scopeKey
    const removedTarget = activeReportTarget
    const reportId = activeReportTarget.currentReport.id
    setRemovingReport(true)
    setReportModalFeedback(null)

    const reportResult = await deleteContentReport({
      userId: currentUserId,
      reportId,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (reportResult.error) {
      setReportModalFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, reportResult.error, 'report_delete'),
      })
      setRemovingReport(false)
      return
    }

    setReviews(current => applyContentReportState(
      current,
      removedTarget.reviewId,
      removedTarget.targetType,
      removedTarget.targetId,
      null
    ))
    setReportModalFeedback({
      tone: 'success',
      message: t('game.details.reportRemoved'),
    })
    setRemovingReport(false)
  }, [activeReportTarget, currentUserId, isScopeActive, scopeKey, t])

  const handleExpandComments = useCallback(async (
    reviewId: string,
    totalComments: number
  ) => {
    const requestKey = `${scopeKey}:${reviewId}`
    if (loadingCommentIdsRef.current.has(requestKey)) return

    const review = reviews.find(item => item.id === reviewId)
    if (!review) return

    const expectedScopeKey = scopeKey
    const requestVersion = paginationRequestVersionRef.current
    const offset = nextCommentOffsetByReviewId[reviewId] ?? review.comentarios.length
    const knownTotal = commentTotalsByReviewId[reviewId] ?? totalComments
    if (offset >= knownTotal) return

    loadingCommentIdsRef.current.add(requestKey)
    setLoadingCommentsByReviewId(current => ({ ...current, [reviewId]: true }))

    try {
      const result = await getReviewCommentsPage(reviewId, {
        currentUserId,
        limit: VISIBLE_COMMENT_BATCH_SIZE,
        offset,
      })
      if (
        !isScopeActive(expectedScopeKey) ||
        requestVersion !== paginationRequestVersionRef.current
      ) return

      if (result.error && result.data.length === 0) {
        setReviewFeedback({
          tone: 'error',
          message: getReviewErrorMessage(t, result.error, 'load'),
        })
        return
      }

      setReviews(current => current.map(currentReview => (
        currentReview.id === reviewId
          ? {
              ...currentReview,
              comentarios: mergeCommentPagePreservingClientState(
                currentReview.comentarios,
                result.data
              ),
            }
          : currentReview
      )))
      setCommentTotalsByReviewId(current => ({
        ...current,
        [reviewId]: result.totalCount ?? current[reviewId] ?? knownTotal,
      }))
      const loadedThroughOffset = offset + result.data.length
      setNextCommentOffsetByReviewId(current => ({
        ...current,
        [reviewId]: result.nextOffset ?? loadedThroughOffset,
      }))
      setVisibleCommentsByReviewId(current => ({
        ...current,
        [reviewId]: Math.max(current[reviewId] ?? 0, loadedThroughOffset),
      }))
    } finally {
      loadingCommentIdsRef.current.delete(requestKey)
      if (isScopeActive(expectedScopeKey)) {
        setLoadingCommentsByReviewId(current => ({ ...current, [reviewId]: false }))
      }
    }
  }, [
    commentTotalsByReviewId,
    currentUserId,
    isScopeActive,
    nextCommentOffsetByReviewId,
    reviews,
    scopeKey,
    t,
  ])

  const handleExpandReviews = useCallback(async () => {
    if (
      !gameId ||
      loadingMoreReviewsRef.current !== null ||
      nextReviewOffset >= totalReviewCount
    ) return

    const expectedScopeKey = scopeKey
    const requestVersion = paginationRequestVersionRef.current
    const offset = nextReviewOffset
    const requestKey = `${scopeKey}:${offset}`
    loadingMoreReviewsRef.current = requestKey
    setLoadingMoreReviews(true)

    try {
      const result = await getGameReviewsPage(gameId, {
        currentUserId,
        limit: VISIBLE_REVIEW_BATCH_SIZE,
        offset,
        initialCommentsLimit: INITIAL_VISIBLE_COMMENT_COUNT,
      })
      if (
        !isScopeActive(expectedScopeKey) ||
        requestVersion !== paginationRequestVersionRef.current
      ) return

      if (result.error && result.data.length === 0) {
        setReviewFeedback({
          tone: 'error',
          message: getReviewErrorMessage(t, result.error, 'load'),
        })
        return
      }

      setReviews(current => mergeReviewPagePreservingClientState(current, result.data))
      setTotalReviewCount(current => result.totalCount ?? current)
      setNextReviewOffset(result.nextOffset ?? offset + result.data.length)
      setCommentTotalsByReviewId(current => ({ ...current, ...(result.commentTotals || {}) }))
      setVisibleCommentsByReviewId(current => {
        const next = { ...current }
        result.data.forEach(review => {
          next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
        })
        return next
      })
      setNextCommentOffsetByReviewId(current => {
        const next = { ...current }
        result.data.forEach(review => {
          next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
        })
        return next
      })
    } finally {
      if (loadingMoreReviewsRef.current === requestKey) {
        loadingMoreReviewsRef.current = null
        if (isScopeActive(expectedScopeKey)) setLoadingMoreReviews(false)
      }
    }
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    nextReviewOffset,
    scopeKey,
    t,
    totalReviewCount,
  ])

  const handleDeleteComment = useCallback(async (
    reviewId: string,
    comment: ReviewComment
  ) => {
    if (!currentUserId || comment.usuario_id !== currentUserId) return

    const removal = removeCommentForRollback(reviews, reviewId, comment.id)
    if (!removal.snapshot) return

    const expectedScopeKey = scopeKey
    const loadedCommentCount = reviews.find(review => review.id === reviewId)?.comentarios.length || 0
    const previousCommentTotal = commentTotalsByReviewId[reviewId] ?? loadedCommentCount
    const previousCommentOffset = nextCommentOffsetByReviewId[reviewId] ?? loadedCommentCount
    setReviewFeedback(null)
    setReviews(removal.reviews)
    setCommentTotalsByReviewId(current => ({
      ...current,
      [reviewId]: Math.max((current[reviewId] ?? previousCommentTotal) - 1, 0),
    }))
    setNextCommentOffsetByReviewId(current => ({
      ...current,
      [reviewId]: Math.max((current[reviewId] ?? previousCommentOffset) - 1, 0),
    }))
    setPendingCommentReactionIds(current => current.filter(id => id !== comment.id))
    setReportModalTarget(current => (
      current?.targetType === 'comment' && current.targetId === comment.id ? null : current
    ))
    setReportModalFeedback(null)

    const deleteResult = await deleteReviewComment({
      userId: currentUserId,
      commentId: comment.id,
    })

    if (!isScopeActive(expectedScopeKey) || deleteResult.ok) return

    setReviews(current => restoreCommentFromRollback(current, removal.snapshot!))
    setCommentTotalsByReviewId(current => ({
      ...current,
      [reviewId]: previousCommentTotal,
    }))
    setNextCommentOffsetByReviewId(current => ({
      ...current,
      [reviewId]: previousCommentOffset,
    }))
    setReviewFeedback({
      tone: 'error',
      message: getReviewErrorMessage(t, deleteResult.error, 'comment_delete'),
    })
  }, [
    commentTotalsByReviewId,
    currentUserId,
    isScopeActive,
    nextCommentOffsetByReviewId,
    reviews,
    scopeKey,
    t,
  ])

  const handleDeleteReview = useCallback(async (review: ReviewItem) => {
    if (
      !currentUserId ||
      !gameId ||
      review.usuario_id !== currentUserId ||
      deletingReviewIds.includes(review.id)
    ) return

    const expectedScopeKey = scopeKey
    setDeletingReviewIds(current => (
      current.includes(review.id) ? current : [...current, review.id]
    ))
    setReviewFeedback(null)

    const deleteResult = await deleteReview({
      userId: currentUserId,
      reviewId: review.id,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (!deleteResult.ok) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, deleteResult.error, 'delete'),
      })
      setDeletingReviewIds(current => current.filter(id => id !== review.id))
      return
    }

    setReviews(current => current.filter(item => item.id !== review.id))
    setOwnReviewForForm(current => current?.id === review.id ? null : current)
    setTotalReviewCount(current => Math.max(current - 1, 0))
    setNextReviewOffset(current => Math.max(current - 1, 0))
    setComentarioTexto(current => removeMapKey(current, review.id))
    setSubmittingComentario(current => removeMapKey(current, review.id))
    setVisibleCommentsByReviewId(current => removeMapKey(current, review.id))
    setCommentTotalsByReviewId(current => removeMapKey(current, review.id))
    setNextCommentOffsetByReviewId(current => removeMapKey(current, review.id))
    setLoadingCommentsByReviewId(current => removeMapKey(current, review.id))
    setPendingReviewReactionIds(current => current.filter(id => id !== review.id))
    setPendingCommentReactionIds(current => current.filter(id => (
      !review.comentarios.some(comment => comment.id === id)
    )))
    setReportModalTarget(current => current?.reviewId === review.id ? null : current)
    setReportModalFeedback(null)

    const [refreshResult] = await Promise.all([
      refreshReviews(gameId),
      refreshRatingSummary(gameId),
    ])

    if (!isScopeActive(expectedScopeKey)) return

    setReviewFeedback(
      refreshResult.error && refreshResult.data.length === 0
        ? {
            tone: 'info',
            message: t('game.details.reviewFeedback.deleteRefreshFailed'),
          }
        : {
            tone: 'success',
            message: t('game.details.reviewFeedback.deleteSuccess'),
          }
    )
    setDeletingReviewIds(current => current.filter(id => id !== review.id))
  }, [
    currentUserId,
    deletingReviewIds,
    gameId,
    isScopeActive,
    refreshRatingSummary,
    refreshReviews,
    scopeKey,
    t,
  ])

  return {
    overview: {
      reviews,
      ratingSummary,
      totalComments: reviews.reduce(
        (total, review) => total + (
          commentTotalsByReviewId[review.id] ?? review.comentarios.length
        ),
        0
      ),
      loading: reviewsLoading,
    },
    section: {
      form: {
        authenticated: Boolean(currentUserId),
        score: nota,
        setScore: setNota,
        text: textoReview,
        setText: setTextoReview,
        submitting,
        feedback: reviewFeedback,
        editing: Boolean(currentUserReview),
        submit: handleSubmitAvaliacao,
      },
      list: {
        userId: currentUserId,
        total: totalReviewCount,
        visible: visibleReviews,
        error: reviewsError,
        commentCounts: visibleCommentsByReviewId,
        commentTotals: commentTotalsByReviewId,
        commentText: comentarioTexto,
        submittingComments: submittingComentario,
        pendingReviews: pendingReviewReactionIds,
        pendingComments: pendingCommentReactionIds,
        deletingReviews: deletingReviewIds,
        loadingMoreReviews,
        loadingComments: loadingCommentsByReviewId,
        hidden: hiddenReviewsCount,
      },
      report: {
        target: activeReportTarget,
        feedback: reportModalFeedback,
        submitting: submittingReport,
        removing: removingReport,
      },
      actions: {
        refreshReviews,
        reviewLike: handleToggleReviewLike,
        reviewDislike: handleToggleReviewDislike,
        reviewDelete: handleDeleteReview,
        commentLike: handleToggleCommentLike,
        commentDislike: handleToggleCommentDislike,
        commentDelete: handleDeleteComment,
        openReport: handleOpenReportModal,
        expandComments: handleExpandComments,
        submitComment: handleSubmitComentario,
        setCommentText: setComentarioTexto,
        expandReviews: handleExpandReviews,
        closeReport: handleCloseReportModal,
        submitReport: handleSubmitReport,
        removeReport: handleRemoveReport,
      },
    },
  }
}
