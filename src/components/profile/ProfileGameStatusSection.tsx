import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import { useI18n } from '../../i18n/I18nContext'
import {
  type GameStatusSortValue,
  type GameStatusItem,
  type GameStatusValue,
} from '../../services/gameStatusService'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../services/gameCatalogService'
import './ProfileGameStatusSection.css'

type StatusSortValue = GameStatusSortValue

interface SaveStatusResult {
  ok: boolean
  message?: string
}

interface DeleteStatusResult {
  ok: boolean
  message?: string
}

interface ProfileGameStatusSectionProps {
  userId: string
  items: GameStatusItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  totalCount: number | null
  hasMore: boolean
  isLoadingMore: boolean
  isOwnerView: boolean
  onSaveStatus: (params: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => Promise<SaveStatusResult>
  onDeleteStatus: (itemId: string) => Promise<DeleteStatusResult>
  onRefresh: () => Promise<void>
  onLoadMore: () => Promise<void>
  onControlsChange: (controls: { sortValue: StatusSortValue; statuses: GameStatusValue[] }) => void
}

interface StatusSearchResultItem {
  game: CatalogGamePreview
  existingItem: GameStatusItem | null
  isTracked: boolean
  statusLabel: string | null
  isFavorite: boolean
}

const SEARCH_DEBOUNCE_DELAY = 220
const STATUS_SORT_VALUES: StatusSortValue[] = ['recent', 'oldest', 'favorites', 'title']
const STATUS_VALUES: GameStatusValue[] = ['jogando', 'zerado', 'dropado']

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

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

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return t('error.permissionSearchGamesStatus')
  }

  return t('error.genericSearchGames')
}

