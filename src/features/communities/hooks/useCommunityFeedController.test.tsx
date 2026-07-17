import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityError,
  CommunityPost,
  CommunityRole,
  PaginatedServiceResult,
} from '../../../services/communityService'

const mocks = vi.hoisted(() => ({
  getCommunityPosts: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  getCommunityPosts: mocks.getCommunityPosts,
}))

import { useCommunityFeedController } from './useCommunityFeedController'

interface ControllerProps {
  communityId: string | null
  currentUserId: string | null
  currentUserRole: CommunityRole | null
  canViewContent: boolean
  page: number
  pageSize: number
}

const defaultProps: ControllerProps = {
  communityId: 'community-a',
  currentUserId: 'viewer-a',
  currentUserRole: 'membro',
  canViewContent: true,
  page: 1,
  pageSize: 8,
}

function createPost(id: string, text = id): CommunityPost {
  return {
    id,
    comunidade_id: 'community-a',
    autor_id: 'author-a',
    texto: text,
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 0,
    dislikes_count: 0,
    comentarios_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    fixado: false,
    fixado_em: null,
    fixado_por: null,
    autor: null,
    comentarios: [],
    currentUserReaction: null,
    savedByCurrentUser: false,
    canInteract: true,
    canDelete: false,
    canPin: false,
  }
}

