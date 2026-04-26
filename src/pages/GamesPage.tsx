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
import { useAuth } from '../contexts/AuthContext'
import {
  getVisibleGameRatingSummaries,
  type GameRatingSummary,
} from '../services/reviewService'
import { supabase } from '../supabase-client'
import './GamesPage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string[] | string
  generos: string[] | string
  data_lancamento: string
  plataformas: string[] | string
}

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
type CatalogSortOption = 'release-desc' | 'release-asc' | 'rating-desc' | 'rating-asc'

interface CatalogFilterToken {
  key: string
  category: CatalogFilterCategory
  value: string
  label: string
  gameId?: number
}

const DEFAULT_CATALOG_SORT: CatalogSortOption = 'release-desc'
const CATALOG_GAME_SELECT =
  'id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas'

const CATALOG_SORT_OPTIONS: Array<{
  value: CatalogSortOption
  label: string
}> = [
  { value: 'release-desc', label: 'Lancamento: mais novos primeiro' },
  { value: 'release-asc', label: 'Lancamento: mais antigos primeiro' },
  { value: 'rating-desc', label: 'Nota: maior nota primeiro' },
  { value: 'rating-asc', label: 'Nota: menor nota primeiro' },
]

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function formatList(value: string[] | string | null | undefined, fallback: string) {
  const items = normalizeList(value)
  return items.length > 0 ? items.join(', ') : fallback
}

function formatDate(value: string | null | undefined, fallback = 'Nao informada') {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback

  return date.toLocaleDateString('pt-BR')
}

