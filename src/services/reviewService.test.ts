import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getCurrentUserContentReports: vi.fn(),
  getReactionSummaryStates: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))

vi.mock('./reviewInteractionsService', async importOriginal => {
  const actual = await importOriginal<typeof import('./reviewInteractionsService')>()
  return {
    ...actual,
    getCurrentUserContentReports: mocks.getCurrentUserContentReports,
    getReactionSummaryStates: mocks.getReactionSummaryStates,
  }
})

import {
  getGameReviewsPage,
  getReviewCommentsPage,
  resolveGameReviewAnchor,
} from './reviewService'

function createAwaitableQuery(response: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.then.mockImplementation((onFulfilled, onRejected) => (
    Promise.resolve(response).then(onFulfilled, onRejected)
  ))
  return query
}

const reviewRow = {
  review_id: 'review-1',
  game_id: 7,
  author_id: 'author-1',
  author_username: 'reviewer',
  author_name: 'Reviewer',
  author_avatar_path: null,
  score: 9,
  review_text: 'Review RPC',
  published_at: '2026-07-01T00:00:00.000Z',
  edited_at: null,
  likes_count: 4,
  dislikes_count: 1,
  comments_count: 5,
  liked_by_current_user: true,
  disliked_by_current_user: false,
  current_user_report_id: null,
  current_user_report_reason: null,
  current_user_report_description: null,
  current_user_report_status: null,
  current_user_report_created_at: null,
  total_count: 6,
}

const commentRow = {
  comment_id: 'comment-1',
  review_id: 'review-1',
  author_id: 'comment-author',
  author_username: 'commenter',
  author_name: null,
  author_avatar_path: null,
  comment_text: 'Comentario RPC',
  published_at: '2026-07-02T00:00:00.000Z',
  edited_at: null,
  likes_count: 2,
  dislikes_count: 0,
  liked_by_current_user: false,
  disliked_by_current_user: false,
  current_user_report_id: null,
  current_user_report_reason: null,
  current_user_report_description: null,
  current_user_report_status: null,
  current_user_report_created_at: null,
  total_count: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getReactionSummaryStates.mockResolvedValue({
    data: { reviews: new Map(), comments: new Map() },
    error: null,
  })
  mocks.getCurrentUserContentReports.mockResolvedValue({
    data: { reportsByReviewId: new Map(), reportsByCommentId: new Map() },
    error: null,
  })
})

describe('paginated game review read models', () => {
  it('loads three initial reviews and two initial comments from the RPCs', async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === 'get_game_reviews_page') {
        return Promise.resolve({ data: [reviewRow], error: null })
      }
      if (name === 'get_review_comments_page') {
        return Promise.resolve({ data: [commentRow], error: null })
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    const result = await getGameReviewsPage(7, { currentUserId: 'viewer' })

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'get_game_reviews_page', {
      p_game_id: 7,
      p_limit: 3,
      p_offset: 0,
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'get_review_comments_page', {
      p_review_id: 'review-1',
      p_limit: 2,
      p_offset: 0,
    })
    expect(result).toMatchObject({
      totalCount: 6,
      hasMore: true,
      nextOffset: 1,
      commentTotals: { 'review-1': 5 },
      error: null,
    })
    expect(result.data[0]).toMatchObject({
      id: 'review-1',
      curtidas: 4,
      likedByCurrentUser: true,
      comentarios: [{ id: 'comment-1', texto: 'Comentario RPC' }],
    })
  })

  it('loads the next four comments using the loaded offset and RPC total', async () => {
    mocks.rpc.mockResolvedValue({ data: [commentRow], error: null })

    const result = await getReviewCommentsPage('review-1', {
      currentUserId: 'viewer',
      limit: 4,
      offset: 2,
    })

    expect(mocks.rpc).toHaveBeenCalledWith('get_review_comments_page', {
      p_review_id: 'review-1',
      p_limit: 4,
      p_offset: 2,
    })
    expect(result).toMatchObject({ totalCount: 5, hasMore: true, nextOffset: 3 })
  })

  it.each(['PGRST202', '42883'])(
    'uses the legacy review query only when the page RPC is unavailable (%s)',
    async code => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'missing RPC' } })
      const query = createAwaitableQuery({
        data: [{
          id: 'legacy-review',
          usuario_id: 'author-1',
          jogo_id: 7,
          nota: 8,
          texto_review: null,
          curtidas: 0,
          data_publicacao: '2026-07-01T00:00:00.000Z',
          editado_em: null,
          usuario: { id: 'author-1', username: 'legacy', avatar_path: null },
          comentarios: [],
        }],
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const result = await getGameReviewsPage(7)

      expect(mocks.from).toHaveBeenCalledWith('avaliacoes')
      expect(result).toMatchObject({
        data: [{ id: 'legacy-review' }],
        totalCount: 1,
        fallbackUsed: true,
      })
    }
  )

  it('does not query legacy tables for ordinary RPC errors', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    const result = await getGameReviewsPage(7)

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      data: [],
      error: { code: '42501', message: 'permission denied' },
      totalCount: null,
    })
  })

  it('does not fall back when the comment page RPC returns an authorization error', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    const result = await getReviewCommentsPage('review-1', { limit: 4, offset: 2 })

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      data: [],
      error: { code: '42501', message: 'permission denied' },
      totalCount: null,
    })
  })

  it('does not fall back when the anchor RPC returns an ordinary error', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'invalid anchor' },
    })

    const result = await resolveGameReviewAnchor(7, { reviewId: 'review-1' })

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: null,
      error: expect.objectContaining({ code: '22023', message: 'invalid anchor' }),
    })
  })

  it('resolves deep-link offsets through the anchor RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        target_type: 'comment',
        review_id: 'review-4',
        comment_id: 'comment-anchor',
        review_offset: 7,
        comment_offset: 9,
      }],
      error: null,
    })

    const result = await resolveGameReviewAnchor(7, { commentId: 'comment-anchor' })

    expect(mocks.rpc).toHaveBeenCalledWith('get_game_review_anchor', {
      p_game_id: 7,
      p_review_id: null,
      p_comment_id: 'comment-anchor',
    })
    expect(result.data).toEqual({
      targetType: 'comment',
      reviewId: 'review-4',
      commentId: 'comment-anchor',
      reviewOffset: 7,
      commentOffset: 9,
    })
  })
})
