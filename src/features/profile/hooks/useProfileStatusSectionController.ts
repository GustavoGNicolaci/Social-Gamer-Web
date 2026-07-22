import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../../services/gameCatalogService'
import {
  SELECTABLE_STATUS_VALUES,
  type GameStatusItem,
  type GameStatusSortValue,
  type GameStatusValue,
} from '../../../services/gameStatusService'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'

interface StatusActionResult {
  ok: boolean
  message?: string
}

interface UseProfileStatusSectionControllerParams {
  userId: string
  items: GameStatusItem[]
  isOwnerView: boolean
  onSaveStatus: (params: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => Promise<StatusActionResult>
  onDeleteStatus: (itemId: string) => Promise<StatusActionResult>
  onControlsChange: (controls: {
    sortValue: GameStatusSortValue
    statuses: GameStatusValue[]
  }) => void
}

export interface ProfileStatusSearchResultItem {
  game: CatalogGamePreview
  existingItem: GameStatusItem | null
  isTracked: boolean
  statusLabel: string | null
  isFavorite: boolean
}

const SEARCH_DEBOUNCE_DELAY = 220
const STATUS_SORT_VALUES: GameStatusSortValue[] = [
  'recent',
  'oldest',
  'favorites',
  'title',
]

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function getStatusGridColumns(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 6
}

function getStatusSearchErrorMessage(
  error: GameCatalogError | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!error) {
    return t('error.genericSearchGames')
  }

  if (isSupabasePermissionError(error)) {
    return t('error.permissionSearchGamesStatus')
  }

  return t('error.genericSearchGames')
}

function sortStatusItems(
  items: GameStatusItem[],
  sortValue: GameStatusSortValue,
  locale: string
) {
  return [...items].sort((leftItem, rightItem) => {
    const leftTitle = leftItem.jogo?.titulo || ''
    const rightTitle = rightItem.jogo?.titulo || ''
    const recentDelta =
      getTimestamp(rightItem.created_at) - getTimestamp(leftItem.created_at)
    const oldestDelta =
      getTimestamp(leftItem.created_at) - getTimestamp(rightItem.created_at)

    if (sortValue === 'favorites') {
      if (leftItem.favorito !== rightItem.favorito) {
        return leftItem.favorito ? -1 : 1
      }

      if (recentDelta !== 0) return recentDelta
      return leftTitle.localeCompare(rightTitle, locale)
    }

    if (sortValue === 'oldest') {
      if (oldestDelta !== 0) return oldestDelta
      if (leftItem.favorito !== rightItem.favorito) {
        return leftItem.favorito ? -1 : 1
      }
      return leftTitle.localeCompare(rightTitle, locale)
    }

    if (sortValue === 'title') {
      const titleDelta = leftTitle.localeCompare(rightTitle, locale)
      if (titleDelta !== 0) return titleDelta
      if (leftItem.favorito !== rightItem.favorito) {
        return leftItem.favorito ? -1 : 1
      }
      return recentDelta
    }

    if (recentDelta !== 0) return recentDelta
    if (leftItem.favorito !== rightItem.favorito) {
      return leftItem.favorito ? -1 : 1
    }
    return leftTitle.localeCompare(rightTitle, locale)
  })
}

