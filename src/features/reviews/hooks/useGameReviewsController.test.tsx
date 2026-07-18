import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewComment, ReviewItem } from '../../../services/reviewService'

const mocks = vi.hoisted(() => ({
  createReviewComment: vi.fn(),
  deleteContentReport: vi.fn(),
  deleteReview: vi.fn(),
  deleteReviewComment: vi.fn(),
  getGameReviewOverview: vi.fn(),
  getGameReviewsPage: vi.fn(),
  getReviewByGameAndUserId: vi.fn(),
  getReviewCommentsPage: vi.fn(),
  resolveGameReviewAnchor: vi.fn(),
  saveReview: vi.fn(),
  submitContentReport: vi.fn(),
  toggleCommentDislike: vi.fn(),
  toggleCommentLike: vi.fn(),
  toggleReviewDislike: vi.fn(),
  toggleReviewLike: vi.fn(),
}))

vi.mock('../../../services/reviewService', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../services/reviewService')>()

  return {
    ...actual,
    createReviewComment: mocks.createReviewComment,
    deleteReview: mocks.deleteReview,
    deleteReviewComment: mocks.deleteReviewComment,
    getGameReviewOverview: mocks.getGameReviewOverview,
    getGameReviewsPage: mocks.getGameReviewsPage,
    getReviewByGameAndUserId: mocks.getReviewByGameAndUserId,
    getReviewCommentsPage: mocks.getReviewCommentsPage,
    resolveGameReviewAnchor: mocks.resolveGameReviewAnchor,
    saveReview: mocks.saveReview,
    toggleReviewLike: mocks.toggleReviewLike,
  }
})

vi.mock('../../../services/reviewInteractionsService', () => ({
  deleteContentReport: mocks.deleteContentReport,
  submitContentReport: mocks.submitContentReport,
  toggleCommentDislike: mocks.toggleCommentDislike,
  toggleCommentLike: mocks.toggleCommentLike,
  toggleReviewDislike: mocks.toggleReviewDislike,
}))

import { useGameReviewsController } from './useGameReviewsController'

const t = (key: string) => key
const noError = { code: 'TEST', message: 'falha controlada' }

function createComment(id: string, overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id,
    usuario_id: 'comment-author',
    review_id: 'review-1',
    texto: `Comment ${id}`,
    data_comentario: '2026-01-01T00:00:00.000Z',
    editado_em: null,
    usuario: { username: 'Comment author', avatar_path: null },
    curtidas: 0,
    likedByCurrentUser: false,
    canLike: true,
    dislikes: 0,
    dislikedByCurrentUser: false,
    canDislike: true,
    currentUserReport: null,
    ...overrides,
  }
}

