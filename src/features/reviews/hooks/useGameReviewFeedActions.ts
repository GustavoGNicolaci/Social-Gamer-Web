import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  deleteReview,
  getGameReviewsPage,
} from '../../../services/reviewService'
import { mergeReviewPagePreservingClientState } from '../domain/gameReviewState'
import type { ReviewError } from '../domain/reviewError'
import type { ReviewItem } from '../domain/reviewModels'
import {
  INITIAL_VISIBLE_COMMENT_COUNT,
  VISIBLE_REVIEW_BATCH_SIZE,
  type ReportModalTargetState,
  type ReviewFeedbackState,
  type UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import {
  getReviewErrorMessage,
  removeRecordKey,
} from './reviewControllerHelpers'

type NumberMap = Record<string, number>
type BooleanMap = Record<string, boolean>

interface UseGameReviewFeedActionsOptions {
  currentUserId: string | null
  gameId: number | null
  scopeKey: string
  isScopeActive: (expectedScopeKey: string) => boolean
  nextReviewOffset: number
  totalReviewCount: number
  deletingReviewIds: string[]
  setReviews: Dispatch<SetStateAction<ReviewItem[]>>
  setOwnReview: Dispatch<SetStateAction<ReviewItem | null>>
  setTotalReviewCount: Dispatch<SetStateAction<number>>
  setNextReviewOffset: Dispatch<SetStateAction<number>>
  setLoadingMoreReviews: Dispatch<SetStateAction<boolean>>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  setSubmittingComments: Dispatch<SetStateAction<BooleanMap>>
  setVisibleCommentCounts: Dispatch<SetStateAction<NumberMap>>
  setCommentTotals: Dispatch<SetStateAction<NumberMap>>
  setNextCommentOffsets: Dispatch<SetStateAction<NumberMap>>
  setLoadingComments: Dispatch<SetStateAction<BooleanMap>>
  setPendingReviewIds: Dispatch<SetStateAction<string[]>>
  setPendingCommentIds: Dispatch<SetStateAction<string[]>>
  setDeletingReviewIds: Dispatch<SetStateAction<string[]>>
  setReportTarget: Dispatch<SetStateAction<ReportModalTargetState | null>>
  setReportFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  setFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  loadingMoreReviewsRef: { current: string | null }
  paginationRequestVersionRef: { current: number }
  refreshReviews: (requestedGameId?: number | null) => Promise<{
    data: ReviewItem[]
    error: ReviewError | null
  }>
  refreshOverview: (requestedGameId?: number | null) => Promise<unknown>
  t: UseGameReviewsControllerOptions['t']
}

export function useGameReviewFeedActions({
  currentUserId,
  gameId,
  scopeKey,
  isScopeActive,
  nextReviewOffset,
  totalReviewCount,
  deletingReviewIds,
  setReviews,
  setOwnReview,
  setTotalReviewCount,
  setNextReviewOffset,
  setLoadingMoreReviews,
  setCommentText,
  setSubmittingComments,
  setVisibleCommentCounts,
  setCommentTotals,
  setNextCommentOffsets,
  setLoadingComments,
  setPendingReviewIds,
  setPendingCommentIds,
  setDeletingReviewIds,
  setReportTarget,
  setReportFeedback,
  setFeedback,
  loadingMoreReviewsRef,
  paginationRequestVersionRef,
  refreshReviews,
  refreshOverview,
  t,
}: UseGameReviewFeedActionsOptions) {
  const expand = useCallback(async () => {
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
        setFeedback({
          tone: 'error',
          message: getReviewErrorMessage(t, result.error, 'load'),
        })
        return
      }

      setReviews(current => mergeReviewPagePreservingClientState(current, result.data))
      setTotalReviewCount(current => result.totalCount ?? current)
      setNextReviewOffset(result.nextOffset ?? offset + result.data.length)
      setCommentTotals(current => ({ ...current, ...(result.commentTotals || {}) }))
      setVisibleCommentCounts(current => {
        const next = { ...current }
        result.data.forEach(review => {
          next[review.id] = Math.max(next[review.id] ?? 0, review.comentarios.length)
        })
        return next
      })
      setNextCommentOffsets(current => {
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
    loadingMoreReviewsRef,
    nextReviewOffset,
    paginationRequestVersionRef,
    scopeKey,
    setCommentTotals,
    setFeedback,
    setLoadingMoreReviews,
    setNextCommentOffsets,
    setNextReviewOffset,
    setReviews,
    setTotalReviewCount,
    setVisibleCommentCounts,
    t,
    totalReviewCount,
  ])

  const remove = useCallback(async (review: ReviewItem) => {
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
    setFeedback(null)

    const deleteResult = await deleteReview({
      userId: currentUserId,
      reviewId: review.id,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (!deleteResult.ok) {
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, deleteResult.error, 'delete'),
      })
      setDeletingReviewIds(current => current.filter(id => id !== review.id))
      return
    }

    setReviews(current => current.filter(item => item.id !== review.id))
    setOwnReview(current => current?.id === review.id ? null : current)
    setTotalReviewCount(current => Math.max(current - 1, 0))
    setNextReviewOffset(current => Math.max(current - 1, 0))
    setCommentText(current => removeRecordKey(current, review.id))
    setSubmittingComments(current => removeRecordKey(current, review.id))
    setVisibleCommentCounts(current => removeRecordKey(current, review.id))
    setCommentTotals(current => removeRecordKey(current, review.id))
    setNextCommentOffsets(current => removeRecordKey(current, review.id))
    setLoadingComments(current => removeRecordKey(current, review.id))
    setPendingReviewIds(current => current.filter(id => id !== review.id))
    setPendingCommentIds(current => current.filter(id => (
      !review.comentarios.some(comment => comment.id === id)
    )))
    setReportTarget(current => current?.reviewId === review.id ? null : current)
    setReportFeedback(null)

    const [refreshResult] = await Promise.all([
      refreshReviews(gameId),
      refreshOverview(gameId),
    ])

    if (!isScopeActive(expectedScopeKey)) return

    setFeedback(
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
    refreshOverview,
    refreshReviews,
    scopeKey,
    setCommentText,
    setCommentTotals,
    setDeletingReviewIds,
    setFeedback,
    setLoadingComments,
    setNextCommentOffsets,
    setNextReviewOffset,
    setOwnReview,
    setPendingCommentIds,
    setPendingReviewIds,
    setReportFeedback,
    setReportTarget,
    setReviews,
    setSubmittingComments,
    setTotalReviewCount,
    setVisibleCommentCounts,
    t,
  ])

  return {
    expand,
    remove,
  }
}
