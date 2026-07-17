import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  getCommunityMembers,
  type CommunityError,
  type CommunityMember,
} from '../../../services/communityService'

export const COMMUNITY_MEMBERS_PAGE_SIZE = 24

export type CommunityMembersLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type CommunityMembersRequestMode = 'initial' | 'loadMore' | 'reload'

interface FailedCommunityMembersRequest {
  mode: CommunityMembersRequestMode
  offset: number
}

export interface UseCommunityMembersControllerOptions {
  communityId: string | null
  currentUserId: string | null
  canViewContent: boolean
  search: string
}

export interface CommunityMembersControllerState {
  members: CommunityMember[]
  totalCount: number | null
  status: CommunityMembersLoadStatus
  error: CommunityError | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  canLoadMore: boolean
  loadMore: () => Promise<void>
  reload: () => Promise<void>
  retry: () => Promise<void>
}

function mergeMembersByUserId(
  currentMembers: CommunityMember[],
  incomingMembers: CommunityMember[]
) {
  const seenUserIds = new Set<string>()
  const mergedMembers: CommunityMember[] = []

  for (const member of [...currentMembers, ...incomingMembers]) {
    if (seenUserIds.has(member.usuario_id)) continue
    seenUserIds.add(member.usuario_id)
    mergedMembers.push(member)
  }

  return mergedMembers
}

export function useCommunityMembersController({
  communityId,
  currentUserId,
  canViewContent,
  search,
}: UseCommunityMembersControllerOptions): CommunityMembersControllerState {
  const normalizedSearch = search.trim()
  const scopeKey = [
    communityId || 'none',
    currentUserId || 'anonymous',
    canViewContent ? 'visible' : 'restricted',
    normalizedSearch,
  ].join(':')

  const [members, setMembers] = useState<CommunityMember[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [status, setStatus] = useState<CommunityMembersLoadStatus>('idle')
  const [error, setError] = useState<CommunityError | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const scopeKeyRef = useRef(scopeKey)
  const mountedRef = useRef(false)
  const requestVersionRef = useRef(0)
  const requestInFlightRef = useRef(false)
  const membersRef = useRef<CommunityMember[]>([])
  const nextOffsetRef = useRef(0)
  const hasMoreRef = useRef(false)
  const failedRequestRef = useRef<FailedCommunityMembersRequest | null>(null)

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestVersionRef.current += 1
      requestInFlightRef.current = false
    }
  }, [])

  const isRequestActive = useCallback((expectedScopeKey: string, requestVersion: number) => (
    mountedRef.current &&
    scopeKeyRef.current === expectedScopeKey &&
    requestVersionRef.current === requestVersion
  ), [])

  const requestPage = useCallback(async (
    offset: number,
    mode: CommunityMembersRequestMode
  ) => {
    if (!communityId || !canViewContent || requestInFlightRef.current) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++requestVersionRef.current
    requestInFlightRef.current = true
    failedRequestRef.current = null
    setError(null)

    if (mode === 'loadMore') {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setStatus('loading')
    }

    const result = await getCommunityMembers(communityId, {
      search: normalizedSearch,
      limit: COMMUNITY_MEMBERS_PAGE_SIZE,
      offset,
    })

    if (!isRequestActive(expectedScopeKey, requestVersion)) return

    requestInFlightRef.current = false
    setLoading(false)
    setLoadingMore(false)

    if (result.error) {
      failedRequestRef.current = { mode, offset }
      setError(result.error)
      setStatus('error')
      return
    }

    const nextMembers = mode === 'loadMore'
      ? mergeMembersByUserId(membersRef.current, result.data)
      : mergeMembersByUserId([], result.data)
    const nextOffset = offset + result.data.length
    const nextHasMore = result.totalCount !== null
      ? nextOffset < result.totalCount
      : result.data.length === COMMUNITY_MEMBERS_PAGE_SIZE

    membersRef.current = nextMembers
    nextOffsetRef.current = nextOffset
    hasMoreRef.current = nextHasMore
    failedRequestRef.current = null
    setMembers(nextMembers)
    setTotalCount(result.totalCount)
    setHasMore(nextHasMore)
    setStatus('ready')
  }, [canViewContent, communityId, isRequestActive, normalizedSearch, scopeKey])

  useEffect(() => {
    const resetAndLoad = async () => {
      requestVersionRef.current += 1
      requestInFlightRef.current = false
      membersRef.current = []
      nextOffsetRef.current = 0
      hasMoreRef.current = false
      failedRequestRef.current = null
      setMembers([])
      setTotalCount(null)
      setError(null)
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      setStatus(communityId && canViewContent ? 'loading' : 'idle')

      if (!communityId || !canViewContent) return
      await requestPage(0, 'initial')
    }

    void resetAndLoad()
  }, [canViewContent, communityId, currentUserId, normalizedSearch, requestPage])

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || requestInFlightRef.current) return
    await requestPage(nextOffsetRef.current, 'loadMore')
  }, [requestPage])

  const reload = useCallback(async () => {
    if (requestInFlightRef.current) return
    await requestPage(0, 'reload')
  }, [requestPage])

  const retry = useCallback(async () => {
    if (requestInFlightRef.current || !failedRequestRef.current) return
    const failedRequest = failedRequestRef.current
    await requestPage(failedRequest.offset, failedRequest.mode)
  }, [requestPage])

  return {
    members,
    totalCount,
    status,
    error,
    loading,
    loadingMore,
    hasMore,
    canLoadMore: Boolean(
      communityId &&
      canViewContent &&
      hasMore &&
      !loading &&
      !loadingMore
    ),
    loadMore,
    reload,
    retry,
  }
}
