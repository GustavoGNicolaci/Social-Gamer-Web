import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityError,
  CommunityMember,
  PaginatedServiceResult,
} from '../../../services/communityService'

const mocks = vi.hoisted(() => ({
  getCommunityMembers: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  getCommunityMembers: mocks.getCommunityMembers,
}))

import {
  COMMUNITY_MEMBERS_PAGE_SIZE,
  useCommunityMembersController,
} from './useCommunityMembersController'

interface ControllerProps {
  communityId: string | null
  currentUserId: string | null
  canViewContent: boolean
  search: string
}

const defaultProps: ControllerProps = {
  communityId: 'community-a',
  currentUserId: 'viewer-a',
  canViewContent: true,
  search: '',
}

function createMember(userId: string): CommunityMember {
  return {
    comunidade_id: 'community-a',
    usuario_id: userId,
    cargo: 'membro',
    entrou_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    usuario: {
      id: userId,
      username: userId,
      nome_completo: null,
      avatar_path: null,
    },
  }
}

function createPage(
  data: CommunityMember[] = [],
  totalCount: number | null = data.length,
  error: CommunityError | null = null
): PaginatedServiceResult<CommunityMember[]> {
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
    (props: ControllerProps) => useCommunityMembersController(props),
    { initialProps }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCommunityMembers.mockResolvedValue(createPage())
})

afterEach(cleanup)

