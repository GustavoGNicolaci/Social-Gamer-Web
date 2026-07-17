import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunityCommentReadRow, PostRow } from './types'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getCurrentUserRoles: vi.fn(),
  resolveCommunityPostImageUrls: vi.fn(),
}))

vi.mock('../../../supabase-client', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}))

vi.mock('../../../services/storageService', () => ({
  deleteStorageFiles: vi.fn(),
  resolveCommunityPostImageUrls: mocks.resolveCommunityPostImageUrls,
}))

vi.mock('./membership', () => ({
  getCurrentUserRoles: mocks.getCurrentUserRoles,
}))

import {
  getCommunityCommentAnchor,
  getCommunityPostCommentsPage,
  getCommunityPosts,
} from './posts'

const post: PostRow = {
  id: 'post-1',
  comunidade_id: 'community-1',
  autor_id: 'author-1',
  texto: 'Post',
  imagem_path: null,
  curtidas_count: 0,
  dislikes_count: 0,
  comentarios_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  fixado: false,
  fixado_em: null,
  fixado_por: null,
}

const previewComment: CommunityCommentReadRow = {
  post_id: 'post-1',
  id: 'comment-1',
  comunidade_id: 'community-1',
  autor_id: 'commenter-1',
  texto: 'Preview comment',
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  author_username: 'commenter',
  author_name: null,
  author_avatar_path: null,
  total_count: 6,
}

const legacyComment = {
  id: 'comment-legacy',
  post_id: 'post-1',
  comunidade_id: 'community-1',
  autor_id: 'commenter-legacy',
  texto: 'Legacy comment',
  created_at: '2026-01-03T00:00:00.000Z',
  updated_at: '2026-01-03T00:00:00.000Z',
  autor: {
    id: 'commenter-legacy',
    username: 'legacy',
    nome_completo: null,
    avatar_path: null,
  },
}

