import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  getCommunityPosts,
  type CommunityError,
  type CommunityPost,
  type CommunityRole,
} from '../../../services/communityService'

export interface UseCommunityFeedControllerOptions {
  communityId: string | null
  currentUserId: string | null
  currentUserRole: CommunityRole | null
  canViewContent: boolean
  page: number
  pageSize: number
}

export type CommunityPostsUpdater = (
  currentPosts: CommunityPost[]
) => CommunityPost[]

export interface CommunityFeedControllerState {
  posts: CommunityPost[]
  totalCount: number | null
  loading: boolean
  error: CommunityError | null
  reload: () => Promise<void>
  updatePosts: (updater: CommunityPostsUpdater) => void
}

type CommunityFeedRequestMode = 'initial' | 'reload'

export function useCommunityFeedController({
  communityId,
  currentUserId,
  currentUserRole,
  canViewContent,
  page,
  pageSize,
}: UseCommunityFeedControllerOptions): CommunityFeedControllerState {
  const normalizedCommunityId = communityId?.trim() || null
  const scopeKey = [
    normalizedCommunityId || 'none',
    currentUserId || 'anonymous',
    currentUserRole || 'no-role',
    canViewContent ? 'visible' : 'restricted',
    page,
    pageSize,
  ].join(':')

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(normalizedCommunityId && canViewContent))
  const [error, setError] = useState<CommunityError | null>(null)

  const scopeKeyRef = useRef(scopeKey)
  const mountedRef = useRef(false)
  const requestVersionRef = useRef(0)
  const requestInFlightRef = useRef(false)

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

  const requestFeed = useCallback(async (mode: CommunityFeedRequestMode) => {
    if (!normalizedCommunityId || !canViewContent || requestInFlightRef.current) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++requestVersionRef.current
    requestInFlightRef.current = true
    setLoading(true)
    setError(null)

    const result = await getCommunityPosts(
      normalizedCommunityId,
      currentUserId || undefined,
      currentUserRole,
      { page, pageSize }
    )

    if (!isRequestActive(expectedScopeKey, requestVersion)) return

    requestInFlightRef.current = false
    setLoading(false)
    setError(result.error)

    if (result.error && mode === 'reload') return

    setPosts(result.data)
    setTotalCount(result.totalCount)
  }, [
    canViewContent,
    currentUserId,
    currentUserRole,
    isRequestActive,
    normalizedCommunityId,
    page,
    pageSize,
    scopeKey,
  ])

  useEffect(() => {
    const resetAndLoad = async () => {
      requestVersionRef.current += 1
      requestInFlightRef.current = false
      setPosts([])
      setTotalCount(null)
      setError(null)

      if (!normalizedCommunityId || !canViewContent) {
        setLoading(false)
        return
      }

      setLoading(true)
      await requestFeed('initial')
    }

    void resetAndLoad()
  }, [canViewContent, normalizedCommunityId, requestFeed])

  const reload = useCallback(async () => {
    await requestFeed('reload')
  }, [requestFeed])

  const updatePosts = useCallback((updater: CommunityPostsUpdater) => {
    setPosts(currentPosts => updater(currentPosts))
  }, [])

  return {
    posts,
    totalCount,
    loading,
    error,
    reload,
    updatePosts,
  }
}
