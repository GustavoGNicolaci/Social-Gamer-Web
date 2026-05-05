import { useEffect, useMemo, useRef, useState } from 'react'
import { GameCoverImage } from '../GameCoverImage'
import { useI18n } from '../../i18n/I18nContext'
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

function getSearchErrorMessage(
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
    return t('error.permissionSearchGames')
  }

  return t('error.genericSearchGames')
}

function getTopFiveHeadingCopy(
  filledSlotsCount: number,
  isOwnerView: boolean,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (filledSlotsCount === 5) {
    return isOwnerView
      ? t('profileTopFive.completeOwner')
      : t('profileTopFive.completePublic')
  }

  if (filledSlotsCount === 0) {
    return isOwnerView
      ? t('profileTopFive.emptyOwner')
      : t('profileTopFive.emptyPublic')
  }

  return isOwnerView
    ? t('profileTopFive.partialOwner', { count: filledSlotsCount })
    : t('profileTopFive.partialPublic', { count: filledSlotsCount })
}

export function ProfileTopFiveSection({
  isOwnerView,
  entries,
  onSaveTopFive,
}: ProfileTopFiveSectionProps) {
  const { t } = useI18n()
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
        setSelectedGamesError(error.message || t('profileTopFive.loadSelectedError'))
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
  }, [storedEntries, t])

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
      setActionError(result.message || t('profileTopFive.updateError'))
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
        setSearchError(getSearchErrorMessage(error, t))
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
    const slotLabel = t('profileTopFive.number', { position: slot.posicao })
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
              <strong>{t('profileTopFive.chooseGame')}</strong>
              <span>{t('profileTopFive.slotHelp')}</span>
            </button>
          ) : (
            <div className="profile-top-five-slot-main">
              <span className="profile-top-five-slot-kicker">{slotLabel}</span>
              <strong>{t('profileTopFive.notDefined')}</strong>
              <span>{t('profileTopFive.emptySlot')}</span>
            </div>
          )}
        </article>
      )
    }

    const visibleTitle = slot.game?.titulo ||
      (selectedGamesLoading ? t('profileTopFive.loadingGame') : t('common.gameUnavailable'))

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
                <GameCoverImage
                  src={slot.game.capa_url}
                  alt={t('catalog.coverAlt', { title: visibleTitle })}
                  width={320}
                  height={400}
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
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
                <GameCoverImage
                  src={slot.game.capa_url}
                  alt={t('catalog.coverAlt', { title: visibleTitle })}
                  width={320}
                  height={400}
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
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
              {t('profileTopFive.changeGame')}
            </button>

            <button
              type="button"
              className="profile-secondary-button profile-item-remove-button"
              onClick={() => void handleRemoveSlot(slot.posicao)}
              disabled={isSavingTopFive}
            >
              {t('common.remove')}
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
          <span className="profile-section-label">{t('profileTopFive.label')}</span>
          <h2>
            {isOwnerView
              ? t('profileTopFive.ownerTitle')
              : t('profileTopFive.publicTitle')}
          </h2>
          <p>{getTopFiveHeadingCopy(filledSlotsCount, isOwnerView, t)}</p>
        </div>
      </div>

      {selectedGamesError ? <p className="profile-feedback is-error">{selectedGamesError}</p> : null}
      {actionError ? <p className="profile-feedback is-error">{actionError}</p> : null}

      <div className="profile-top-five-grid">{topFiveSlots.map(renderSlotBody)}</div>

      {selectedGamesLoading ? (
        <p className="profile-top-five-status">
          {isOwnerView
            ? t('profileTopFive.loadingSelectedOwner')
            : t('profileTopFive.loadingSelectedPublic')}
        </p>
      ) : null}

      {activeSlotPosition ? (
        <div className="profile-top-five-picker">
          <div className="profile-top-five-picker-head">
            <div className="profile-top-five-picker-copy">
              <span className="profile-section-label">{t('profileTopFive.pickerLabel')}</span>
              <h3>{t('profileTopFive.pickerTitle', { position: activeSlotPosition })}</h3>
              <p>{t('profileTopFive.pickerText')}</p>
            </div>

            <button
              type="button"
              className="profile-secondary-button"
              onClick={resetPicker}
              disabled={isSavingTopFive}
            >
              {t('common.cancel')}
            </button>
          </div>

          {activeSlot?.gameId !== null ? (
            <div className="profile-top-five-picker-current">
              <span>{t('profileTopFive.current')}</span>
              <strong>{activeSlot?.game?.titulo || t('profileTopFive.previousGame')}</strong>
            </div>
          ) : null}

          <label className="profile-top-five-search-field" htmlFor="profile-top-five-search-input">
            <span>{t('profileTopFive.searchLabel')}</span>
            <input
              ref={searchInputRef}
              id="profile-top-five-search-input"
              type="text"
              value={searchQuery}
              onChange={event => handleSearchChange(event.target.value)}
              className="profile-input"
              placeholder={t('profileTopFive.searchPlaceholder')}
              autoComplete="off"
              disabled={isSavingTopFive}
              aria-expanded={shouldShowSearchFeedback || shouldShowSearchEmptyState}
              aria-controls={pickerResultsId}
            />
          </label>

          {trimmedSearchQuery.length === 1 && !searchLoading ? (
            <p className="profile-top-five-search-helper">
              {t('profileTopFive.keepTyping')}
            </p>
          ) : null}

          {shouldShowSearchFeedback || shouldShowSearchEmptyState ? (
            <div className="profile-top-five-search-results" id={pickerResultsId}>
              {searchLoading ? (
                <p className="profile-top-five-search-state">{t('profileTopFive.searching')}</p>
              ) : searchError ? (
                <p className="profile-top-five-search-state is-error">{searchError}</p>
              ) : shouldShowSearchEmptyState ? (
                <p className="profile-top-five-search-state">{t('profileTopFive.emptySearch')}</p>
              ) : (
                topFiveSearchResults.map(result => {
                  const { game, occupiedPosition, isDisabled, isCurrentSlot } = result
                  const helperText = isDisabled
                    ? t('profileTopFive.alreadyInNumber', { position: occupiedPosition || 0 })
                    : isCurrentSlot
                      ? t('profileTopFive.alreadyCurrent', { position: activeSlotPosition })
                      : t('profileTopFive.selectForNumber', { position: activeSlotPosition })

                  if (isDisabled) {
                    return (
                      <div
                        key={`top-five-search-result-${game.id}`}
                        className="profile-top-five-search-result is-disabled"
                        aria-label={t('profileTopFive.alreadyOccupiesAria', {
                          title: game.titulo,
                          position: occupiedPosition || 0,
                        })}
                      >
                        <div className="profile-top-five-search-result-cover">
                          {game.capa_url ? (
                            <GameCoverImage
                              src={game.capa_url}
                              alt={t('catalog.coverAlt', { title: game.titulo })}
                              width={60}
                              height={60}
                              sizes="60px"
                            />
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
                          <GameCoverImage
                            src={game.capa_url}
                            alt={t('catalog.coverAlt', { title: game.titulo })}
                            width={60}
                            height={60}
                            sizes="60px"
                          />
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
