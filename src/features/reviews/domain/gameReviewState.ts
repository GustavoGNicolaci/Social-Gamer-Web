import {
  sortCommentsByRelevance,
  sortReviewsByRelevance,
  type ReviewComment,
  type ReviewError,
  type ReviewItem,
} from '../../../services/reviewService'
import type {
  CommentReactionState,
  CurrentUserReportSummary,
  ReportTargetType,
  ReviewReactionState,
} from '../../../services/reviewInteractionsService'

type ReactionState = ReviewReactionState | CommentReactionState

export interface RefreshedReviewsResult {
  data: ReviewItem[]
  error: ReviewError | null
}

export interface OptimisticReactionTransition {
  previous: ReviewReactionState
  next: ReviewReactionState
}

export interface RemovedCommentSnapshot {
  reviewId: string
  comment: ReviewComment
  originalIndex: number
}

export interface CommentRemovalResult {
  reviews: ReviewItem[]
  snapshot: RemovedCommentSnapshot | null
}

export function clampReactionCount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

export function createReactionSnapshot(source: ReactionState): ReviewReactionState {
  return {
    curtidas: clampReactionCount(source.curtidas),
    likedByCurrentUser: source.likedByCurrentUser,
    dislikes: clampReactionCount(source.dislikes),
    dislikedByCurrentUser: source.dislikedByCurrentUser,
  }
}

export function createOptimisticLikeTransition(
  source: ReactionState
): OptimisticReactionTransition {
  const previous = createReactionSnapshot(source)
  const wasLiked = previous.likedByCurrentUser

  return {
    previous,
    next: {
      curtidas: clampReactionCount(previous.curtidas + (wasLiked ? -1 : 1)),
      likedByCurrentUser: !wasLiked,
      dislikes: clampReactionCount(
        previous.dislikes - (previous.dislikedByCurrentUser && !wasLiked ? 1 : 0)
      ),
      dislikedByCurrentUser: false,
    },
  }
}

export function createOptimisticDislikeTransition(
  source: ReactionState
): OptimisticReactionTransition {
  const previous = createReactionSnapshot(source)
  const wasDisliked = previous.dislikedByCurrentUser

  return {
    previous,
    next: {
      curtidas: clampReactionCount(
        previous.curtidas - (previous.likedByCurrentUser && !wasDisliked ? 1 : 0)
      ),
      likedByCurrentUser: false,
      dislikes: clampReactionCount(previous.dislikes + (wasDisliked ? -1 : 1)),
      dislikedByCurrentUser: !wasDisliked,
    },
  }
}

export function mergeRefreshedReviews(
  currentReviews: ReviewItem[],
  result: RefreshedReviewsResult
) {
  if (result.error && result.data.length === 0) {
    return currentReviews
  }

  if (!result.error) {
    return result.data
  }

  const currentReviewStateById = new Map(
    currentReviews.map(review => [review.id, review])
  )

  return sortReviewsByRelevance(result.data.map(review => {
    const currentReview = currentReviewStateById.get(review.id)

    if (!currentReview) {
      return review
    }

    const currentCommentStateById = new Map(
      currentReview.comentarios.map(comment => [comment.id, comment])
    )

    return {
      ...review,
      curtidas: currentReview.curtidas,
      likedByCurrentUser: currentReview.likedByCurrentUser,
      dislikes: currentReview.dislikes,
      dislikedByCurrentUser: currentReview.dislikedByCurrentUser,
      currentUserReport: currentReview.currentUserReport,
      comentarios: sortCommentsByRelevance(review.comentarios.map(comment => {
        const currentComment = currentCommentStateById.get(comment.id)

        if (!currentComment) {
          return comment
        }

        return {
          ...comment,
          curtidas: currentComment.curtidas,
          likedByCurrentUser: currentComment.likedByCurrentUser,
          dislikes: currentComment.dislikes,
          dislikedByCurrentUser: currentComment.dislikedByCurrentUser,
          currentUserReport: currentComment.currentUserReport,
        }
      })),
    }
  }))
}

export function mergeCommentPagePreservingClientState(
  currentComments: ReviewComment[],
  incomingComments: ReviewComment[]
) {
  const currentById = new Map(currentComments.map(comment => [comment.id, comment]))
  const merged = [...currentComments]

  incomingComments.forEach(comment => {
    const existing = currentById.get(comment.id)
    if (existing) return
    merged.push(comment)
  })

  return sortCommentsByRelevance(merged)
}

