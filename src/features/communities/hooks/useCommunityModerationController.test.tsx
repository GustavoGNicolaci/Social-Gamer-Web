import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityError,
  CommunityJoinRequest,
  CommunityJoinRequestStatus,
  CommunityReport,
  CommunityReportStatus,
  ServiceResult,
} from '../../../services/communityService'

const mocks = vi.hoisted(() => ({
  getCommunityJoinRequests: vi.fn(),
  getCommunityReports: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  getCommunityJoinRequests: mocks.getCommunityJoinRequests,
  getCommunityReports: mocks.getCommunityReports,
}))

import { useCommunityModerationController } from './useCommunityModerationController'

interface ControllerProps {
  communityId: string | null
  isModerator: boolean
  requestFilter: CommunityJoinRequestStatus | 'all'
  reportFilter: CommunityReportStatus | 'all'
}

const defaultProps: ControllerProps = {
  communityId: 'community-a',
  isModerator: true,
  requestFilter: 'pendente',
  reportFilter: 'all',
}

function createJoinRequest(id: string, communityId = 'community-a'): CommunityJoinRequest {
  return {
    id,
    comunidade_id: communityId,
    usuario_id: `user-${id}`,
    status: 'pendente',
    decidido_por: null,
    decidido_em: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    usuario: null,
    moderador: null,
  }
}

function createReport(id: string, communityId = 'community-a'): CommunityReport {
  return {
    id,
    comunidade_id: communityId,
    denunciante_id: `reporter-${id}`,
    tipo_conteudo: 'post',
    post_id: `post-${id}`,
    comentario_id: null,
    motivo: 'spam',
    descricao: null,
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    denunciante: null,
    targetText: null,
    targetImagePath: null,
    targetAuthor: null,
    targetCreatedAt: null,
  }
}

function createResult<T>(data: T, error: CommunityError | null = null): ServiceResult<T> {
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
    (props: ControllerProps) => useCommunityModerationController(props),
    { initialProps }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCommunityJoinRequests.mockResolvedValue(createResult([]))
  mocks.getCommunityReports.mockResolvedValue(createResult([]))
})

afterEach(cleanup)

