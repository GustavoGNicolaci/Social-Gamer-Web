import {
  useEffect,
  useState,
  type CSSProperties,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase-client'
import './GamesPage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string[] | string
  generos: string[] | string
  data_lancamento: string
  descricao: string
  plataformas: string[] | string
}

interface ActiveChipProps {
  label: string
  onRemove: () => void
}

interface GameCardProps {
  game: Game
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

function GameCard({ game, onShowGenres }: GameCardProps) {
  const genres = normalizeList(game.generos)
  const displayedGenres = genres.slice(0, 2)
  const hasMoreGenres = genres.length > 2

  return (
    <article className="gp-game">
      <Link to={`/games/${game.id}`} className="gp-cover">
        {game.capa_url ? (
          <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
        ) : (
          <div className="gp-fallback">{initial(game.titulo)}</div>
        )}

        <div className="gp-cover-top">
          <span className="gp-date">{formatDate(game.data_lancamento)}</span>
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
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
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
  const trimmedModalSearch = filtersModalSearch.trim()
  const normalizedNavbarQuery = navbarQuery.toLowerCase()
  const itemsPerPage = gridColumns * 4

  useEffect(() => {
    let isMounted = true

    const fetchGames = async () => {
      const { data, error } = await supabase.from('jogos').select('*')

      if (!isMounted) return

      if (error) {
        console.error('Erro ao buscar jogos:', error)
        setGames([])
      } else {
        setGames((data || []) as Game[])
      }

      setLoading(false)
    }

    void fetchGames()

    return () => {
      isMounted = false
    }
  }, [])

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
  }, [facetFilters, navbarQuery])

  useEffect(() => {
    if (showFiltersModal) return

    const timeoutId = window.setTimeout(() => {
      setFiltersModalSearch('')
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [showFiltersModal])

  const updateNavbarQuery = (value: string) => {
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
  }

  const toggleFacetFilter = (category: FacetCategory, value: string) => {
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
  }

  const isFacetFilterActive = (category: FacetCategory, value: string) =>
    facetFilters.some(
      token => token.category === category && token.value.toLowerCase() === value.toLowerCase()
    )

  const navbarScopedGames = games.filter(
    game =>
      normalizedNavbarQuery.length === 0 ||
      game.titulo.toLowerCase().includes(normalizedNavbarQuery)
  )

  const allGenres = sortAlphabetically(
    Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.generos))))
  )

  const allPlatforms = sortAlphabetically(
    Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.plataformas))))
  )

  const allDevelopers = sortAlphabetically(
    Array.from(new Set(navbarScopedGames.flatMap(game => normalizeList(game.desenvolvedora))))
  )

  const clearAllFilters = () => {
    setFacetFilters([])
    setCurrentPage(1)
    setFiltersModalSearch('')

    if (navbarQuery) {
      updateNavbarQuery('')
    }
  }

  const activeFilters = [
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
  ]

  const genreFilterTokens = facetFilters.filter(filter => filter.category === 'genre')
  const platformFilterTokens = facetFilters.filter(filter => filter.category === 'platform')
  const developerFilterTokens = facetFilters.filter(filter => filter.category === 'developer')

  const filteredGames = navbarScopedGames.filter(game => {
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
        platforms.some(platform => platform.toLowerCase().includes(filterToken.value.toLowerCase()))
      )

    const developerMatch =
      developerFilterTokens.length === 0 ||
      developerFilterTokens.every(filterToken =>
        developers.some(developer =>
          developer.toLowerCase().includes(filterToken.value.toLowerCase())
        )
      )

    return genreMatch && platformMatch && developerMatch
  })

  const modalGenreOptions = buildVisibleFacetOptions(allGenres, trimmedModalSearch)
  const modalPlatformOptions = buildVisibleFacetOptions(allPlatforms, trimmedModalSearch)
  const modalDeveloperOptions = buildVisibleFacetOptions(allDevelopers, trimmedModalSearch)

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage)
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const gamesToDisplay = filteredGames.slice(startIndex, endIndex)
  const visibleStart = filteredGames.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(endIndex, filteredGames.length)
  const rangeLabel =
    filteredGames.length === 0
      ? 'Nenhum item para exibir'
      : `Mostrando ${visibleStart}-${visibleEnd} de ${filteredGames.length}`

  const gridStyle = {
    '--gp-grid-columns': String(gridColumns),
  } as CSSProperties

  const modalGroups = [
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
  ]

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
                  onShowGenres={genres => {
                    setSelectedGameGenres(genres)
                    setShowGenresModal(true)
                  }}
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
