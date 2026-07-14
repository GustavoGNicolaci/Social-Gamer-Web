import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  },
}))

import { createReviewComment, saveReview, toggleReviewLike } from './reviewService'
import {
  getReactionSummaryStates,
  submitContentReport,
  toggleCommentDislike,
  toggleContentReaction,
} from './reviewInteractionsService'

describe('review reaction RPC adapters', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockReset()
    supabaseMocks.from.mockReset()
  })

  it('loads review and comment aggregates in one RPC without sending a user id', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          content_type: 'review',
          content_id: 'review-1',
          curtidas: 4,
          dislikes: 1,
          liked_by_current_user: true,
          disliked_by_current_user: false,
        },
        {
          content_type: 'comment',
          content_id: 'comment-1',
          curtidas: 2,
          dislikes: 3,
          liked_by_current_user: false,
          disliked_by_current_user: true,
        },
      ],
      error: null,
    })

    const result = await getReactionSummaryStates(
      ['review-1', 'review-1', 'review-without-reactions'],
      ['comment-1']
    )

    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_review_reaction_summaries', {
      p_review_ids: ['review-1', 'review-without-reactions'],
      p_comment_ids: ['comment-1'],
    })
    expect(result.data.reviews.get('review-1')).toEqual({
      curtidas: 4,
      likedByCurrentUser: true,
      dislikes: 1,
      dislikedByCurrentUser: false,
    })
    expect(result.data.reviews.get('review-without-reactions')).toEqual({
      curtidas: 0,
      likedByCurrentUser: false,
      dislikes: 0,
      dislikedByCurrentUser: false,
    })
    expect(result.data.comments.get('comment-1')?.dislikedByCurrentUser).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns initialized aggregate maps when the batch RPC fails', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc unavailable' },
    })

    const result = await getReactionSummaryStates(['review-1'], ['comment-1'])

    expect(result.data.reviews.get('review-1')?.curtidas).toBe(0)
    expect(result.data.comments.get('comment-1')?.dislikes).toBe(0)
    expect(result.error?.message).toBe('rpc unavailable')
  })

  it('splits reaction summaries into requests that respect the 500-item RPC limit', async () => {
    const reviewIds = Array.from({ length: 500 }, (_, index) => `review-${index + 1}`)
    supabaseMocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            content_type: 'review',
            content_id: 'review-500',
            curtidas: 8,
            dislikes: 0,
            liked_by_current_user: true,
            disliked_by_current_user: false,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            content_type: 'comment',
            content_id: 'comment-1',
            curtidas: 1,
            dislikes: 2,
            liked_by_current_user: false,
            disliked_by_current_user: true,
          },
        ],
        error: null,
      })

    const result = await getReactionSummaryStates(reviewIds, ['comment-1'])

    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(2)
    expect(supabaseMocks.rpc).toHaveBeenNthCalledWith(1, 'get_review_reaction_summaries', {
      p_review_ids: reviewIds,
      p_comment_ids: [],
    })
    expect(supabaseMocks.rpc).toHaveBeenNthCalledWith(2, 'get_review_reaction_summaries', {
      p_review_ids: [],
      p_comment_ids: ['comment-1'],
    })
    expect(result.data.reviews.get('review-500')?.curtidas).toBe(8)
    expect(result.data.comments.get('comment-1')?.dislikes).toBe(2)
    expect(result.error).toBeNull()
  })

  it('maps the atomic toggle result without issuing direct table mutations', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          reaction_status: 'disliked',
          curtidas: 7,
          dislikes: 2,
          liked_by_current_user: false,
          disliked_by_current_user: true,
        },
      ],
      error: null,
    })

    const result = await toggleContentReaction('comment', 'comment-1', 'dislike')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('toggle_review_reaction', {
      p_content_type: 'comment',
      p_content_id: 'comment-1',
      p_reaction: 'dislike',
    })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'disliked',
      data: {
        curtidas: 7,
        likedByCurrentUser: false,
        dislikes: 2,
        dislikedByCurrentUser: true,
      },
      error: null,
    })
  })

  it('keeps the review like public API while delegating to the atomic RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          reaction_status: 'liked',
          curtidas: 3,
          dislikes: 0,
          liked_by_current_user: true,
          disliked_by_current_user: false,
        },
      ],
      error: null,
    })

    const result = await toggleReviewLike({
      reviewId: 'review-1',
      userId: 'user-1',
      reviewAuthorId: 'author-1',
      likedByCurrentUser: false,
      dislikedByCurrentUser: true,
      currentLikeCount: 2,
      currentDislikeCount: 1,
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('toggle_review_reaction', {
      p_content_type: 'review',
      p_content_id: 'review-1',
      p_reaction: 'like',
    })
    expect(result.status).toBe('liked')
    expect(result.data?.dislikedByCurrentUser).toBe(false)
  })

  it('keeps the local self-reaction guard and does not call the RPC', async () => {
    const result = await toggleCommentDislike({
      commentId: 'comment-1',
      userId: 'author-1',
      commentAuthorId: 'author-1',
      likedByCurrentUser: false,
      dislikedByCurrentUser: false,
      currentLikeCount: 0,
      currentDislikeCount: 0,
    })

    expect(result.status).toBe('error')
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('lets the database assign review counters and publication timestamps', async () => {
    const existingReviewQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    existingReviewQuery.select.mockReturnValue(existingReviewQuery)
    existingReviewQuery.eq.mockReturnValue(existingReviewQuery)

    const insert = vi.fn().mockResolvedValue({ error: null })
    supabaseMocks.from
      .mockReturnValueOnce(existingReviewQuery)
      .mockReturnValueOnce({ insert })

    const result = await saveReview({
      userId: 'user-1',
      gameId: 42,
      nota: 8,
      textoReview: '  Review segura  ',
    })

    expect(insert).toHaveBeenCalledWith({
      usuario_id: 'user-1',
      jogo_id: 42,
      nota: 8,
      texto_review: 'Review segura',
    })
    expect(result).toEqual({ status: 'created', error: null })
  })

  it('lets the database assign comment timestamps', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabaseMocks.from.mockReturnValue({ insert })

    const result = await createReviewComment({
      userId: 'user-1',
      reviewId: 'review-1',
      texto: '  Comentario seguro  ',
    })

    expect(insert).toHaveBeenCalledWith({
      usuario_id: 'user-1',
      review_id: 'review-1',
      texto: 'Comentario seguro',
    })
    expect(result).toEqual({ data: null, error: null })
  })

  it('lets the database assign content report status and timestamp', async () => {
    const reportQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    reportQuery.insert.mockReturnValue(reportQuery)
    reportQuery.select.mockReturnValue(reportQuery)
    supabaseMocks.from.mockReturnValue(reportQuery)

    const result = await submitContentReport({
      userId: 'user-1',
      targetType: 'review',
      targetId: 'review-2',
      targetAuthorId: 'author-2',
      reason: 'spam',
      description: '  Repetido  ',
    })

    expect(reportQuery.insert).toHaveBeenCalledWith({
      denunciante_id: 'user-1',
      tipo_conteudo: 'review',
      avaliacao_id: 'review-2',
      comentario_id: null,
      motivo: 'spam',
      descricao: 'Repetido',
    })
    expect(result).toEqual({ status: 'created', data: null, error: null })
  })
})