function createPage(
  data: CommunityPost[] = [],
  totalCount: number | null = data.length,
  error: CommunityError | null = null
): PaginatedServiceResult<CommunityPost[]> {
  return { data, totalCount, error }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function renderController(initialProps: ControllerProps = defaultProps) {
  return renderHook(
    (props: ControllerProps) => useCommunityFeedController(props),
    { initialProps }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCommunityPosts.mockResolvedValue(createPage())
})

afterEach(cleanup)

describe('useCommunityFeedController', () => {
  it('mantem loading ate a pagina inicial terminar e preserva os argumentos', async () => {
    const request = createDeferred<PaginatedServiceResult<CommunityPost[]>>()
    const initialPosts = [createPost('post-a'), createPost('post-b')]
    mocks.getCommunityPosts.mockReturnValueOnce(request.promise)
    const { result } = renderController()

    expect(result.current.loading).toBe(true)
    expect(result.current.posts).toEqual([])
    expect(mocks.getCommunityPosts).toHaveBeenCalledWith(
      'community-a',
      'viewer-a',
      'membro',
      { page: 1, pageSize: 8 }
    )

    await act(async () => {
      request.resolve(createPage(initialPosts, 12))
      await request.promise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.posts).toEqual(initialPosts)
    expect(result.current.totalCount).toBe(12)
    expect(result.current.error).toBeNull()
  })

  it('expoe o erro raw e mantem dados parciais da leitura inicial', async () => {
    const serviceError = { code: 'TEST', message: 'falha controlada' }
    const partialPosts = [createPost('partial-post')]
    mocks.getCommunityPosts.mockResolvedValueOnce(createPage(partialPosts, 1, serviceError))
    const { result } = renderController()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.posts).toEqual(partialPosts)
    expect(result.current.totalCount).toBe(1)
    expect(result.current.error).toEqual(serviceError)
  })

  it('nao consulta nem preserva feed quando o conteudo esta restrito', async () => {
    const { result } = renderController({ ...defaultProps, canViewContent: false })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.posts).toEqual([])
    expect(result.current.totalCount).toBeNull()
    expect(result.current.error).toBeNull()
    expect(mocks.getCommunityPosts).not.toHaveBeenCalled()
  })

  it('descarta resposta obsoleta ao trocar de comunidade', async () => {
    const staleRequest = createDeferred<PaginatedServiceResult<CommunityPost[]>>()
    const currentPosts = [createPost('current-post')]
    mocks.getCommunityPosts.mockImplementation((communityId: string) => {
      if (communityId === 'community-a') return staleRequest.promise
      return Promise.resolve(createPage(currentPosts, 1))
    })
    const { result, rerender } = renderController()
    await waitFor(() => expect(mocks.getCommunityPosts).toHaveBeenCalledTimes(1))

    rerender({ ...defaultProps, communityId: 'community-b' })
    await waitFor(() => expect(result.current.posts).toEqual(currentPosts))

    await act(async () => {
      staleRequest.resolve(createPage([createPost('stale-post')], 1))
      await staleRequest.promise
    })

    expect(result.current.posts).toEqual(currentPosts)
    expect(result.current.totalCount).toBe(1)
  })

  it('reseta e consulta novamente ao trocar pagina ou tamanho da pagina', async () => {
    mocks.getCommunityPosts.mockImplementation(
      (_communityId: string, _userId: string, _role: CommunityRole, options: { page: number }) => (
        Promise.resolve(createPage([createPost(`page-${options.page}`)], 20))
      )
    )
    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.posts[0]?.id).toBe('page-1'))

    rerender({ ...defaultProps, page: 2, pageSize: 4 })

    await waitFor(() => expect(result.current.posts[0]?.id).toBe('page-2'))
    expect(mocks.getCommunityPosts).toHaveBeenLastCalledWith(
      'community-a',
      'viewer-a',
      'membro',
      { page: 2, pageSize: 4 }
    )
    expect(mocks.getCommunityPosts).toHaveBeenCalledTimes(2)
  })

  it('reseta pelo usuario e papel atuais', async () => {
    mocks.getCommunityPosts.mockImplementation(
      (_communityId: string, currentUserId: string, role: CommunityRole) => (
        Promise.resolve(createPage([createPost(`${currentUserId}-${role}`)], 1))
      )
    )
    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.posts[0]?.id).toBe('viewer-a-membro'))

    rerender({
      ...defaultProps,
      currentUserId: 'viewer-b',
      currentUserRole: 'admin',
    })

    await waitFor(() => expect(result.current.posts[0]?.id).toBe('viewer-b-admin'))
    expect(mocks.getCommunityPosts).toHaveBeenLastCalledWith(
      'community-a',
      'viewer-b',
      'admin',
      { page: 1, pageSize: 8 }
    )
    expect(mocks.getCommunityPosts).toHaveBeenCalledTimes(2)
  })

  it('preserva posts e contagem quando um reload falha', async () => {
    const originalPosts = [createPost('original-post')]
    const replacementPosts = [createPost('replacement-post')]
    const reloadError = { message: 'falha no reload' }
    const reloadRequest = createDeferred<PaginatedServiceResult<CommunityPost[]>>()
    mocks.getCommunityPosts
      .mockResolvedValueOnce(createPage(originalPosts, 5))
      .mockReturnValueOnce(reloadRequest.promise)
      .mockResolvedValueOnce(createPage(replacementPosts, 1))
    const { result } = renderController()
    await waitFor(() => expect(result.current.posts).toEqual(originalPosts))

    let reloadPromise: Promise<void> | undefined
    act(() => {
      reloadPromise = result.current.reload()
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.posts).toEqual(originalPosts)

    await act(async () => {
      reloadRequest.resolve(createPage([createPost('error-result')], 99, reloadError))
      await reloadPromise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.posts).toEqual(originalPosts)
    expect(result.current.totalCount).toBe(5)
    expect(result.current.error).toEqual(reloadError)

    await act(async () => result.current.reload())
    expect(result.current.posts).toEqual(replacementPosts)
    expect(result.current.totalCount).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('aplica updates funcionais nomeados sem refazer a consulta', async () => {
    const originalPosts = [createPost('post-a'), createPost('post-b')]
    mocks.getCommunityPosts.mockResolvedValueOnce(createPage(originalPosts, 2))
    const { result } = renderController()
    await waitFor(() => expect(result.current.posts).toEqual(originalPosts))

    act(() => {
      result.current.updatePosts(currentPosts => currentPosts.map(post => (
        post.id === 'post-b'
          ? { ...post, savedByCurrentUser: true, curtidas_count: 3 }
          : post
      )))
    })

    expect(result.current.posts[1]).toMatchObject({
      id: 'post-b',
      savedByCurrentUser: true,
      curtidas_count: 3,
    })
    expect(result.current.totalCount).toBe(2)
    expect(mocks.getCommunityPosts).toHaveBeenCalledTimes(1)
  })
})
