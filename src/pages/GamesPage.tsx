import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GameCoverImage } from '../components/GameCoverImage'
import RatingCircle from '../components/RatingCircle'
import {
  type GameRatingSummary,
} from '../services/reviewService'
import {
  getCatalogFacetOptions,
  getCatalogGamesPage,
  type CatalogGamePreview,
  type CatalogSortOption,
} from '../services/gameCatalogService'
import { formatLocalizedDate, formatLocalizedNumber, getRuntimeLocale } from '../i18n'
import { useI18n } from '../i18n/I18nContext'
import './GamesPage.css'

type Game = CatalogGamePreview

interface ActiveChipProps {
  label: string
  onRemove: () => void
}

interface GameCardProps {
  game: Game
  ratingSummary: GameRatingSummary | null
  onShowGenres: (genres: string[]) => void
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
}

type CatalogFilterCategory = 'title' | 'game' | 'genre' | 'platform' | 'developer'
type FacetCategory = Extract<CatalogFilterCategory, 'genre' | 'platform' | 'developer'>

interface CatalogFilterToken {
  key: string
  category: CatalogFilterCategory
  value: string
  label: string
  gameId?: number
}

const DEFAULT_CATALOG_SORT: CatalogSortOption = 'release-desc'

const CATALOG_SORT_OPTIONS: Array<{
  value: CatalogSortOption
  labelKey: string
}> = [
  { value: 'release-desc', labelKey: 'catalog.sort.releaseDesc' },
  { value: 'release-asc', labelKey: 'catalog.sort.releaseAsc' },
  { value: 'rating-desc', labelKey: 'catalog.sort.ratingDesc' },
  { value: 'rating-asc', labelKey: 'catalog.sort.ratingAsc' },
]

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function formatDate(value: string | null | undefined, fallback?: string) {
  return formatLocalizedDate(value, { fallback })
}

