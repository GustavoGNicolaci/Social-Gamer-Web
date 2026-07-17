import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SetStateAction,
} from 'react'
import {
  getCommunityJoinRequests,
  getCommunityReports,
  type CommunityError,
  type CommunityJoinRequest,
  type CommunityJoinRequestStatus,
  type CommunityReport,
  type CommunityReportStatus,
} from '../../../services/communityService'

export type CommunityRequestFilter = CommunityJoinRequestStatus | 'all'
export type CommunityReportFilter = CommunityReportStatus | 'all'

export interface UseCommunityModerationControllerOptions {
  communityId: string | null
  isModerator: boolean
  requestFilter: CommunityRequestFilter
  reportFilter: CommunityReportFilter
}

export interface CommunityModerationControllerState {
  joinRequests: CommunityJoinRequest[]
  reports: CommunityReport[]
  loading: boolean
  error: CommunityError | null
  reload: () => Promise<void>
  updateJoinRequests: (update: SetStateAction<CommunityJoinRequest[]>) => void
  updateReports: (update: SetStateAction<CommunityReport[]>) => void
}

export function useCommunityModerationController({
  communityId,
  isModerator,
  requestFilter,
  reportFilter,
}: UseCommunityModerationControllerOptions): CommunityModerationControllerState {
  const normalizedCommunityId = communityId?.trim() || null
  const scopeKey = [
    normalizedCommunityId || 'none',
    isModerator ? 'moderator' : 'restricted',
    requestFilter,
    reportFilter,
  ].join(':')

  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([])
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [loading, setLoading] = useState(Boolean(normalizedCommunityId && isModerator))
  const [error, setError] = useState<CommunityError | null>(null)
  const scopeKeyRef = useRef(scopeKey)
  const mountedRef = useRef(false)
  const requestVersionRef = useRef(0)

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey
  }, [scopeKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestVersionRef.current += 1
    }
  }, [])

  const isRequestActive = useCallback((expectedScopeKey: string, requestVersion: number) => (
    mountedRef.current &&
    scopeKeyRef.current === expectedScopeKey &&
    requestVersionRef.current === requestVersion
  ), [])

  const loadModeration = useCallback(async () => {
    if (!normalizedCommunityId || !isModerator) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++requestVersionRef.current
    setLoading(true)
    setError(null)

    const [requestsResult, reportsResult] = await Promise.all([
      getCommunityJoinRequests(normalizedCommunityId, requestFilter),
      getCommunityReports(normalizedCommunityId, { status: reportFilter }),
    ])

    if (!isRequestActive(expectedScopeKey, requestVersion)) return

    setJoinRequests(requestsResult.data)
    setReports(reportsResult.data)
    setError(requestsResult.error || reportsResult.error)
    setLoading(false)
  }, [
    isModerator,
    isRequestActive,
    normalizedCommunityId,
    reportFilter,
    requestFilter,
    scopeKey,
  ])

  useEffect(() => {
    const resetAndLoad = async () => {
      requestVersionRef.current += 1
      setJoinRequests([])
      setReports([])
      setError(null)

      if (!normalizedCommunityId || !isModerator) {
        setLoading(false)
        return
      }

      setLoading(true)
      await loadModeration()
    }

    void resetAndLoad()
  }, [isModerator, loadModeration, normalizedCommunityId, reportFilter, requestFilter])

  const updateJoinRequests = useCallback((update: SetStateAction<CommunityJoinRequest[]>) => {
    setJoinRequests(update)
  }, [])

  const updateReports = useCallback((update: SetStateAction<CommunityReport[]>) => {
    setReports(update)
  }, [])

  return {
    joinRequests,
    reports,
    loading,
    error,
    reload: loadModeration,
    updateJoinRequests,
    updateReports,
  }
}
