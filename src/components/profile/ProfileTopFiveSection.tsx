import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCatalogGamesByIds,
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../services/gameCatalogService'
import {
  TOP_FIVE_POSITIONS,
  normalizeTopFiveEntries,
  type TopFivePosition,
  type TopFiveStoredEntry,
} from '../../utils/profileTopFive'
import './ProfileTopFiveSection.css'

interface SaveTopFiveResult {
  ok: boolean
  message?: string
}

interface TopFiveSlot {
  posicao: TopFivePosition
  gameId: number | null
  game: CatalogGamePreview | null
}

interface TopFiveSearchResultItem {
  game: CatalogGamePreview
  occupiedPosition: TopFivePosition | null
  isDisabled: boolean
  isCurrentSlot: boolean
}

interface ProfileTopFiveSectionProps {
  isOwnerView: boolean
  entries: TopFiveStoredEntry[]
  onSaveTopFive: (entries: TopFiveStoredEntry[]) => Promise<SaveTopFiveResult>
}

const SEARCH_DEBOUNCE_DELAY = 220

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function getSearchErrorMessage(error: GameCatalogError | null) {
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
    return 'Nao foi possivel buscar jogos por permissao. Verifique as policies da tabela jogos no Supabase.'
  }

  return 'Nao foi possivel buscar jogos agora.'
}

function getTopFiveHeadingCopy(filledSlotsCount: number, isOwnerView: boolean) {
  if (filledSlotsCount === 5) {
    return isOwnerView
      ? 'Seu ranking pessoal esta completo.'
      : 'O ranking pessoal deste perfil esta completo.'
  }

  if (filledSlotsCount === 0) {
    return isOwnerView
      ? 'Escolha os cinco jogos que melhor representam voce.'
      : 'Este perfil ainda nao definiu nenhum jogo no ranking pessoal.'
  }

  return isOwnerView
    ? `${filledSlotsCount}/5 posicoes definidas no seu ranking pessoal.`
    : `${filledSlotsCount}/5 posicoes definidas no ranking pessoal deste perfil.`
}

