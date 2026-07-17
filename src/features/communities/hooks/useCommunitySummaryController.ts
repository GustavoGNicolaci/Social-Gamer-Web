import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  getCommunityById,
  type CommunityError,
  type CommunitySummary,
} from '../../../services/communityService'

export interface UseCommunitySummaryControllerOptions {
  communityId: string | null
  currentUserId: string | null
}

export interface CommunitySummaryControllerState {
  summary: CommunitySummary | null
  loading: boolean
  error: CommunityError | null
  reload: () => Promise<void>
}

export function useCommunitySummaryController({
  communityId,
  currentUserId,
}: UseCommunitySummaryControllerOptions): CommunitySummaryControllerState {
  const normalizedCommunityId = communityId?.trim() || null
  const scopeKey = `${normalizedCommunityId || 'none'}:${currentUserId || 'anonymous'}`
  const [summary, setSummary] = useState<CommunitySummary | null>(null)
  const [loading, setLoading] = useState(Boolean(normalizedCommunityId))
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

  const loadSummary = useCallback(async () => {
    if (!normalizedCommunityId) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++requestVersionRef.current
    setLoading(true)
    setError(null)

    const result = await getCommunityById(normalizedCommunityId, currentUserId)

    if (!isRequestActive(expectedScopeKey, requestVersion)) return

    setSummary(result.data)
    setError(result.error)
    setLoading(false)
  }, [currentUserId, isRequestActive, normalizedCommunityId, scopeKey])

  useEffect(() => {
    const resetAndLoad = async () => {
      requestVersionRef.current += 1
      setSummary(null)
      setError(null)

      if (!normalizedCommunityId) {
        setLoading(false)
        return
      }

      setLoading(true)
      await loadSummary()
    }

    void resetAndLoad()
  }, [currentUserId, loadSummary, normalizedCommunityId])

  return {
    summary,
    loading,
    error,
    reload: loadSummary,
  }
}