function formatCatalogRating(value: number) {
  return formatLocalizedNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

function initial(value: string) {
  const first = value.trim().charAt(0)
  return first ? first.toUpperCase() : 'J'
}

function getGamesGridColumns(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 5
}

function getFacetLabelPrefix(category: FacetCategory, t: (key: string) => string) {
  if (category === 'genre') return t('catalog.filter.genrePrefix')
  if (category === 'platform') return t('catalog.filter.platformPrefix')
  return t('catalog.filter.developerPrefix')
}

function sortAlphabetically(values: string[]) {
  return values.sort((left, right) => left.localeCompare(right, getRuntimeLocale()))
}

function getCatalogSortOption(value: string | null): CatalogSortOption {
  return CATALOG_SORT_OPTIONS.some(option => option.value === value)
    ? (value as CatalogSortOption)
    : DEFAULT_CATALOG_SORT
}

function buildFacetToken(category: FacetCategory, value: string, t: (key: string) => string): CatalogFilterToken {
  return {
    key: `${category}-${value.toLowerCase()}`,
    category,
    value,
    label: `${getFacetLabelPrefix(category, t)}: ${value}`,
  }
}

function getFacetTokenLabel(token: CatalogFilterToken, t: (key: string) => string) {
  return `${getFacetLabelPrefix(token.category as FacetCategory, t)}: ${token.value}`
}

function buildVisibleFacetOptions(options: string[], inputValue: string, limit?: number) {
  const normalizedInputValue = inputValue.trim().toLowerCase()
  const filteredOptions =
    normalizedInputValue.length === 0
      ? options
      : options.filter(option => option.toLowerCase().includes(normalizedInputValue))

  return typeof limit === 'number' ? filteredOptions.slice(0, limit) : filteredOptions
}

function ActiveChip({ label, onRemove }: ActiveChipProps) {
  const { t } = useI18n()

  return (
    <span className="gp-chip">
      <span>{label}</span>
      <button type="button" aria-label={t('catalog.removeFilter', { label })} onClick={onRemove}>
        x
      </button>
    </span>
  )
}

function StaticChip({ label }: { label: string }) {
  return <span className="gp-chip gp-chip--static">{label}</span>
}

const GameCard = memo(function GameCard({ game, ratingSummary, onShowGenres }: GameCardProps) {
  const { t } = useI18n()
  const genres = normalizeList(game.generos)
  const displayedGenres = genres.slice(0, 2)
  const hasMoreGenres = genres.length > 2
  const averageRating = ratingSummary?.averageRating ?? null
  const ratingAriaLabel =
    averageRating === null
      ? t('catalog.noRatingFor', { title: game.titulo })
      : t('catalog.averageFor', { rating: formatCatalogRating(averageRating), title: game.titulo })

  return (
    <article className="gp-game">
      <Link to={`/games/${game.id}`} className="gp-cover">
        {game.capa_url ? (
          <GameCoverImage
            src={game.capa_url}
            alt={t('catalog.coverAlt', { title: game.titulo })}
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          <div className="gp-fallback">{initial(game.titulo)}</div>
        )}

        <div className="gp-cover-top">
          <span className="gp-date">{formatDate(game.data_lancamento, t('common.notProvided'))}</span>
        </div>

        <div className="gp-cover-rating">
          <RatingCircle value={averageRating} size={52} ariaLabel={ratingAriaLabel} />
        </div>
      </Link>

      <div className="gp-game-body">
        <div className="gp-game-head">
          <h3 title={game.titulo}>{game.titulo}</h3>
        </div>

        <div className="gp-tags">
          {displayedGenres.length > 0 ? (
            displayedGenres.map(genre => (
              <span key={genre} className="genre-chip gp-tag">
                {genre}
              </span>
            ))
          ) : (
            <span className="gp-muted">{t('catalog.noGenres')}</span>
          )}

          {hasMoreGenres ? (
            <button type="button" className="gp-more" onClick={() => onShowGenres(genres)}>
              +{genres.length - displayedGenres.length}
            </button>
          ) : null}
        </div>

        <div className="gp-meta">
          <div className="gp-meta-row">
            <span>{t('common.studio')}</span>
            <strong title={formatList(game.desenvolvedora, t('common.notProvided'))}>
              {formatList(game.desenvolvedora, t('common.notProvided'))}
            </strong>
          </div>
          <div className="gp-meta-row">
            <span>{t('common.platforms')}</span>
            <strong title={formatList(game.plataformas, t('common.notProvidedPlural'))}>
              {formatList(game.plataformas, t('common.notProvidedPlural'))}
            </strong>
          </div>
        </div>
      </div>

      <Link to={`/games/${game.id}`} className="game-button gp-btn--primary">
        {t('common.viewDetails')}
      </Link>
    </article>
  )
})

function PaginationControls({ currentPage, totalPages, onChangePage }: PaginationProps) {
  const { t } = useI18n()

  if (totalPages <= 1) return null

  return (
    <nav className="gp-pagination" aria-label={t('catalog.pagination')}>
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        {t('catalog.previous')}
      </button>

      {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
        <button
          key={page}
          type="button"
          onClick={() => onChangePage(page)}
          className={page === currentPage ? 'is-active' : ''}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChangePage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        {t('catalog.next')}
      </button>
    </nav>
  )
}

function GamesPage() {
  const { t, formatNumber } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<Game[]>([])
  const [ratingSummariesByGameId, setRatingSummariesByGameId] = useState<Map<number, GameRatingSummary>>(
    () => new Map()
  )
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [ratingsError, setRatingsError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [availableFacets, setAvailableFacets] = useState({
    genres: [] as string[],
    platforms: [] as string[],
    developers: [] as string[],
  })
  const [facetFilters, setFacetFilters] = useState<CatalogFilterToken[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [gridColumns, setGridColumns] = useState(() =>
    typeof window === 'undefined' ? 5 : getGamesGridColumns(window.innerWidth)
  )
  const [showGenresModal, setShowGenresModal] = useState(false)
  const [selectedGameGenres, setSelectedGameGenres] = useState<string[]>([])
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [filtersModalSearch, setFiltersModalSearch] = useState('')

  const navbarQuery = searchParams.get('q')?.trim() || ''
  const catalogSort = getCatalogSortOption(searchParams.get('sort'))
  const trimmedModalSearch = filtersModalSearch.trim()
  const itemsPerPage = gridColumns * 4
  const genreFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'genre'),
    [facetFilters]
  )
  const platformFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'platform'),
    [facetFilters]
  )
  const developerFilterTokens = useMemo(
    () => facetFilters.filter(filter => filter.category === 'developer'),
    [facetFilters]
  )
  const selectedGenres = useMemo(
    () => genreFilterTokens.map(filter => filter.value),
    [genreFilterTokens]
  )
  const selectedPlatforms = useMemo(
    () => platformFilterTokens.map(filter => filter.value),
    [platformFilterTokens]
  )
  const selectedDevelopers = useMemo(
    () => developerFilterTokens.map(filter => filter.value),
    [developerFilterTokens]
  )

  useEffect(() => {
    let isMounted = true

    const fetchGames = async () => {
      setLoading(true)
      setRatingsError(null)
      setCatalogError(null)

      const result = await getCatalogGamesPage({
        page: currentPage,
        pageSize: itemsPerPage,
        query: navbarQuery,
        genres: selectedGenres,
        platforms: selectedPlatforms,
        developers: selectedDevelopers,
        sort: catalogSort,
      })

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao buscar jogos:', result.error)
        setGames([])
        setRatingSummariesByGameId(new Map())
        setTotalCount(0)
        setTotalPages(0)
        setCatalogError(result.error.message)
        setLoading(false)
        return
      }

      const nextGames = result.data.items
      setGames(nextGames)
      setTotalCount(result.data.totalCount)
      setTotalPages(result.data.totalPages)
      setRatingSummariesByGameId(() => {
        const nextSummaries = new Map<number, GameRatingSummary>()

        nextGames.forEach(game => {
          nextSummaries.set(game.id, {
            gameId: game.id,
            averageRating: game.averageRating ?? null,
            reviewCount: game.reviewCount ?? 0,
          })
        })

        return nextSummaries
      })
      setLoading(false)
    }

    void fetchGames()

    return () => {
      isMounted = false
    }
  }, [
    catalogSort,
    currentPage,
    itemsPerPage,
    navbarQuery,
    selectedDevelopers,
    selectedGenres,
    selectedPlatforms,
  ])

  useEffect(() => {
    let isMounted = true

    const fetchFacets = async () => {
      const result = await getCatalogFacetOptions(navbarQuery)

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao buscar filtros do catalogo:', result.error)
        setAvailableFacets({ genres: [], platforms: [], developers: [] })
        return
      }

      setAvailableFacets(result.data)
    }

    void fetchFacets()

    return () => {
      isMounted = false
    }
  }, [navbarQuery])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncGridColumns = () => {
      setGridColumns(getGamesGridColumns(window.innerWidth))
    }

    syncGridColumns()
    window.addEventListener('resize', syncGridColumns)

    return () => {
      window.removeEventListener('resize', syncGridColumns)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowGenresModal(false)
        setShowFiltersModal(false)
      }
    }

    if (!showGenresModal && !showFiltersModal) {
      return
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showFiltersModal, showGenresModal])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [catalogSort, facetFilters, navbarQuery])

  useEffect(() => {
    if (showFiltersModal) return

    const timeoutId = window.setTimeout(() => {
      setFiltersModalSearch('')
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showFiltersModal])

  const updateNavbarQuery = useCallback((value: string) => {
    const trimmedValue = value.trim()

    setSearchParams(
      currentParams => {
        const nextParams = new URLSearchParams(currentParams)

        if (trimmedValue) {
          nextParams.set('q', trimmedValue)
        } else {
          nextParams.delete('q')
        }

        return nextParams
      },
      { replace: true }
    )
  }, [setSearchParams])

  const updateCatalogSort = useCallback((nextSort: CatalogSortOption) => {
    setSearchParams(
      currentParams => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('sort', nextSort)

        return nextParams
      },
      { replace: true }
    )
  }, [setSearchParams])

  const toggleFacetFilter = useCallback((category: FacetCategory, value: string) => {
    setFacetFilters(currentFilters => {
      const normalizedValue = value.trim().toLowerCase()
      const alreadyExists = currentFilters.some(
        token => token.category === category && token.value.toLowerCase() === normalizedValue
      )

      if (alreadyExists) {
        return currentFilters.filter(
          token => !(token.category === category && token.value.toLowerCase() === normalizedValue)
        )
      }

      return [...currentFilters, buildFacetToken(category, value, t)]
    })
  }, [t])

  const isFacetFilterActive = useCallback(
    (category: FacetCategory, value: string) =>
      facetFilters.some(
        token => token.category === category && token.value.toLowerCase() === value.toLowerCase()
      ),
    [facetFilters]
  )

  const allGenres = useMemo(
    () => sortAlphabetically([...availableFacets.genres]),
    [availableFacets.genres]
  )

  const allPlatforms = useMemo(
    () => sortAlphabetically([...availableFacets.platforms]),
    [availableFacets.platforms]
  )

  const allDevelopers = useMemo(
    () => sortAlphabetically([...availableFacets.developers]),
    [availableFacets.developers]
  )

  const clearAllFilters = useCallback(() => {
    setFacetFilters([])
    setCurrentPage(1)
    setFiltersModalSearch('')

    if (navbarQuery) {
      updateNavbarQuery('')
    }
  }, [navbarQuery, updateNavbarQuery])

  const activeFilters = useMemo(
    () => [
      ...(navbarQuery
        ? [
            {
              key: `navbar-query-${navbarQuery.toLowerCase()}`,
              label: t('catalog.globalSearchChip', { query: navbarQuery }),
              onRemove: () => updateNavbarQuery(''),
            },
          ]
        : []),
      ...facetFilters.map(filter => ({
        key: filter.key,
        label: getFacetTokenLabel(filter, t),
        onRemove: () =>
          setFacetFilters(currentFilters =>
            currentFilters.filter(currentFilter => currentFilter.key !== filter.key)
          ),
      })),
    ],
    [facetFilters, navbarQuery, t, updateNavbarQuery]
  )

  const modalGenreOptions = useMemo(
    () => buildVisibleFacetOptions(allGenres, trimmedModalSearch),
    [allGenres, trimmedModalSearch]
  )
  const modalPlatformOptions = useMemo(
    () => buildVisibleFacetOptions(allPlatforms, trimmedModalSearch),
    [allPlatforms, trimmedModalSearch]
  )
  const modalDeveloperOptions = useMemo(
    () => buildVisibleFacetOptions(allDevelopers, trimmedModalSearch),
    [allDevelopers, trimmedModalSearch]
  )

  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages)
  const gamesToDisplay = games
  const visibleStart = totalCount === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1
  const visibleEnd = totalCount === 0 ? 0 : Math.min(visibleStart + gamesToDisplay.length - 1, totalCount)
  const rangeLabel =
    totalCount === 0
      ? t('catalog.rangeEmpty')
      : t('catalog.range', {
          start: formatNumber(visibleStart),
          end: formatNumber(visibleEnd),
          total: formatNumber(totalCount),
        })

  const gridStyle = useMemo(
    () => ({
      '--gp-grid-columns': String(gridColumns),
    }) as CSSProperties,
    [gridColumns]
  )

  const modalGroups = useMemo(
    () => [
      {
        key: 'genre-modal',
        category: 'genre' as const,
        title: t('common.genres'),
        options: modalGenreOptions,
      },
      {
        key: 'platform-modal',
        category: 'platform' as const,
        title: t('common.platforms'),
        options: modalPlatformOptions,
      },
      {
        key: 'developer-modal',
        category: 'developer' as const,
        title: t('common.studios'),
        options: modalDeveloperOptions,
      },
    ],
    [modalDeveloperOptions, modalGenreOptions, modalPlatformOptions, t]
  )

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleShowGenres = useCallback((genres: string[]) => {
    setSelectedGameGenres(genres)
    setShowGenresModal(true)
  }, [])

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-card">
            <span className="gp-badge">{t('common.catalog')}</span>
            <h1>{t('catalog.loadingTitle')}</h1>
            <p className="gp-muted">
              {t('catalog.loadingText')}
            </p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content games-page">
        <section className="gp-panel">
          <div className="gp-panel-head">
            <div className="gp-panel-copy">
              <span className="gp-badge">{t('common.catalog')}</span>
              <h1>{t('common.games')}</h1>
              <p className="gp-muted">
                {t('catalog.pageText')}
              </p>
            </div>

            <div className="gp-panel-summary">
              <label className="gp-sort-control">
                <span>{t('catalog.sortBy')}</span>
                <select
                  value={catalogSort}
                  onChange={event => updateCatalogSort(event.target.value as CatalogSortOption)}
                  aria-label={t('catalog.sortAria')}
                >
                  {CATALOG_SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="game-button gp-btn--secondary"
                onClick={() => setShowFiltersModal(true)}
              >
                {t('catalog.allFilters')}
              </button>
            </div>
          </div>

          <div className="gp-panel-footer">
            {activeFilters.length > 0 ? (
              <div className="gp-chips">
                {activeFilters.map(filter => (
                  <StaticChip key={`summary-${filter.key}`} label={filter.label} />
                ))}
              </div>
            ) : null}

            <p className="gp-panel-footnote">
              {navbarQuery
                ? t('catalog.globalSearchActive', { query: navbarQuery, range: rangeLabel })
                : rangeLabel}
            </p>

            {ratingsError ? <p className="gp-panel-footnote is-warning">{ratingsError}</p> : null}
            {catalogError ? <p className="gp-panel-footnote is-warning">{catalogError}</p> : null}
          </div>
        </section>

        {gamesToDisplay.length === 0 ? (
          <article className="gp-empty">
            <span className="gp-badge">{t('common.noResults')}</span>
            <h3>{t('catalog.emptyTitle')}</h3>
            <p className="gp-muted">
              {t('catalog.emptyText')}
            </p>
            <button
              type="button"
              className="game-button gp-btn--secondary"
              onClick={() => setShowFiltersModal(true)}
            >
              {t('catalog.allFilters')}
            </button>
          </article>
        ) : (
          <>
            <div className="gp-grid" style={gridStyle}>
              {gamesToDisplay.map(game => (
                <GameCard
                  key={game.id}
                  game={game}
                  ratingSummary={ratingSummariesByGameId.get(game.id) || null}
                  onShowGenres={handleShowGenres}
                />
              ))}
            </div>

            <div className="gp-results-footer">
              <p className="gp-panel-footnote">{rangeLabel}</p>
              <PaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onChangePage={setCurrentPage}
              />
            </div>
          </>
        )}

        {showFiltersModal ? (
          <div className="gp-modal" onClick={() => setShowFiltersModal(false)}>
            <div
              className="gp-modal-card gp-filters-modal"
              onClick={event => event.stopPropagation()}
            >
              <div className="gp-modal-head">
                <div>
                  <span className="gp-badge">{t('catalog.allFilters')}</span>
                  <h3>{t('catalog.filtersTitle')}</h3>
                  <p className="gp-muted">
                    {t('catalog.filtersText')}
                  </p>
                </div>

                <button
                  type="button"
                  className="gp-modal-close"
                  aria-label={t('catalog.closeFilters')}
                  onClick={() => setShowFiltersModal(false)}
                >
                  x
                </button>
              </div>

              <label className="gp-modal-search">
                <span className="gp-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M21 21L16.65 16.65M18 11C18 14.866 14.866 18 11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <input
                  type="text"
                  value={filtersModalSearch}
                  placeholder={t('catalog.searchFiltersPlaceholder')}
                  onChange={event => setFiltersModalSearch(event.target.value)}
                />
              </label>

              {activeFilters.length > 0 ? (
                <div className="gp-chips">
                  {activeFilters.map(filter => (
                    <ActiveChip key={`modal-${filter.key}`} label={filter.label} onRemove={filter.onRemove} />
                  ))}
                </div>
              ) : null}

              <div className="gp-modal-section-grid">
                {modalGroups.map(group => (
                  <section key={group.key} className="gp-modal-section">
                    <div className="gp-modal-section-head">
                      <h4>{group.title}</h4>
                      <span>{t('catalog.optionCount', { count: formatNumber(group.options.length) })}</span>
                    </div>

                    {group.options.length > 0 ? (
                      <div className="gp-filter-pill-cloud is-modal">
                        {group.options.map(option => (
                          <button
                            key={`${group.category}-${option}-modal`}
                            type="button"
                            className={`gp-filter-pill${isFacetFilterActive(group.category, option) ? ' is-active' : ''}`}
                            onClick={() => toggleFacetFilter(group.category, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="gp-filter-empty">
                        {t('catalog.noFilterOption')}
                      </p>
                    )}
                  </section>
                ))}
              </div>

              <div className="gp-modal-actions">
                <button type="button" className="game-button gp-btn--secondary" onClick={clearAllFilters}>
                  {t('common.clearAll')}
                </button>

                <button
                  type="button"
                  className="game-button gp-btn--primary"
                  onClick={() => setShowFiltersModal(false)}
                >
                  {t('common.applyFilters')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showGenresModal ? (
          <div className="gp-modal" onClick={() => setShowGenresModal(false)}>
            <div className="gp-modal-card" onClick={event => event.stopPropagation()}>
              <div className="gp-modal-head">
                <div>
                  <span className="gp-badge">{t('catalog.categories')}</span>
                  <h3>{t('catalog.allGameGenres')}</h3>
                  <p className="gp-muted">
                    {t('catalog.allGameGenresText')}
                  </p>
                </div>

                <button
                  type="button"
                  className="gp-modal-close"
                  aria-label={t('catalog.closeGenres')}
                  onClick={() => setShowGenresModal(false)}
                >
                  x
                </button>
              </div>

              <div className="gp-modal-list">
                {selectedGameGenres.map((genre, index) => (
                  <span key={`${genre}-${index}`} className="genre-chip gp-tag">
                    {genre}
                  </span>
                ))}
              </div>

              <div className="gp-modal-actions">
                <button
                  type="button"
                  className="game-button gp-btn--secondary"
                  onClick={() => setShowGenresModal(false)}
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default GamesPage
