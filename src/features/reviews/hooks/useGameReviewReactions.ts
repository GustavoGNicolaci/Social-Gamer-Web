import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  toggleCommentDislike,
  toggleCommentLike,
  toggleReviewDislike,
} from '../../../services/reviewInteractionsService'
import { toggleReviewLike } from '../../../services/reviewService'
import {
  applyCommentReactionState,
  applyReviewReactionState,
  createOptimisticDislikeTransition,
  createOptimisticLikeTransition,
} from '../domain/gameReviewState'
import type { ReviewError } from '../domain/reviewError'
import type { ReviewComment, ReviewItem } from '../domain/reviewModels'
import type {
  ReviewFeedbackState,
  UseGameReviewsControllerOptions,
} from './gameReviewControllerContracts'
import { getReviewErrorMessage } from './reviewControllerHelpers'

interface UseGameReviewReactionsOptions {
  currentUserId: string | null
  gameId: number | null
  scopeKey: string
  isScopeActive: (expectedScopeKey: string) => boolean
  pendingReviewIds: string[]
  setPendingReviewIds: Dispatch<SetStateAction<string[]>>
  pendingCommentIds: string[]
  setPendingCommentIds: Dispatch<SetStateAction<string[]>>
  setReviews: Dispatch<SetStateAction<ReviewItem[]>>
  setFeedback: Dispatch<SetStateAction<ReviewFeedbackState | null>>
  refreshReviews: (requestedGameId?: number | null) => Promise<{
    data: ReviewItem[]
    error: ReviewError | null
  }>
  t: UseGameReviewsControllerOptions['t']
}

export function useGameReviewReactions({
  currentUserId,
  gameId,
  scopeKey,
  isScopeActive,
  pendingReviewIds,
  setPendingReviewIds,
  pendingCommentIds,
  setPendingCommentIds,
  setReviews,
  setFeedback,
  refreshReviews,
  t,
}: UseGameReviewReactionsOptions) {
  const toggleReviewReaction = useCallback(async (
    review: ReviewItem,
    reactionType: 'like' | 'dislike'
  ) => {
    const isLike = reactionType === 'like'
    const canReact = isLike ? review.canLike : review.canDislike

    if (
      !currentUserId ||
      !gameId ||
      !canReact ||
      pendingReviewIds.includes(review.id)
    ) return

    const expectedScopeKey = scopeKey
    const transition = isLike
      ? createOptimisticLikeTransition(review)
      : createOptimisticDislikeTransition(review)

    setPendingReviewIds(current => (
      current.includes(review.id) ? current : [...current, review.id]
    ))
    setFeedback(null)
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
      setReviews(current => applyReviewReactionState(
        current,
        review.id,
        transition.previous
      ))
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(
          t,
          toggleResult.error,
          isLike ? 'review_like' : 'review_dislike'
        ),
      })
      setPendingReviewIds(current => current.filter(id => id !== review.id))
      return
    }

    if (toggleResult.data) {
      setReviews(current => applyReviewReactionState(
        current,
        review.id,
        toggleResult.data!
      ))
    }

    const refreshResult = await refreshReviews(gameId)
    if (!isScopeActive(expectedScopeKey)) return

    if (refreshResult.error && refreshResult.data.length === 0) {
      setFeedback({
        tone: 'info',
        message: t(`game.details.reviewFeedback.${reactionType}RefreshFailed`),
      })
    }

    setPendingReviewIds(current => current.filter(id => id !== review.id))
  }, [
    currentUserId,
    gameId,
    isScopeActive,
    pendingReviewIds,
    refreshReviews,
    scopeKey,
    setFeedback,
    setPendingReviewIds,
    setReviews,
    t,
  ])

  const reviewLike = useCallback(
    (review: ReviewItem) => toggleReviewReaction(review, 'like'),
    [toggleReviewReaction]
  )
  const reviewDislike = useCallback(
    (review: ReviewItem) => toggleReviewReaction(review, 'dislike'),
    [toggleReviewReaction]
  )

  const toggleCommentReaction = useCallback(async (
    reviewId: string,
    comment: ReviewComment,
    reactionType: 'like' | 'dislike'
  ) => {
    const isLike = reactionType === 'like'
    const canReact = isLike ? comment.canLike : comment.canDislike

    if (!currentUserId || pendingCommentIds.includes(comment.id) || !canReact) {
      return
    }

    const expectedScopeKey = scopeKey
    const transition = isLike
      ? createOptimisticLikeTransition(comment)
      : createOptimisticDislikeTransition(comment)

    setPendingCommentIds(current => (
      current.includes(comment.id) ? current : [...current, comment.id]
    ))
    setFeedback(null)
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
      setFeedback({
        tone: 'error',
        message: getReviewErrorMessage(
          t,
          toggleResult.error,
          isLike ? 'comment_like' : 'comment_dislike'
        ),
      })
      setPendingCommentIds(current => current.filter(id => id !== comment.id))
      return
    }

    if (toggleResult.data) {
      setReviews(current => applyCommentReactionState(
        current,
        reviewId,
        comment.id,
        toggleResult.data!
      ))
    }

    setPendingCommentIds(current => current.filter(id => id !== comment.id))
  }, [
    currentUserId,
    isScopeActive,
    pendingCommentIds,
    scopeKey,
    setFeedback,
    setPendingCommentIds,
    setReviews,
    t,
  ])

  const commentLike = useCallback(
    (reviewId: string, comment: ReviewComment) => (
      toggleCommentReaction(reviewId, comment, 'like')
    ),
    [toggleCommentReaction]
  )
  const commentDislike = useCallback(
    (reviewId: string, comment: ReviewComment) => (
      toggleCommentReaction(reviewId, comment, 'dislike')
    ),
    [toggleCommentReaction]
  )

  return {
    reviewLike,
    reviewDislike,
    commentLike,
    commentDislike,
  }
}
