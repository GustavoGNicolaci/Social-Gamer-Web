import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  type GameStatusItem,
  type GameStatusValue,
} from '../../services/gameStatusService'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../services/gameCatalogService'
import './ProfileGameStatusSection.css'

type StatusSortValue = 'recent' | 'oldest' | 'favorites' | 'title'

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
  isOwnerView: boolean
  onSaveStatus: (params: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => Promise<SaveStatusResult>
  onDeleteStatus: (itemId: string) => Promise<DeleteStatusResult>
  onRefresh: () => Promise<void>
}

interface StatusSearchResultItem {
  game: CatalogGamePreview
  existingItem: GameStatusItem | null
  isTracked: boolean
  statusLabel: string | null
  isFavorite: boolean
}

const SEARCH_DEBOUNCE_DELAY = 220
const STATUS_SORT_OPTIONS: Array<{ value: StatusSortValue; label: string }> = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'favorites', label: 'Favoritos primeiro' },
  { value: 'title', label: 'Titulo A-Z' },
]

const STATUS_OPTIONS: Array<{ value: GameStatusValue; label: string }> = [
  { value: 'jogando', label: 'Jogando' },
  { value: 'zerado', label: 'Zerei' },
  { value: 'dropado', label: 'Dropei' },
]

function formatCompactDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function getStatusLabel(status: GameStatusValue) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label || 'Status'
}

function getStatusGridColumns(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 6
}

function getStatusSearchErrorMessage(error: GameCatalogError | null) {
  if (!error) {
    return 'Nao foi possivel buscar jogos agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel buscar jogos por permissao. Verifique as policies das tabelas jogos e status_jogo no Supabase.'
  }

  return 'Nao foi possivel buscar jogos agora.'
}

function sortStatusItems(items: GameStatusItem[], sortValue: StatusSortValue) {
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
      return leftTitle.localeCompare(rightTitle, 'pt-BR')
    }

    if (sortValue === 'oldest') {
      if (oldestDelta !== 0) return oldestDelta
      if (leftItem.favorito !== rightItem.favorito) {
        return leftItem.favorito ? -1 : 1
      }
      return leftTitle.localeCompare(rightTitle, 'pt-BR')
    }

    if (sortValue === 'title') {
      const titleDelta = leftTitle.localeCompare(rightTitle, 'pt-BR')
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
    return leftTitle.localeCompare(rightTitle, 'pt-BR')
  })
}

function PaginationControls({
  currentPage,
  totalPages,
  onChangePage,
}: {
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <nav className="profile-status-pagination" aria-label="Paginacao dos jogos do perfil">
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 0))}
        disabled={currentPage === 0}
      >
        Anterior
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
        Proxima
      </button>
    </nav>
  )
}

