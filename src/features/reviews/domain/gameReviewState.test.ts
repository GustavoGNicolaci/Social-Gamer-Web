import { describe, expect, it } from 'vitest'
import type { ReviewComment, ReviewItem } from '../../../services/reviewService'
import type { CurrentUserReportSummary } from '../../../services/reviewInteractionsService'
import {
  applyCommentReactionState,
  applyContentReportState,
  applyReviewReactionState,
  clampReactionCount,
  createOptimisticDislikeTransition,
  createOptimisticLikeTransition,
  createReactionSnapshot,
  mergeCommentPagePreservingClientState,
  mergeRefreshedReviews,
  mergeReviewPagePreservingClientState,
  removeCommentForRollback,
  restoreCommentFromRollback,
} from './gameReviewState'

const NO_REACTION = {
  curtidas: 0,
  likedByCurrentUser: false,
  dislikes: 0,
  dislikedByCurrentUser: false,
}

function createReport(id: string): CurrentUserReportSummary {
  return {
    id,
    targetType: 'review',
    reason: 'spam',
    description: null,
    status: 'pending',
    createdAt: '2026-07-01T12:00:00.000Z',
  }
}

function createComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'comment-1',
    usuario_id: 'comment-author',
    review_id: 'review-1',
    texto: 'Comment text',
    data_comentario: '2026-07-01T12:00:00.000Z',
    editado_em: null,
    usuario: {
      id: 'comment-author',
      username: 'commenter',
      avatar_path: null,
    },
    ...NO_REACTION,
    canLike: true,
    canDislike: true,
    currentUserReport: null,
    ...overrides,
  }
}

function createReview(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'review-1',
    usuario_id: 'review-author',
    jogo_id: 42,
    nota: 8,
    texto_review: 'Review text',
    data_publicacao: '2026-07-01T12:00:00.000Z',
    editado_em: null,
    usuario: {
      id: 'review-author',
      username: 'reviewer',
      avatar_path: null,
    },
    comentarios: [],
    ...NO_REACTION,
    canLike: true,
    canDislike: true,
    currentUserReport: null,
    ...overrides,
  }
}