function formatCatalogRating(value: number) {
  return value.toLocaleString('pt-BR', {
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

function getFacetLabelPrefix(category: FacetCategory) {
  if (category === 'genre') return 'Genero'
  if (category === 'platform') return 'Plataforma'
  return 'Studio'
}

function sortAlphabetically(values: string[]) {
  return values.sort((left, right) => left.localeCompare(right, 'pt-BR'))
}

function getCatalogSortOption(value: string | null): CatalogSortOption {
  return CATALOG_SORT_OPTIONS.some(option => option.value === value)
    ? (value as CatalogSortOption)
    : DEFAULT_CATALOG_SORT
}

function getSortableTimestamp(value: string | null | undefined) {
  if (!value) return null

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function compareGamesByTitle(leftGame: Game, rightGame: Game) {
  const titleDelta = leftGame.titulo.localeCompare(rightGame.titulo, 'pt-BR')
  if (titleDelta !== 0) return titleDelta

  return leftGame.id - rightGame.id
}

function compareGamesByRelease(
  leftGame: Game,
  rightGame: Game,
  direction: 'asc' | 'desc'
) {
  const leftTimestamp = getSortableTimestamp(leftGame.data_lancamento)
  const rightTimestamp = getSortableTimestamp(rightGame.data_lancamento)

  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return direction === 'desc'
      ? rightTimestamp - leftTimestamp
      : leftTimestamp - rightTimestamp
  }

  if (leftTimestamp !== null && rightTimestamp === null) return -1
  if (leftTimestamp === null && rightTimestamp !== null) return 1

  return compareGamesByTitle(leftGame, rightGame)
}

function getGameAverageRating(
  ratingSummariesByGameId: ReadonlyMap<number, GameRatingSummary>,
  gameId: number
) {
  const rating = ratingSummariesByGameId.get(gameId)?.averageRating
  return typeof rating === 'number' && Number.isFinite(rating) ? rating : null
}

function compareGamesByRating(
  leftGame: Game,
  rightGame: Game,
  direction: 'asc' | 'desc',
  ratingSummariesByGameId: ReadonlyMap<number, GameRatingSummary>
) {
  const leftRating = getGameAverageRating(ratingSummariesByGameId, leftGame.id)
  const rightRating = getGameAverageRating(ratingSummariesByGameId, rightGame.id)

  if (leftRating !== null && rightRating !== null && leftRating !== rightRating) {
    return direction === 'desc' ? rightRating - leftRating : leftRating - rightRating
  }

  if (leftRating !== null && rightRating === null) return -1
  if (leftRating === null && rightRating !== null) return 1

  return compareGamesByRelease(leftGame, rightGame, 'desc')
}

function sortCatalogGames(
  games: Game[],
  sortOption: CatalogSortOption,
  ratingSummariesByGameId: ReadonlyMap<number, GameRatingSummary>
) {
  return [...games].sort((leftGame, rightGame) => {
    if (sortOption === 'release-asc') {
      return compareGamesByRelease(leftGame, rightGame, 'asc')
    }

    if (sortOption === 'rating-desc') {
      return compareGamesByRating(leftGame, rightGame, 'desc', ratingSummariesByGameId)
    }

    if (sortOption === 'rating-asc') {
      return compareGamesByRating(leftGame, rightGame, 'asc', ratingSummariesByGameId)
    }

    return compareGamesByRelease(leftGame, rightGame, 'desc')
  })
}

function buildFacetToken(category: FacetCategory, value: string): CatalogFilterToken {
  return {
    key: `${category}-${value.toLowerCase()}`,
    category,
    value,
    label: `${getFacetLabelPrefix(category)}: ${value}`,
  }
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
  return (
    <span className="gp-chip">
      <span>{label}</span>
      <button type="button" aria-label={`Remover filtro ${label}`} onClick={onRemove}>
        x
      </button>
    </span>
  )
}

function StaticChip({ label }: { label: string }) {
  return <span className="gp-chip gp-chip--static">{label}</span>
}

const GameCard = memo(function GameCard({ game, ratingSummary, onShowGenres }: GameCardProps) {
  const genres = normalizeList(game.generos)
  const displayedGenres = genres.slice(0, 2)
  const hasMoreGenres = genres.length > 2
  const averageRating = ratingSummary?.averageRating ?? null
  const ratingAriaLabel =
    averageRating === null
      ? `Sem nota para ${game.titulo}`
      : `Media ${formatCatalogRating(averageRating)} de 10 para ${game.titulo}`

  return (
    <article className="gp-game">
      <Link to={`/games/${game.id}`} className="gp-cover">
        {game.capa_url ? (
          <GameCoverImage
            src={game.capa_url}
            alt={`Capa do jogo ${game.titulo}`}
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 992px) 33vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          <div className="gp-fallback">{initial(game.titulo)}</div>
        )}

        <div className="gp-cover-top">
          <span className="gp-date">{formatDate(game.data_lancamento)}</span>
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
            <span className="gp-muted">Generos nao informados.</span>
          )}

          {hasMoreGenres ? (
            <button type="button" className="gp-more" onClick={() => onShowGenres(genres)}>
              +{genres.length - displayedGenres.length}
            </button>
          ) : null}
        </div>

        <div className="gp-meta">
          <div className="gp-meta-row">
            <span>Studio</span>
            <strong title={formatList(game.desenvolvedora, 'Nao informada')}>
              {formatList(game.desenvolvedora, 'Nao informada')}
            </strong>
          </div>
          <div className="gp-meta-row">
            <span>Plataformas</span>
            <strong title={formatList(game.plataformas, 'Nao informadas')}>
              {formatList(game.plataformas, 'Nao informadas')}
            </strong>
          </div>
        </div>
      </div>

      <Link to={`/games/${game.id}`} className="game-button gp-btn--primary">
        Ver detalhes
      </Link>
    </article>
  )
})

function PaginationControls({ currentPage, totalPages, onChangePage }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav className="gp-pagination" aria-label="Paginacao dos jogos">
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        Anterior
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
        Proxima
      </button>
    </nav>
  )
}

function GamesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<Game[]>([])
  const [ratingSummariesByGameId, setRatingSummariesByGameId] = useState<Map<number, GameRatingSummary>>(
    () => new Map()
  )
  const [loading, setLoading] = useState(true)
  const [ratingsError, setRatingsError] = useState<string | null>(null)
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
  const normalizedNavbarQuery = navbarQuery.toLowerCase()
  const itemsPerPage = gridColumns * 4

  useEffect(() => {
    let isMounted = true

    const fetchGames = async () => {
      setLoading(true)
      setRatingsError(null)
      setRatingSummariesByGameId(new Map())

      const { data, error } = await supabase.from('jogos').select(CATALOG_GAME_SELECT)

      if (!isMounted) return

      if (error) {
        console.error('Erro ao buscar jogos:', error)
        setGames([])
        setRatingSummariesByGameId(new Map())
        setLoading(false)
        return
      }

      const nextGames = (data || []) as Game[]
      setGames(nextGames)
      setLoading(false)
    }

    void fetchGames()

    return () => {
      isMounted = false
    }
  }, [user?.id])

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

      return [...currentFilters, buildFacetToken(category, value)]
    })
  }, [])

  const isFacetFilterActive = useCallback(
    (category: FacetCategory, value: string) =>
      facetFilters.some(
        token => token.category === category && token.value.toLowerCase() === value.toLowerCase()
      ),
    [facetFilters]
  )

  const navbarScopedGames = useMemo(
    () =>
      games.filter(
        game =>
          normalizedNavbarQuery.length === 0 ||
          game.titulo.toLowerCase().includes(normalizedNavbarQuery)
      ),
    [games, normalizedNavbarQuery]
  )

  const allGenres = useMemo(
    () => sortAlphabetically(
      Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.generos))))
    ),
    [navbarScopedGames]
  )

  const allPlatforms = useMemo(
    () => sortAlphabetically(
      Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.plataformas))))
    ),
    [navbarScopedGames]
  )

  const allDevelopers = useMemo(
    () => sortAlphabetically(
      Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.desenvolvedora))))
    ),
    [navbarScopedGames]
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
              label: `Busca na navbar: ${navbarQuery}`,
              onRemove: () => updateNavbarQuery(''),
            },
          ]
        : []),
      ...facetFilters.map(filter => ({
        key: filter.key,
        label: filter.label,
        onRemove: () =>
          setFacetFilters(currentFilters =>
            currentFilters.filter(currentFilter => currentFilter.key !== filter.key)
          ),
      })),
    ],
    [facetFilters, navbarQuery, updateNavbarQuery]
  )

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

  const filteredGames = useMemo(
    () =>
      navbarScopedGames.filter(game => {
        const genres = normalizeList(game.generos)
        const platforms = normalizeList(game.plataformas)
        const developers = normalizeList(game.desenvolvedora)

        const genreMatch =
          genreFilterTokens.length === 0 ||
          genreFilterTokens.every(filterToken =>
            genres.some(genre => genre.toLowerCase().includes(filterToken.value.toLowerCase()))
          )

        const platformMatch =
          platformFilterTokens.length === 0 ||
          platformFilterTokens.every(filterToken =>
            platforms.some(platform =>
              platform.toLowerCase().includes(filterToken.value.toLowerCase())
            )
          )

        const developerMatch =
          developerFilterTokens.length === 0 ||
          developerFilterTokens.every(filterToken =>
            developers.some(developer =>
              developer.toLowerCase().includes(filterToken.value.toLowerCase())
            )
          )

        return genreMatch && platformMatch && developerMatch
      }),
    [developerFilterTokens, genreFilterTokens, navbarScopedGames, platformFilterTokens]
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

  const sortedGames = useMemo(
    () => sortCatalogGames(filteredGames, catalogSort, ratingSummariesByGameId),
    [catalogSort, filteredGames, ratingSummariesByGameId]
  )
  const totalPages = Math.ceil(sortedGames.length / itemsPerPage)
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const gamesToDisplay = useMemo(
    () => sortedGames.slice(startIndex, endIndex),
    [endIndex, sortedGames, startIndex]
  )
  const visibleStart = sortedGames.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(endIndex, sortedGames.length)
  const rangeLabel =
    sortedGames.length === 0
      ? 'Nenhum item para exibir'
      : `Mostrando ${visibleStart}-${visibleEnd} de ${sortedGames.length}`

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
        title: 'Generos',
        options: modalGenreOptions,
      },
      {
        key: 'platform-modal',
        category: 'platform' as const,
        title: 'Plataformas',
        options: modalPlatformOptions,
      },
      {
        key: 'developer-modal',
        category: 'developer' as const,
        title: 'Studios',
        options: modalDeveloperOptions,
      },
    ],
    [modalDeveloperOptions, modalGenreOptions, modalPlatformOptions]
  )

  const requiresAllRatingSummaries = catalogSort === 'rating-desc' || catalogSort === 'rating-asc'
  const ratingSummaryTargetIds = useMemo(
    () => (requiresAllRatingSummaries ? filteredGames : gamesToDisplay).map(game => game.id),
    [filteredGames, gamesToDisplay, requiresAllRatingSummaries]
  )

  useEffect(() => {
    if (loading || ratingSummaryTargetIds.length === 0) return

    const missingRatingIds = ratingSummaryTargetIds.filter(
      gameId => !ratingSummariesByGameId.has(gameId)
    )

    if (missingRatingIds.length === 0) return

    let isMounted = true

    const fetchRatingSummaries = async () => {
      const ratingSummariesResult = await getVisibleGameRatingSummaries(missingRatingIds, user?.id)

      if (!isMounted) return

      if (ratingSummariesResult.error) {
        console.error('Erro ao buscar notas do catalogo:', ratingSummariesResult.error)
        setRatingsError('Nao foi possivel carregar as notas do catalogo agora.')
      } else {
        setRatingsError(null)
      }

      if (ratingSummariesResult.data.length > 0) {
        setRatingSummariesByGameId(currentSummaries => {
          const nextSummaries = new Map(currentSummaries)

          ratingSummariesResult.data.forEach(summary => {
            nextSummaries.set(summary.gameId, summary)
          })

          return nextSummaries
        })
      }
    }

    void fetchRatingSummaries()

    return () => {
      isMounted = false
    }
  }, [loading, ratingSummariesByGameId, ratingSummaryTargetIds, user?.id])

  const handleShowGenres = useCallback((genres: string[]) => {
    setSelectedGameGenres(genres)
    setShowGenresModal(true)
  }, [])

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-card">
            <span className="gp-badge">Catalogo</span>
            <h1>Carregando jogos</h1>
            <p className="gp-muted">
              Estamos preparando o catalogo com a busca global sincronizada e um painel dedicado
              para filtros.
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
              <span className="gp-badge">Catalogo</span>
              <h1>Jogos</h1>
              <p className="gp-muted">
                A busca da navbar continua global, e os filtros desta pagina ficam concentrados no
                modal para deixar o catalogo mais limpo.
              </p>
            </div>

            <div className="gp-panel-summary">
              <label className="gp-sort-control">
                <span>Ordenar por</span>
                <select
                  value={catalogSort}
                  onChange={event => updateCatalogSort(event.target.value as CatalogSortOption)}
                  aria-label="Ordenar catalogo de jogos"
                >
                  {CATALOG_SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="game-button gp-btn--secondary"
                onClick={() => setShowFiltersModal(true)}
              >
                Ver todos os filtros
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
                ? `Busca global ativa: "${navbarQuery}". ${rangeLabel}`
                : rangeLabel}
            </p>

            {ratingsError ? <p className="gp-panel-footnote is-warning">{ratingsError}</p> : null}
          </div>
        </section>

        {gamesToDisplay.length === 0 ? (
          <article className="gp-empty">
            <span className="gp-badge">Sem resultados</span>
            <h3>Nenhum jogo combinou com a busca e os filtros atuais</h3>
            <p className="gp-muted">
              Ajuste a busca global da navbar ou use o modal de filtros para voltar ao catalogo
              completo.
            </p>
            <button
              type="button"
              className="game-button gp-btn--secondary"
              onClick={() => setShowFiltersModal(true)}
            >
              Ver todos os filtros
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
                  <span className="gp-badge">Todos os filtros</span>
                  <h3>Explore todas as opcoes disponiveis</h3>
                  <p className="gp-muted">
                    Filtre por genero, plataforma ou studio dentro do contexto atual da busca.
                  </p>
                </div>

                <button
                  type="button"
                  className="gp-modal-close"
                  aria-label="Fechar modal de filtros"
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
                  placeholder="Pesquisar entre todos os filtros..."
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
                      <span>{group.options.length} opcoes</span>
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
                        Nenhuma opcao encontrada para este termo.
                      </p>
                    )}
                  </section>
                ))}
              </div>

              <div className="gp-modal-actions">
                <button type="button" className="game-button gp-btn--secondary" onClick={clearAllFilters}>
                  Limpar tudo
                </button>

                <button
                  type="button"
                  className="game-button gp-btn--primary"
                  onClick={() => setShowFiltersModal(false)}
                >
                  Aplicar filtros
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
                  <span className="gp-badge">Categorias</span>
                  <h3>Todos os generos deste jogo</h3>
                  <p className="gp-muted">
                    Veja a lista completa de tags relacionadas ao titulo selecionado.
                  </p>
                </div>

                <button
                  type="button"
                  className="gp-modal-close"
                  aria-label="Fechar modal de generos"
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
                  Fechar
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