export function mergeReviewPagePreservingClientState(
  currentReviews: ReviewItem[],
  incomingReviews: ReviewItem[]
) {
  const currentById = new Map(currentReviews.map(review => [review.id, review]))
  const merged = [...currentReviews]

  incomingReviews.forEach(review => {
    const existing = currentById.get(review.id)

    if (!existing) {
      merged.push(review)
      return
    }

    const existingIndex = merged.findIndex(item => item.id === review.id)
    merged[existingIndex] = {
      ...review,
      curtidas: existing.curtidas,
      likedByCurrentUser: existing.likedByCurrentUser,
      dislikes: existing.dislikes,
      dislikedByCurrentUser: existing.dislikedByCurrentUser,
      currentUserReport: existing.currentUserReport,
      comentarios: mergeCommentPagePreservingClientState(
        existing.comentarios,
        review.comentarios
      ),
    }
  })

  return merged
}

export function applyReviewReactionState(
  reviews: ReviewItem[],
  reviewId: string,
  nextReactionState: ReviewReactionState
) {
  return sortReviewsByRelevance(reviews.map(review =>
    review.id === reviewId
      ? {
          ...review,
          curtidas: nextReactionState.curtidas,
          likedByCurrentUser: nextReactionState.likedByCurrentUser,
          dislikes: nextReactionState.dislikes,
          dislikedByCurrentUser: nextReactionState.dislikedByCurrentUser,
        }
      : review
  ))
}

export function applyCommentReactionState(
  reviews: ReviewItem[],
  reviewId: string,
  commentId: string,
  nextReactionState: CommentReactionState
) {
  return reviews.map(review =>
    review.id === reviewId
      ? {
          ...review,
          comentarios: sortCommentsByRelevance(review.comentarios.map(comment =>
            comment.id === commentId
              ? {
                  ...comment,
                  curtidas: nextReactionState.curtidas,
                  likedByCurrentUser: nextReactionState.likedByCurrentUser,
                  dislikes: nextReactionState.dislikes,
                  dislikedByCurrentUser: nextReactionState.dislikedByCurrentUser,
                }
              : comment
          )),
        }
      : review
  )
}

export function applyContentReportState(
  reviews: ReviewItem[],
  reviewId: string,
  targetType: ReportTargetType,
  targetId: string,
  nextReport: CurrentUserReportSummary | null
) {
  return reviews.map(review => {
    if (review.id !== reviewId) {
      return review
    }

    if (targetType === 'review') {
      return {
        ...review,
        currentUserReport: nextReport,
      }
    }

    return {
      ...review,
      comentarios: review.comentarios.map(comment =>
        comment.id === targetId
          ? {
              ...comment,
              currentUserReport: nextReport,
            }
          : comment
      ),
    }
  })
}

export function removeCommentForRollback(
  reviews: ReviewItem[],
  reviewId: string,
  commentId: string
): CommentRemovalResult {
  const review = reviews.find(currentReview => currentReview.id === reviewId)
  const originalIndex = review?.comentarios.findIndex(comment => comment.id === commentId) ?? -1

  if (!review || originalIndex < 0) {
    return {
      reviews,
      snapshot: null,
    }
  }

  const comment = review.comentarios[originalIndex]

  return {
    reviews: reviews.map(currentReview =>
      currentReview.id === reviewId
        ? {
            ...currentReview,
            comentarios: currentReview.comentarios.filter(
              currentComment => currentComment.id !== commentId
            ),
          }
        : currentReview
    ),
    snapshot: {
      reviewId,
      comment,
      originalIndex,
    },
  }
}

export function restoreCommentFromRollback(
  reviews: ReviewItem[],
  snapshot: RemovedCommentSnapshot
) {
  const review = reviews.find(currentReview => currentReview.id === snapshot.reviewId)

  if (
    !review ||
    review.comentarios.some(comment => comment.id === snapshot.comment.id)
  ) {
    return reviews
  }

  return reviews.map(currentReview => {
    if (currentReview.id !== snapshot.reviewId) {
      return currentReview
    }

    const nextComments = [...currentReview.comentarios]
    const restoreIndex = Math.min(snapshot.originalIndex, nextComments.length)
    nextComments.splice(restoreIndex, 0, snapshot.comment)

    return {
      ...currentReview,
      comentarios: sortCommentsByRelevance(nextComments),
    }
  })
}