export function useProfileStatusSectionController({
  userId,
  items,
  isOwnerView,
  onSaveStatus,
  onDeleteStatus,
  onControlsChange,
}: UseProfileStatusSectionControllerParams) {
  const { t, locale } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatalogGamePreview[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<CatalogGamePreview | null>(null)
  const [composerStatus, setComposerStatus] = useState<GameStatusValue>('jogando')
  const [composerFavorito, setComposerFavorito] = useState(false)
  const [activeStatusFilters, setActiveStatusFilters] = useState<GameStatusValue[]>([])
  const [sortValue, setSortValue] = useState<GameStatusSortValue>('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [gridColumns, setGridColumns] = useState(() =>
    typeof window === 'undefined' ? 6 : getStatusGridColumns(window.innerWidth)
  )
  const [currentPage, setCurrentPage] = useState(0)
  const [isCreatingStatus, setIsCreatingStatus] = useState(false)
  const [savingItemIds, setSavingItemIds] = useState<string[]>([])
  const [removingItemIds, setRemovingItemIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const sortMenuRef = useRef<HTMLDivElement | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)
  const statusSortOptions = useMemo(
    () =>
      STATUS_SORT_VALUES.map(value => ({
        value,
        label: t(`profileStatus.sort.${value}`),
      })),
    [t]
  )
  const statusOptions = useMemo(
    () =>
      SELECTABLE_STATUS_VALUES.map(value => ({
        value,
        label: t(`game.status.${value}`),
      })),
    [t]
  )
  const getStatusLabel = useCallback(
    (status: GameStatusValue) => {
      if (status === 'planejando') return t('profileStatus.legacyStatus')

      return (
        statusOptions.find(option => option.value === status)?.label ||
        t('common.status')
      )
    },
    [statusOptions, t]
  )

  const activeStatusFilterSet = useMemo(
    () => new Set(activeStatusFilters),
    [activeStatusFilters]
  )
  const trackedItemsByGameId = useMemo(() => {
    const nextMap = new Map<number, GameStatusItem>()

    items.forEach(item => {
      nextMap.set(item.jogo_id, item)
    })

    return nextMap
  }, [items])
  const searchResultItems = useMemo<ProfileStatusSearchResultItem[]>(
    () =>
      searchResults.map(game => {
        const existingItem = trackedItemsByGameId.get(game.id) || null

        return {
          game,
          existingItem,
          isTracked: Boolean(existingItem),
          statusLabel: existingItem ? getStatusLabel(existingItem.status) : null,
          isFavorite: Boolean(existingItem?.favorito),
        }
      }),
    [getStatusLabel, searchResults, trackedItemsByGameId]
  )
  const filteredItems = useMemo(() => {
    if (activeStatusFilters.length === 0) return items

    return items.filter(item => activeStatusFilterSet.has(item.status))
  }, [activeStatusFilterSet, activeStatusFilters.length, items])
  const activeStatusFilterOptions = useMemo(
    () => statusOptions.filter(option => activeStatusFilterSet.has(option.value)),
    [activeStatusFilterSet, statusOptions]
  )
  const sortedItems = useMemo(
    () => sortStatusItems(filteredItems, sortValue, locale),
    [filteredItems, locale, sortValue]
  )
  const hasSavedStatusItems = items.length > 0
  const hasVisibleStatusItems = sortedItems.length > 0
  const hasActiveStatusFilters = activeStatusFilters.length > 0
  const itemsPerPage = gridColumns * 4
  const totalPages = Math.max(Math.ceil(sortedItems.length / itemsPerPage), 1)
  const safeCurrentPage = Math.min(currentPage, totalPages - 1)
  const visibleItems = sortedItems.slice(
    safeCurrentPage * itemsPerPage,
    safeCurrentPage * itemsPerPage + itemsPerPage
  )
  const searchResultsId = `profile-status-search-results-${userId}`
  const trimmedSearchQuery = searchQuery.trim()
  const visibleSelectedGame =
    selectedGame && !trackedItemsByGameId.has(selectedGame.id) ? selectedGame : null
  const shouldShowAutosuggest =
    isOwnerView &&
    !visibleSelectedGame &&
    trimmedSearchQuery.length >= 2 &&
    (searchLoading || Boolean(searchError) || searchResultItems.length > 0)
  const shouldShowEmptyAutosuggest =
    isOwnerView &&
    !visibleSelectedGame &&
    trimmedSearchQuery.length >= 2 &&
    !searchLoading &&
    !searchError &&
    searchResultItems.length === 0
  const sortLabel =
    statusSortOptions.find(option => option.value === sortValue)?.label ||
    t('profileStatus.sort.recent')
  const statusFilterSummary = useMemo(() => {
    if (activeStatusFilterOptions.length === 0) {
      return t('profileStatus.allStatuses')
    }
    if (activeStatusFilterOptions.length <= 2) {
      return activeStatusFilterOptions.map(option => option.label).join(', ')
    }

    return t('profileStatus.activeStatuses', {
      count: activeStatusFilterOptions.length,
    })
  }, [activeStatusFilterOptions, t])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncGridColumns = () => {
      setGridColumns(getStatusGridColumns(window.innerWidth))
    }

    syncGridColumns()
    window.addEventListener('resize', syncGridColumns)

    return () => {
      window.removeEventListener('resize', syncGridColumns)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setShowSortMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const clearScheduledSearch = () => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }

  const resetComposer = () => {
    setSelectedGame(null)
    setComposerStatus('jogando')
    setComposerFavorito(false)
  }

  const handleToggleStatusFilter = (status: GameStatusValue) => {
    const nextFilters = activeStatusFilters.includes(status)
      ? activeStatusFilters.filter(currentStatus => currentStatus !== status)
      : [...activeStatusFilters, status]

    setActiveStatusFilters(nextFilters)
    onControlsChange({ sortValue, statuses: nextFilters })
    setCurrentPage(0)
  }

  const handleClearStatusFilters = () => {
    setActiveStatusFilters([])
    onControlsChange({ sortValue, statuses: [] })
    setCurrentPage(0)
  }

  const handleSearchChange = (value: string) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setSearchQuery(value)
    setSearchError(null)
    setActionError(null)

    if (visibleSelectedGame) {
      resetComposer()
    }

    const trimmedValue = value.trim()

    if (!trimmedValue || trimmedValue.length < 2) {
      setSearchLoading(false)
      setSearchResults([])
      return
    }

    const requestId = searchRequestIdRef.current
    setSearchLoading(true)

    searchTimeoutRef.current = window.setTimeout(async () => {
      const { data, error } = await searchCatalogGamesByTitle(trimmedValue)

      if (searchRequestIdRef.current !== requestId) return

      if (error) {
        setSearchResults([])
        setSearchError(getStatusSearchErrorMessage(error, t))
      } else {
        setSearchResults(data)
        setSearchError(null)
      }

      setSearchLoading(false)
      searchTimeoutRef.current = null
    }, SEARCH_DEBOUNCE_DELAY)
  }

  const handleSelectGame = (game: CatalogGamePreview) => {
    clearScheduledSearch()
    setSelectedGame(game)
    setComposerStatus('jogando')
    setComposerFavorito(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setSearchError(null)
    setActionError(null)
  }

  const handleCancelSelectedGame = () => {
    clearScheduledSearch()
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setSearchError(null)
    setActionError(null)
    resetComposer()
  }

  const handleCreateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!visibleSelectedGame) return

    setIsCreatingStatus(true)
    setActionError(null)

    const result = await onSaveStatus({
      gameId: visibleSelectedGame.id,
      status: composerStatus,
      favorito: composerFavorito,
    })

    if (!result.ok) {
      setActionError(result.message || t('profileStatus.saveError'))
      setIsCreatingStatus(false)
      return
    }

    clearScheduledSearch()
    setCurrentPage(0)
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setSearchError(null)
    resetComposer()
    setIsCreatingStatus(false)
  }

  const handleUpdateExistingItem = async (
    item: GameStatusItem,
    nextStatus: GameStatusValue,
    nextFavorito: boolean
  ) => {
    if (item.status === nextStatus && item.favorito === nextFavorito) {
      return
    }

    setSavingItemIds(currentIds =>
      currentIds.includes(item.id) ? currentIds : [...currentIds, item.id]
    )
    setActionError(null)

    const result = await onSaveStatus({
      gameId: item.jogo_id,
      status: nextStatus,
      favorito: nextFavorito,
    })

    setSavingItemIds(currentIds =>
      currentIds.filter(currentId => currentId !== item.id)
    )

    if (!result.ok) {
      setActionError(result.message || t('profileStatus.updateError'))
    }
  }

  const handleDeleteItem = async (item: GameStatusItem) => {
    setRemovingItemIds(currentIds =>
      currentIds.includes(item.id) ? currentIds : [...currentIds, item.id]
    )
    setActionError(null)

    const result = await onDeleteStatus(item.id)

    setRemovingItemIds(currentIds =>
      currentIds.filter(currentId => currentId !== item.id)
    )

    if (!result.ok) {
      setActionError(result.message || t('profileStatus.removeError'))
    }
  }

  const handleSelectSort = (nextSortValue: GameStatusSortValue) => {
    setSortValue(nextSortValue)
    onControlsChange({ sortValue: nextSortValue, statuses: activeStatusFilters })
    setCurrentPage(0)
    setShowSortMenu(false)
  }

  return {
    actionError,
    activeStatusFilterSet,
    composerFavorito,
    composerStatus,
    gridColumns,
    handleCancelSelectedGame,
    handleClearStatusFilters,
    handleCreateStatus,
    handleDeleteItem,
    handleSearchChange,
    handleSelectGame,
    handleSelectSort,
    handleToggleStatusFilter,
    handleUpdateExistingItem,
    hasActiveStatusFilters,
    hasSavedStatusItems,
    hasVisibleStatusItems,
    isCreatingStatus,
    removingItemIds,
    safeCurrentPage,
    savingItemIds,
    searchError,
    searchLoading,
    searchQuery,
    searchResultItems,
    searchResultsId,
    setComposerFavorito,
    setComposerStatus,
    setCurrentPage,
    setShowSortMenu,
    shouldShowAutosuggest,
    shouldShowEmptyAutosuggest,
    showSortMenu,
    sortLabel,
    sortMenuRef,
    sortValue,
    sortedItems,
    statusFilterSummary,
    statusOptions,
    statusSortOptions,
    totalPages,
    trimmedSearchQuery,
    visibleItems,
    visibleSelectedGame,
  }
}

export type ProfileStatusSectionController = ReturnType<
  typeof useProfileStatusSectionController
>