export function ProfileGameStatusSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  isOwnerView,
  onSaveStatus,
  onDeleteStatus,
  onRefresh,
}: ProfileGameStatusSectionProps) {
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
    [searchResults, trackedItemsByGameId]
  )
  const filteredItems = useMemo(() => {
    if (activeStatusFilters.length === 0) return items

    return items.filter(item => activeStatusFilterSet.has(item.status))
  }, [activeStatusFilterSet, activeStatusFilters.length, items])
  const activeStatusFilterOptions = useMemo(
    () => STATUS_OPTIONS.filter(option => activeStatusFilterSet.has(option.value)),
    [activeStatusFilterSet]
  )
  const sortedItems = useMemo(() => sortStatusItems(filteredItems, sortValue), [filteredItems, sortValue])
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
  const sortLabel = STATUS_SORT_OPTIONS.find(option => option.value === sortValue)?.label || 'Mais recentes'
  const statusFilterSummary = useMemo(() => {
    if (activeStatusFilterOptions.length === 0) return 'Todos os status'
    if (activeStatusFilterOptions.length <= 2) {
      return activeStatusFilterOptions.map(option => option.label).join(', ')
    }

    return `${activeStatusFilterOptions.length} status ativos`
  }, [activeStatusFilterOptions])

  const handleToggleStatusFilter = (status: GameStatusValue) => {
    setActiveStatusFilters(currentFilters => {
      if (currentFilters.includes(status)) {
        return currentFilters.filter(currentStatus => currentStatus !== status)
      }

      return [...currentFilters, status]
    })
    setCurrentPage(0)
  }

  const handleClearStatusFilters = () => {
    setActiveStatusFilters([])
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
        setSearchError(getStatusSearchErrorMessage(error))
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
      setActionError(result.message || 'Nao foi possivel salvar o status deste jogo.')
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
      setActionError(result.message || 'Nao foi possivel atualizar o status deste jogo.')
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
      setActionError(result.message || 'Nao foi possivel remover este jogo do perfil.')
    }
  }

  const handleSelectSort = (nextSortValue: StatusSortValue) => {
    setSortValue(nextSortValue)
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
            <span className="profile-section-label">Status dos jogos</span>
            <h2>
              {isOwnerView
                ? 'Uma lista so para tudo o que ja entrou no seu perfil'
                : 'Os jogos que este perfil ja adicionou e organizou'}
            </h2>
            <p>
              {isOwnerView
                ? 'Busque rapido, organize por filtro e navegue pela sua colecao no mesmo ritmo da lista de jogos que voce quer jogar.'
                : 'Explore os jogos deste perfil por status, favoritos e ordem de visualizacao.'}
            </p>
          </div>

          <div className="profile-meta-item profile-status-summary">
            <span>Total salvo</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        <div className="profile-status-toolbar">
          {isOwnerView ? (
            <div className="profile-status-toolbar-control profile-status-search-shell">
              <label className="profile-status-search-field" htmlFor="profile-status-search-input">
                <span>Buscar jogo no catalogo</span>
                <input
                  id="profile-status-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={event => handleSearchChange(event.target.value)}
                  className="profile-input"
                  placeholder="Digite para ver resultados imediatos..."
                  autoComplete="off"
                  disabled={isCreatingStatus}
                  aria-expanded={shouldShowAutosuggest || shouldShowEmptyAutosuggest}
                  aria-controls={searchResultsId}
                />
              </label>

              {trimmedSearchQuery.length === 1 && !searchLoading ? (
                <p className="profile-status-search-helper">
                  Continue digitando para mostrar sugestoes do catalogo.
                </p>
              ) : null}

              {shouldShowAutosuggest || shouldShowEmptyAutosuggest ? (
                <div className="profile-status-autosuggest" id={searchResultsId}>
                  {searchLoading ? (
                    <p className="profile-status-autosuggest-state">Buscando jogos...</p>
                  ) : searchError ? (
                    <p className="profile-status-autosuggest-state is-error">{searchError}</p>
                  ) : shouldShowEmptyAutosuggest ? (
                    <p className="profile-status-autosuggest-state">
                      Nenhum jogo encontrado para esse termo.
                    </p>
                  ) : (
                    searchResultItems.map(result => {
                      const { game, existingItem, isTracked, statusLabel, isFavorite } = result
                      const autosuggestContent = (
                        <>
                          <div className="profile-status-autosuggest-cover">
                            {game.capa_url ? (
                              <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
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
                                {isTracked ? 'Ja adicionado ao perfil' : 'Adicionar ao perfil'}
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
                                  Favorito
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
                            aria-label={`${game.titulo} ja adicionado ao perfil em ${statusLabel || 'Status'}${isFavorite ? ', favorito' : ''}.`}
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
              <span className="profile-status-toolbar-label">Ordenacao e status</span>

              <div className="profile-status-sort" ref={sortMenuRef}>
                <button
                  type="button"
                  className={`profile-status-sort-trigger${showSortMenu ? ' is-open' : ''}`}
                  onClick={() => setShowSortMenu(currentValue => !currentValue)}
                  aria-haspopup="menu"
                  aria-expanded={showSortMenu}
                  aria-label={`Ordenar e filtrar jogos do perfil. Ordem atual: ${sortLabel}. Status ativos: ${statusFilterSummary}.`}
                >
                  <span className="profile-status-sort-trigger-copy">
                    <strong>{sortLabel}</strong>
                    <span className="profile-status-sort-trigger-meta">{statusFilterSummary}</span>
                  </span>
                </button>

                {showSortMenu ? (
                  <div className="profile-status-sort-menu" role="menu" aria-label="Ordenar e filtrar jogos do perfil">
                    <div className="profile-status-sort-section">
                      <span className="profile-status-sort-section-label">Ordenacao</span>

                      {STATUS_SORT_OPTIONS.map(option => (
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
                            Limpar
                          </button>
                        ) : null}
                      </div>

                      <div className="profile-status-sort-filter-list">
                        {STATUS_OPTIONS.map(option => {
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
                  <img
                    src={visibleSelectedGame.capa_url}
                    alt={`Capa do jogo ${visibleSelectedGame.titulo}`}
                  />
                ) : (
                  <div className="profile-status-card-fallback">
                    {getInitial(visibleSelectedGame.titulo)}
                  </div>
                )}
              </div>

              <div className="profile-status-composer-copy">
                <span className="profile-section-label">Novo jogo no perfil</span>
                <h3>{visibleSelectedGame.titulo}</h3>
                <p>Escolha o status inicial e confirme se ele deve entrar como favorito.</p>
              </div>
            </div>

            <div className="profile-status-composer-actions">
              <label className="profile-status-control-field">
                <span>Status inicial</span>
                <select
                  value={composerStatus}
                  className="profile-status-select"
                  onChange={event => setComposerStatus(event.target.value as GameStatusValue)}
                  disabled={isCreatingStatus}
                >
                  {STATUS_OPTIONS.map(option => (
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
                  {composerFavorito ? 'Favorito ativo' : 'Marcar favorito'}
                </button>

                <button
                  type="button"
                  className="profile-secondary-button"
                  onClick={handleCancelSelectedGame}
                  disabled={isCreatingStatus}
                >
                  Cancelar
                </button>

                <button type="submit" className="profile-save-button" disabled={isCreatingStatus}>
                  {isCreatingStatus ? 'Salvando...' : 'Salvar no perfil'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {actionError ? <p className="profile-feedback is-error">{actionError}</p> : null}

        {isLoading ? (
          <div className="profile-status-empty">
            <h3>{isOwnerView ? 'Carregando seus jogos' : 'Carregando jogos deste perfil'}</h3>
            <p>
              {isOwnerView
                ? 'Estamos montando a grade com tudo o que voce adicionou ao seu perfil.'
                : 'Estamos montando a grade com tudo o que este perfil adicionou.'}
            </p>
          </div>
        ) : errorMessage ? (
          <div className="profile-status-empty">
            <h3>Ocorreu um problema ao carregar os jogos deste perfil</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={() => void onRefresh()}
            >
              Tentar novamente
            </button>
          </div>
        ) : !hasSavedStatusItems ? (
          <div className="profile-status-empty">
            <h3>{isOwnerView ? 'Seu perfil ainda nao tem jogos salvos' : 'Este perfil ainda nao tem jogos salvos'}</h3>
            <p>
              {isOwnerView
                ? 'Use a busca acima para adicionar o primeiro jogo e começar a organizar seu perfil.'
                : 'Quando este usuario adicionar jogos ao perfil, eles vao aparecer aqui.'}
            </p>
          </div>
        ) : !hasVisibleStatusItems ? (
          <div className="profile-status-empty">
            <h3>Nenhum jogo corresponde aos filtros atuais</h3>
            <p>Selecione outros status ou limpe os filtros para voltar a visualizar toda a lista.</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={handleClearStatusFilters}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="profile-status-list-head">
              <p>
                {sortedItems.length === 1
                  ? `1 jogo encontrado${hasActiveStatusFilters ? ' com os filtros atuais.' : ' nesta visualizacao.'}`
                  : `${sortedItems.length} jogos encontrados${hasActiveStatusFilters ? ' com os filtros atuais.' : ' nesta visualizacao.'}`}
              </p>
              <span>
                Pagina {safeCurrentPage + 1} de {totalPages}
              </span>
            </div>

            <div className="profile-status-grid" style={statusGridStyle}>
              {visibleItems.map(item => {
                const visibleTitle = item.jogo?.titulo || 'Jogo indisponivel'
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
                          <span className="profile-status-favorite-pill">Favorito</span>
                        ) : null}
                      </div>

                      <div className="profile-status-card-cover">
                        {item.jogo?.capa_url ? (
                          <img src={item.jogo.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
                        ) : (
                          <div className="profile-status-card-fallback">{getInitial(visibleTitle)}</div>
                        )}
                      </div>

                      <div className="profile-status-card-body">
                        <span className="profile-status-date">
                          Atualizado em {formatCompactDate(item.created_at)}
                        </span>
                        <h3>{visibleTitle}</h3>
                        <span className="profile-status-card-cta">Ver detalhes</span>
                      </div>
                    </Link>

                    {isOwnerView ? (
                      <div className="profile-status-card-actions">
                        <label className="profile-status-control-field">
                          <span>Status</span>
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
                            {STATUS_OPTIONS.map(option => (
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
                            {item.favorito ? 'Favorito ativo' : 'Marcar favorito'}
                          </button>

                          <button
                            type="button"
                            className="profile-secondary-button profile-item-remove-button"
                            onClick={() => void handleDeleteItem(item)}
                            disabled={isBusyItem}
                          >
                            Remover
                          </button>

                          {isBusyItem ? (
                            <span className="profile-status-saving-label">
                              {isRemovingItem ? 'Removendo...' : 'Salvando...'}
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
            />
          </>
        )}
      </div>
    </section>
  )
}
