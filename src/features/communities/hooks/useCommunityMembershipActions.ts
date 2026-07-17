import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  approveCommunityJoinRequest,
  joinCommunity,
  leaveCommunity,
  rejectCommunityJoinRequest,
  removeCommunityMember,
  transferCommunityLeadership,
  updateCommunityMemberRole,
  type CommunityJoinRequest,
} from '../../../services/communityService'
import type {
  ConfirmState,
  FeedbackState,
  Translate,
} from '../domain/communityDetailsTypes'

export type CommunityMembershipConfirmState = Extract<
  ConfirmState,
  | { kind: 'leave-community' }
  | { kind: 'kick-member' }
  | { kind: 'transfer-leadership' }
  | { kind: 'promote-member' }
  | { kind: 'demote-admin' }
>

export interface UseCommunityMembershipActionsOptions {
  communityId: string | null
  currentUserId: string | null
  reloadAll: () => Promise<void>
  reloadModeration: () => Promise<void>
  publishFeedback: (feedback: FeedbackState) => void
  closeConfirmation: () => void
  t: Translate
}

export interface CommunityMembershipActionsController {
  joining: boolean
  pendingRequestIds: readonly string[]
  join: () => Promise<void>
  approveRequest: (request: CommunityJoinRequest) => Promise<void>
  rejectRequest: (request: CommunityJoinRequest) => Promise<void>
  executeConfirmation: (state: ConfirmState) => Promise<boolean>
}

function isMembershipConfirmState(
  state: ConfirmState
): state is CommunityMembershipConfirmState {
  return state.kind === 'leave-community' ||
    state.kind === 'kick-member' ||
    state.kind === 'transfer-leadership' ||
    state.kind === 'promote-member' ||
    state.kind === 'demote-admin'
}

function getUnexpectedErrorMessage(error: unknown, t: Translate) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return t('communities.actionError')
}

