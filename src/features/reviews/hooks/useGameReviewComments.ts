import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import {
  createReviewComment,
  deleteReviewComment,
  getReviewCommentsPage,
} from '../../../services/reviewService'
import {
  mergeCommentPagePreservingClientState,
  removeCommentForRollback,
  restoreCommentFromRollback,
} from '../domain/gameReviewState'
import type {
  GameReviewOverview,
  ReviewComment,
  ReviewItem,
} from '../domain/reviewModels'
import {
  INITIAL_VISIBLE_COMMENT_COUNT,
  VISIBLE_COMMENT_BATCH_SIZE,
  type ReportModalTargetState,
  type ReviewFeedbackState,
  type UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import { getReviewErrorMessage } from './reviewControllerHelpers'

type NumberMap = Record<string, number>
type BooleanMap = Record<string, boolean>

interface UseGameReviewCommentsOptions {
  currentUserId: string | null
  gameId: number | null
  scopeKey: string
  isScopeActive: (expectedScopeKey: string) => boolean
  reviews: ReviewItem[]
  setReviews: Dispatch<SetStateAction<ReviewItem[]>>
  commentText: Record<string, string>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  commentTotals: NumberMap
  setCommentTotals: Dispatch<SetStateAction<NumberMap>>
  nextCommentOffsets: NumberMap
  setNextCommentOffsets: Dispatch<SetStateAction<NumberMap>>
  setVisibleCommentCounts: Dispatch<SetStateAction<NumberMap>>
  setLoadingComments: Dispatch<SetStateAction<BooleanMap>>
  setSubmittingComments: Dispatch<SetStateAction<BooleanMap>>
  setPendingCommentIds: Dispatch<SetStateAction<string[]>>
  setReportTarget: Dispatch<SetStateAction<ReportModalTargetState | null>>
  setReportFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  setReviewFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  setOverview: Dispatch<SetStateAction<GameReviewOverview | null>>
  loadingCommentIdsRef: { current: Set<string> }
  paginationRequestVersionRef: { current: number }
  t: UseGameReviewsControllerOptions['t']
}

export function useGameReviewComments({
  currentUserId,
  gameId,
  scopeKey,
  isScopeActive,
  reviews,
  setReviews,
  commentText,
  setCommentText,
  commentTotals,
  setCommentTotals,
  nextCommentOffsets,
  setNextCommentOffsets,
  setVisibleCommentCounts,
  setLoadingComments,
  setSubmittingComments,
  setPendingCommentIds,
  setReportTarget,
  setReportFeedback,
  setReviewFeedback,
  setOverview,
  loadingCommentIdsRef,
  paginationRequestVersionRef,
  t,
}: UseGameReviewCommentsOptions) {
  const submit = useCallback(async (
    reviewId: string,
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    if (!currentUserId || !gameId) return

    const text = commentText[reviewId]?.trim()
    if (!text) return

    const expectedScopeKey = scopeKey
    setSubmittingComments(current => ({ ...current, [reviewId]: true }))
    setReviewFeedback(null)

    const commentResult = await createReviewComment({
      userId: currentUserId,
      reviewId,
      texto: text,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (commentResult.error) {
      setReviewFeedback({
        tone: 'error',
        message: getReviewErrorMessage(t, commentResult.error, 'comment'),
      })
      setSubmittingComments(current => ({ ...current, [reviewId]: false }))
      return
    }

    setCommentText(current => ({ ...current, [reviewId]: '' }))
    setOverview(current => current
      ? { ...current, commentCount: current.commentCount + 1 }
      : current
    )
    const loadedCommentCount =
      reviews.find(review => review.id === reviewId)?.comentarios.length || 0
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
    setCommentTotals(current => ({
      ...current,
      [reviewId]: refreshResult.totalCount ?? current[reviewId] ?? loadedCommentCount + 1,
    }))
    setNextCommentOffsets(current => ({
      ...current,
      [reviewId]: refreshResult.nextOffset ?? refreshResult.data.length,
    }))
    setVisibleCommentCounts(current => ({
      ...current,
      [reviewId]: Math.max(current[reviewId] ?? 0, refreshResult.data.length),
    }))

    if (refreshResult.error && refreshResult.data.length === 0) {
      setReviewFeedback({
        tone: 'info',
        message: t('game.details.reviewFeedback.commentRefreshFailed'),
      })
    }

    setSubmittingComments(current => ({ ...current, [reviewId]: false }))
  }, [
    commentText,
    currentUserId,
    gameId,
    isScopeActive,
    reviews,
    scopeKey,
    setCommentText,
    setCommentTotals,
    setNextCommentOffsets,
    setOverview,
    setReviewFeedback,
    setReviews,
    setSubmittingComments,
    setVisibleCommentCounts,
    t,
  ])

  const expand = useCallback(async (
    reviewId: string,
    totalComments: number
  ) => {
    const requestKey = `${scopeKey}:${reviewId}`
    if (loadingCommentIdsRef.current.has(requestKey)) return

    const review = reviews.find(item => item.id === reviewId)
    if (!review) return

    const expectedScopeKey = scopeKey
    const requestVersion = paginationRequestVersionRef.current
    const offset = nextCommentOffsets[reviewId] ?? review.comentarios.length
    const knownTotal = commentTotals[reviewId] ?? totalComments
    if (offset >= knownTotal) return

    loadingCommentIdsRef.current.add(requestKey)
    setLoadingComments(current => ({ ...current, [reviewId]: true }))

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
      setCommentTotals(current => ({
        ...current,
        [reviewId]: result.totalCount ?? current[reviewId] ?? knownTotal,
      }))
      const loadedThroughOffset = offset + result.data.length
      setNextCommentOffsets(current => ({
        ...current,
        [reviewId]: result.nextOffset ?? loadedThroughOffset,
      }))
      setVisibleCommentCounts(current => ({
        ...current,
        [reviewId]: Math.max(current[reviewId] ?? 0, loadedThroughOffset),
      }))
    } finally {
      loadingCommentIdsRef.current.delete(requestKey)
      if (isScopeActive(expectedScopeKey)) {
        setLoadingComments(current => ({ ...current, [reviewId]: false }))
      }
    }
  }, [
    commentTotals,
    currentUserId,
    isScopeActive,
    loadingCommentIdsRef,
    nextCommentOffsets,
    paginationRequestVersionRef,
    reviews,
    scopeKey,
    setCommentTotals,
    setLoadingComments,
    setNextCommentOffsets,
    setReviewFeedback,
    setReviews,
    setVisibleCommentCounts,
    t,
  ])

  const remove = useCallback(async (
    reviewId: string,
    comment: ReviewComment
  ) => {
    if (!currentUserId || comment.usuario_id !== currentUserId) return

    const removal = removeCommentForRollback(reviews, reviewId, comment.id)
    if (!removal.snapshot) return

    const expectedScopeKey = scopeKey
    const loadedCommentCount =
      reviews.find(review => review.id === reviewId)?.comentarios.length || 0
    const previousCommentTotal = commentTotals[reviewId] ?? loadedCommentCount
    const previousCommentOffset = nextCommentOffsets[reviewId] ?? loadedCommentCount
    setReviewFeedback(null)
    setReviews(removal.reviews)
    setCommentTotals(current => ({
      ...current,
      [reviewId]: Math.max((current[reviewId] ?? previousCommentTotal) - 1, 0),
    }))
    setNextCommentOffsets(current => ({
      ...current,
      [reviewId]: Math.max((current[reviewId] ?? previousCommentOffset) - 1, 0),
    }))
    setPendingCommentIds(current => current.filter(id => id !== comment.id))
    setReportTarget(current => (
      current?.targetType === 'comment' && current.targetId === comment.id ? null : current
    ))
    setReportFeedback(null)

    const deleteResult = await deleteReviewComment({
      userId: currentUserId,
      commentId: comment.id,
    })

    if (!isScopeActive(expectedScopeKey)) return

    if (deleteResult.ok) {
      setOverview(current => current
        ? { ...current, commentCount: Math.max(current.commentCount - 1, 0) }
        : current
      )
      return
    }

    setReviews(current => restoreCommentFromRollback(current, removal.snapshot!))
    setCommentTotals(current => ({
      ...current,
      [reviewId]: previousCommentTotal,
    }))
    setNextCommentOffsets(current => ({
      ...current,
      [reviewId]: previousCommentOffset,
    }))
    setReviewFeedback({
      tone: 'error',
      message: getReviewErrorMessage(t, deleteResult.error, 'comment_delete'),
    })
  }, [
    commentTotals,
    currentUserId,
    isScopeActive,
    nextCommentOffsets,
    reviews,
    scopeKey,
    setCommentTotals,
    setNextCommentOffsets,
    setOverview,
    setPendingCommentIds,
    setReportFeedback,
    setReportTarget,
    setReviewFeedback,
    setReviews,
    t,
  ])

  return {
    submit,
    expand,
    remove,
  }
}