function createReview(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    usuario_id: 'review-author',
    jogo_id: 1,
    nota: 8,
    texto_review: `Review ${id}`,
    curtidas: 0,
    data_publicacao: '2026-01-01T00:00:00.000Z',
    editado_em: null,
    usuario: { username: 'Review author', avatar_path: null },
    comentarios: [],
    likedByCurrentUser: false,
    canLike: true,
    dislikes: 0,
    dislikedByCurrentUser: false,
    canDislike: true,
    currentUserReport: null,
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function renderController(
  initialProps: { gameId: number | null; currentUserId: string | null; locationHash: string } = {
    gameId: 1,
    currentUserId: 'viewer',
    locationHash: '',
  }
) {
  return renderHook(
    (props: typeof initialProps) => useGameReviewsController({ ...props, t }),
    { initialProps }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  mocks.getGameReviewsPage.mockResolvedValue({
    data: [],
    error: null,
    totalCount: 0,
    hasMore: false,
    nextOffset: null,
    commentTotals: {},
  })
  mocks.getReviewCommentsPage.mockResolvedValue({
    data: [],
    error: null,
    totalCount: 0,
    hasMore: false,
    nextOffset: null,
  })
  mocks.getReviewByGameAndUserId.mockResolvedValue({ data: null, error: null })
  mocks.resolveGameReviewAnchor.mockResolvedValue({ data: null, error: null })
  mocks.getGameReviewOverview.mockResolvedValue({
    data: {
      gameId: 1,
      averageRating: null,
      reviewCount: 0,
      commentCount: 0,
    },
    error: null,
  })
  mocks.createReviewComment.mockResolvedValue({ data: null, error: null })
  mocks.deleteReview.mockResolvedValue({ ok: true, error: null })
  mocks.deleteReviewComment.mockResolvedValue({ ok: true, error: null })
  mocks.saveReview.mockResolvedValue({ status: 'created', error: null })
  mocks.toggleReviewLike.mockResolvedValue({
    status: 'liked',
    data: {
      curtidas: 1,
      likedByCurrentUser: true,
      dislikes: 0,
      dislikedByCurrentUser: false,
    },
    error: null,
  })
  mocks.toggleReviewDislike.mockResolvedValue({ status: 'disliked', data: null, error: null })
  mocks.toggleCommentLike.mockResolvedValue({ status: 'liked', data: null, error: null })
  mocks.toggleCommentDislike.mockResolvedValue({ status: 'disliked', data: null, error: null })
  mocks.submitContentReport.mockResolvedValue({ status: 'created', data: null, error: null })
  mocks.deleteContentReport.mockResolvedValue({ status: 'deleted', error: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useGameReviewsController', () => {
  it('representa loading e estado vazio sem erro', async () => {
    const deferred = createDeferred<{ data: ReviewItem[]; error: null }>()
    mocks.getGameReviewsPage.mockReturnValueOnce(deferred.promise)

    const { result } = renderController()
    expect(result.current.overview.loading).toBe(true)

    await act(async () => {
      deferred.resolve({ data: [], error: null })
      await deferred.promise
    })

    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(result.current.overview.reviews).toEqual([])
    expect(result.current.section.list.error).toBeNull()
  })

  it('usa o total global exato de comentarios sem depender das reviews carregadas', async () => {
    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [createReview('loaded', { comentarios: [createComment('visible')] })],
      error: null,
      totalCount: 8,
      hasMore: true,
      nextOffset: 1,
      commentTotals: { loaded: 5 },
    })
    mocks.getGameReviewOverview.mockResolvedValueOnce({
      data: {
        gameId: 1,
        averageRating: 8.5,
        reviewCount: 8,
        commentCount: 31,
      },
      error: null,
    })

    const { result } = renderController()

    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(result.current.overview.totalComments).toBe(31)
  })

  it('mantem a soma carregada enquanto usa o fallback de compatibilidade', async () => {
    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [createReview('loaded', { comentarios: [createComment('visible')] })],
      error: null,
      totalCount: 1,
      hasMore: false,
      nextOffset: null,
      commentTotals: { loaded: 5 },
    })
    mocks.getGameReviewOverview.mockResolvedValueOnce({
      data: {
        gameId: 1,
        averageRating: 8,
        reviewCount: 1,
        commentCount: 0,
      },
      error: null,
      fallbackUsed: true,
    })

    const { result } = renderController()

    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(result.current.overview.totalComments).toBe(5)
  })

  it('mantem dados parciais e so exibe erro de carga quando nao ha reviews', async () => {
    mocks.getGameReviewsPage.mockResolvedValueOnce({ data: [], error: noError })
    const { result } = renderController()

    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(result.current.section.list.error).toBe(
      'game.details.reviewError.load.default'
    )

    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [createReview('partial')],
      error: noError,
    })
    await act(async () => {
      await result.current.section.actions.refreshReviews()
    })

    expect(result.current.overview.reviews.map(review => review.id)).toEqual(['partial'])
    expect(result.current.section.list.error).toBeNull()
  })

  it('traduz diagnosticos conhecidos por chave sem expor literal do controller', async () => {
    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [],
      error: { code: '42501', message: 'permission denied' },
    })
    const { result } = renderController()

    await waitFor(() => expect(result.current.overview.loading).toBe(false))
    expect(result.current.section.list.error).toBe(
      'game.details.reviewError.load.permission'
    )
  })

  it('mantem a edicao da review do usuario mesmo quando ela esta fora da primeira pagina', async () => {
    const ownReview = createReview('own-review', {
      usuario_id: 'viewer',
      nota: 9,
      texto_review: 'Minha review existente',
    })
    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [createReview('public-1'), createReview('public-2'), createReview('public-3')],
      error: null,
      totalCount: 8,
      nextOffset: 3,
      commentTotals: {},
    })
    mocks.getReviewByGameAndUserId.mockResolvedValueOnce({ data: ownReview, error: null })

    const { result } = renderController()

    await waitFor(() => expect(result.current.section.form.editing).toBe(true))
    await waitFor(() => expect(result.current.section.form.score).toBe(9))
    expect(result.current.section.form.text).toBe('Minha review existente')
    expect(result.current.section.list.visible).toHaveLength(3)
  })

  it('ignora resposta obsoleta depois da troca de jogo', async () => {
    const stale = createDeferred<{ data: ReviewItem[]; error: null }>()
    mocks.getGameReviewsPage.mockImplementation((gameId: number) => {
      if (gameId === 1) return stale.promise
      return Promise.resolve({ data: [createReview('current', { jogo_id: 2 })], error: null })
    })
    mocks.getGameReviewOverview.mockImplementation((requestedGameId: number) => Promise.resolve({
      data: {
        gameId: requestedGameId,
        averageRating: 8,
        reviewCount: 1,
        commentCount: 4,
      },
      error: null,
    }))

    const { result, rerender } = renderController()
    rerender({ gameId: 2, currentUserId: 'viewer', locationHash: '' })

    await waitFor(() => expect(result.current.overview.reviews[0]?.id).toBe('current'))

    await act(async () => {
      stale.resolve({ data: [createReview('stale')], error: null })
      await stale.promise
    })

    expect(result.current.overview.reviews[0]?.id).toBe('current')
    expect(result.current.overview.ratingSummary?.gameId).toBe(2)
  })

  it('aplica like otimista, preserva exclusividade e confirma o estado retornado', async () => {
    const review = createReview('review-1', {
      dislikes: 1,
      dislikedByCurrentUser: true,
    })
    const refreshedReview = createReview('review-1', {
      curtidas: 1,
      likedByCurrentUser: true,
    })
    const mutation = createDeferred<{
      status: 'liked'
      data: {
        curtidas: number
        likedByCurrentUser: boolean
        dislikes: number
        dislikedByCurrentUser: boolean
      }
      error: null
    }>()

    mocks.getGameReviewsPage
      .mockResolvedValueOnce({ data: [review], error: null })
      .mockResolvedValueOnce({ data: [refreshedReview], error: null })
    mocks.toggleReviewLike.mockReturnValueOnce(mutation.promise)
    const { result } = renderController()
    await waitFor(() => expect(result.current.overview.reviews).toHaveLength(1))

    let pendingMutation!: Promise<void>
    act(() => {
      pendingMutation = result.current.section.actions.reviewLike(
        result.current.overview.reviews[0]
      )
    })

    expect(result.current.overview.reviews[0]).toMatchObject({
      curtidas: 1,
      likedByCurrentUser: true,
      dislikes: 0,
      dislikedByCurrentUser: false,
    })

    await act(async () => {
      mutation.resolve({
        status: 'liked',
        data: {
          curtidas: 1,
          likedByCurrentUser: true,
          dislikes: 0,
          dislikedByCurrentUser: false,
        },
        error: null,
      })
      await pendingMutation
    })

    expect(result.current.overview.reviews[0].likedByCurrentUser).toBe(true)
    expect(result.current.section.list.pendingReviews).toEqual([])
  })

  it('faz rollback da reacao otimista quando o servico falha', async () => {
    const review = createReview('review-1')
    mocks.getGameReviewsPage.mockResolvedValueOnce({ data: [review], error: null })
    mocks.toggleReviewLike.mockResolvedValueOnce({ status: 'error', data: null, error: noError })
    const { result } = renderController()
    await waitFor(() => expect(result.current.overview.reviews).toHaveLength(1))

    await act(async () => {
      await result.current.section.actions.reviewLike(result.current.overview.reviews[0])
    })

    expect(result.current.overview.reviews[0]).toMatchObject({
      curtidas: 0,
      likedByCurrentUser: false,
    })
    expect(result.current.section.form.feedback).toEqual({
      tone: 'error',
      message: 'game.details.reviewError.review_like.default',
    })
  })

  it('restaura um comentario removido de forma otimista quando a exclusao falha', async () => {
    const comment = createComment('comment-1', { usuario_id: 'viewer' })
    const review = createReview('review-1', { comentarios: [comment] })
    const deletion = createDeferred<{ ok: false; error: typeof noError }>()
    mocks.getGameReviewsPage.mockResolvedValueOnce({ data: [review], error: null })
    mocks.deleteReviewComment.mockReturnValueOnce(deletion.promise)
    const { result } = renderController()
    await waitFor(() => expect(result.current.overview.reviews).toHaveLength(1))

    let pendingDeletion!: Promise<void>
    act(() => {
      pendingDeletion = result.current.section.actions.commentDelete('review-1', comment)
    })
    expect(result.current.overview.reviews[0].comentarios).toEqual([])

    await act(async () => {
      deletion.resolve({ ok: false, error: noError })
      await pendingDeletion
    })

    expect(result.current.overview.reviews[0].comentarios[0]?.id).toBe('comment-1')
    expect(result.current.section.form.feedback?.tone).toBe('error')
  })

  it('busca mais quatro reviews e bloqueia cliques duplicados durante a requisicao', async () => {
    const initialReviews = [
      createReview('review-1'),
      createReview('review-2'),
      createReview('review-3'),
    ]
    const nextPage = createDeferred<{
      data: ReviewItem[]
      error: null
      totalCount: number
      nextOffset: null
      commentTotals: Record<string, number>
    }>()
    mocks.getGameReviewsPage
      .mockResolvedValueOnce({
        data: initialReviews,
        error: null,
        totalCount: 7,
        nextOffset: 3,
        commentTotals: {},
      })
      .mockReturnValueOnce(nextPage.promise)
    const { result } = renderController()
    await waitFor(() => expect(result.current.section.list.visible).toHaveLength(3))

    let firstRequest!: Promise<void>
    act(() => {
      firstRequest = result.current.section.actions.expandReviews()
      void result.current.section.actions.expandReviews()
    })

    expect(mocks.getGameReviewsPage).toHaveBeenCalledTimes(2)
    expect(mocks.getGameReviewsPage).toHaveBeenLastCalledWith(1, {
      currentUserId: 'viewer',
      limit: 4,
      offset: 3,
      initialCommentsLimit: 2,
    })

    await act(async () => {
      nextPage.resolve({
        data: [
          createReview('review-4'),
          createReview('review-5'),
          createReview('review-6'),
          createReview('review-7'),
        ],
        error: null,
        totalCount: 7,
        nextOffset: null,
        commentTotals: {},
      })
      await firstRequest
    })

    expect(result.current.section.list.visible).toHaveLength(7)
    expect(result.current.section.list.hidden).toBe(0)
  })

  it('ignora uma pagina adicional obsoleta depois da troca de jogo', async () => {
    const stalePage = createDeferred<{
      data: ReviewItem[]
      error: null
      totalCount: number
      nextOffset: null
      commentTotals: Record<string, number>
    }>()
    mocks.getGameReviewsPage.mockImplementation((gameId: number, options: { offset: number }) => {
      if (gameId === 1 && options.offset === 0) {
        return Promise.resolve({
          data: [createReview('game-1-review')],
          error: null,
          totalCount: 2,
          nextOffset: 1,
          commentTotals: {},
        })
      }
      if (gameId === 1) return stalePage.promise
      return Promise.resolve({
        data: [createReview('game-2-review', { jogo_id: 2 })],
        error: null,
        totalCount: 1,
        nextOffset: null,
        commentTotals: {},
      })
    })
    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.section.list.visible[0]?.id).toBe('game-1-review'))

    let pendingPage!: Promise<void>
    act(() => {
      pendingPage = result.current.section.actions.expandReviews()
    })
    rerender({ gameId: 2, currentUserId: 'viewer', locationHash: '' })
    await waitFor(() => expect(result.current.section.list.visible[0]?.id).toBe('game-2-review'))

    await act(async () => {
      stalePage.resolve({
        data: [createReview('stale-page')],
        error: null,
        totalCount: 2,
        nextOffset: null,
        commentTotals: {},
      })
      await pendingPage
    })

    expect(result.current.section.list.visible.map(review => review.id)).toEqual([
      'game-2-review',
    ])
  })

  it('busca mais quatro comentarios e bloqueia cliques duplicados por review', async () => {
    const initialComments = [createComment('comment-1'), createComment('comment-2')]
    const review = createReview('review-1', { comentarios: initialComments })
    const nextPage = createDeferred<{
      data: ReviewComment[]
      error: null
      totalCount: number
      nextOffset: null
    }>()
    mocks.getGameReviewsPage.mockResolvedValueOnce({
      data: [review],
      error: null,
      totalCount: 1,
      nextOffset: null,
      commentTotals: { 'review-1': 6 },
    })
    mocks.getReviewCommentsPage.mockReturnValueOnce(nextPage.promise)
    const { result } = renderController()
    await waitFor(() => expect(result.current.section.list.visible).toHaveLength(1))

    let firstRequest!: Promise<void>
    act(() => {
      firstRequest = result.current.section.actions.expandComments('review-1', 6)
      void result.current.section.actions.expandComments('review-1', 6)
    })

    expect(mocks.getReviewCommentsPage).toHaveBeenCalledTimes(1)
    expect(mocks.getReviewCommentsPage).toHaveBeenCalledWith('review-1', {
      currentUserId: 'viewer',
      limit: 4,
      offset: 2,
    })

    await act(async () => {
      nextPage.resolve({
        data: [
          createComment('comment-3'),
          createComment('comment-4'),
          createComment('comment-5'),
          createComment('comment-6'),
        ],
        error: null,
        totalCount: 6,
        nextOffset: null,
      })
      await firstRequest
    })

    expect(result.current.section.list.visible[0].comentarios).toHaveLength(6)
    expect(result.current.section.list.commentTotals['review-1']).toBe(6)
  })

  it('resolve o deep link por RPC e carrega somente a review e o comentario alvo', async () => {
    const initialReviews = [
      createReview('review-1'),
      createReview('review-2'),
      createReview('review-3'),
    ]
    const anchorReview = createReview('review-4', {
      comentarios: [createComment('comment-1'), createComment('comment-2')],
    })
    const anchorComment = createComment('comment-anchor', { review_id: 'review-4' })
    mocks.getGameReviewsPage
      .mockResolvedValueOnce({
        data: initialReviews,
        error: null,
        totalCount: 5,
        nextOffset: 3,
        commentTotals: {},
      })
      .mockResolvedValueOnce({
        data: [anchorReview],
        error: null,
        totalCount: 5,
        nextOffset: 4,
        commentTotals: { 'review-4': 3 },
      })
    mocks.resolveGameReviewAnchor.mockResolvedValueOnce({
      data: {
        targetType: 'comment',
        reviewId: 'review-4',
        commentId: 'comment-anchor',
        reviewOffset: 3,
        commentOffset: 2,
      },
      error: null,
    })
    mocks.getReviewCommentsPage.mockResolvedValueOnce({
      data: [anchorComment],
      error: null,
      totalCount: 3,
      nextOffset: null,
    })
    const { result } = renderController({
      gameId: 1,
      currentUserId: 'viewer',
      locationHash: '#comment-comment-anchor',
    })

    await waitFor(() => expect(result.current.section.list.visible).toHaveLength(4))
    expect(result.current.section.list.commentCounts['review-4']).toBe(3)
    expect(
      result.current.section.list.visible
        .find(review => review.id === 'review-4')
        ?.comentarios.some(comment => comment.id === 'comment-anchor')
    ).toBe(true)
    expect(mocks.resolveGameReviewAnchor).toHaveBeenCalledWith(1, {
      reviewId: null,
      commentId: 'comment-anchor',
    })
    expect(mocks.getReviewCommentsPage).toHaveBeenCalledWith('review-4', {
      currentUserId: 'viewer',
      limit: 1,
      offset: 2,
    })
  })

  it('atualiza a denuncia ativa e limpa os mapas ao excluir a review', async () => {
    const review = createReview('review-1', { usuario_id: 'viewer' })
    const report = {
      id: 'report-1',
      targetType: 'review' as const,
      reason: 'spam' as const,
      description: null,
      status: 'pending' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    mocks.getGameReviewsPage
      .mockResolvedValueOnce({ data: [review], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mocks.submitContentReport.mockResolvedValueOnce({
      status: 'created',
      data: report,
      error: null,
    })
    const { result } = renderController()
    await waitFor(() => expect(result.current.overview.reviews).toHaveLength(1))

    act(() => result.current.section.actions.openReport('review', 'review-1', 'review-1'))
    await act(async () => {
      await result.current.section.actions.submitReport({ reason: 'spam', description: '' })
    })
    expect(result.current.overview.reviews[0].currentUserReport?.id).toBe('report-1')

    act(() => result.current.section.actions.setCommentText({ 'review-1': 'draft' }))
    await act(async () => {
      await result.current.section.actions.reviewDelete(result.current.overview.reviews[0])
    })

    expect(result.current.overview.reviews).toEqual([])
    expect(result.current.section.list.commentText).toEqual({})
    expect(result.current.section.report.target).toBeNull()
  })
})
