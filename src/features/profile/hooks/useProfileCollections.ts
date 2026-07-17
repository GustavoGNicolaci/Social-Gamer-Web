import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserProfile } from '../../../contexts/AuthContext'
import type { PublicUserProfile } from '../../../services/userService'
import { useProfileGameStatuses } from './useProfileGameStatuses'
import { useProfileReviews } from './useProfileReviews'
import { useProfileWishlist } from './useProfileWishlist'

export { mergeProfileCollectionsById } from './profileCollectionState'
export type { ProfileStatusControls } from './useProfileGameStatuses'

type ActiveProfile = UserProfile | PublicUserProfile

export type ProfileTab =
  | 'status'
  | 'wishlist'
  | 'reviews'
  | 'communities'
  | 'communityPosts'
  | 'savedCommunityPosts'

type LoadedProfileTabs = Record<ProfileTab, boolean>

const createEmptyLoadedProfileTabs = (): LoadedProfileTabs => ({
  status: false,
  wishlist: false,
  reviews: false,
  communities: false,
  communityPosts: false,
  savedCommunityPosts: false,
})

interface UseProfileCollectionsParams {
  activeProfile: ActiveProfile | null
  activeTab: ProfileTab
  editableProfile: UserProfile | null
  isOwnerView: boolean
  isRestrictedPublicView: boolean
  userId?: string
}

export function useProfileCollections({
  activeProfile,
  activeTab,
  editableProfile,
  isOwnerView,
  isRestrictedPublicView,
  userId,
}: UseProfileCollectionsParams) {
  const [loadedProfileTabs, setLoadedProfileTabs] =
    useState<LoadedProfileTabs>(createEmptyLoadedProfileTabs)
  const [loadedCollectionsKey, setLoadedCollectionsKey] = useState<string | null>(null)
  const [readyCollectionsKey, setReadyCollectionsKey] = useState<string | null>(null)

  const collectionsKey = useMemo(() => {
    if (!activeProfile || isRestrictedPublicView) return null

    return [activeProfile.id, userId || 'anon', isOwnerView ? 'owner' : 'viewer'].join(':')
  }, [activeProfile, isOwnerView, isRestrictedPublicView, userId])

  const setStatusLoaded = useCallback((loaded: boolean) => {
    setLoadedProfileTabs(currentTabs => ({ ...currentTabs, status: loaded }))
  }, [])
  const setWishlistLoaded = useCallback((loaded: boolean) => {
    setLoadedProfileTabs(currentTabs => ({ ...currentTabs, wishlist: loaded }))
  }, [])
  const setReviewsLoaded = useCallback((loaded: boolean) => {
    setLoadedProfileTabs(currentTabs => ({ ...currentTabs, reviews: loaded }))
  }, [])

  const {
    actions: statusActions,
    items: statusGames,
    load: loadStatusPage,
    reset: resetStatuses,
    state: statusState,
  } = useProfileGameStatuses(
    activeProfile,
    collectionsKey,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    setStatusLoaded
  )
  const {
    actions: wishlistActions,
    items: wishlistGames,
    load: loadWishlistPage,
    reset: resetWishlist,
    state: wishlistState,
  } = useProfileWishlist(
    activeProfile,
    collectionsKey,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    setWishlistLoaded
  )
  const {
    actions: reviewActions,
    items: userReviews,
    load: loadReviewsPage,
    reset: resetReviews,
    state: reviewState,
  } = useProfileReviews(
    activeProfile,
    collectionsKey,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    setReviewsLoaded,
    userId
  )

  const resetCollections = useCallback(
    (nextCollectionsKey: string | null) => {
      resetStatuses()
      resetWishlist()
      resetReviews()
      setLoadedProfileTabs(createEmptyLoadedProfileTabs())
      setReadyCollectionsKey(null)
      setLoadedCollectionsKey(nextCollectionsKey)
    },
    [resetReviews, resetStatuses, resetWishlist]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!collectionsKey) {
        if (loadedCollectionsKey !== null) resetCollections(null)
        return
      }

      if (loadedCollectionsKey !== collectionsKey) resetCollections(collectionsKey)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [collectionsKey, loadedCollectionsKey, resetCollections])

  useEffect(() => {
    if (!collectionsKey || loadedCollectionsKey !== collectionsKey) return

    const timeoutId = window.setTimeout(() => {
      setReadyCollectionsKey(collectionsKey)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [collectionsKey, loadedCollectionsKey])

  useEffect(() => {
    if (
      !activeProfile ||
      !collectionsKey ||
      loadedCollectionsKey !== collectionsKey ||
      readyCollectionsKey !== collectionsKey ||
      isRestrictedPublicView
    ) return

    if (activeTab === 'status') {
      void loadStatusPage()
      return
    }

    if (activeTab === 'wishlist') {
      void loadWishlistPage()
      return
    }

    if (activeTab === 'reviews') void loadReviewsPage()
  }, [
    activeProfile,
    activeTab,
    collectionsKey,
    isRestrictedPublicView,
    loadedCollectionsKey,
    readyCollectionsKey,
    loadReviewsPage,
    loadStatusPage,
    loadWishlistPage,
  ])

  const hasCurrentCollections = Boolean(collectionsKey && loadedCollectionsKey === collectionsKey)
  const statusItemsForView = hasCurrentCollections ? statusGames : []
  const wishlistItemsForView = hasCurrentCollections ? wishlistGames : []
  const reviewItemsForView = hasCurrentCollections ? userReviews : []

  return {
    ...reviewActions,
    ...statusActions,
    ...wishlistActions,
    hasCurrentCollections,
    loadedProfileTabs,
    reviewItemsForView,
    ...reviewState,
    ...statusState,
    statusItemsForView,
    ...wishlistState,
    wishlistItemsForView,
  }
}
