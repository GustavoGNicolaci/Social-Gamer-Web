import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase-client'
import './GamesPage.css'

interface Game {
  id: number
  titulo: string
  capa_url: string
  desenvolvedora: string[] | string
  generos: string[] | string
  data_lancamento: string
  descricao: string
  plataformas: string[] | string
}

interface FilterGroupProps {
  title: string
  description: string
  options: string[]
  selectedValues: string[]
  customValue: string
  placeholder: string
  onCustomValueChange: (value: string) => void
  onToggleValue: (value: string, checked: boolean) => void
  onAddCustomValue: () => void
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
  return 6
}

function toggleSelection(
  value: string,
  checked: boolean,
  setSelection: Dispatch<SetStateAction<string[]>>
) {
  if (checked) {
    setSelection(current => (current.includes(value) ? current : [...current, value]))
    return
  }

  setSelection(current => current.filter(item => item !== value))
}

function addCustomValue(
  inputValue: string,
  selectedValues: string[],
  setInputValue: Dispatch<SetStateAction<string>>,
  setSelection: Dispatch<SetStateAction<string[]>>
) {
  const trimmedValue = inputValue.trim()
  if (trimmedValue && !selectedValues.includes(trimmedValue)) {
    setSelection(current => [...current, trimmedValue])
  }
  setInputValue('')
}