function sortStatusItems(items: GameStatusItem[], sortValue: StatusSortValue, locale: string) {
  return [...items].sort((leftItem, rightItem) => {
    const leftTitle = leftItem.jogo?.titulo || ''
    const rightTitle = rightItem.jogo?.titulo || ''
    const recentDelta = getTimestamp(rightItem.created_at) - getTimestamp(leftItem.created_at)
    const oldestDelta = getTimestamp(leftItem.created_at) - getTimestamp(rightItem.created_at)

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

function PaginationControls({
  currentPage,
  totalPages,
  onChangePage,
  label,
  previousLabel,
  nextLabel,
}: {
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
  label: string
  previousLabel: string
  nextLabel: string
}) {
  if (totalPages <= 1) return null

  return (
    <nav className="profile-status-pagination" aria-label={label}>
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 0))}
        disabled={currentPage === 0}
      >
        {previousLabel}
      </button>

      {Array.from({ length: totalPages }, (_, index) => index).map(page => (
        <button
          key={`status-page-${page}`}
          type="button"
          onClick={() => onChangePage(page)}
          className={page === currentPage ? 'is-active' : ''}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page + 1}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChangePage(Math.min(currentPage + 1, totalPages - 1))}
        disabled={currentPage === totalPages - 1}
      >
        {nextLabel}
      </button>
    </nav>
  )
}

export const ProfileGameStatusSection = memo(function ProfileGameStatusSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  totalCount,
  hasMore,
  isLoadingMore,
  isOwnerView,
  onSaveStatus,
  onDeleteStatus,
  onRefresh,
  onLoadMore,
  onControlsChange,
}: ProfileGameStatusSectionProps) {
  const { t, formatDate, locale } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatalogGamePreview[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<CatalogGamePreview | null>(null)
  const [composerStatus, setComposerStatus] = useState<GameStatusValue>('jogando')
  const [composerFavorito, setComposerFavorito] = useState(false)
  const [activeStatusFilters, setActiveStatusFilters] = useState<GameStatusValue[]>([])
  const [sortValue, setSortValue] = useState<StatusSortValue>('recent')
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
      STATUS_VALUES.map(value => ({
        value,
        label: t(`game.status.${value}`),
      })),
    [t]
  )
  const formatStatusDate = (value: string | null | undefined) =>
    formatDate(value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      fallback: t('profile.dateFallback'),
    })
  const getStatusLabel = (status: GameStatusValue) =>
    statusOptions.find(option => option.value === status)?.label || t('common.status')

  const activeStatusFilterSet = useMemo(() => new Set(activeStatusFilters), [activeStatusFilters])
  const trackedItemsByGameId = useMemo(() => {
    const nextMap = new Map<number, GameStatusItem>()

    items.forEach(item => {
      nextMap.set(item.jogo_id, item)
    })

    return nextMap
  }, [items])
  const searchResultItems = useMemo<StatusSearchResultItem[]>(
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
    [searchResults, statusOptions, trackedItemsByGameId]
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
  const statusGridStyle = {
    '--status-columns': String(gridColumns),
  } as CSSProperties
  const sortLabel =
    statusSortOptions.find(option => option.value === sortValue)?.label || t('profileStatus.sort.recent')
  const statusFilterSummary = useMemo(() => {
    if (activeStatusFilterOptions.length === 0) return t('profileStatus.allStatuses')
    if (activeStatusFilterOptions.length <= 2) {
      return activeStatusFilterOptions.map(option => option.label).join(', ')
    }

    return t('profileStatus.activeStatuses', { count: activeStatusFilterOptions.length })
  }, [activeStatusFilterOptions, t])

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

    setSavingItemIds(currentIds => currentIds.filter(currentId => currentId !== item.id))

    if (!result.ok) {
      setActionError(result.message || t('profileStatus.updateError'))
      return
    }
  }

  const handleDeleteItem = async (item: GameStatusItem) => {
    setRemovingItemIds(currentIds =>
      currentIds.includes(item.id) ? currentIds : [...currentIds, item.id]
    )
    setActionError(null)

    const result = await onDeleteStatus(item.id)

    setRemovingItemIds(currentIds => currentIds.filter(currentId => currentId !== item.id))

    if (!result.ok) {
      setActionError(result.message || t('profileStatus.removeError'))
    }
  }

  const handleSelectSort = (nextSortValue: StatusSortValue) => {
    setSortValue(nextSortValue)
    onControlsChange({ sortValue: nextSortValue, statuses: activeStatusFilters })
    setCurrentPage(0)
    setShowSortMenu(false)
  }

  return (
    <section className="profile-card profile-status-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-status-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">{t('profile.tab.status')}</span>
            <h2>
              {isOwnerView
                ? t('profileStatus.ownerTitle')
                : t('profileStatus.publicTitle')}
            </h2>
            <p>
              {isOwnerView
                ? t('profileStatus.ownerText')
                : t('profileStatus.publicText')}
            </p>
          </div>

          <div className="profile-meta-item profile-status-summary">
            <span>{t('profileStatus.totalSaved')}</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        <div className="profile-status-toolbar">
          {isOwnerView ? (
            <div className="profile-status-toolbar-control profile-status-search-shell">
              <label className="profile-status-search-field" htmlFor="profile-status-search-input">
                <span>{t('profileStatus.searchLabel')}</span>
                <input
                  id="profile-status-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={event => handleSearchChange(event.target.value)}
                  className="profile-input"
                  placeholder={t('profileStatus.searchPlaceholder')}
                  autoComplete="off"
                  disabled={isCreatingStatus}
                  aria-expanded={shouldShowAutosuggest || shouldShowEmptyAutosuggest}
                  aria-controls={searchResultsId}
                />
              </label>

              {trimmedSearchQuery.length === 1 && !searchLoading ? (
                <p className="profile-status-search-helper">
                  {t('profileStatus.keepTyping')}
                </p>
              ) : null}

              {shouldShowAutosuggest || shouldShowEmptyAutosuggest ? (
                <div className="profile-status-autosuggest" id={searchResultsId}>
                  {searchLoading ? (
                    <p className="profile-status-autosuggest-state">{t('profileStatus.searching')}</p>
                  ) : searchError ? (
                    <p className="profile-status-autosuggest-state is-error">{searchError}</p>
                  ) : shouldShowEmptyAutosuggest ? (
                    <p className="profile-status-autosuggest-state">
                      {t('profileStatus.emptySearch')}
                    </p>
                  ) : (
                    searchResultItems.map(result => {
                      const { game, existingItem, isTracked, statusLabel, isFavorite } = result
                      const autosuggestContent = (
                        <>
                          <div className="profile-status-autosuggest-cover">
                            {game.capa_url ? (
                              <GameCoverImage
                                src={game.capa_url}
                                alt={t('catalog.coverAlt', { title: game.titulo })}
                                width={64}
                                height={64}
                                sizes="64px"
                              />
                            ) : (
                              <div className="profile-status-autosuggest-fallback">
                                {getInitial(game.titulo)}
                              </div>
                            )}
                          </div>

                          <div className="profile-status-autosuggest-copy">
                            <div className="profile-status-autosuggest-heading">
                              <strong>{game.titulo}</strong>
                            </div>

                            <div className="profile-status-autosuggest-meta">
                              <span
                                className={`profile-status-autosuggest-hint${isTracked ? ' is-tracked' : ''}`}
                              >
                                {isTracked ? t('profileStatus.alreadyTracked') : t('profileStatus.addToProfile')}
                              </span>

                              {isTracked && existingItem ? (
                                <span
                                  className={`profile-status-search-badge is-${existingItem.status}`}
                                >
                                  {statusLabel}
                                </span>
                              ) : null}

                              {isFavorite ? (
                                <span className="profile-status-search-badge is-favorite">
                                  {t('profileStatus.favoriteBadge')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </>
                      )

                      if (isTracked) {
                        return (
                          <div
                            key={game.id}
                            className="profile-status-autosuggest-item is-tracked"
                            aria-label={`${game.titulo} ${t('profileStatus.alreadyTracked')} ${statusLabel || t('common.status')}${isFavorite ? `, ${t('profileStatus.favoriteBadge')}` : ''}.`}
                          >
                            {autosuggestContent}
                          </div>
                        )
                      }

                      return (
                        <button
                          key={game.id}
                          type="button"
                          className="profile-status-autosuggest-item is-actionable"
                          onClick={() => handleSelectGame(game)}
                        >
                          {autosuggestContent}
                        </button>
                      )
                    })
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="profile-status-toolbar-control profile-status-toolbar-placeholder"></div>
          )}

          <div className="profile-status-toolbar-control">
            <div className="profile-status-sort-field">
              <span className="profile-status-toolbar-label">{t('profileStatus.sortAndStatus')}</span>

              <div className="profile-status-sort" ref={sortMenuRef}>
                <button
                  type="button"
                  className={`profile-status-sort-trigger${showSortMenu ? ' is-open' : ''}`}
                  onClick={() => setShowSortMenu(currentValue => !currentValue)}
                  aria-haspopup="menu"
                  aria-expanded={showSortMenu}
                  aria-label={t('profileStatus.sortAria', {
                    sort: sortLabel,
                    status: statusFilterSummary,
                  })}
                >
                  <span className="profile-status-sort-trigger-copy">
                    <strong>{sortLabel}</strong>
                    <span className="profile-status-sort-trigger-meta">{statusFilterSummary}</span>
                  </span>
                </button>

                {showSortMenu ? (
                  <div className="profile-status-sort-menu" role="menu" aria-label={t('profileStatus.sortAndStatus')}>
                    <div className="profile-status-sort-section">
                      <span className="profile-status-sort-section-label">{t('profileStatus.sortSection')}</span>

                      {statusSortOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`profile-status-sort-option${sortValue === option.value ? ' is-active' : ''}`}
                          onClick={() => handleSelectSort(option.value)}
                          role="menuitemradio"
                          aria-checked={sortValue === option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="profile-status-sort-section">
                      <div className="profile-status-sort-section-head">
                        <span className="profile-status-sort-section-label">Status</span>

                        {hasActiveStatusFilters ? (
                          <button
                            type="button"
                            className="profile-status-sort-clear"
                            onClick={handleClearStatusFilters}
                          >
                            {t('common.clear')}
                          </button>
                        ) : null}
                      </div>

                      <div className="profile-status-sort-filter-list">
                        {statusOptions.map(option => {
                          const isActive = activeStatusFilterSet.has(option.value)

                          return (
                            <button
                              key={`sort-filter-${option.value}`}
                              type="button"
                              className={`profile-status-sort-filter-option is-${option.value}${isActive ? ' is-active' : ''}`}
                              onClick={() => handleToggleStatusFilter(option.value)}
                              role="menuitemcheckbox"
                              aria-checked={isActive}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {visibleSelectedGame ? (
          <form className="profile-status-composer" onSubmit={handleCreateStatus}>
            <div className="profile-status-composer-preview">
              <div className="profile-status-composer-cover">
                {visibleSelectedGame.capa_url ? (
                  <GameCoverImage
                    src={visibleSelectedGame.capa_url}
                    alt={t('catalog.coverAlt', { title: visibleSelectedGame.titulo })}
                    width={92}
                    height={92}
                    sizes="92px"
                  />
                ) : (
                  <div className="profile-status-card-fallback">
                    {getInitial(visibleSelectedGame.titulo)}
                  </div>
                )}
              </div>

              <div className="profile-status-composer-copy">
                <span className="profile-section-label">{t('profileStatus.newGame')}</span>
                <h3>{visibleSelectedGame.titulo}</h3>
                <p>{t('profileStatus.composerText')}</p>
              </div>
            </div>

            <div className="profile-status-composer-actions">
              <label className="profile-status-control-field">
                <span>{t('profileStatus.initialStatus')}</span>
                <select
                  value={composerStatus}
                  className="profile-status-select"
                  onChange={event => setComposerStatus(event.target.value as GameStatusValue)}
                  disabled={isCreatingStatus}
                >
                  {statusOptions.map(option => (
                    <option key={`composer-status-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="profile-status-composer-buttons">
                <button
                  type="button"
                  className={`profile-status-favorite-toggle${composerFavorito ? ' is-active' : ''}`}
                  aria-pressed={composerFavorito}
                  onClick={() => setComposerFavorito(currentValue => !currentValue)}
                  disabled={isCreatingStatus}
                >
                  {composerFavorito ? t('profileStatus.favoriteActive') : t('profileStatus.markFavorite')}
                </button>

                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={handleCancelSelectedGame}
                  disabled={isCreatingStatus}
                >
                  {t('common.cancel')}
                </button>

                <button type="submit" className="profile-save-button" disabled={isCreatingStatus}>
                  {isCreatingStatus ? t('common.saving') : t('profileStatus.saveToProfile')}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {actionError ? <p className="profile-feedback is-error">{actionError}</p> : null}

        {isLoading ? (
          <div className="profile-status-empty">
            <h3>{isOwnerView ? t('profileStatus.loadingOwner') : t('profileStatus.loadingPublic')}</h3>
            <p>
              {isOwnerView
                ? t('profileStatus.loadingOwnerText')
                : t('profileStatus.loadingPublicText')}
            </p>
            <div className="profile-status-skeleton-grid" style={statusGridStyle} aria-hidden="true">
              {Array.from({ length: Math.min(gridColumns * 2, 12) }, (_, index) => (
                <span key={`status-skeleton-${index}`} className="profile-status-skeleton-card" />
              ))}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="profile-status-empty">
            <h3>{t('profileStatus.errorTitle')}</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={() => void onRefresh()}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : !hasSavedStatusItems ? (
          <div className="profile-status-empty">
            <h3>{isOwnerView ? t('profileStatus.emptyOwner') : t('profileStatus.emptyPublic')}</h3>
            <p>
              {isOwnerView
                ? t('profileStatus.emptyOwnerText')
                : t('profileStatus.emptyPublicText')}
            </p>
          </div>
        ) : !hasVisibleStatusItems ? (
          <div className="profile-status-empty">
            <h3>{t('profileStatus.emptyFilterTitle')}</h3>
            <p>{t('profileStatus.emptyFilterText')}</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={handleClearStatusFilters}
            >
              {t('profileStatus.clearFilters')}
            </button>
          </div>
        ) : (
          <>
            <div className="profile-status-list-head">
              <p>
                {sortedItems.length === 1
                  ? t('profileStatus.foundOneFiltered', {
                      suffix: hasActiveStatusFilters
                        ? t('profileStatus.withFilters')
                        : t('profileStatus.inView'),
                    })
                  : t('profileStatus.foundManyFiltered', {
                      count: sortedItems.length,
                      suffix: hasActiveStatusFilters
                        ? t('profileStatus.withFilters')
                        : t('profileStatus.inView'),
                    })}
                {totalCount !== null && totalCount > sortedItems.length
                  ? t('profileStatus.notLoaded', { count: totalCount - sortedItems.length })
                  : ''}
              </p>
              <span>
                {t('profileStatus.page', { page: safeCurrentPage + 1, total: totalPages })}
              </span>
            </div>

            <div className="profile-status-grid" style={statusGridStyle}>
              {visibleItems.map(item => {
                const visibleTitle = item.jogo?.titulo || t('common.gameUnavailable')
                const isSavingItem = savingItemIds.includes(item.id)
                const isRemovingItem = removingItemIds.includes(item.id)
                const isBusyItem = isSavingItem || isRemovingItem

                return (
                  <article
                    key={item.id}
                    className={`profile-status-card${item.favorito ? ' is-favorite' : ''}${isBusyItem ? ' is-saving' : ''}`}
                  >
                    <Link to={`/games/${item.jogo_id}`} className="profile-status-card-link">
                      <div className="profile-status-card-meta">
                        <span className={`profile-status-pill is-${item.status}`}>
                          {getStatusLabel(item.status)}
                        </span>
                        {item.favorito ? (
                          <span className="profile-status-favorite-pill">{t('profileStatus.favoriteBadge')}</span>
                        ) : null}
                      </div>

                      <div className="profile-status-card-cover">
                        {item.jogo?.capa_url ? (
                          <GameCoverImage
                            src={item.jogo.capa_url}
                            alt={t('catalog.coverAlt', { title: visibleTitle })}
                            width={430}
                            height={200}
                            sizes="(max-width: 768px) 100vw, 17vw"
                          />
                        ) : (
                          <div className="profile-status-card-fallback">{getInitial(visibleTitle)}</div>
                        )}
                      </div>

                      <div className="profile-status-card-body">
                        <span className="profile-status-date">
                          {t('profileStatus.updatedAt', { date: formatStatusDate(item.created_at) })}
                        </span>
                        <h3>{visibleTitle}</h3>
                        <span className="profile-status-card-cta">{t('common.viewDetails')}</span>
                      </div>
                    </Link>

                    {isOwnerView ? (
                      <div className="profile-status-card-actions">
                        <label className="profile-status-control-field">
                          <span>{t('common.status')}</span>
                          <select
                            value={item.status}
                            className="profile-status-select"
                            onChange={event =>
                              void handleUpdateExistingItem(
                                item,
                                event.target.value as GameStatusValue,
                                item.favorito
                              )
                            }
                            disabled={isBusyItem}
                          >
                            {statusOptions.map(option => (
                              <option key={`${item.id}-${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="profile-status-card-action-row">
                          <button
                            type="button"
                            className={`profile-status-favorite-toggle${item.favorito ? ' is-active' : ''}`}
                            aria-pressed={item.favorito}
                            onClick={() =>
                              void handleUpdateExistingItem(item, item.status, !item.favorito)
                            }
                            disabled={isBusyItem}
                          >
                            {item.favorito ? t('profileStatus.favoriteActive') : t('profileStatus.markFavorite')}
                          </button>

                          <button
                            type="button"
                            className="profile-secondary-button profile-item-remove-button"
                            onClick={() => void handleDeleteItem(item)}
                            disabled={isBusyItem}
                          >
                            {t('common.remove')}
                          </button>

                          {isBusyItem ? (
                            <span className="profile-status-saving-label">
                              {isRemovingItem ? t('common.removing') : t('common.saving')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <PaginationControls
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onChangePage={setCurrentPage}
              label={t('profileStatus.paginationLabel')}
              previousLabel={t('profileStatus.previous')}
              nextLabel={t('profileStatus.next')}
            />

            {hasMore ? (
              <button
                type="button"
                className="profile-secondary-button profile-status-load-more"
                onClick={() => void onLoadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t('common.loading') : t('profileStatus.moreGames')}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
})