describe('useCommunityModerationController', () => {
  it('carrega as duas colecoes em paralelo e encaminha os filtros', async () => {
    const requests = [createJoinRequest('request-a')]
    const reports = [createReport('report-a')]
    const requestsDeferred = createDeferred<ServiceResult<CommunityJoinRequest[]>>()
    const reportsDeferred = createDeferred<ServiceResult<CommunityReport[]>>()
    mocks.getCommunityJoinRequests.mockReturnValueOnce(requestsDeferred.promise)
    mocks.getCommunityReports.mockReturnValueOnce(reportsDeferred.promise)

    const { result } = renderController({
      ...defaultProps,
      requestFilter: 'all',
      reportFilter: 'under_review',
    })

    await waitFor(() => {
      expect(mocks.getCommunityJoinRequests).toHaveBeenCalledWith('community-a', 'all')
      expect(mocks.getCommunityReports).toHaveBeenCalledWith('community-a', {
        status: 'under_review',
      })
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      requestsDeferred.resolve(createResult(requests))
      await requestsDeferred.promise
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      reportsDeferred.resolve(createResult(reports))
      await reportsDeferred.promise
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.joinRequests).toEqual(requests)
    expect(result.current.reports).toEqual(reports)
    expect(result.current.error).toBeNull()
  })

  it('nao consulta sem permissao e reseta dados ao perder a moderacao', async () => {
    const request = createJoinRequest('visible-request')
    const report = createReport('visible-report')
    mocks.getCommunityJoinRequests.mockResolvedValueOnce(createResult([request]))
    mocks.getCommunityReports.mockResolvedValueOnce(createResult([report]))

    const { result, rerender } = renderController()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.joinRequests).toEqual([request])
    expect(result.current.reports).toEqual([report])

    rerender({ ...defaultProps, isModerator: false })

    await waitFor(() => {
      expect(result.current.joinRequests).toEqual([])
      expect(result.current.reports).toEqual([])
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mocks.getCommunityJoinRequests).toHaveBeenCalledTimes(1)
    expect(mocks.getCommunityReports).toHaveBeenCalledTimes(1)

    const restricted = renderController({ ...defaultProps, isModerator: false })
    expect(restricted.result.current.loading).toBe(false)
    expect(mocks.getCommunityJoinRequests).toHaveBeenCalledTimes(1)
    expect(mocks.getCommunityReports).toHaveBeenCalledTimes(1)
  })

  it('preserva o resultado parcial e expoe o erro bruto prioritario', async () => {
    const requestError = { code: 'REQUEST_ERROR', message: 'request failed' }
    const report = createReport('available-report')
    mocks.getCommunityJoinRequests.mockResolvedValueOnce(createResult([], requestError))
    mocks.getCommunityReports.mockResolvedValueOnce(createResult([report]))

    const { result } = renderController()
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.joinRequests).toEqual([])
    expect(result.current.reports).toEqual([report])
    expect(result.current.error).toBe(requestError)
  })

  it('ignora respostas obsoletas ao trocar de comunidade', async () => {
    const staleRequests = createDeferred<ServiceResult<CommunityJoinRequest[]>>()
    const staleReports = createDeferred<ServiceResult<CommunityReport[]>>()
    const currentRequest = createJoinRequest('current-request', 'community-b')
    const currentReport = createReport('current-report', 'community-b')
    mocks.getCommunityJoinRequests.mockImplementation((communityId: string) => (
      communityId === 'community-a'
        ? staleRequests.promise
        : Promise.resolve(createResult([currentRequest]))
    ))
    mocks.getCommunityReports.mockImplementation((communityId: string) => (
      communityId === 'community-a'
        ? staleReports.promise
        : Promise.resolve(createResult([currentReport]))
    ))

    const { result, rerender } = renderController()
    await waitFor(() => expect(mocks.getCommunityReports).toHaveBeenCalledTimes(1))

    rerender({ ...defaultProps, communityId: 'community-b' })
    await waitFor(() => expect(result.current.joinRequests).toEqual([currentRequest]))
    expect(result.current.reports).toEqual([currentReport])

    await act(async () => {
      staleRequests.resolve(createResult([createJoinRequest('stale-request')]))
      staleReports.resolve(createResult([createReport('stale-report')]))
      await Promise.all([staleRequests.promise, staleReports.promise])
    })

    expect(result.current.joinRequests).toEqual([currentRequest])
    expect(result.current.reports).toEqual([currentReport])
  })

  it('ignora respostas obsoletas ao trocar os filtros', async () => {
    const staleRequests = createDeferred<ServiceResult<CommunityJoinRequest[]>>()
    const staleReports = createDeferred<ServiceResult<CommunityReport[]>>()
    const filteredRequest = createJoinRequest('filtered-request')
    const filteredReport = createReport('filtered-report')
    mocks.getCommunityJoinRequests
      .mockReturnValueOnce(staleRequests.promise)
      .mockResolvedValueOnce(createResult([filteredRequest]))
    mocks.getCommunityReports
      .mockReturnValueOnce(staleReports.promise)
      .mockResolvedValueOnce(createResult([filteredReport]))

    const { result, rerender } = renderController()
    await waitFor(() => expect(mocks.getCommunityReports).toHaveBeenCalledTimes(1))

    rerender({
      ...defaultProps,
      requestFilter: 'all',
      reportFilter: 'resolved',
    })
    await waitFor(() => expect(result.current.joinRequests).toEqual([filteredRequest]))
    expect(result.current.reports).toEqual([filteredReport])

    await act(async () => {
      staleRequests.resolve(createResult([createJoinRequest('stale-request')]))
      staleReports.resolve(createResult([createReport('stale-report')]))
      await Promise.all([staleRequests.promise, staleReports.promise])
    })

    expect(result.current.joinRequests).toEqual([filteredRequest])
    expect(result.current.reports).toEqual([filteredReport])
  })

  it('reload refaz as duas consultas e substitui o estado atual', async () => {
    const originalRequest = createJoinRequest('original-request')
    const originalReport = createReport('original-report')
    const replacementRequest = createJoinRequest('replacement-request')
    const replacementReport = createReport('replacement-report')
    mocks.getCommunityJoinRequests
      .mockResolvedValueOnce(createResult([originalRequest]))
      .mockResolvedValueOnce(createResult([replacementRequest]))
    mocks.getCommunityReports
      .mockResolvedValueOnce(createResult([originalReport]))
      .mockResolvedValueOnce(createResult([replacementReport]))

    const { result } = renderController()
    await waitFor(() => expect(result.current.joinRequests).toEqual([originalRequest]))

    await act(async () => result.current.reload())

    expect(result.current.joinRequests).toEqual([replacementRequest])
    expect(result.current.reports).toEqual([replacementReport])
    expect(mocks.getCommunityJoinRequests).toHaveBeenCalledTimes(2)
    expect(mocks.getCommunityReports).toHaveBeenCalledTimes(2)
  })

  it('permite atualizacoes diretas e funcionais das duas colecoes', async () => {
    const request = createJoinRequest('manual-request')
    const report = createReport('manual-report')
    const { result } = renderController()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.updateJoinRequests([request])
      result.current.updateReports(currentReports => [...currentReports, report])
    })

    expect(result.current.joinRequests).toEqual([request])
    expect(result.current.reports).toEqual([report])
  })
})