describe('review refresh merging', () => {
  it('appends paginated data without replacing optimistic reaction state', () => {
    const optimisticComment = createComment({ curtidas: 3, likedByCurrentUser: true })
    const optimisticReview = createReview({
      curtidas: 8,
      likedByCurrentUser: true,
      comentarios: [optimisticComment],
    })
    const stalePageReview = createReview({
      curtidas: 7,
      likedByCurrentUser: false,
      comentarios: [createComment({ curtidas: 2, likedByCurrentUser: false })],
    })
    const nextReview = createReview({ id: 'review-2' })

    const merged = mergeReviewPagePreservingClientState(
      [optimisticReview],
      [stalePageReview, nextReview]
    )

    expect(merged.map(review => review.id)).toEqual(['review-1', 'review-2'])
    expect(merged[0]).toMatchObject({ curtidas: 8, likedByCurrentUser: true })
    expect(merged[0].comentarios[0]).toMatchObject({
      curtidas: 3,
      likedByCurrentUser: true,
    })
  })

  it('deduplicates comments loaded by an anchor and a later sequential page', () => {
    const current = [createComment({ id: 'comment-anchor', curtidas: 5 })]
    const incoming = [
      createComment({ id: 'comment-2' }),
      createComment({ id: 'comment-anchor', curtidas: 4 }),
    ]

    const merged = mergeCommentPagePreservingClientState(current, incoming)

    expect(merged.filter(comment => comment.id === 'comment-anchor')).toHaveLength(1)
    expect(merged.find(comment => comment.id === 'comment-anchor')?.curtidas).toBe(5)
  })

  it('keeps the current list when a refresh fails without usable data', () => {
    const currentReviews = [createReview()]

    expect(mergeRefreshedReviews(currentReviews, {
      data: [],
      error: { message: 'Network error' },
    })).toBe(currentReviews)
  })

  it('uses successful refresh data without changing its order or identity', () => {
    const refreshedReviews = [
      createReview({ id: 'review-2' }),
      createReview({ id: 'review-1' }),
    ]

    expect(mergeRefreshedReviews([], {
      data: refreshedReviews,
      error: null,
    })).toBe(refreshedReviews)
  })

  it('preserves local reactions and reports while accepting partial refreshed content', () => {
    const localReviewReport = createReport('local-review-report')
    const localCommentReport = {
      ...createReport('local-comment-report'),
      targetType: 'comment' as const,
    }
    const localComment = createComment({
      curtidas: 7,
      likedByCurrentUser: true,
      currentUserReport: localCommentReport,
    })
    const currentReviews = [createReview({
      curtidas: 9,
      likedByCurrentUser: true,
      dislikes: 2,
      currentUserReport: localReviewReport,
      comentarios: [localComment],
    })]
    const refreshedMatchingComment = createComment({
      texto: 'Fresh comment text',
      curtidas: 0,
      likedByCurrentUser: false,
    })
    const refreshedNewComment = createComment({
      id: 'comment-2',
      texto: 'New comment',
      curtidas: 3,
      data_comentario: '2026-07-02T12:00:00.000Z',
    })
    const refreshedMatchingReview = createReview({
      texto_review: 'Fresh review text',
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 0,
      currentUserReport: null,
      comentarios: [refreshedNewComment, refreshedMatchingComment],
    })
    const refreshedNewReview = createReview({
      id: 'review-2',
      curtidas: 4,
      texto_review: 'Brand-new review',
    })

    const merged = mergeRefreshedReviews(currentReviews, {
      data: [refreshedNewReview, refreshedMatchingReview],
      error: { message: 'Reaction summary failed' },
    })

    expect(merged.map(review => review.id)).toEqual(['review-1', 'review-2'])
    expect(merged[0]).toMatchObject({
      texto_review: 'Fresh review text',
      curtidas: 9,
      likedByCurrentUser: true,
      dislikes: 2,
      currentUserReport: localReviewReport,
    })
    expect(merged[0].comentarios.map(comment => comment.id)).toEqual([
      'comment-1',
      'comment-2',
    ])
    expect(merged[0].comentarios[0]).toMatchObject({
      texto: 'Fresh comment text',
      curtidas: 7,
      likedByCurrentUser: true,
      currentUserReport: localCommentReport,
    })
    expect(merged[0].comentarios[1]).toBe(refreshedNewComment)
  })
})

describe('reaction snapshots and optimistic transitions', () => {
  it('clamps invalid counters when creating a snapshot', () => {
    expect(clampReactionCount(-3)).toBe(0)
    expect(clampReactionCount(Number.NaN)).toBe(0)
    expect(createReactionSnapshot({
      curtidas: -1,
      likedByCurrentUser: false,
      dislikes: -2,
      dislikedByCurrentUser: false,
    })).toEqual(NO_REACTION)
  })

  it('adds and removes a like without producing negative counts', () => {
    expect(createOptimisticLikeTransition(NO_REACTION)).toEqual({
      previous: NO_REACTION,
      next: {
        curtidas: 1,
        likedByCurrentUser: true,
        dislikes: 0,
        dislikedByCurrentUser: false,
      },
    })

    expect(createOptimisticLikeTransition({
      curtidas: 0,
      likedByCurrentUser: true,
      dislikes: 0,
      dislikedByCurrentUser: false,
    }).next).toEqual(NO_REACTION)
  })

  it('switches a dislike to a like exclusively', () => {
    expect(createOptimisticLikeTransition({
      curtidas: 4,
      likedByCurrentUser: false,
      dislikes: 2,
      dislikedByCurrentUser: true,
    }).next).toEqual({
      curtidas: 5,
      likedByCurrentUser: true,
      dislikes: 1,
      dislikedByCurrentUser: false,
    })
  })

  it('adds and removes a dislike without producing negative counts', () => {
    expect(createOptimisticDislikeTransition(NO_REACTION).next).toEqual({
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 1,
      dislikedByCurrentUser: true,
    })

    expect(createOptimisticDislikeTransition({
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 0,
      dislikedByCurrentUser: true,
    }).next).toEqual(NO_REACTION)
  })

  it('switches a like to a dislike exclusively', () => {
    expect(createOptimisticDislikeTransition({
      curtidas: 3,
      likedByCurrentUser: true,
      dislikes: 5,
      dislikedByCurrentUser: false,
    }).next).toEqual({
      curtidas: 2,
      likedByCurrentUser: false,
      dislikes: 6,
      dislikedByCurrentUser: true,
    })
  })
})

