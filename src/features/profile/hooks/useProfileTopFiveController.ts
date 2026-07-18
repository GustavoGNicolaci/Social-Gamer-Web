import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import {
  getCatalogGamesByIds,
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../../services/gameCatalogService'
import {
  TOP_FIVE_POSITIONS,
  normalizeTopFiveEntries,
  type TopFivePosition,
  type TopFiveStoredEntry,
} from '../../../utils/profileTopFive'

export interface SaveTopFiveResult {
  ok: boolean
  message?: string
}

interface UseProfileTopFiveControllerParams {
  isOwnerView: boolean
  entries: TopFiveStoredEntry[]
  onSaveTopFive: (
    entries: TopFiveStoredEntry[]
  ) => Promise<SaveTopFiveResult>
}

export interface ProfileTopFiveSlot {
  posicao: TopFivePosition
  gameId: number | null
  game: CatalogGamePreview | null
}

export interface ProfileTopFiveSearchResultItem {
  game: CatalogGamePreview
  occupiedPosition: TopFivePosition | null
  isDisabled: boolean
  isCurrentSlot: boolean
}

interface StoredEntriesOverride {
  sourceSignature: string
  entriesSignature: string
  entries: TopFiveStoredEntry[]
}

interface SelectedGamesLoadResult {
  requestKey: string
  error: string | null
}

const SEARCH_DEBOUNCE_DELAY = 220

function getSearchErrorMessage(
  error: GameCatalogError | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!error) {
    return t('error.genericSearchGames')
  }

  const fullMessage = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

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

export function useProfileTopFiveController({
  isOwnerView,
  entries,
  onSaveTopFive,
}: UseProfileTopFiveControllerParams) {
  const { t } = useI18n()
  const normalizedEntriesFromProps = useMemo(
    () => normalizeTopFiveEntries(entries),
    [entries]
  )
  const normalizedEntriesSignature = useMemo(
    () => JSON.stringify(normalizedEntriesFromProps),
    [normalizedEntriesFromProps]
  )
  const [storedEntriesOverride, setStoredEntriesOverride] =
    useState<StoredEntriesOverride | null>(null)
  const [gamesById, setGamesById] = useState<
    Record<number, CatalogGamePreview>
  >({})
  const [selectedGamesLoadResult, setSelectedGamesLoadResult] =
    useState<SelectedGamesLoadResult>({ requestKey: '', error: null })
  const [activeSlotPosition, setActiveSlotPosition] =
    useState<TopFivePosition | null>(null)
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
  const storedEntries =
    storedEntriesOverride?.sourceSignature === normalizedEntriesSignature
      ? storedEntriesOverride.entries
      : normalizedEntriesFromProps

  useEffect(() => {
    if (
      storedEntriesOverride?.entriesSignature !== normalizedEntriesSignature
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStoredEntriesOverride(currentOverride =>
        currentOverride?.entriesSignature === normalizedEntriesSignature
          ? null
          : currentOverride
      )
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [normalizedEntriesSignature, storedEntriesOverride?.entriesSignature])

  const selectedGameIds = useMemo(
    () => storedEntries.map(entry => entry.jogo_id),
    [storedEntries]
  )
  const selectedGamesRequestKey = selectedGameIds.join(',')
  const selectedGamesLoading =
    selectedGameIds.length > 0 &&
    selectedGamesLoadResult.requestKey !== selectedGamesRequestKey
  const selectedGamesError =
    selectedGamesLoadResult.requestKey === selectedGamesRequestKey
      ? selectedGamesLoadResult.error
      : null
  const entriesByPosition = useMemo(
    () => new Map(storedEntries.map(entry => [entry.posicao, entry])),
    [storedEntries]
  )
  const occupiedPositionsByGameId = useMemo(
    () => new Map(storedEntries.map(entry => [entry.jogo_id, entry.posicao])),
    [storedEntries]
  )
  const topFiveSlots = useMemo<ProfileTopFiveSlot[]>(
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
    () =>
      topFiveSlots.find(slot => slot.posicao === activeSlotPosition) || null,
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
  const topFiveSearchResults = useMemo<ProfileTopFiveSearchResultItem[]>(
    () =>
      searchResults.map(game => {
        const occupiedPosition =
          occupiedPositionsByGameId.get(game.id) || null
        const isCurrentSlot = occupiedPosition === activeSlotPosition
        const isDisabled = Boolean(
          occupiedPosition && occupiedPosition !== activeSlotPosition
        )

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
    const requestId = selectedGamesRequestIdRef.current + 1
    selectedGamesRequestIdRef.current = requestId

    if (selectedGameIds.length === 0) return

    void (async () => {
      const { data, error } = await getCatalogGamesByIds(selectedGameIds)

      if (selectedGamesRequestIdRef.current !== requestId) return

      if (error) {
        setSelectedGamesLoadResult({
          requestKey: selectedGamesRequestKey,
          error:
            error.message || t('profileTopFive.loadSelectedError'),
        })
        return
      }

      setGamesById(currentGamesById => {
        const nextGamesById = { ...currentGamesById }
        data.forEach(game => {
          nextGamesById[game.id] = game
        })
        return nextGamesById
      })
      setSelectedGamesLoadResult({
        requestKey: selectedGamesRequestKey,
        error: null,
      })
    })()
  }, [selectedGameIds, selectedGamesRequestKey, t])

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

    setStoredEntriesOverride({
      sourceSignature: normalizedEntriesSignature,
      entriesSignature: nextEntriesSignature,
      entries: normalizedNextEntries,
    })
    setIsSavingTopFive(true)
    setActionError(null)

    const result = await onSaveTopFive(normalizedNextEntries)

    setIsSavingTopFive(false)

    if (!result.ok) {
      setStoredEntriesOverride({
        sourceSignature: normalizedEntriesSignature,
        entriesSignature: previousEntriesSignature,
        entries: previousEntries,
      })
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
      const { data, error } =
        await searchCatalogGamesByTitle(trimmedValue)

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

    const occupiedPosition =
      occupiedPositionsByGameId.get(game.id) || null

    if (occupiedPosition && occupiedPosition !== activeSlotPosition) {
      return
    }

    const nextEntries = [
      ...storedEntries.filter(
        entry => entry.posicao !== activeSlotPosition
      ),
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

    const nextEntries = storedEntries.filter(
      entry => entry.posicao !== posicao
    )

    await persistTopFiveEntries(nextEntries, {
      closePickerOnSuccess: activeSlotPosition === posicao,
    })
  }

  return {
    actionError,
    activeSlot,
    activeSlotPosition,
    filledSlotsCount,
    handleOpenSlotPicker,
    handleRemoveSlot,
    handleSearchChange,
    handleSelectGame,
    isSavingTopFive,
    pickerResultsId,
    resetPicker,
    searchError,
    searchInputRef,
    searchLoading,
    searchQuery,
    selectedGamesError,
    selectedGamesLoading,
    shouldShowSearchEmptyState,
    shouldShowSearchFeedback,
    topFiveSearchResults,
    topFiveSlots,
    trimmedSearchQuery,
  }
}

export type ProfileTopFiveController = ReturnType<
  typeof useProfileTopFiveController
>
