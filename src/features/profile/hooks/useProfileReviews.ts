import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../../../contexts/AuthContext'
import { useI18n } from '../../../i18n/I18nContext'
import {
  deleteReview,
  getReviewsPageByUserId,
  type ProfileReviewItem,
  type ReviewError,
} from '../../../services/reviewService'
import { getPerformanceNow, logPerformanceTiming } from '../../../utils/performanceDiagnostics'
import {
  getSupabaseErrorText,
  isSupabasePermissionError,
} from '../../../utils/supabaseErrors'
import {
  createCachedCollection,
  createEmptyProfilePageState,
  createLoadedPageState,
  mergeProfileCollectionsById,
  type CachedCollection,
  type LoadProfilePageOptions,
} from './profileCollectionState'

const PROFILE_REVIEWS_PAGE_SIZE = 6

function getReviewErrorMessage(
  error: ReviewError | null,
  action: 'load' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'delete') return 'Could not delete this review right now.'

    return isOwnerView
      ? 'Could not load your reviews right now.'
      : 'Could not load this profile reviews right now.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'delete'
      ? 'Could not delete your review due to permissions. Check the DELETE policies for the avaliacoes table in Supabase.'
      : 'Could not load reviews due to permissions. Check the policies for the avaliacoes and jogos tables in Supabase.'
  }

  if (getSupabaseErrorText(error).includes('column')) {
    return action === 'delete'
      ? 'Could not delete the review because the avaliacoes table structure does not match the frontend.'
      : 'Could not load reviews because the table structure does not match the frontend.'
  }

  return action === 'delete'
    ? error.message || 'Could not delete this review right now.'
    : isOwnerView
      ? 'Could not load your reviews right now.'
      : 'Could not load this profile reviews right now.'
}

export function useProfileReviews(
  activeProfile: { id: string } | null,
  collectionsKey: string | null,
  editableProfile: UserProfile | null,
  isOwnerView: boolean,
  isRestrictedPublicView: boolean,
  setLoaded: (loaded: boolean) => void,
  userId?: string
) {
  const { t } = useI18n()
  const [userReviews, setUserReviews] = useState<ProfileReviewItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewsPageState, setReviewsPageState] = useState(createEmptyProfilePageState)
  const reviewsRequestIdRef = useRef(0)
  const activeCollectionsKeyRef = useRef(collectionsKey)
  const reviewsCacheRef = useRef(new Map<string, CachedCollection<ProfileReviewItem>>())

  useEffect(() => {
    activeCollectionsKeyRef.current = collectionsKey
  }, [collectionsKey])

  const reviewsCacheKey = useMemo(
    () => (collectionsKey ? `${collectionsKey}:reviews` : null),
    [collectionsKey]
  )

  const reset = useCallback(() => {
    reviewsRequestIdRef.current += 1
    setUserReviews([])
    setReviewsError(null)
    setReviewsLoading(false)
    setReviewsLoadingMore(false)
    setReviewsPageState(createEmptyProfilePageState())
  }, [])

  const loadReviewsPage = useCallback(
    async ({ page = 0, append = false, force = false }: LoadProfilePageOptions = {}) => {
      if (!activeProfile || !reviewsCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = reviewsCacheRef.current.get(reviewsCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setUserReviews(cachedCollection.items)
        setReviewsPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setReviewsError(null)
        setLoaded(true)
        return { ok: true }
      }

      const requestId = reviewsRequestIdRef.current + 1
      reviewsRequestIdRef.current = requestId

      if (append) setReviewsLoadingMore(true)
      else setReviewsLoading(true)

      setReviewsError(null)
      const startedAt = getPerformanceNow()
      const reviewsResult = await getReviewsPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_REVIEWS_PAGE_SIZE,
        currentUserId: userId,
        includeRestrictedAuthorReviews: isOwnerView,
      })

      if (
        reviewsRequestIdRef.current !== requestId ||
        activeCollectionsKeyRef.current !== collectionsKey
      ) return { ok: false }

      logPerformanceTiming('profile.reviews.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: reviewsResult.timings.requestCount,
        itemCount: reviewsResult.data.length,
      })

      if (reviewsResult.error) {
        if (!isOwnerView && isSupabasePermissionError(reviewsResult.error)) {
          setUserReviews(reviewsResult.data)
          setReviewsPageState(createLoadedPageState(reviewsResult.data.length, false, null))
          setReviewsError(null)
          setReviewsLoading(false)
          setReviewsLoadingMore(false)
          setLoaded(true)
          return { ok: true }
        }

        console.error('Erro ao carregar reviews do perfil:', reviewsResult.error)
        if (!append) {
          setUserReviews(reviewsResult.data)
          setReviewsPageState(createEmptyProfilePageState())
        }
        setReviewsError(getReviewErrorMessage(reviewsResult.error, 'load', isOwnerView))
        setReviewsLoading(false)
        setReviewsLoadingMore(false)
        setLoaded(true)
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        reviewsResult.totalCount,
        reviewsResult.hasMore,
        reviewsResult.nextPage
      )

      setUserReviews(currentItems => {
        const nextItems = append
          ? mergeProfileCollectionsById(currentItems, reviewsResult.data)
          : reviewsResult.data
        reviewsCacheRef.current.set(reviewsCacheKey, createCachedCollection(nextItems, nextPageState))
        return nextItems
      })
      setReviewsPageState(nextPageState)
      setReviewsError(null)
      setReviewsLoading(false)
      setReviewsLoadingMore(false)
      setLoaded(true)

      return { ok: true }
    },
    [
      activeProfile,
      collectionsKey,
      isOwnerView,
      isRestrictedPublicView,
      reviewsCacheKey,
      setLoaded,
      userId,
    ]
  )

  const handleLoadMoreReviews = async () => {
    if (!reviewsPageState.hasMore || reviewsPageState.nextPage === null || reviewsLoadingMore) return
    await loadReviewsPage({ page: reviewsPageState.nextPage, append: true })
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!editableProfile) {
      return { ok: false, message: t('profile.error.identifyReviewDelete') }
    }

    const result = await deleteReview({ userId: editableProfile.id, reviewId })

    if (!result.ok) {
      return { ok: false, message: getReviewErrorMessage(result.error, 'delete', true) }
    }

    const nextPageState = {
      ...reviewsPageState,
      totalCount:
        reviewsPageState.totalCount === null ? null : Math.max(reviewsPageState.totalCount - 1, 0),
    }

    setUserReviews(currentReviews => {
      const nextReviews = currentReviews.filter(currentReview => currentReview.id !== reviewId)
      if (reviewsCacheKey) {
        reviewsCacheRef.current.set(
          reviewsCacheKey,
          createCachedCollection(nextReviews, nextPageState)
        )
      }
      return nextReviews
    })
    setReviewsPageState(nextPageState)
    setReviewsError(null)

    return { ok: true }
  }

  return {
    actions: {
      handleDeleteReview,
      handleLoadMoreReviews,
    },
    items: userReviews,
    load: loadReviewsPage,
    reset,
    state: {
      reviewsError,
      reviewsLoading,
      reviewsLoadingMore,
      reviewsPageState,
    },
  }
}