export function useCommunityMembershipActions({
  communityId,
  currentUserId,
  reloadAll,
  reloadModeration,
  publishFeedback,
  closeConfirmation,
  t,
}: UseCommunityMembershipActionsOptions): CommunityMembershipActionsController {
  const [joining, setJoining] = useState(false)
  const [pendingRequestIds, setPendingRequestIds] = useState<string[]>([])
  const scopeKey = `${communityId || 'none'}:${currentUserId || 'anonymous'}`
  const scopeKeyRef = useRef(scopeKey)
  const stateScopeKeyRef = useRef(scopeKey)
  const scopeVersionRef = useRef(0)
  const mountedRef = useRef(false)
  const joinInFlightRef = useRef(false)
  const confirmationInFlightRef = useRef(false)
  const pendingRequestIdsRef = useRef(new Set<string>())

  useLayoutEffect(() => {
    if (scopeKeyRef.current !== scopeKey) {
      scopeVersionRef.current += 1
      joinInFlightRef.current = false
      confirmationInFlightRef.current = false
      pendingRequestIdsRef.current.clear()
    }

    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    const requestIdsInScope = pendingRequestIdsRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      scopeVersionRef.current += 1
      joinInFlightRef.current = false
      confirmationInFlightRef.current = false
      requestIdsInScope.clear()
    }
  }, [])

  useEffect(() => {
    if (stateScopeKeyRef.current === scopeKey) return
    stateScopeKeyRef.current = scopeKey

    const timeoutId = window.setTimeout(() => {
      setJoining(false)
      setPendingRequestIds([])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [scopeKey])

  const isScopeActive = useCallback((expectedScopeKey: string, scopeVersion: number) => (
    mountedRef.current &&
    scopeKeyRef.current === expectedScopeKey &&
    scopeVersionRef.current === scopeVersion
  ), [])

  const join = useCallback(async () => {
    if (!communityId || !currentUserId || joinInFlightRef.current) return

    const expectedScopeKey = scopeKey
    const scopeVersion = scopeVersionRef.current
    joinInFlightRef.current = true
    setJoining(true)

    try {
      const result = await joinCommunity(communityId)
      if (!isScopeActive(expectedScopeKey, scopeVersion)) return

      if (result.error) {
        publishFeedback({ tone: 'error', message: result.error.message })
        return
      }

      const requestPending = result.data === 'requested' || result.data === 'already_pending'
      publishFeedback({
        tone: requestPending ? 'info' : 'success',
        message: requestPending
          ? t('communities.private.requestSent')
          : t('communities.joined'),
      })
      await reloadAll()
    } finally {
      if (isScopeActive(expectedScopeKey, scopeVersion)) {
        joinInFlightRef.current = false
        setJoining(false)
      }
    }
  }, [communityId, currentUserId, isScopeActive, publishFeedback, reloadAll, scopeKey, t])

  const runRequestAction = useCallback(async (
    request: CommunityJoinRequest,
    action: 'approve' | 'reject'
  ) => {
    if (
      !communityId ||
      !currentUserId ||
      request.comunidade_id !== communityId ||
      pendingRequestIdsRef.current.has(request.id)
    ) return

    const expectedScopeKey = scopeKey
    const scopeVersion = scopeVersionRef.current
    pendingRequestIdsRef.current.add(request.id)
    setPendingRequestIds(currentIds => [...currentIds, request.id])

    try {
      const result = action === 'approve'
        ? await approveCommunityJoinRequest(request.id)
        : await rejectCommunityJoinRequest(request.id)

      if (!isScopeActive(expectedScopeKey, scopeVersion)) return

      if (result.error) {
        publishFeedback({ tone: 'error', message: result.error.message })
        return
      }

      publishFeedback({
        tone: 'success',
        message: action === 'approve'
          ? t('communities.moderation.requestApproved')
          : t('communities.moderation.requestRejected'),
      })

      if (action === 'approve') {
        await reloadAll()
      } else {
        await reloadModeration()
      }
    } finally {
      if (isScopeActive(expectedScopeKey, scopeVersion)) {
        pendingRequestIdsRef.current.delete(request.id)
        setPendingRequestIds(currentIds => currentIds.filter(id => id !== request.id))
      }
    }
  }, [
    communityId,
    currentUserId,
    isScopeActive,
    publishFeedback,
    reloadAll,
    reloadModeration,
    scopeKey,
    t,
  ])

  const approveRequest = useCallback(async (request: CommunityJoinRequest) => {
    await runRequestAction(request, 'approve')
  }, [runRequestAction])

  const rejectRequest = useCallback(async (request: CommunityJoinRequest) => {
    await runRequestAction(request, 'reject')
  }, [runRequestAction])

  const executeConfirmation = useCallback(async (state: ConfirmState) => {
    if (!isMembershipConfirmState(state)) return false
    if (!communityId || !currentUserId || confirmationInFlightRef.current) return true
    if ('member' in state && state.member.comunidade_id !== communityId) return true

    const expectedScopeKey = scopeKey
    const scopeVersion = scopeVersionRef.current
    confirmationInFlightRef.current = true

    try {
      const result = state.kind === 'leave-community'
        ? await leaveCommunity(communityId)
        : state.kind === 'kick-member'
          ? await removeCommunityMember(communityId, state.member.usuario_id)
          : state.kind === 'transfer-leadership'
            ? await transferCommunityLeadership(communityId, state.member.usuario_id)
            : await updateCommunityMemberRole(
                communityId,
                state.member.usuario_id,
                state.kind === 'promote-member' ? 'admin' : 'membro'
              )

      if (!isScopeActive(expectedScopeKey, scopeVersion)) return true

      if (result.error) {
        publishFeedback({ tone: 'error', message: result.error.message })
        return true
      }

      const successMessage = state.kind === 'leave-community'
        ? t('communities.left')
        : state.kind === 'kick-member'
          ? t('communities.member.removed')
          : state.kind === 'transfer-leadership'
            ? t('communities.member.transferred')
            : state.kind === 'promote-member'
              ? t('communities.member.promoted')
              : t('communities.member.demoted')

      publishFeedback({ tone: 'success', message: successMessage })
      closeConfirmation()
      await reloadAll()
      return true
    } catch (error) {
      if (isScopeActive(expectedScopeKey, scopeVersion)) {
        publishFeedback({
          tone: 'error',
          message: getUnexpectedErrorMessage(error, t),
        })
      }
      return true
    } finally {
      if (isScopeActive(expectedScopeKey, scopeVersion)) {
        confirmationInFlightRef.current = false
      }
    }
  }, [
    closeConfirmation,
    communityId,
    currentUserId,
    isScopeActive,
    publishFeedback,
    reloadAll,
    scopeKey,
    t,
  ])

  return {
    joining,
    pendingRequestIds,
    join,
    approveRequest,
    rejectRequest,
    executeConfirmation,
  }
}
