import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityError,
  CommunitySummary,
  ServiceResult,
} from '../../../services/communityService'

const mocks = vi.hoisted(() => ({
  getCommunityById: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  getCommunityById: mocks.getCommunityById,
}))

import { useCommunitySummaryController } from './useCommunitySummaryController'

interface ControllerProps {
  communityId: string | null
  currentUserId: string | null
}

const defaultProps: ControllerProps = {
  communityId: 'community-a',
  currentUserId: 'viewer-a',
}

function createSummary(id: string, name = id): CommunitySummary {
  return {
    id,
    nome: name,
    descricao: null,
    banner_path: null,
    tipo: null,
    jogo_id: null,
    categoria: null,
    regras: null,
    permissao_postagem: 'todos_membros',
    visibilidade: 'publica',
    lider_id: 'leader-a',
    membros_count: 1,
    posts_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    jogo: null,
    lider: null,
    currentUserRole: null,
    currentUserJoinRequestStatus: null,
    canPost: false,
    canViewContent: true,
  }
}

function createResult(
  data: CommunitySummary | null,
  error: CommunityError | null = null
): ServiceResult<CommunitySummary | null> {
  return { data, error }
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
    (props: ControllerProps) => useCommunitySummaryController(props),
    { initialProps }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCommunityById.mockResolvedValue(createResult(createSummary('community-a')))
})

afterEach(cleanup)

describe('useCommunitySummaryController', () => {
  it('mantem loading ate o resumo inicial terminar e preserva os argumentos', async () => {
    const request = createDeferred<ServiceResult<CommunitySummary | null>>()
    mocks.getCommunityById.mockReturnValueOnce(request.promise)
    const { result } = renderController()

    expect(result.current.loading).toBe(true)
    expect(result.current.summary).toBeNull()
    expect(mocks.getCommunityById).toHaveBeenCalledWith('community-a', 'viewer-a')

    await act(async () => {
      request.resolve(createResult(createSummary('community-a', 'Community A')))
      await request.promise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.summary?.nome).toBe('Community A')
    expect(result.current.error).toBeNull()
  })

  it('expoe o erro raw retornado pela fachada', async () => {
    const serviceError = { code: 'TEST', message: 'falha controlada' }
    mocks.getCommunityById.mockResolvedValueOnce(createResult(null, serviceError))
    const { result } = renderController()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toBeNull()
    expect(result.current.error).toEqual(serviceError)
  })

  it('nao consulta a fachada para uma rota invalida', async () => {
    const { result } = renderController({ communityId: '   ', currentUserId: 'viewer-a' })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toBeNull()
    expect(result.current.error).toBeNull()
    expect(mocks.getCommunityById).not.toHaveBeenCalled()
  })

  it('descarta resposta obsoleta ao trocar de comunidade', async () => {
    const staleRequest = createDeferred<ServiceResult<CommunitySummary | null>>()
    mocks.getCommunityById.mockImplementation((communityId: string) => {
      if (communityId === 'community-a') return staleRequest.promise
      return Promise.resolve(createResult(createSummary('community-b', 'Community B')))
    })
    const { result, rerender } = renderController()
    await waitFor(() => expect(mocks.getCommunityById).toHaveBeenCalledTimes(1))

    rerender({ communityId: 'community-b', currentUserId: 'viewer-a' })
    await waitFor(() => expect(result.current.summary?.id).toBe('community-b'))

    await act(async () => {
      staleRequest.resolve(createResult(createSummary('community-a', 'Stale')))
      await staleRequest.promise
    })

    expect(result.current.summary?.id).toBe('community-b')
    expect(result.current.summary?.nome).toBe('Community B')
  })

  it('reseta e recarrega ao trocar o usuario atual', async () => {
    mocks.getCommunityById.mockImplementation((_: string, currentUserId: string) => (
      Promise.resolve(createResult(createSummary('community-a', currentUserId)))
    ))
    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.summary?.nome).toBe('viewer-a'))

    rerender({ communityId: 'community-a', currentUserId: 'viewer-b' })

    await waitFor(() => expect(result.current.summary?.nome).toBe('viewer-b'))
    expect(mocks.getCommunityById).toHaveBeenLastCalledWith('community-a', 'viewer-b')
    expect(mocks.getCommunityById).toHaveBeenCalledTimes(2)
  })

  it('reload refaz a consulta e atualiza o resumo', async () => {
    mocks.getCommunityById
      .mockResolvedValueOnce(createResult(createSummary('community-a', 'Before reload')))
      .mockResolvedValueOnce(createResult(createSummary('community-a', 'After reload')))
    const { result } = renderController()
    await waitFor(() => expect(result.current.summary?.nome).toBe('Before reload'))

    await act(async () => result.current.reload())

    expect(result.current.summary?.nome).toBe('After reload')
    expect(result.current.loading).toBe(false)
    expect(mocks.getCommunityById).toHaveBeenCalledTimes(2)
  })
})
