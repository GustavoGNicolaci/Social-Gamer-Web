import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../../../contexts/AuthContext'
import { useI18n } from '../../../i18n/I18nContext'
import {
  deleteGameStatus,
  getGameStatusesPageByUserId,
  saveGameStatus,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusSortValue,
  type GameStatusValue,
} from '../../../services/gameStatusService'
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

const PROFILE_STATUS_PAGE_SIZE = 12

export interface ProfileStatusControls {
  sortValue: GameStatusSortValue
  statuses: GameStatusValue[]
}

const DEFAULT_STATUS_CONTROLS: ProfileStatusControls = {
  sortValue: 'recent',
  statuses: [],
}

function getStatusControlsCacheKey(controls: ProfileStatusControls) {
  const statusesKey = controls.statuses.length > 0 ? [...controls.statuses].sort().join(',') : 'all'
  return `${controls.sortValue}:${statusesKey}`
}

function getGameStatusErrorMessage(
  error: GameStatusError | null,
  action: 'load' | 'save' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'save') return 'Could not save this game status right now.'
    if (action === 'delete') return 'Could not remove this game from the profile right now.'

    return isOwnerView
      ? 'Could not load your profile statuses right now.'
      : 'Could not load this profile statuses right now.'
  }

  if (isSupabasePermissionError(error)) {
    return action === 'load'
      ? 'Could not load statuses due to permissions. Check the policies for the status_jogo table in Supabase.'
      : action === 'save'
        ? 'Could not save the status due to permissions. Check the policies for the status_jogo table in Supabase.'
        : 'Could not remove this game from the profile due to permissions. Check the DELETE policies for the status_jogo table in Supabase.'
  }

  if (getSupabaseErrorText(error).includes('column')) {
    return 'Could not continue because the status_jogo table structure does not match the frontend.'
  }

  if (action === 'save') return 'Could not save this game status right now.'
  if (action === 'delete') return 'Could not remove this game from the profile right now.'

  return isOwnerView
    ? 'Could not load your profile statuses right now.'
    : 'Could not load this profile statuses right now.'
}