function createQuery(result: Record<string, unknown>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    then: <TResult1 = Record<string, unknown>, TResult2 = never>(
      onFulfilled?: ((value: Record<string, unknown>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue(result)

  return query
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveCommunityPostImageUrls.mockResolvedValue(new Map())
  mocks.getCurrentUserRoles.mockResolvedValue(new Map([['community-1', 'admin']]))
  mocks.rpc.mockResolvedValue({ data: [], error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'comunidade_posts') {
      return createQuery({ data: [post], error: null, count: 1 })
    }

    return createQuery({ data: [], error: null })
  })
})

describe('getCommunityPosts role resolution', () => {
  it('loads the authenticated user role when the summary did not provide it', async () => {
    const result = await getCommunityPosts('community-1', 'viewer-1', null, {
      page: 1,
      pageSize: 8,
    })

    expect(mocks.getCurrentUserRoles).toHaveBeenCalledWith(['community-1'], 'viewer-1')
    expect(result.error).toBeNull()
    expect(result.data[0]).toMatchObject({ canInteract: true, canPin: true })
  })

  it('reuses a known summary role without issuing another membership query', async () => {
    const result = await getCommunityPosts('community-1', 'viewer-1', 'membro')

    expect(mocks.getCurrentUserRoles).not.toHaveBeenCalled()
    expect(result.data[0]).toMatchObject({ canInteract: true, canPin: false })
  })
})

describe('community comment read models', () => {
  it('loads three previews per post and preserves the authoritative total', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [previewComment], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'comunidade_posts') {
        return createQuery({
          data: [{ ...post, comentarios_count: 99 }],
          error: null,
          count: 1,
        })
      }
      return createQuery({ data: [], error: null })
    })

    const result = await getCommunityPosts('community-1', undefined, 'membro')

    expect(mocks.rpc).toHaveBeenCalledWith('get_community_post_comment_previews', {
      p_post_ids: ['post-1'],
      p_limit_per_post: 3,
    })
    expect(mocks.from).not.toHaveBeenCalledWith('comunidade_post_comentarios')
    expect(result.error).toBeNull()
    expect(result.data[0]).toMatchObject({
      comentarios_count: 6,
      commentsNextOffset: 1,
      comentarios: [expect.objectContaining({ id: 'comment-1', texto: 'Preview comment' })],
    })
  })

  it.each(['PGRST202', '42883'])(
    'uses the legacy collection only when previews RPC is unavailable (%s)',
    async code => {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'missing' } })
      mocks.from.mockImplementation((table: string) => {
        if (table === 'comunidade_posts') {
          return createQuery({ data: [{ ...post, comentarios_count: 1 }], error: null, count: 1 })
        }
        if (table === 'comunidade_post_comentarios') {
          return createQuery({ data: [legacyComment], error: null })
        }
        return createQuery({ data: [], error: null })
      })

      const result = await getCommunityPosts('community-1', undefined, 'membro')

      expect(mocks.from).toHaveBeenCalledWith('comunidade_post_comentarios')
      expect(result.error).toBeNull()
      expect(result.data[0]).toMatchObject({
        comentarios_count: 1,
        commentsNextOffset: 1,
        comentarios: [expect.objectContaining({ id: 'comment-legacy' })],
      })
    }
  )

  it('does not issue a legacy collection for other preview errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX001', message: 'read model failure' },
    })

    const result = await getCommunityPosts('community-1', undefined, 'membro')

    expect(mocks.from).not.toHaveBeenCalledWith('comunidade_post_comentarios')
    expect(result.error).toMatchObject({ code: 'XX001' })
  })

  it('loads a bounded page through the RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ ...previewComment, id: 'comment-4', total_count: 6 }],
      error: null,
    })

    const result = await getCommunityPostCommentsPage('post-1', { limit: 3, offset: 3 })

    expect(mocks.rpc).toHaveBeenCalledWith('get_community_post_comments_page', {
      p_post_id: 'post-1',
      p_limit: 3,
      p_offset: 3,
    })
    expect(result).toMatchObject({
      data: {
        comments: [expect.objectContaining({ id: 'comment-4' })],
        totalCount: 6,
        nextOffset: 4,
      },
      error: null,
    })
  })

  it('keeps page fallback bounded when the RPC is unavailable', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'missing' },
    })
    mocks.from.mockImplementation((table: string) => (
      table === 'comunidade_post_comentarios'
        ? createQuery({ data: [legacyComment], error: null, count: 6 })
        : createQuery({ data: [], error: null })
    ))

    const result = await getCommunityPostCommentsPage('post-1', { limit: 3, offset: 3 })

    const commentQuery = mocks.from.mock.results.find(
      entry => entry.type === 'return'
    )?.value
    expect(commentQuery.range).toHaveBeenCalledWith(3, 5)
    expect(result.data).toMatchObject({ totalCount: 6, nextOffset: 4 })
  })

  it('does not fall back when a page RPC fails for another reason', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'forbidden' },
    })

    const result = await getCommunityPostCommentsPage('post-1', { offset: 3 })

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result.error).toMatchObject({ code: '42501' })
  })

  it('resolves the stable page offset returned for a comment anchor', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ found: true, comment_offset: 7, page_offset: 6, total_count: 10 }],
      error: null,
    })

    const result = await getCommunityCommentAnchor('post-1', 'comment-8', 3)

    expect(mocks.rpc).toHaveBeenCalledWith('get_community_comment_anchor', {
      p_post_id: 'post-1',
      p_comment_id: 'comment-8',
      p_limit: 3,
    })
    expect(result.data).toEqual({
      found: true,
      commentOffset: 7,
      pageOffset: 6,
      totalCount: 10,
    })
  })

  it('uses the legacy anchor scan only while the anchor RPC is unavailable', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'missing' },
    })
    mocks.from.mockReturnValue(createQuery({
      data: ['comment-1', 'comment-2', 'comment-3', 'comment-4'].map(id => ({ id })),
      error: null,
    }))

    const result = await getCommunityCommentAnchor('post-1', 'comment-4', 3)

    expect(mocks.from).toHaveBeenCalledWith('comunidade_post_comentarios')
    expect(result).toEqual({
      data: { found: true, commentOffset: 3, pageOffset: 3, totalCount: 4 },
      error: null,
    })
  })

  it('does not scan legacy comments for another anchor RPC error', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX001', message: 'read model failure' },
    })

    const result = await getCommunityCommentAnchor('post-1', 'comment-4', 3)

    expect(mocks.from).not.toHaveBeenCalled()
    expect(result.error).toMatchObject({ code: 'XX001' })
  })
})