export function ProfileTopFiveSection({
  isOwnerView,
  entries,
  onSaveTopFive,
}: ProfileTopFiveSectionProps) {
  const normalizedEntriesFromProps = useMemo(() => normalizeTopFiveEntries(entries), [entries])

  const [storedEntries, setStoredEntries] = useState<TopFiveStoredEntry[]>(normalizedEntriesFromProps)
  const [gamesById, setGamesById] = useState<Record<number, CatalogGamePreview>>({})
  const [selectedGamesLoading, setSelectedGamesLoading] = useState(false)
  const [selectedGamesError, setSelectedGamesError] = useState<string | null>(null)
  const [activeSlotPosition, setActiveSlotPosition] = useState<TopFivePosition | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatalogGamePreview[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSavingTopFive, setIsSavingTopFive] = useState(false)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)
  const selectedGamesRequestIdRef = useRef(0)

  const entriesByPosition = useMemo(
    () => new Map(storedEntries.map(entry => [entry.posicao, entry])),
    [storedEntries]
  )
  const occupiedPositionsByGameId = useMemo(
    () => new Map(storedEntries.map(entry => [entry.jogo_id, entry.posicao])),
    [storedEntries]
  )
  const topFiveSlots = useMemo<TopFiveSlot[]>(
    () =>
      TOP_FIVE_POSITIONS.map(posicao => {
        const entry = entriesByPosition.get(posicao) || null
        const gameId = entry?.jogo_id ?? null

        return {
          posicao,
          gameId,
          game: gameId ? gamesById[gameId] || null : null,
        }
      }),
    [entriesByPosition, gamesById]
  )
  const activeSlot = useMemo(
    () => topFiveSlots.find(slot => slot.posicao === activeSlotPosition) || null,
    [activeSlotPosition, topFiveSlots]
  )
  const filledSlotsCount = storedEntries.length
  const trimmedSearchQuery = searchQuery.trim()
  const pickerResultsId = activeSlotPosition
    ? `profile-top-five-search-results-${activeSlotPosition}`
    : 'profile-top-five-search-results'
  const shouldShowSearchFeedback =
    trimmedSearchQuery.length >= 2 &&
    (searchLoading || Boolean(searchError) || searchResults.length > 0)
  const shouldShowSearchEmptyState =
    trimmedSearchQuery.length >= 2 &&
    !searchLoading &&
    !searchError &&
    searchResults.length === 0
  const topFiveSearchResults = useMemo<TopFiveSearchResultItem[]>(
    () =>
      searchResults.map(game => {
        const occupiedPosition = occupiedPositionsByGameId.get(game.id) || null
        const isCurrentSlot = occupiedPosition === activeSlotPosition
        const isDisabled = Boolean(occupiedPosition && occupiedPosition !== activeSlotPosition)

        return {
          game,
          occupiedPosition,
          isDisabled,
          isCurrentSlot,
        }
      }),
    [activeSlotPosition, occupiedPositionsByGameId, searchResults]
  )

  useEffect(() => {
    setStoredEntries(normalizedEntriesFromProps)
  }, [normalizedEntriesFromProps])

  useEffect(() => {
    const nextGameIds = storedEntries.map(entry => entry.jogo_id)
    const requestId = selectedGamesRequestIdRef.current + 1
    selectedGamesRequestIdRef.current = requestId

    if (nextGameIds.length === 0) {
      setSelectedGamesLoading(false)
      setSelectedGamesError(null)
      return
    }

    setSelectedGamesLoading(true)
    setSelectedGamesError(null)

    void (async () => {
      const { data, error } = await getCatalogGamesByIds(nextGameIds)

      if (selectedGamesRequestIdRef.current !== requestId) return

      if (error) {
        setSelectedGamesError(error.message || 'Nao foi possivel carregar os jogos do seu Top 5.')
        setSelectedGamesLoading(false)
        return
      }

      setGamesById(currentGamesById => {
        const nextGamesById = { ...currentGamesById }
        data.forEach(game => {
          nextGamesById[game.id] = game
        })
        return nextGamesById
      })
      setSelectedGamesError(null)
      setSelectedGamesLoading(false)
    })()
  }, [storedEntries])

  useEffect(() => {
    if (!activeSlotPosition) return

    searchInputRef.current?.focus()
  }, [activeSlotPosition])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const clearScheduledSearch = () => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }

  const resetPicker = () => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setActiveSlotPosition(null)
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setSearchError(null)
  }

  const persistTopFiveEntries = async (
    nextEntriesInput: TopFiveStoredEntry[],
    options?: {
      optimisticGame?: CatalogGamePreview | null
      closePickerOnSuccess?: boolean
    }
  ) => {
    const normalizedNextEntries = normalizeTopFiveEntries(nextEntriesInput)
    const previousEntries = storedEntries
    const previousEntriesSignature = JSON.stringify(previousEntries)
    const nextEntriesSignature = JSON.stringify(normalizedNextEntries)

    if (previousEntriesSignature === nextEntriesSignature) {
      setActionError(null)

      if (options?.closePickerOnSuccess) {
        resetPicker()
      }

      return
    }

    const optimisticGame = options?.optimisticGame || null

    if (optimisticGame) {
      setGamesById(currentGamesById => ({
        ...currentGamesById,
        [optimisticGame.id]: optimisticGame,
      }))
    }

    setStoredEntries(normalizedNextEntries)
    setIsSavingTopFive(true)
    setActionError(null)

    const result = await onSaveTopFive(normalizedNextEntries)

    setIsSavingTopFive(false)

    if (!result.ok) {
      setStoredEntries(previousEntries)
      setActionError(result.message || 'Nao foi possivel atualizar o Top 5 agora.')
      return
    }

    if (options?.closePickerOnSuccess) {
      resetPicker()
    }
  }

  const handleOpenSlotPicker = (posicao: TopFivePosition) => {
    if (!isOwnerView || isSavingTopFive) return

    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setActiveSlotPosition(posicao)
    setSearchQuery('')
    setSearchResults([])
    setSearchLoading(false)
    setSearchError(null)
    setActionError(null)
  }

  const handleSearchChange = (value: string) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setSearchQuery(value)
    setSearchError(null)
    setActionError(null)

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
        setSearchError(getSearchErrorMessage(error))
      } else {
        setSearchResults(data)
        setSearchError(null)
      }

      setSearchLoading(false)
      searchTimeoutRef.current = null
    }, SEARCH_DEBOUNCE_DELAY)
  }

  const handleSelectGame = async (game: CatalogGamePreview) => {
    if (!activeSlotPosition) return

    const occupiedPosition = occupiedPositionsByGameId.get(game.id) || null

    if (occupiedPosition && occupiedPosition !== activeSlotPosition) {
      return
    }

    const nextEntries = [
      ...storedEntries.filter(entry => entry.posicao !== activeSlotPosition),
      {
        posicao: activeSlotPosition,
        jogo_id: game.id,
      },
    ]

    await persistTopFiveEntries(nextEntries, {
      optimisticGame: game,
      closePickerOnSuccess: true,
    })
  }

  const handleRemoveSlot = async (posicao: TopFivePosition) => {
    if (isSavingTopFive) return

    const nextEntries = storedEntries.filter(entry => entry.posicao !== posicao)

    await persistTopFiveEntries(nextEntries, {
      closePickerOnSuccess: activeSlotPosition === posicao,
    })
  }

  const renderSlotBody = (slot: TopFiveSlot) => {
    const slotLabel = `Numero ${slot.posicao}`
    const isActiveSlot = activeSlotPosition === slot.posicao
    const hasAssignedGame = slot.gameId !== null
    const slotClassName = `profile-top-five-slot is-rank-${slot.posicao}${hasAssignedGame ? ' is-filled' : ' is-empty'}${isActiveSlot ? ' is-active-picker' : ''}`

    if (!hasAssignedGame) {
      return (
        <article key={`top-five-slot-${slot.posicao}`} className={slotClassName}>
          <div className="profile-top-five-slot-number" aria-hidden="true">
            {slot.posicao}
          </div>

          {isOwnerView ? (
            <button
              type="button"
              className="profile-top-five-slot-main profile-top-five-slot-button"
              onClick={() => handleOpenSlotPicker(slot.posicao)}
              disabled={isSavingTopFive}
            >
              <span className="profile-top-five-slot-kicker">{slotLabel}</span>
              <strong>Escolher jogo</strong>
              <span>Monte sua colocacao pessoal com um jogo do catalogo.</span>
            </button>
          ) : (
            <div className="profile-top-five-slot-main">
              <span className="profile-top-five-slot-kicker">{slotLabel}</span>
              <strong>Nao definido</strong>
              <span>Este espaco ainda nao recebeu um jogo.</span>
            </div>
          )}
        </article>
      )
    }

    const visibleTitle = slot.game?.titulo || (selectedGamesLoading ? 'Carregando jogo...' : 'Jogo indisponivel')

    return (
      <article key={`top-five-slot-${slot.posicao}`} className={slotClassName}>
        <div className="profile-top-five-slot-number" aria-hidden="true">
          {slot.posicao}
        </div>

        {isOwnerView ? (
          <button
            type="button"
            className="profile-top-five-slot-main profile-top-five-slot-button"
            onClick={() => handleOpenSlotPicker(slot.posicao)}
            disabled={isSavingTopFive}
          >
            <div className="profile-top-five-slot-cover">
              {slot.game?.capa_url ? (
                <img src={slot.game.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
              ) : (
                <div className="profile-top-five-slot-fallback">{getInitial(visibleTitle)}</div>
              )}
            </div>

            <div className="profile-top-five-slot-copy">
              <span className="profile-top-five-slot-kicker">{slotLabel}</span>
              <strong>{visibleTitle}</strong>
            </div>
          </button>
        ) : (
          <div className="profile-top-five-slot-main">
            <div className="profile-top-five-slot-cover">
              {slot.game?.capa_url ? (
                <img src={slot.game.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
              ) : (
                <div className="profile-top-five-slot-fallback">{getInitial(visibleTitle)}</div>
              )}
            </div>

            <div className="profile-top-five-slot-copy">
              <span className="profile-top-five-slot-kicker">{slotLabel}</span>
              <strong>{visibleTitle}</strong>
            </div>
          </div>
        )}

        {isOwnerView ? (
          <div className="profile-top-five-slot-actions">
            <button
              type="button"
              className="profile-secondary-button"
              onClick={() => handleOpenSlotPicker(slot.posicao)}
              disabled={isSavingTopFive}
            >
              Trocar jogo
            </button>

            <button
              type="button"
              className="profile-secondary-button profile-item-remove-button"
              onClick={() => void handleRemoveSlot(slot.posicao)}
              disabled={isSavingTopFive}
            >
              Remover
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <div className="profile-top-five-section">
      <div className="profile-top-five-header">
        <div className="profile-top-five-copy">
          <span className="profile-section-label">Top 5 pessoal</span>
          <h2>
            {isOwnerView
              ? 'Os jogos que definem o seu ranking pessoal'
              : 'Os jogos que definem o ranking pessoal deste perfil'}
          </h2>
          <p>{getTopFiveHeadingCopy(filledSlotsCount, isOwnerView)}</p>
        </div>
      </div>

      {selectedGamesError ? <p className="profile-feedback is-error">{selectedGamesError}</p> : null}
      {actionError ? <p className="profile-feedback is-error">{actionError}</p> : null}

      <div className="profile-top-five-grid">{topFiveSlots.map(renderSlotBody)}</div>

      {selectedGamesLoading ? (
        <p className="profile-top-five-status">
          {isOwnerView
            ? 'Carregando os jogos ja escolhidos para o seu Top 5...'
            : 'Carregando os jogos ja escolhidos para o Top 5 deste perfil...'}
        </p>
      ) : null}

      {activeSlotPosition ? (
        <div className="profile-top-five-picker">
          <div className="profile-top-five-picker-head">
            <div className="profile-top-five-picker-copy">
              <span className="profile-section-label">Selecao do ranking</span>
              <h3>Escolher jogo para o Numero {activeSlotPosition}</h3>
              <p>
                Busque um jogo do catalogo e confirme qual titulo deve ocupar essa colocacao.
              </p>
            </div>

            <button
              type="button"
              className="profile-secondary-button"
              onClick={resetPicker}
              disabled={isSavingTopFive}
            >
              Cancelar
            </button>
          </div>

          {activeSlot?.gameId !== null ? (
            <div className="profile-top-five-picker-current">
              <span>Atual</span>
              <strong>{activeSlot?.game?.titulo || 'Jogo selecionado anteriormente'}</strong>
            </div>
          ) : null}

          <label className="profile-top-five-search-field" htmlFor="profile-top-five-search-input">
            <span>Buscar jogo no catalogo</span>
            <input
              ref={searchInputRef}
              id="profile-top-five-search-input"
              type="text"
              value={searchQuery}
              onChange={event => handleSearchChange(event.target.value)}
              className="profile-input"
              placeholder="Digite para encontrar um jogo..."
              autoComplete="off"
              disabled={isSavingTopFive}
              aria-expanded={shouldShowSearchFeedback || shouldShowSearchEmptyState}
              aria-controls={pickerResultsId}
            />
          </label>

          {trimmedSearchQuery.length === 1 && !searchLoading ? (
            <p className="profile-top-five-search-helper">
              Continue digitando para mostrar sugestoes do catalogo.
            </p>
          ) : null}

          {shouldShowSearchFeedback || shouldShowSearchEmptyState ? (
            <div className="profile-top-five-search-results" id={pickerResultsId}>
              {searchLoading ? (
                <p className="profile-top-five-search-state">Buscando jogos...</p>
              ) : searchError ? (
                <p className="profile-top-five-search-state is-error">{searchError}</p>
              ) : shouldShowSearchEmptyState ? (
                <p className="profile-top-five-search-state">Nenhum jogo encontrado para esse termo.</p>
              ) : (
                topFiveSearchResults.map(result => {
                  const { game, occupiedPosition, isDisabled, isCurrentSlot } = result
                  const helperText = isDisabled
                    ? `Ja no Numero ${occupiedPosition}`
                    : isCurrentSlot
                      ? `Ja ocupa o Numero ${activeSlotPosition}`
                      : `Selecionar para o Numero ${activeSlotPosition}`

                  if (isDisabled) {
                    return (
                      <div
                        key={`top-five-search-result-${game.id}`}
                        className="profile-top-five-search-result is-disabled"
                        aria-label={`${game.titulo} ja ocupa o Numero ${occupiedPosition}.`}
                      >
                        <div className="profile-top-five-search-result-cover">
                          {game.capa_url ? (
                            <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
                          ) : (
                            <div className="profile-top-five-search-result-fallback">
                              {getInitial(game.titulo)}
                            </div>
                          )}
                        </div>

                        <div className="profile-top-five-search-result-copy">
                          <strong>{game.titulo}</strong>
                          <span>{helperText}</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <button
                      key={`top-five-search-result-${game.id}`}
                      type="button"
                      className="profile-top-five-search-result"
                      onClick={() => void handleSelectGame(game)}
                      disabled={isSavingTopFive}
                    >
                      <div className="profile-top-five-search-result-cover">
                        {game.capa_url ? (
                          <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
                        ) : (
                          <div className="profile-top-five-search-result-fallback">
                            {getInitial(game.titulo)}
                          </div>
                        )}
                      </div>

                      <div className="profile-top-five-search-result-copy">
                        <strong>{game.titulo}</strong>
                        <span>{helperText}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
