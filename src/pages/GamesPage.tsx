import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
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

const ITEMS_PER_PAGE = 12

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

function previewText(value: string | null | undefined) {
  const normalizedValue = value?.trim() || ''
  if (!normalizedValue) return 'Descricao nao informada.'
  if (normalizedValue.length <= 150) return normalizedValue
  return `${normalizedValue.slice(0, 147).trim()}...`
}

function initial(value: string) {
  const first = value.trim().charAt(0)
  return first ? first.toUpperCase() : 'J'
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
  const displayedGenres = genres.slice(0, 3)
  const hasMoreGenres = genres.length > 3

  return (
    <article className="gp-game">
      <Link to={`/games/${game.id}`} className="gp-cover">
        {game.capa_url ? (
          <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
        ) : (
          <div className="gp-fallback">{initial(game.titulo)}</div>
        )}

        <div className="gp-cover-top">
          <span className="gp-pill">Social Gamer</span>
          <span className="gp-date">{formatDate(game.data_lancamento)}</span>
        </div>
      </Link>

      <div className="gp-game-body">
        <div className="gp-game-head">
          <h3>{game.titulo}</h3>
          <p className="gp-preview">{previewText(game.descricao)}</p>
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
              +{genres.length - displayedGenres.length} generos
            </button>
          )}
        </div>

        <div className="gp-meta">
          <div className="gp-meta-row">
            <span>Studio</span>
            <strong>{formatList(game.desenvolvedora, 'Nao informada')}</strong>
          </div>
          <div className="gp-meta-row">
            <span>Plataformas</span>
            <strong>{formatList(game.plataformas, 'Nao informadas')}</strong>
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
  const [search, setSearch] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedDevelopers, setSelectedDevelopers] = useState<string[]>([])
  const [customGenre, setCustomGenre] = useState('')
  const [customPlatform, setCustomPlatform] = useState('')
  const [customDeveloper, setCustomDeveloper] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
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
    setCurrentPage(1)
  }, [search, selectedGenres, selectedPlatforms, selectedDevelopers])

  const allGenres = Array.from(new Set(games.flatMap(game => normalizeList(game.generos)))).sort(
    (left, right) => left.localeCompare(right, 'pt-BR')
  )
  const allPlatforms = Array.from(
    new Set(games.flatMap(game => normalizeList(game.plataformas)))
  ).sort((left, right) => left.localeCompare(right, 'pt-BR'))
  const allDevelopers = Array.from(
    new Set(games.flatMap(game => normalizeList(game.desenvolvedora)))
  ).sort((left, right) => left.localeCompare(right, 'pt-BR'))

  const filteredGames = games.filter(game => {
    const titleMatch = game.titulo.toLowerCase().includes(search.toLowerCase())
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

    return titleMatch && genreMatch && platformMatch && developerMatch
  })

  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const gamesToDisplay = filteredGames.slice(startIndex, endIndex)
  const visibleStart = filteredGames.length === 0 ? 0 : startIndex + 1
  const visibleEnd = Math.min(endIndex, filteredGames.length)
  const resultsLabel =
    filteredGames.length === 1 ? '1 jogo encontrado' : `${filteredGames.length} jogos encontrados`
  const rangeLabel =
    filteredGames.length === 0
      ? 'Nenhum item para exibir'
      : `Mostrando ${visibleStart}-${visibleEnd} de ${filteredGames.length}`

  const activeFilters = [
    ...(search.trim()
      ? [
          {
            key: `search-${search.trim()}`,
            label: `Busca: ${search.trim()}`,
            onRemove: () => setSearch(''),
          },
        ]
      : []),
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

  const clearAllFilters = () => {
    setSearch('')
    setSelectedGenres([])
    setSelectedPlatforms([])
    setSelectedDevelopers([])
    setCustomGenre('')
    setCustomPlatform('')
    setCustomDeveloper('')
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-card">
            <span className="gp-badge">Catalogo</span>
            <h1>Carregando jogos</h1>
            <p className="gp-muted">
              Estamos preparando o catalogo com capas, filtros e destaques para voce navegar.
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
            <div className="gp-top">
              <div className="gp-copy">
                <span className="gp-badge">Catalogo</span>
                <h1 className="gp-title">Descubra jogos com uma navegacao mais clara</h1>
                <p className="gp-muted">
                  Explore o catalogo do Social Gamer com filtros sempre visiveis, cards mais
                  informativos e uma leitura mais confortavel em qualquer tela.
                </p>
              </div>

              <div className="gp-search">
                <div className="gp-search-head">
                  <span className="gp-label">Buscar por titulo</span>
                  <p className="gp-muted">
                    Digite um nome para filtrar rapidamente os jogos exibidos abaixo.
                  </p>
                </div>

                <input
                  type="text"
                  value={search}
                  className="gp-input"
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Ex.: Hollow Knight, FIFA, Zelda..."
                />

                <div className="gp-row">
                  <span className="gp-muted">{resultsLabel}</span>
                  <button
                    type="button"
                    className="game-button gp-btn--secondary"
                    onClick={clearAllFilters}
                  >
                    Limpar busca e filtros
                  </button>
                </div>
              </div>
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
                <span>Pagina</span>
                <strong>{totalPages > 0 ? `${currentPage}/${totalPages}` : '0/0'}</strong>
                <small>Posicao atual na navegacao</small>
              </article>
            </div>
          </div>
        </section>

        <div className="gp-layout">
          <aside className="gp-box" aria-label="Filtros do catalogo">
            <div className="gp-head">
              <span className="gp-badge">Filtros</span>
              <h2>Refine o catalogo</h2>
              <p className="gp-muted">
                Combine genero, plataforma e studio para chegar mais rapido no que voce procura.
              </p>
            </div>

            <div className="gp-filters">
              <FilterGroup
                title="Generos"
                description="Selecione um ou mais estilos para reduzir a lista."
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
                onToggleValue={(value, checked) =>
                  toggleSelection(value, checked, setSelectedPlatforms)
                }
                onAddCustomValue={() =>
                  addCustomValue(
                    customPlatform,
                    selectedPlatforms,
                    setCustomPlatform,
                    setSelectedPlatforms
                  )
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
          </aside>

          <section className="gp-box">
            <div className="gp-result-head">
              <div className="gp-result-copy">
                <span className="gp-badge">Resultados</span>
                <h2>Jogos para explorar</h2>
                <p className="gp-muted">{rangeLabel}</p>
              </div>

              <div className="gp-summary">
                <span>Resumo</span>
                <strong>{resultsLabel}</strong>
                <small>
                  {activeFilters.length > 0
                    ? `${activeFilters.length} filtros ativos`
                    : 'Sem filtros ativos'}
                </small>
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
                Use a busca e os filtros ao lado para personalizar o catalogo sem perder contexto.
              </p>
            )}

            {gamesToDisplay.length === 0 ? (
              <article className="gp-empty">
                <span className="gp-badge">Sem resultados</span>
                <h3>Nenhum jogo combinou com os filtros atuais</h3>
                <p className="gp-muted">
                  Tente remover alguns filtros ou fazer uma busca mais ampla para voltar a ver o
                  catalogo completo.
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
                <div className="gp-grid">
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
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onChangePage={setCurrentPage}
                />
              </>
            )}
          </section>
        </div>

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