describe('useCommunityMembersController', () => {
  it('carrega somente a primeira pagina de 24 membros e nao faz pre-busca', async () => {
    const firstPage = Array.from(
      { length: COMMUNITY_MEMBERS_PAGE_SIZE },
      (_, index) => createMember(`user-${index + 1}`)
    )
    mocks.getCommunityMembers.mockResolvedValueOnce(createPage(firstPage, 40))

    const { result } = renderController({ ...defaultProps, search: '  player  ' })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(1)
    expect(mocks.getCommunityMembers).toHaveBeenCalledWith('community-a', {
      search: 'player',
      limit: 24,
      offset: 0,
    })
    expect(result.current.members).toEqual(firstPage)
    expect(result.current.totalCount).toBe(40)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.canLoadMore).toBe(true)
  })

  it('avanca o offset, remove duplicados e preserva a ordem recebida', async () => {
    const firstPage = Array.from(
      { length: COMMUNITY_MEMBERS_PAGE_SIZE },
      (_, index) => createMember(`user-${index + 1}`)
    )
    const nextPage = [
      createMember('user-24'),
      createMember('user-25'),
      createMember('user-26'),
    ]
    mocks.getCommunityMembers
      .mockResolvedValueOnce(createPage(firstPage, 26))
      .mockResolvedValueOnce(createPage(nextPage, 26))

    const { result } = renderController()
    await waitFor(() => expect(result.current.canLoadMore).toBe(true))

    await act(async () => result.current.loadMore())

    expect(mocks.getCommunityMembers).toHaveBeenLastCalledWith('community-a', {
      search: '',
      limit: 24,
      offset: 24,
    })
    expect(result.current.members.map(member => member.usuario_id)).toEqual([
      ...firstPage.map(member => member.usuario_id),
      'user-25',
      'user-26',
    ])
    expect(result.current.hasMore).toBe(false)
  })

  it('preserva itens e offset quando load-more falha e permite retry', async () => {
    const firstPage = Array.from(
      { length: COMMUNITY_MEMBERS_PAGE_SIZE },
      (_, index) => createMember(`user-${index + 1}`)
    )
    const loadMoreError = { code: 'TEST', message: 'falha ao carregar mais' }
    mocks.getCommunityMembers
      .mockResolvedValueOnce(createPage(firstPage, 25))
      .mockResolvedValueOnce(createPage([], null, loadMoreError))
      .mockResolvedValueOnce(createPage([createMember('user-25')], 25))

    const { result } = renderController()
    await waitFor(() => expect(result.current.canLoadMore).toBe(true))

    await act(async () => result.current.loadMore())
    expect(result.current.members).toEqual(firstPage)
    expect(result.current.totalCount).toBe(25)
    expect(result.current.error).toEqual(loadMoreError)
    expect(result.current.status).toBe('error')

    await act(async () => result.current.retry())
    expect(mocks.getCommunityMembers).toHaveBeenLastCalledWith('community-a', {
      search: '',
      limit: 24,
      offset: 24,
    })
    expect(result.current.members.map(member => member.usuario_id)).toEqual([
      ...firstPage.map(member => member.usuario_id),
      'user-25',
    ])
    expect(result.current.error).toBeNull()
  })

  it('ignora resposta obsoleta ao trocar de comunidade', async () => {
    const staleRequest = createDeferred<PaginatedServiceResult<CommunityMember[]>>()
    const currentMember = createMember('current-user')
    mocks.getCommunityMembers.mockImplementation((communityId: string) => {
      if (communityId === 'community-a') return staleRequest.promise
      return Promise.resolve(createPage([currentMember], 1))
    })

    const { result, rerender } = renderController()
    await waitFor(() => expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(1))

    rerender({ ...defaultProps, communityId: 'community-b' })
    await waitFor(() => expect(result.current.members).toEqual([currentMember]))

    await act(async () => {
      staleRequest.resolve(createPage([createMember('stale-user')], 1))
      await staleRequest.promise
    })

    expect(result.current.members).toEqual([currentMember])
    expect(result.current.totalCount).toBe(1)
  })

  it('reseta ao perder permissao e recarrega ao recuperar acesso', async () => {
    mocks.getCommunityMembers
      .mockResolvedValueOnce(createPage([createMember('visible-user')], 1))
      .mockResolvedValueOnce(createPage([createMember('visible-again')], 1))
    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.members).toHaveLength(1))

    rerender({ ...defaultProps, canViewContent: false })
    await waitFor(() => expect(result.current.status).toBe('idle'))
    expect(result.current.members).toEqual([])
    expect(result.current.totalCount).toBeNull()
    expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(1)

    rerender(defaultProps)
    await waitFor(() => expect(result.current.members[0]?.usuario_id).toBe('visible-again'))
    expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(2)
  })

  it('reseta por busca e usuario e descarta a busca anterior pendente', async () => {
    const staleSearch = createDeferred<PaginatedServiceResult<CommunityMember[]>>()
    mocks.getCommunityMembers
      .mockReturnValueOnce(staleSearch.promise)
      .mockResolvedValueOnce(createPage([createMember('searched-user')], 1))
      .mockResolvedValueOnce(createPage([createMember('other-viewer-result')], 1))

    const { result, rerender } = renderController({ ...defaultProps, search: 'old' })
    await waitFor(() => expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(1))

    rerender({ ...defaultProps, search: 'new' })
    await waitFor(() => expect(result.current.members[0]?.usuario_id).toBe('searched-user'))

    await act(async () => {
      staleSearch.resolve(createPage([createMember('stale-search')], 1))
      await staleSearch.promise
    })
    expect(result.current.members[0]?.usuario_id).toBe('searched-user')

    rerender({ ...defaultProps, currentUserId: 'viewer-b', search: 'new' })
    await waitFor(() => expect(result.current.members[0]?.usuario_id).toBe('other-viewer-result'))
    expect(mocks.getCommunityMembers).toHaveBeenCalledTimes(3)
  })

  it('reload consulta o offset zero e retry preserva os itens se ele falhar', async () => {
    const original = createMember('original-user')
    const replacement = createMember('replacement-user')
    const reloadError = { message: 'falha no reload' }
    mocks.getCommunityMembers
      .mockResolvedValueOnce(createPage([original], 1))
      .mockResolvedValueOnce(createPage([], null, reloadError))
      .mockResolvedValueOnce(createPage([replacement], 1))

    const { result } = renderController()
    await waitFor(() => expect(result.current.members).toEqual([original]))

    await act(async () => result.current.reload())
    expect(result.current.members).toEqual([original])
    expect(result.current.error).toEqual(reloadError)

    await act(async () => result.current.retry())
    expect(mocks.getCommunityMembers).toHaveBeenLastCalledWith('community-a', {
      search: '',
      limit: 24,
      offset: 0,
    })
    expect(result.current.members).toEqual([replacement])
    expect(result.current.status).toBe('ready')
  })
})
