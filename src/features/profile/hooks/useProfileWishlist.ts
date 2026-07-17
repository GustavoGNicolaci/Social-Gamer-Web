import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../../../contexts/AuthContext'
import { useI18n } from '../../../i18n/I18nContext'
import {
  deleteWishlistEntry,
  getWishlistGamesByUserId,
  getWishlistGamesPageByUserId,
  type WishlistError,
  type WishlistGameItem,
} from '../../../services/wishlistService'
import { getPerformanceNow, logPerformanceTiming } from '../../../utils/performanceDiagnostics'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import {
  createCachedCollection,
  createEmptyProfilePageState,
  createLoadedPageState,
  mergeProfileCollectionsById,
  type CachedCollection,
  type LoadProfilePageOptions,
} from './profileCollectionState'

const PROFILE_WISHLIST_PAGE_SIZE = 12

function getWishlistErrorMessage(
  error: WishlistError | null,
  action: 'load' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'delete') return 'Could not remove this game from your list right now.'

    return isOwnerView
      ? 'Could not load the games you want to play right now.'
      : 'Could not load the games this profile wants to play right now.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'delete'
      ? 'Could not remove this game due to permissions. Check the DELETE policies for the lista_desejos table in Supabase.'
      : 'Could not load this list due to permissions. Check the policies for the lista_desejos table in Supabase.'
  }

  return action === 'delete'
    ? 'Could not remove this game from your list right now.'
    : isOwnerView
      ? 'Could not load the games you want to play right now.'
      : 'Could not load the games this profile wants to play right now.'
}