function FilterGroup({
  title,
  description,
  options,
  selectedValues,
  customValue,
  placeholder,
  onCustomValueChange,
  onToggleValue,
  onAddCustomValue,
}: FilterGroupProps) {
  return (
    <section className="gp-filter">
      <div className="gp-filter-top">
        <div className="gp-filter-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {selectedValues.length > 0 && <span className="gp-count">{selectedValues.length}</span>}
      </div>

      <div className="gp-options">
        {options.length === 0 ? (
          <p className="gp-muted">Nenhuma opcao disponivel ainda.</p>
        ) : (
          options.map(option => (
            <label key={option} className="gp-option">
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={event => onToggleValue(option, event.target.checked)}
              />
              <span>{option}</span>
            </label>
          ))
        )}
      </div>

      <div className="gp-custom">
        <input
          type="text"
          value={customValue}
          className="gp-filter-input"
          placeholder={placeholder}
          onChange={event => onCustomValueChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddCustomValue()
            }
          }}
        />
        <button type="button" className="game-button gp-btn--primary" onClick={onAddCustomValue}>
          Adicionar
        </button>
      </div>
    </section>
  )
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

          {hasMoreGenres && (
            <button type="button" className="gp-more" onClick={() => onShowGenres(genres)}>
              +{genres.length - displayedGenres.length}
            </button>
          )}
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
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([])
  const [customGenre, setCustomGenre] = useState('')
  const [customPlatform, setCustomPlatform] = useState('')
  const [customDeveloper, setCustomDeveloper] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [gridColumns, setGridColumns] = useState(() =>
    typeof window === 'undefined' ? 6 : getGamesGridColumns(window.innerWidth)
  )
  const [isDesktopFiltersExpanded, setIsDesktopFiltersExpanded] = useState(false)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const [showGenresModal, setShowGenresModal] = useState(false)
  const [selectedGameGenres, setSelectedGameGenres] = useState<string[]>([])

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
    setCurrentPage(1)
  }, [selectedGenres, selectedPlatforms, selectedDevelopers])

  useEffect(() => {
    if (gridColumns === 6) {
      setIsFilterDrawerOpen(false)
      return
    }

    setIsDesktopFiltersExpanded(false)
  }, [gridColumns])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterDrawerOpen(false)
        setShowGenresModal(false)
      }
    }

    if (!isFilterDrawerOpen && !showGenresModal) {
      return
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterDrawerOpen, showGenresModal])

  const usesFilterDrawer = gridColumns < 6
  const itemsPerPage = gridColumns * 4

  const allGenres = useMemo(
    () =>
      Array.from(new Set(games.flatMap(game => normalizeList(game.generos)))).sort((left, right) =>
        left.localeCompare(right, 'pt-BR')
      ),
    [games]
  )
  const allPlatforms = useMemo(
    () =>
      Array.from(new Set(games.flatMap(game => normalizeList(game.plataformas)))).sort(
        (left, right) => left.localeCompare(right, 'pt-BR')
      ),
    [games]
  )
  const allDevelopers = useMemo(
    () =>
      Array.from(new Set(games.flatMap(game => normalizeList(game.desenvolvedora)))).sort(
        (left, right) => left.localeCompare(right, 'pt-BR')
      ),
    [games]
  )

  const filteredGames = useMemo(
    () =>
      games.filter(game => {
        const genres = normalizeList(game.generos)
        const platforms = normalizeList(game.plataformas)
        const developers = normalizeList(game.desenvolvedora)

        const genreMatch =
          selectedGenres.length === 0 ||
          selectedGenres.every(value =>
            genres.some(genre => genre.toLowerCase().includes(value.toLowerCase()))
          )

        const platformMatch =
          selectedPlatforms.length === 0 ||
          selectedPlatforms.every(value =>
            platforms.some(platform => platform.toLowerCase().includes(value.toLowerCase()))
          )

        const developerMatch =
          selectedDevelopers.length === 0 ||
          selectedDevelopers.every(value =>
            developers.some(developer => developer.toLowerCase().includes(value.toLowerCase()))
          )

        return genreMatch && platformMatch && developerMatch
      }),
    [games, selectedDevelopers, selectedGenres, selectedPlatforms]
  )

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage)
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const gamesToDisplay = filteredGames.slice(startIndex, endIndex)
  const visibleStart = filteredGames.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(endIndex, filteredGames.length)
  const resultsLabel =
    filteredGames.length === 1 ? '1 jogo encontrado' : `${filteredGames.length} jogos encontrados`
  const rangeLabel =
    filteredGames.length === 0
      ? 'Nenhum item para exibir'
      : `Mostrando ${visibleStart}-${visibleEnd} de ${filteredGames.length}`

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage)
    }
  }, [currentPage, safeCurrentPage])

  const activeFilters = [
    ...selectedGenres.map(value => ({
      key: `genre-${value}`,
      label: `Genero: ${value}`,
      onRemove: () => setSelectedGenres(current => current.filter(item => item !== value)),
    })),
    ...selectedPlatforms.map(value => ({
      key: `platform-${value}`,
      label: `Plataforma: ${value}`,
      onRemove: () => setSelectedPlatforms(current => current.filter(item => item !== value)),
    })),
    ...selectedDevelopers.map(value => ({
      key: `developer-${value}`,
      label: `Studio: ${value}`,
      onRemove: () => setSelectedDevelopers(current => current.filter(item => item !== value)),
    })),
  ]

  const activeFilterCount = activeFilters.length

  const clearAllFilters = () => {
    setSelectedGenres([])
    setSelectedPlatforms([])
    setSelectedDevelopers([])
    setCustomGenre('')
    setCustomPlatform('')
    setCustomDeveloper('')
    setCurrentPage(1)
    setIsFilterDrawerOpen(false)
  }

  const gridStyle = {
    '--gp-grid-columns': String(gridColumns),
    '--gp-filter-column': usesFilterDrawer ? '0px' : isDesktopFiltersExpanded ? '320px' : '148px',
  } as CSSProperties

  const filterPanel = (
    <div className="gp-box gp-box--filters">
      <div className="gp-head">
        <div className="gp-head-row">
          <div>
            <span className="gp-badge">Filtros</span>
            <h2>Refine o catalogo</h2>
          </div>

          {activeFilterCount > 0 ? <span className="gp-count">{activeFilterCount}</span> : null}
        </div>

        <p className="gp-muted">
          Combine genero, plataforma e studio para reduzir a lista sem tirar o foco da grade.
        </p>
      </div>

      {activeFilterCount > 0 ? (
        <div className="gp-filter-actions">
          <button type="button" className="game-button gp-btn--secondary" onClick={clearAllFilters}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      <div className="gp-filters">
        <FilterGroup
          title="Generos"
          description="Selecione estilos que devem aparecer na grade."
          options={allGenres}
          selectedValues={selectedGenres}
          customValue={customGenre}
          placeholder="Adicionar genero..."
          onCustomValueChange={setCustomGenre}
          onToggleValue={(value, checked) => toggleSelection(value, checked, setSelectedGenres)}
          onAddCustomValue={() =>
            addCustomValue(customGenre, selectedGenres, setCustomGenre, setSelectedGenres)
          }
        />

        <FilterGroup
          title="Plataformas"
          description="Marque onde voce prefere jogar."
          options={allPlatforms}
          selectedValues={selectedPlatforms}
          customValue={customPlatform}
          placeholder="Adicionar plataforma..."
          onCustomValueChange={setCustomPlatform}
          onToggleValue={(value, checked) => toggleSelection(value, checked, setSelectedPlatforms)}
          onAddCustomValue={() =>
            addCustomValue(customPlatform, selectedPlatforms, setCustomPlatform, setSelectedPlatforms)
          }
        />

        <FilterGroup
          title="Studios"
          description="Filtre pelas desenvolvedoras que voce acompanha."
          options={allDevelopers}
          selectedValues={selectedDevelopers}
          customValue={customDeveloper}
          placeholder="Adicionar studio..."
          onCustomValueChange={setCustomDeveloper}
          onToggleValue={(value, checked) =>
            toggleSelection(value, checked, setSelectedDevelopers)
          }
          onAddCustomValue={() =>
            addCustomValue(
              customDeveloper,
              selectedDevelopers,
              setCustomDeveloper,
              setSelectedDevelopers
            )
          }
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-card">
            <span className="gp-badge">Catalogo</span>
            <h1>Carregando jogos</h1>
            <p className="gp-muted">
              Estamos preparando o catalogo com capas maiores, filtros reorganizados e uma grade
              mais limpa para voce navegar.
            </p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content games-page">
        <section className="gp-hero">
          <div className="gp-glow gp-glow--left"></div>
          <div className="gp-glow gp-glow--right"></div>

          <div className="gp-hero-inner">
            <div className="gp-copy">
              <span className="gp-badge">Catalogo</span>
              <h1 className="gp-title">Explore o catalogo com foco total nos jogos</h1>
              <p className="gp-muted">
                A busca agora fica na navbar com sugestoes imediatas. Aqui, o destaque fica na
                grade com cards maiores, filtros mais discretos e leitura mais fluida.
              </p>
            </div>

            <div className="gp-metrics">
              <article className="gp-metric">
                <span>Total</span>
                <strong>{games.length}</strong>
                <small>Jogos no catalogo</small>
              </article>
              <article className="gp-metric">
                <span>Filtrados</span>
                <strong>{filteredGames.length}</strong>
                <small>Resultados apos aplicar filtros</small>
              </article>
              <article className="gp-metric">
                <span>Layout</span>
                <strong>
                  {gridColumns} x 4
                </strong>
                <small>{itemsPerPage} jogos por pagina nesta tela</small>
              </article>
            </div>
          </div>
        </section>

        <div className="gp-layout" style={gridStyle}>
          {!usesFilterDrawer ? (
            <aside className="gp-filters-rail" aria-label="Filtros do catalogo">
              <div className="gp-filters-sticky">
                <div className="gp-filter-rail-card">
                  <span className="gp-badge">Filtros</span>
                  <strong>{activeFilterCount}</strong>
                  <small>{activeFilterCount === 1 ? '1 filtro ativo' : `${activeFilterCount} ativos`}</small>

                  <button
                    type="button"
                    className="game-button gp-btn--secondary"
                    onClick={() => setIsDesktopFiltersExpanded(currentValue => !currentValue)}
                  >
                    {isDesktopFiltersExpanded ? 'Recolher' : 'Expandir'}
                  </button>

                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      className="gp-clear-link"
                      onClick={clearAllFilters}
                    >
                      Limpar tudo
                    </button>
                  ) : null}
                </div>

                {isDesktopFiltersExpanded ? filterPanel : null}
              </div>
            </aside>
          ) : null}

          <section className="gp-box gp-results-box">
            <div className="gp-result-head">
              <div className="gp-result-copy">
                <span className="gp-badge">Resultados</span>
                <h2>Jogos para explorar</h2>
                <p className="gp-muted">{rangeLabel}</p>
              </div>

              <div className="gp-result-actions">
                <div className="gp-summary">
                  <span>Resumo</span>
                  <strong>{resultsLabel}</strong>
                  <small>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} filtros ativos`
                      : 'Use a navbar para buscar por titulo'}
                  </small>
                </div>

                <div className="gp-toolbar-buttons">
                  {usesFilterDrawer ? (
                    <button
                      type="button"
                      className="game-button gp-btn--secondary"
                      onClick={() => setIsFilterDrawerOpen(true)}
                    >
                      {activeFilterCount > 0
                        ? `Filtros (${activeFilterCount})`
                        : 'Abrir filtros'}
                    </button>
                  ) : null}

                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      className="game-button gp-btn--secondary"
                      onClick={clearAllFilters}
                    >
                      Limpar filtros
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {activeFilters.length > 0 ? (
              <div className="gp-chips">
                {activeFilters.map(filter => (
                  <ActiveChip key={filter.key} label={filter.label} onRemove={filter.onRemove} />
                ))}
              </div>
            ) : (
              <p className="gp-muted">
                Use os filtros para afunilar o catalogo e a busca da navbar para ir direto a um
                jogo especifico.
              </p>
            )}

            {gamesToDisplay.length === 0 ? (
              <article className="gp-empty">
                <span className="gp-badge">Sem resultados</span>
                <h3>Nenhum jogo combinou com os filtros atuais</h3>
                <p className="gp-muted">
                  Tente remover alguns filtros ou abrir mais opcoes para voltar a ver o catalogo
                  completo.
                </p>
                <button
                  type="button"
                  className="game-button gp-btn--secondary"
                  onClick={clearAllFilters}
                >
                  Limpar filtros
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

                <PaginationControls
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  onChangePage={setCurrentPage}
                />
              </>
            )}
          </section>
        </div>

        {usesFilterDrawer && isFilterDrawerOpen ? (
          <div className="gp-drawer-backdrop" onClick={() => setIsFilterDrawerOpen(false)}>
            <div className="gp-drawer" onClick={event => event.stopPropagation()}>
              <div className="gp-drawer-head">
                <div>
                  <span className="gp-badge">Filtros</span>
                  <h3>Refine a grade</h3>
                </div>

                <button
                  type="button"
                  className="game-button gp-btn--secondary"
                  onClick={() => setIsFilterDrawerOpen(false)}
                >
                  Fechar
                </button>
              </div>

              {filterPanel}
            </div>
          </div>
        ) : null}

        {showGenresModal && (
          <div className="gp-modal" onClick={() => setShowGenresModal(false)}>
            <div className="gp-modal-card" onClick={event => event.stopPropagation()}>
              <div className="gp-head">
                <span className="gp-badge">Categorias</span>
                <h3>Todos os generos deste jogo</h3>
                <p className="gp-muted">
                  Veja a lista completa de tags relacionadas ao titulo selecionado.
                </p>
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
        )}
      </div>
    </div>
  )
}

export default GamesPage