export function useProfileGameStatuses(
  activeProfile: { id: string } | null,
  collectionsKey: string | null,
  editableProfile: UserProfile | null,
  isOwnerView: boolean,
  isRestrictedPublicView: boolean,
  setLoaded: (loaded: boolean) => void
) {
  const { t } = useI18n()
  const [statusGames, setStatusGames] = useState<GameStatusItem[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusLoadingMore, setStatusLoadingMore] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusPageState, setStatusPageState] = useState(createEmptyProfilePageState)
  const [statusControls, setStatusControls] =
    useState<ProfileStatusControls>(DEFAULT_STATUS_CONTROLS)
  const statusRequestIdRef = useRef(0)
  const activeCollectionsKeyRef = useRef(collectionsKey)
  const statusCacheRef = useRef(new Map<string, CachedCollection<GameStatusItem>>())

  useEffect(() => {
    activeCollectionsKeyRef.current = collectionsKey
  }, [collectionsKey])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setStatusControls({
        sortValue: DEFAULT_STATUS_CONTROLS.sortValue,
        statuses: [],
      })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeProfile?.id])

  const statusCacheKey = useMemo(
    () =>
      collectionsKey
        ? `${collectionsKey}:status:${getStatusControlsCacheKey(statusControls)}`
        : null,
    [collectionsKey, statusControls]
  )

  const reset = useCallback(() => {
    statusRequestIdRef.current += 1
    setStatusGames([])
    setStatusError(null)
    setStatusLoading(false)
    setStatusLoadingMore(false)
    setStatusPageState(createEmptyProfilePageState())
  }, [])

  const loadStatusPage = useCallback(
    async ({ page = 0, append = false, force = false }: LoadProfilePageOptions = {}) => {
      if (!activeProfile || !statusCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = statusCacheRef.current.get(statusCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setStatusGames(cachedCollection.items)
        setStatusPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setStatusError(null)
        setLoaded(true)
        return { ok: true }
      }

      const requestId = statusRequestIdRef.current + 1
      statusRequestIdRef.current = requestId

      if (append) setStatusLoadingMore(true)
      else setStatusLoading(true)

      setStatusError(null)
      const startedAt = getPerformanceNow()
      const statusResult = await getGameStatusesPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_STATUS_PAGE_SIZE,
        sort: statusControls.sortValue,
        statuses: statusControls.statuses,
      })

      if (
        statusRequestIdRef.current !== requestId ||
        activeCollectionsKeyRef.current !== collectionsKey
      ) return { ok: false }

      logPerformanceTiming('profile.status.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: statusResult.timings.requestCount,
        itemCount: statusResult.data.length,
      })

      if (statusResult.error) {
        if (!isOwnerView && isSupabasePermissionError(statusResult.error)) {
          setStatusGames([])
          setStatusPageState(createLoadedPageState(0, false, null))
          setStatusError(null)
          setStatusLoading(false)
          setStatusLoadingMore(false)
          setLoaded(true)
          return { ok: true }
        }

        console.error('Erro ao carregar status dos jogos do perfil:', statusResult.error)
        if (!append) {
          setStatusGames([])
          setStatusPageState(createEmptyProfilePageState())
        }
        setStatusError(getGameStatusErrorMessage(statusResult.error, 'load', isOwnerView))
        setStatusLoading(false)
        setStatusLoadingMore(false)
        setLoaded(true)
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        statusResult.totalCount,
        statusResult.hasMore,
        statusResult.nextPage
      )

      setStatusGames(currentItems => {
        const nextItems = append
          ? mergeProfileCollectionsById(currentItems, statusResult.data)
          : statusResult.data
        statusCacheRef.current.set(statusCacheKey, createCachedCollection(nextItems, nextPageState))
        return nextItems
      })
      setStatusPageState(nextPageState)
      setStatusError(null)
      setStatusLoading(false)
      setStatusLoadingMore(false)
      setLoaded(true)

      return { ok: true }
    },
    [
      activeProfile,
      collectionsKey,
      isOwnerView,
      isRestrictedPublicView,
      setLoaded,
      statusCacheKey,
      statusControls.sortValue,
      statusControls.statuses,
    ]
  )

  const handleRefreshStatusGames = async () => {
    if (!activeProfile) {
      reset()
      return
    }

    if (statusCacheKey) statusCacheRef.current.delete(statusCacheKey)
    await loadStatusPage({ page: 0, force: true })
  }

  const handleStatusControlsChange = (nextControls: ProfileStatusControls) => {
    setStatusControls({
      sortValue: nextControls.sortValue,
      statuses: [...nextControls.statuses],
    })
    setStatusGames([])
    setStatusPageState(createEmptyProfilePageState())
    setStatusError(null)
    setLoaded(false)
  }

  const handleLoadMoreStatusGames = async () => {
    if (!statusPageState.hasMore || statusPageState.nextPage === null || statusLoadingMore) return
    await loadStatusPage({ page: statusPageState.nextPage, append: true })
  }

  const handleSaveGameStatus = async ({
    gameId,
    status,
    favorito,
  }: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => {
    if (!editableProfile) {
      return { ok: false, message: t('profile.error.identifyStatusSave') }
    }

    const { error } = await saveGameStatus({
      userId: editableProfile.id,
      gameId,
      status,
      favorito,
    })

    if (error) return { ok: false, message: getGameStatusErrorMessage(error, 'save', true) }

    if (statusCacheKey) statusCacheRef.current.delete(statusCacheKey)
    const reloadResult = await loadStatusPage({ page: 0, force: true })

    if (!reloadResult.ok) {
      return { ok: false, message: t('profile.error.statusSavedRefresh') }
    }

    setStatusError(null)
    return { ok: true }
  }

  const handleDeleteStatus = async (itemId: string) => {
    if (!editableProfile) {
      return { ok: false, message: t('profile.error.identifyStatusDelete') }
    }

    const { error } = await deleteGameStatus({
      userId: editableProfile.id,
      statusId: itemId,
    })

    if (error) return { ok: false, message: getGameStatusErrorMessage(error, 'delete', true) }

    const nextPageState = {
      ...statusPageState,
      totalCount:
        statusPageState.totalCount === null ? null : Math.max(statusPageState.totalCount - 1, 0),
    }

    setStatusGames(currentItems => {
      const nextItems = currentItems.filter(item => item.id !== itemId)
      if (statusCacheKey) {
        statusCacheRef.current.set(statusCacheKey, createCachedCollection(nextItems, nextPageState))
      }
      return nextItems
    })
    setStatusPageState(nextPageState)
    setStatusError(null)

    return { ok: true }
  }

  return {
    actions: {
      handleDeleteStatus,
      handleLoadMoreStatusGames,
      handleRefreshStatusGames,
      handleSaveGameStatus,
      handleStatusControlsChange,
    },
    items: statusGames,
    load: loadStatusPage,
    reset,
    state: {
      statusError,
      statusLoading,
      statusLoadingMore,
      statusPageState,
    },
  }
}
