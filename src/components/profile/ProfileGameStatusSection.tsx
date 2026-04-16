import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  searchGamesForStatus,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusValue,
  type StatusGame,
} from '../../services/gameStatusService'
import './ProfileGameStatusSection.css'

type FeedbackTone = 'success' | 'error'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface SaveStatusResult {
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
  onRefresh: () => Promise<void>
}

const STATUS_GROUPS: Array<{
  value: GameStatusValue
  label: string
  description: string
}> = [
  {
    value: 'jogando',
    label: 'Jogando',
    description: 'Titulos que ainda estao em andamento.',
  },
  {
    value: 'zerado',
    label: 'Zerado',
    description: 'Jogos concluidos e prontos para revisitar.',
  },
  {
    value: 'dropado',
    label: 'Dropado',
    description: 'Experiencias pausadas ou deixadas de lado.',
  },
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

function sortStatusItems(leftItem: GameStatusItem, rightItem: GameStatusItem) {
  if (leftItem.favorito !== rightItem.favorito) {
    return leftItem.favorito ? -1 : 1
  }

  const createdAtDelta = getTimestamp(rightItem.created_at) - getTimestamp(leftItem.created_at)
  if (createdAtDelta !== 0) return createdAtDelta

  const leftTitle = leftItem.jogo?.titulo || ''
  const rightTitle = rightItem.jogo?.titulo || ''
  return leftTitle.localeCompare(rightTitle, 'pt-BR')
}

function getStatusSearchErrorMessage(error: GameStatusError | null) {
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

export function ProfileGameStatusSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  isOwnerView,
  onSaveStatus,
  onRefresh,
}: ProfileGameStatusSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StatusGame[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<StatusGame | null>(null)
  const [composerStatus, setComposerStatus] = useState<GameStatusValue>('jogando')
  const [composerFavorito, setComposerFavorito] = useState(false)
  const [isCreatingStatus, setIsCreatingStatus] = useState(false)
  const [savingItemIds, setSavingItemIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  const trackedGameIds = useMemo(() => new Set(items.map(item => item.jogo_id)), [items])
  const availableSearchResults = useMemo(
    () => searchResults.filter(game => !trackedGameIds.has(game.id)),
    [searchResults, trackedGameIds]
  )
  const groupedItems = useMemo(
    () =>
      STATUS_GROUPS.map(group => ({
        ...group,
        items: items.filter(item => item.status === group.value).sort(sortStatusItems),
      })),
    [items]
  )

  const hasStatusItems = items.length > 0
  const searchResultsId = `profile-status-search-results-${userId}`
  const visibleSelectedGame = selectedGame && !trackedGameIds.has(selectedGame.id) ? selectedGame : null

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) {
      setSearchResults([])
      setSelectedGame(null)
      setSearchError('Digite o nome de um jogo para pesquisar no catalogo.')
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    setFeedback(null)

    const { data, error } = await searchGamesForStatus(trimmedQuery)

    if (error) {
      setSearchResults([])
      setSelectedGame(null)
      setSearchError(getStatusSearchErrorMessage(error))
      setSearchLoading(false)
      return
    }

    const availableResults = data.filter(game => !trackedGameIds.has(game.id))
    setSearchResults(availableResults)

    if (selectedGame && availableResults.every(game => game.id !== selectedGame.id)) {
      setSelectedGame(null)
    }

    setSearchLoading(false)
  }

  const handleSelectGame = (game: StatusGame) => {
    setSelectedGame(game)
    setComposerStatus('jogando')
    setComposerFavorito(false)
    setFeedback(null)
  }

  const handleCancelSelectedGame = () => {
    setSelectedGame(null)
    setComposerStatus('jogando')
    setComposerFavorito(false)
  }

  const handleCreateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!visibleSelectedGame) return

    setIsCreatingStatus(true)
    setFeedback(null)

    const result = await onSaveStatus({
      gameId: visibleSelectedGame.id,
      status: composerStatus,
      favorito: composerFavorito,
    })

    if (!result.ok) {
      setFeedback({
        tone: 'error',
        message: result.message || 'Nao foi possivel salvar o status deste jogo.',
      })
      setIsCreatingStatus(false)
      return
    }

    const selectedTitle = visibleSelectedGame.titulo

    setSearchQuery('')
    setSearchResults([])
    setSelectedGame(null)
    setComposerStatus('jogando')
    setComposerFavorito(false)
    setFeedback({
      tone: 'success',
      message: `${selectedTitle} foi adicionado aos seus status.`,
    })
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
    setFeedback(null)

    const result = await onSaveStatus({
      gameId: item.jogo_id,
      status: nextStatus,
      favorito: nextFavorito,
    })

    setSavingItemIds(currentIds => currentIds.filter(currentId => currentId !== item.id))

    if (!result.ok) {
      setFeedback({
        tone: 'error',
        message: result.message || 'Nao foi possivel atualizar o status deste jogo.',
      })
      return
    }

    setFeedback({
      tone: 'success',
      message: `${item.jogo?.titulo || 'O jogo'} foi atualizado com sucesso.`,
    })
  }

  return (
    <section className="profile-card profile-status-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-status-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">Status dos jogos</span>
            <h2>Separe o que esta jogando, zerado ou dropado</h2>
            <p>Organize sua jornada por status sem misturar os jogos com a wishlist.</p>
          </div>

          <div className="profile-meta-item profile-status-summary">
            <span>Total com status</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        {isOwnerView ? (
          <div className="profile-status-search-card">
            <div className="profile-status-search-head">
              <div>
                <h3>Adicionar jogo aos seus status</h3>
                <p>Busque no catalogo e escolha como esse jogo aparece no seu perfil.</p>
              </div>
            </div>

            <form className="profile-status-search-form" onSubmit={handleSearchSubmit}>
              <label className="profile-status-search-field">
                <span>Buscar jogo</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="profile-input"
                  placeholder="Ex.: Hollow Knight, Celeste, Zelda..."
                  disabled={searchLoading || isCreatingStatus}
                />
              </label>

              <button
                type="submit"
                className="profile-save-button profile-status-search-button"
                disabled={searchLoading || isCreatingStatus}
              >
                {searchLoading ? 'Buscando...' : 'Buscar no catalogo'}
              </button>
            </form>

            {searchError ? <p className="profile-feedback is-error">{searchError}</p> : null}

            {!searchError && !searchLoading && searchQuery.trim() && availableSearchResults.length === 0 ? (
              <div className="profile-status-search-empty">
                <h4>Nenhum jogo disponivel para adicionar</h4>
                <p>
                  Tente outro termo ou escolha um titulo que ainda nao tenha status salvo no seu
                  perfil.
                </p>
              </div>
            ) : null}

            {availableSearchResults.length > 0 ? (
              <div className="profile-status-search-results" id={searchResultsId}>
                {availableSearchResults.map(game => {
                  const isSelected = visibleSelectedGame?.id === game.id

                  return (
                    <button
                      key={game.id}
                      type="button"
                      className={`profile-status-search-result${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleSelectGame(game)}
                    >
                      <div className="profile-status-search-result-cover">
                        {game.capa_url ? (
                          <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
                        ) : (
                          <div className="profile-status-search-result-fallback">
                            {getInitial(game.titulo)}
                          </div>
                        )}
                      </div>

                      <div className="profile-status-search-result-copy">
                        <strong>{game.titulo}</strong>
                        <span>{isSelected ? 'Selecionado para adicionar' : 'Selecionar jogo'}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

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
                      <div className="profile-status-search-result-fallback">
                        {getInitial(visibleSelectedGame.titulo)}
                      </div>
                    )}
                  </div>

                  <div className="profile-status-composer-copy">
                    <span className="profile-section-label">Novo status</span>
                    <h3>{visibleSelectedGame.titulo}</h3>
                    <p>Escolha como esse jogo deve aparecer na aba de status do seu perfil.</p>
                  </div>
                </div>

                <div className="profile-status-composer-controls">
                  <div className="profile-status-choice-group" role="group" aria-label="Escolher status inicial">
                    {STATUS_GROUPS.map(statusOption => (
                      <button
                        key={`composer-status-${statusOption.value}`}
                        type="button"
                        className={`profile-status-choice${composerStatus === statusOption.value ? ' is-active' : ''}`}
                        onClick={() => setComposerStatus(statusOption.value)}
                        disabled={isCreatingStatus}
                      >
                        {statusOption.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`profile-status-favorite-toggle${composerFavorito ? ' is-active' : ''}`}
                    aria-pressed={composerFavorito}
                    onClick={() => setComposerFavorito(currentValue => !currentValue)}
                    disabled={isCreatingStatus}
                  >
                    {composerFavorito ? 'Favorito ativo' : 'Marcar como favorito'}
                  </button>
                </div>

                <div className="profile-status-composer-actions">
                  <button
                    type="button"
                    className="profile-secondary-button"
                    onClick={handleCancelSelectedGame}
                    disabled={isCreatingStatus}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="profile-save-button" disabled={isCreatingStatus}>
                    {isCreatingStatus ? 'Salvando...' : 'Salvar status'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}

        {feedback ? <p className={`profile-feedback is-${feedback.tone}`}>{feedback.message}</p> : null}

        {isLoading ? (
          <div className="profile-status-empty">
            <h3>Carregando seus status</h3>
            <p>Estamos buscando os jogos organizados por andamento, conclusao e pausa.</p>
          </div>
        ) : errorMessage ? (
          <div className="profile-status-empty">
            <h3>Ocorreu um problema ao carregar os status</h3>
            <p>{errorMessage}</p>
            <button type="button" className="profile-secondary-button" onClick={() => void onRefresh()}>
              Tentar novamente
            </button>
          </div>
        ) : !hasStatusItems ? (
          <div className="profile-status-empty">
            <h3>{isOwnerView ? 'Nenhum jogo com status ainda' : 'Este perfil ainda nao tem status salvos'}</h3>
            <p>
              {isOwnerView
                ? 'Use a busca acima para adicionar jogos e separar o que esta jogando, zerado ou dropado.'
                : 'Quando este usuario organizar os jogos por status, eles vao aparecer aqui.'}
            </p>
          </div>
        ) : (
          <div className="profile-status-groups">
            {groupedItems.map(group => (
              <article key={group.value} className="profile-status-group">
                <div className="profile-status-group-head">
                  <div className="profile-status-group-copy">
                    <span className={`profile-status-pill is-${group.value}`}>{group.label}</span>
                    <p>{group.description}</p>
                  </div>

                  <span className="profile-status-group-count">
                    {group.items.length === 1 ? '1 jogo' : `${group.items.length} jogos`}
                  </span>
                </div>

                {group.items.length === 0 ? (
                  <div className="profile-status-group-empty">
                    <p>Nenhum jogo marcado como {group.label.toLowerCase()} por enquanto.</p>
                  </div>
                ) : (
                  <div className="profile-status-grid">
                    {group.items.map(item => {
                      const visibleTitle = item.jogo?.titulo || 'Jogo indisponivel'
                      const isSavingItem = savingItemIds.includes(item.id)

                      return (
                        <article
                          key={item.id}
                          className={`profile-status-card${item.favorito ? ' is-favorite' : ''}${isSavingItem ? ' is-saving' : ''}`}
                        >
                          <Link to={`/games/${item.jogo_id}`} className="profile-status-card-link">
                            <div className="profile-status-card-cover">
                              {item.jogo?.capa_url ? (
                                <img src={item.jogo.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
                              ) : (
                                <div className="profile-status-card-fallback">
                                  {getInitial(visibleTitle)}
                                </div>
                              )}
                            </div>

                            <div className="profile-status-card-body">
                              <div className="profile-status-card-badges">
                                <span className={`profile-status-pill is-${item.status}`}>
                                  {STATUS_GROUPS.find(groupOption => groupOption.value === item.status)?.label ||
                                    'Status'}
                                </span>
                                {item.favorito ? (
                                  <span className="profile-status-favorite-pill">Favorito</span>
                                ) : null}
                              </div>

                              <h3>{visibleTitle}</h3>
                              <p>Atualizado em {formatCompactDate(item.created_at)}</p>
                              <span className="profile-status-card-cta">Ver detalhes</span>
                            </div>
                          </Link>

                          {isOwnerView ? (
                            <div className="profile-status-card-controls">
                              <div
                                className="profile-status-choice-group"
                                role="group"
                                aria-label={`Alterar status de ${visibleTitle}`}
                              >
                                {STATUS_GROUPS.map(statusOption => (
                                  <button
                                    key={`${item.id}-${statusOption.value}`}
                                    type="button"
                                    className={`profile-status-choice${item.status === statusOption.value ? ' is-active' : ''}`}
                                    onClick={() =>
                                      void handleUpdateExistingItem(
                                        item,
                                        statusOption.value,
                                        item.favorito
                                      )
                                    }
                                    disabled={isSavingItem}
                                  >
                                    {statusOption.label}
                                  </button>
                                ))}
                              </div>

                              <div className="profile-status-card-footer">
                                <button
                                  type="button"
                                  className={`profile-status-favorite-toggle${item.favorito ? ' is-active' : ''}`}
                                  aria-pressed={item.favorito}
                                  onClick={() =>
                                    void handleUpdateExistingItem(item, item.status, !item.favorito)
                                  }
                                  disabled={isSavingItem}
                                >
                                  {item.favorito ? 'Favorito ativo' : 'Marcar favorito'}
                                </button>

                                {isSavingItem ? (
                                  <span className="profile-status-saving-label">Salvando...</span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