export function useProfileWishlist(
  activeProfile: { id: string } | null,
  collectionsKey: string | null,
  editableProfile: UserProfile | null,
  isOwnerView: boolean,
  isRestrictedPublicView: boolean,
  setLoaded: (loaded: boolean) => void
) {
  const { t } = useI18n()
  const [wishlistGames, setWishlistGames] = useState<WishlistGameItem[]>([])
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistLoadingMore, setWishlistLoadingMore] = useState(false)
  const [wishlistPreparingReorder, setWishlistPreparingReorder] = useState(false)
  const [wishlistError, setWishlistError] = useState<string | null>(null)
  const [wishlistPageState, setWishlistPageState] = useState(createEmptyProfilePageState)
  const wishlistRequestIdRef = useRef(0)
  const wishlistFullLoadRequestIdRef = useRef(0)
  const activeCollectionsKeyRef = useRef(collectionsKey)
  const wishlistCacheRef = useRef(new Map<string, CachedCollection<WishlistGameItem>>())

  useEffect(() => {
    activeCollectionsKeyRef.current = collectionsKey
  }, [collectionsKey])

  const wishlistCacheKey = useMemo(
    () => (collectionsKey ? `${collectionsKey}:wishlist` : null),
    [collectionsKey]
  )

  const reset = useCallback(() => {
    wishlistRequestIdRef.current += 1
    wishlistFullLoadRequestIdRef.current += 1
    setWishlistGames([])
    setWishlistError(null)
    setWishlistLoading(false)
    setWishlistLoadingMore(false)
    setWishlistPreparingReorder(false)
    setWishlistPageState(createEmptyProfilePageState())
  }, [])

  const loadWishlistPage = useCallback(
    async ({ page = 0, append = false, force = false }: LoadProfilePageOptions = {}) => {
      if (!activeProfile || !wishlistCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = wishlistCacheRef.current.get(wishlistCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setWishlistGames(cachedCollection.items)
        setWishlistPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setWishlistError(null)
        setLoaded(true)
        return { ok: true }
      }

      const requestId = wishlistRequestIdRef.current + 1
      wishlistRequestIdRef.current = requestId

      if (append) setWishlistLoadingMore(true)
      else setWishlistLoading(true)

      setWishlistError(null)
      const startedAt = getPerformanceNow()
      const wishlistResult = await getWishlistGamesPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_WISHLIST_PAGE_SIZE,
      })

      if (
        wishlistRequestIdRef.current !== requestId ||
        activeCollectionsKeyRef.current !== collectionsKey
      ) return { ok: false }

      logPerformanceTiming('profile.wishlist.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: wishlistResult.timings.requestCount,
        itemCount: wishlistResult.data.length,
      })

      if (wishlistResult.error) {
        if (!isOwnerView && isSupabasePermissionError(wishlistResult.error)) {
          setWishlistGames([])
          setWishlistPageState(createLoadedPageState(0, false, null))
          setWishlistError(null)
          setWishlistLoading(false)
          setWishlistLoadingMore(false)
          setLoaded(true)
          return { ok: true }
        }

        console.error('Erro ao carregar jogos que quero jogar:', wishlistResult.error)
        if (!append) {
          setWishlistGames([])
          setWishlistPageState(createEmptyProfilePageState())
        }
        setWishlistError(getWishlistErrorMessage(wishlistResult.error, 'load', isOwnerView))
        setWishlistLoading(false)
        setWishlistLoadingMore(false)
        setLoaded(true)
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        wishlistResult.totalCount,
        wishlistResult.hasMore,
        wishlistResult.nextPage
      )

      setWishlistGames(currentItems => {
        const nextItems = append
          ? mergeProfileCollectionsById(currentItems, wishlistResult.data)
          : wishlistResult.data
        wishlistCacheRef.current.set(
          wishlistCacheKey,
          createCachedCollection(nextItems, nextPageState)
        )
        return nextItems
      })
      setWishlistPageState(nextPageState)
      setWishlistError(null)
      setWishlistLoading(false)
      setWishlistLoadingMore(false)
      setLoaded(true)

      return { ok: true }
    },
    [activeProfile, collectionsKey, isOwnerView, isRestrictedPublicView, setLoaded, wishlistCacheKey]
  )

  const handleLoadMoreWishlistGames = async () => {
    if (!wishlistPageState.hasMore || wishlistPageState.nextPage === null || wishlistLoadingMore) return
    await loadWishlistPage({ page: wishlistPageState.nextPage, append: true })
  }

  const handleLoadFullWishlistForReorder = async () => {
    if (!activeProfile || !wishlistCacheKey || wishlistPreparingReorder) {
      return { ok: false, message: t('profile.error.prepareReorder') }
    }

    if (!wishlistPageState.hasMore && wishlistPageState.loaded) return { ok: true }

    setWishlistPreparingReorder(true)
    setWishlistError(null)
    const requestId = wishlistFullLoadRequestIdRef.current + 1
    wishlistFullLoadRequestIdRef.current = requestId
    const startedAt = getPerformanceNow()
    const { data, error } = await getWishlistGamesByUserId(activeProfile.id)

    if (
      wishlistFullLoadRequestIdRef.current !== requestId ||
      activeCollectionsKeyRef.current !== collectionsKey
    ) {
      return { ok: false, message: t('profile.error.prepareReorder') }
    }

    logPerformanceTiming('profile.wishlist.full-reorder-load', getPerformanceNow() - startedAt, {
      profileId: activeProfile.id,
      itemCount: data.length,
      hasError: Boolean(error),
    })

    setWishlistPreparingReorder(false)

    if (error) {
      const message = getWishlistErrorMessage(error, 'load', isOwnerView)
      setWishlistError(message)
      return { ok: false, message }
    }

    const nextPageState = createLoadedPageState(data.length, false, null)
    setWishlistGames(data)
    setWishlistPageState(nextPageState)
    wishlistCacheRef.current.set(wishlistCacheKey, createCachedCollection(data, nextPageState))
    setLoaded(true)
    setWishlistError(null)

    return { ok: true }
  }

  const handleDeleteWishlistItem = async (itemId: string) => {
    if (!editableProfile) {
      return { ok: false, message: t('profile.error.identifyWishlistDelete') }
    }

    const { error } = await deleteWishlistEntry({
      userId: editableProfile.id,
      wishlistEntryId: itemId,
    })

    if (error) return { ok: false, message: getWishlistErrorMessage(error, 'delete', true) }

    const nextPageState = {
      ...wishlistPageState,
      totalCount:
        wishlistPageState.totalCount === null
          ? null
          : Math.max(wishlistPageState.totalCount - 1, 0),
    }

    setWishlistGames(currentItems => {
      const nextItems = currentItems.filter(item => item.id !== itemId)
      if (wishlistCacheKey) {
        wishlistCacheRef.current.set(wishlistCacheKey, createCachedCollection(nextItems, nextPageState))
      }
      return nextItems
    })
    setWishlistPageState(nextPageState)
    setWishlistError(null)

    return { ok: true }
  }

  return {
    actions: {
      handleDeleteWishlistItem,
      handleLoadFullWishlistForReorder,
      handleLoadMoreWishlistGames,
    },
    items: wishlistGames,
    load: loadWishlistPage,
    reset,
    state: {
      wishlistError,
      wishlistLoading,
      wishlistLoadingMore,
      wishlistPageState,
      wishlistPreparingReorder,
    },
  }
}
