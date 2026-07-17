import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityJoinAction,
  CommunityJoinRequest,
  CommunityMember,
  ServiceResult,
} from '../../../services/communityService'
import type { ConfirmState } from '../domain/communityDetailsTypes'

const mocks = vi.hoisted(() => ({
  approveCommunityJoinRequest: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  rejectCommunityJoinRequest: vi.fn(),
  removeCommunityMember: vi.fn(),
  transferCommunityLeadership: vi.fn(),
  updateCommunityMemberRole: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  approveCommunityJoinRequest: mocks.approveCommunityJoinRequest,
  joinCommunity: mocks.joinCommunity,
  leaveCommunity: mocks.leaveCommunity,
  rejectCommunityJoinRequest: mocks.rejectCommunityJoinRequest,
  removeCommunityMember: mocks.removeCommunityMember,
  transferCommunityLeadership: mocks.transferCommunityLeadership,
  updateCommunityMemberRole: mocks.updateCommunityMemberRole,
}))

import {
  useCommunityMembershipActions,
  type UseCommunityMembershipActionsOptions,
} from './useCommunityMembershipActions'

function createMember(
  userId = 'member-a',
  overrides: Partial<CommunityMember> = {}
): CommunityMember {
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
    ...overrides,
  }
}

function createRequest(
  id = 'request-a',
  overrides: Partial<CommunityJoinRequest> = {}
): CommunityJoinRequest {
  return {
    id,
    comunidade_id: 'community-a',
    usuario_id: 'request-user',
    status: 'pendente',
    decidido_por: null,
    decidido_em: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    usuario: null,
    moderador: null,
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createOptions(
  overrides: Partial<UseCommunityMembershipActionsOptions> = {}
): UseCommunityMembershipActionsOptions {
  return {
    communityId: 'community-a',
    currentUserId: 'viewer-a',
    reloadAll: vi.fn().mockResolvedValue(undefined),
    reloadModeration: vi.fn().mockResolvedValue(undefined),
    publishFeedback: vi.fn(),
    closeConfirmation: vi.fn(),
    t: (key: string) => key,
    ...overrides,
  }
}

function renderController(initialOptions = createOptions()) {
  return renderHook(
    (options: UseCommunityMembershipActionsOptions) => (
      useCommunityMembershipActions(options)
    ),
    { initialProps: initialOptions }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.joinCommunity.mockResolvedValue({ data: 'joined', error: null })
  mocks.approveCommunityJoinRequest.mockResolvedValue({ data: null, error: null })
  mocks.rejectCommunityJoinRequest.mockResolvedValue({ data: null, error: null })
  mocks.leaveCommunity.mockResolvedValue({ data: null, error: null })
  mocks.removeCommunityMember.mockResolvedValue({ data: null, error: null })
  mocks.transferCommunityLeadership.mockResolvedValue({ data: null, error: null })
  mocks.updateCommunityMemberRole.mockResolvedValue({ data: null, error: null })
})

afterEach(cleanup)

describe('useCommunityMembershipActions', () => {
  it('entra na comunidade, publica feedback e preserva a ordem antes do reloadAll', async () => {
    const options = createOptions()
    const { result } = renderController(options)

    await act(async () => result.current.join())

    expect(mocks.joinCommunity).toHaveBeenCalledWith('community-a')
    expect(options.publishFeedback).toHaveBeenCalledWith({
      tone: 'success',
      message: 'communities.joined',
    })
    expect(options.reloadAll).toHaveBeenCalledTimes(1)
    expect(vi.mocked(options.publishFeedback).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(options.reloadAll).mock.invocationCallOrder[0]
    )
    expect(result.current.joining).toBe(false)
  })

  it.each<CommunityJoinAction>(['requested', 'already_pending'])(
    'mantem feedback informativo para resultado %s',
    async joinAction => {
      mocks.joinCommunity.mockResolvedValueOnce({ data: joinAction, error: null })
      const options = createOptions()
      const { result } = renderController(options)

      await act(async () => result.current.join())

      expect(options.publishFeedback).toHaveBeenCalledWith({
        tone: 'info',
        message: 'communities.private.requestSent',
      })
      expect(options.reloadAll).toHaveBeenCalledTimes(1)
    }
  )

  it('mantem o escopo quando a entrada retorna erro', async () => {
    mocks.joinCommunity.mockResolvedValueOnce({
      data: 'joined',
      error: { code: 'TEST', message: 'join failed' },
    })
    const options = createOptions()
    const { result } = renderController(options)

    await act(async () => result.current.join())

    expect(options.publishFeedback).toHaveBeenCalledWith({
      tone: 'error',
      message: 'join failed',
    })
    expect(options.reloadAll).not.toHaveBeenCalled()
    expect(result.current.joining).toBe(false)
  })

  it('aprova com reloadAll e rejeita recarregando apenas a moderacao', async () => {
    const options = createOptions()
    const { result } = renderController(options)
    const approvedRequest = createRequest('approve-request')
    const rejectedRequest = createRequest('reject-request')

    await act(async () => result.current.approveRequest(approvedRequest))
    expect(mocks.approveCommunityJoinRequest).toHaveBeenCalledWith('approve-request')
    expect(options.publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.moderation.requestApproved',
    })
    expect(options.reloadAll).toHaveBeenCalledTimes(1)
    expect(options.reloadModeration).not.toHaveBeenCalled()

    await act(async () => result.current.rejectRequest(rejectedRequest))
    expect(mocks.rejectCommunityJoinRequest).toHaveBeenCalledWith('reject-request')
    expect(options.publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.moderation.requestRejected',
    })
    expect(options.reloadAll).toHaveBeenCalledTimes(1)
    expect(options.reloadModeration).toHaveBeenCalledTimes(1)
    expect(result.current.pendingRequestIds).toEqual([])
  })

  it('publica erro de solicitacao sem executar reload', async () => {
    mocks.approveCommunityJoinRequest.mockResolvedValueOnce({
      data: null,
      error: { message: 'approval failed' },
    })
    mocks.rejectCommunityJoinRequest.mockResolvedValueOnce({
      data: null,
      error: { message: 'rejection failed' },
    })
    const options = createOptions()
    const { result } = renderController(options)

    await act(async () => result.current.approveRequest(createRequest('approve-request')))
    expect(options.publishFeedback).toHaveBeenLastCalledWith({
      tone: 'error',
      message: 'approval failed',
    })

    await act(async () => result.current.rejectRequest(createRequest('reject-request')))
    expect(options.publishFeedback).toHaveBeenLastCalledWith({
      tone: 'error',
      message: 'rejection failed',
    })
    expect(options.reloadAll).not.toHaveBeenCalled()
    expect(options.reloadModeration).not.toHaveBeenCalled()
  })

  it('executa todos os discriminantes de membership e fecha antes do reload', async () => {
    const options = createOptions()
    const { result } = renderController(options)
    const member = createMember()
    const cases: Array<{
      state: ConfirmState
      assertService: () => void
      message: string
    }> = [
      {
        state: { kind: 'leave-community' },
        assertService: () => expect(mocks.leaveCommunity).toHaveBeenLastCalledWith('community-a'),
        message: 'communities.left',
      },
      {
        state: { kind: 'kick-member', member },
        assertService: () => expect(mocks.removeCommunityMember).toHaveBeenLastCalledWith(
          'community-a',
          'member-a'
        ),
        message: 'communities.member.removed',
      },
      {
        state: { kind: 'transfer-leadership', member },
        assertService: () => expect(mocks.transferCommunityLeadership).toHaveBeenLastCalledWith(
          'community-a',
          'member-a'
        ),
        message: 'communities.member.transferred',
      },
      {
        state: { kind: 'promote-member', member },
        assertService: () => expect(mocks.updateCommunityMemberRole).toHaveBeenLastCalledWith(
          'community-a',
          'member-a',
          'admin'
        ),
        message: 'communities.member.promoted',
      },
      {
        state: { kind: 'demote-admin', member: { ...member, cargo: 'admin' } },
        assertService: () => expect(mocks.updateCommunityMemberRole).toHaveBeenLastCalledWith(
          'community-a',
          'member-a',
          'membro'
        ),
        message: 'communities.member.demoted',
      },
    ]

    for (const confirmationCase of cases) {
      let handled = false
      await act(async () => {
        handled = await result.current.executeConfirmation(confirmationCase.state)
      })

      expect(handled).toBe(true)
      confirmationCase.assertService()
      expect(options.publishFeedback).toHaveBeenLastCalledWith({
        tone: 'success',
        message: confirmationCase.message,
      })
    }

    expect(options.closeConfirmation).toHaveBeenCalledTimes(cases.length)
    expect(options.reloadAll).toHaveBeenCalledTimes(cases.length)
    vi.mocked(options.closeConfirmation).mock.invocationCallOrder.forEach((closeOrder, index) => {
      expect(closeOrder).toBeLessThan(
        vi.mocked(options.reloadAll).mock.invocationCallOrder[index]
      )
    })
  })

  it('mantem o modal aberto e nao recarrega quando uma confirmacao falha', async () => {
    mocks.leaveCommunity.mockResolvedValueOnce({
      data: null,
      error: { message: 'leave failed' },
    })
    const options = createOptions()
    const { result } = renderController(options)

    let handled = false
    await act(async () => {
      handled = await result.current.executeConfirmation({ kind: 'leave-community' })
    })

    expect(handled).toBe(true)
    expect(options.publishFeedback).toHaveBeenCalledWith({
      tone: 'error',
      message: 'leave failed',
    })
    expect(options.closeConfirmation).not.toHaveBeenCalled()
    expect(options.reloadAll).not.toHaveBeenCalled()
  })

  it('nao intercepta confirmacoes de outros dominios', async () => {
    const options = createOptions()
    const { result } = renderController(options)

    let deleteHandled = true
    let postingHandled = true
    await act(async () => {
      deleteHandled = await result.current.executeConfirmation({ kind: 'delete-community' })
      postingHandled = await result.current.executeConfirmation({
        kind: 'posting-permission',
        permission: 'somente_admins',
      })
    })

    expect(deleteHandled).toBe(false)
    expect(postingHandled).toBe(false)
    expect(options.publishFeedback).not.toHaveBeenCalled()
    expect(options.closeConfirmation).not.toHaveBeenCalled()
    expect(options.reloadAll).not.toHaveBeenCalled()
  })

  it('bloqueia join, solicitacao e confirmacao duplicados', async () => {
    const joinRequest = createDeferred<ServiceResult<CommunityJoinAction>>()
    const approvalRequest = createDeferred<ServiceResult<null>>()
    const leaveRequest = createDeferred<ServiceResult<null>>()
    mocks.joinCommunity.mockReturnValueOnce(joinRequest.promise)
    mocks.approveCommunityJoinRequest.mockReturnValueOnce(approvalRequest.promise)
    mocks.leaveCommunity.mockReturnValueOnce(leaveRequest.promise)
    const options = createOptions()
    const { result } = renderController(options)
    const request = createRequest()
    let firstJoin!: Promise<void>
    let secondJoin!: Promise<void>
    let firstApproval!: Promise<void>
    let secondApproval!: Promise<void>
    let firstConfirmation!: Promise<boolean>
    let secondConfirmation!: Promise<boolean>

    act(() => {
      firstJoin = result.current.join()
      secondJoin = result.current.join()
      firstApproval = result.current.approveRequest(request)
      secondApproval = result.current.approveRequest(request)
      firstConfirmation = result.current.executeConfirmation({ kind: 'leave-community' })
      secondConfirmation = result.current.executeConfirmation({ kind: 'leave-community' })
    })

    expect(mocks.joinCommunity).toHaveBeenCalledTimes(1)
    expect(mocks.approveCommunityJoinRequest).toHaveBeenCalledTimes(1)
    expect(mocks.leaveCommunity).toHaveBeenCalledTimes(1)
    expect(result.current.joining).toBe(true)
    expect(result.current.pendingRequestIds).toEqual(['request-a'])

    await act(async () => {
      joinRequest.resolve({ data: 'joined', error: null })
      approvalRequest.resolve({ data: null, error: null })
      leaveRequest.resolve({ data: null, error: null })
      await Promise.all([
        firstJoin,
        secondJoin,
        firstApproval,
        secondApproval,
        firstConfirmation,
        secondConfirmation,
      ])
    })

    expect(options.reloadAll).toHaveBeenCalledTimes(3)
  })

  it('ignora respostas obsoletas depois de trocar de comunidade', async () => {
    const joinRequest = createDeferred<ServiceResult<CommunityJoinAction>>()
    mocks.joinCommunity.mockReturnValueOnce(joinRequest.promise)
    const options = createOptions()
    const { result, rerender } = renderController(options)
    let submission!: Promise<void>

    act(() => {
      submission = result.current.join()
    })
    expect(result.current.joining).toBe(true)

    rerender({ ...options, communityId: 'community-b' })
    await waitFor(() => expect(result.current.joining).toBe(false))
    vi.mocked(options.publishFeedback).mockClear()

    await act(async () => {
      joinRequest.resolve({ data: 'joined', error: null })
      await submission
    })

    expect(options.publishFeedback).not.toHaveBeenCalled()
    expect(options.reloadAll).not.toHaveBeenCalled()
  })

  it('nao chama servicos sem comunidade e usuario ativos', async () => {
    const options = createOptions({ communityId: null, currentUserId: null })
    const { result } = renderController(options)

    let handled = false
    await act(async () => {
      await result.current.join()
      await result.current.approveRequest(createRequest())
      await result.current.rejectRequest(createRequest())
      handled = await result.current.executeConfirmation({ kind: 'leave-community' })
    })

    expect(handled).toBe(true)
    expect(mocks.joinCommunity).not.toHaveBeenCalled()
    expect(mocks.approveCommunityJoinRequest).not.toHaveBeenCalled()
    expect(mocks.rejectCommunityJoinRequest).not.toHaveBeenCalled()
    expect(mocks.leaveCommunity).not.toHaveBeenCalled()
    expect(options.publishFeedback).not.toHaveBeenCalled()
    expect(options.reloadAll).not.toHaveBeenCalled()
    expect(options.reloadModeration).not.toHaveBeenCalled()
  })
})