describe('immutable review interaction updates', () => {
  it('updates a review reaction and reorders reviews by relevance', () => {
    const firstReview = createReview({ id: 'review-1', curtidas: 0 })
    const secondReview = createReview({ id: 'review-2', curtidas: 2 })

    const updated = applyReviewReactionState(
      [firstReview, secondReview],
      'review-1',
      {
        curtidas: 3,
        likedByCurrentUser: true,
        dislikes: 0,
        dislikedByCurrentUser: false,
      }
    )

    expect(updated.map(review => review.id)).toEqual(['review-1', 'review-2'])
    expect(updated[0]).toMatchObject({ curtidas: 3, likedByCurrentUser: true })
    expect(updated[1]).toBe(secondReview)
  })

  it('updates a comment reaction and reorders comments only inside its review', () => {
    const firstComment = createComment({ id: 'comment-1', curtidas: 0 })
    const secondComment = createComment({ id: 'comment-2', curtidas: 2 })
    const review = createReview({ comentarios: [firstComment, secondComment] })

    const updated = applyCommentReactionState(
      [review],
      review.id,
      firstComment.id,
      {
        curtidas: 4,
        likedByCurrentUser: true,
        dislikes: 0,
        dislikedByCurrentUser: false,
      }
    )

    expect(updated[0].comentarios.map(comment => comment.id)).toEqual([
      'comment-1',
      'comment-2',
    ])
    expect(updated[0].comentarios[0]).toMatchObject({
      curtidas: 4,
      likedByCurrentUser: true,
    })
  })

  it('sets and removes current-user reports for reviews and comments', () => {
    const report = createReport('report-1')
    const review = createReview({ comentarios: [createComment()] })

    const withReviewReport = applyContentReportState(
      [review],
      review.id,
      'review',
      review.id,
      report
    )
    const withCommentReport = applyContentReportState(
      withReviewReport,
      review.id,
      'comment',
      'comment-1',
      { ...report, targetType: 'comment' }
    )
    const withoutCommentReport = applyContentReportState(
      withCommentReport,
      review.id,
      'comment',
      'comment-1',
      null
    )

    expect(withCommentReport[0].currentUserReport).toBe(report)
    expect(withCommentReport[0].comentarios[0].currentUserReport).toMatchObject({
      id: 'report-1',
      targetType: 'comment',
    })
    expect(withoutCommentReport[0].comentarios[0].currentUserReport).toBeNull()
  })
})

describe('comment deletion rollback', () => {
  it('removes a comment and restores it from the captured snapshot', () => {
    const removedComment = createComment({ id: 'comment-1', curtidas: 5 })
    const remainingComment = createComment({ id: 'comment-2', curtidas: 1 })
    const reviews = [createReview({ comentarios: [removedComment, remainingComment] })]

    const removal = removeCommentForRollback(reviews, 'review-1', 'comment-1')

    expect(removal.reviews[0].comentarios).toEqual([remainingComment])
    expect(removal.snapshot).toEqual({
      reviewId: 'review-1',
      comment: removedComment,
      originalIndex: 0,
    })

    const restored = restoreCommentFromRollback(removal.reviews, removal.snapshot!)

    expect(restored[0].comentarios).toEqual([removedComment, remainingComment])
  })

  it('does not duplicate a comment during a repeated rollback', () => {
    const comment = createComment()
    const reviews = [createReview({ comentarios: [comment] })]
    const snapshot = {
      reviewId: 'review-1',
      comment,
      originalIndex: 0,
    }

    expect(restoreCommentFromRollback(reviews, snapshot)).toBe(reviews)
  })

  it('returns an empty snapshot when the target comment is no longer present', () => {
    const reviews = [createReview()]

    expect(removeCommentForRollback(reviews, 'review-1', 'missing-comment')).toEqual({
      reviews,
      snapshot: null,
    })
  })
})
