import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { TranslationParams } from '../../../i18n'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
  type GameCatalogError,
} from '../../../services/gameCatalogService'
import {
  followUser,
  searchUsers,
  unfollowUser,
  type UserSearchResult,
  type UserServiceError,
} from '../../../services/userService'
import { getPublicProfilePath } from '../../../utils/profileRoutes'

const SEARCH_DEBOUNCE_DELAY = 220
const SEARCH_RESULTS_ID = 'navbar-search-results'

type NavbarSearchItem =
  | { kind: 'game'; id: string; game: CatalogGamePreview }
  | { kind: 'user'; id: string; user: UserSearchResult }

type TranslateFunction = (key: string, params?: TranslationParams) => string

interface UseNavbarGlobalSearchOptions {
  viewerId?: string
  t: TranslateFunction
}

interface CloseSearchOptions {
  collapseCompact?: boolean
  clearQuery?: boolean
}

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function getCompactYear(value: string | null | undefined) {
  if (!value) return null
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : String(parsedDate.getFullYear())
}

function getCatalogSearchErrorMessage(error: GameCatalogError | null, t: TranslateFunction) {
  if (!error) return t('error.genericSearchGames')
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return t('error.permissionSearchGames')
  }
  return t('error.genericSearchGames')
}

function getUserSearchErrorMessage(error: UserServiceError | null, t: TranslateFunction) {
  if (!error) return t('navbar.search.userError')
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return t('navbar.search.userPermissionError')
  }
  return error.message || t('navbar.search.userError')
}

function getFollowActionErrorMessage(
  error: UserServiceError | null,
  action: 'follow' | 'unfollow',
  t: TranslateFunction
) {
  if (!error) return action === 'follow' ? t('navbar.search.followError') : t('navbar.search.unfollowError')
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return action === 'follow'
      ? t('navbar.search.followPermissionError')
      : t('navbar.search.unfollowPermissionError')
  }
  return error.message || getUserSearchErrorMessage(error, t)
}

function isCompactSearchViewport(viewportWidth: number) {
  return viewportWidth <= 960
}

export function getNavbarSearchResultInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

export function getNavbarGameMetaLine(game: CatalogGamePreview, t: TranslateFunction) {
  const studio = normalizeList(game.desenvolvedora)[0]
  const primaryPlatform = normalizeList(game.plataformas)[0]
  const year = getCompactYear(game.data_lancamento)
  return [studio || primaryPlatform || t('navbar.search.gameMetaFallback'), year].filter(Boolean).join(' - ')
}

export function useNavbarGlobalSearch({ viewerId, t }: UseNavbarGlobalSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('')
  const [gameResults, setGameResults] = useState<CatalogGamePreview[]>([])
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [gameSearchError, setGameSearchError] = useState<string | null>(null)
  const [userSearchError, setUserSearchError] = useState<string | null>(null)
  const [userActionError, setUserActionError] = useState<string | null>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [completedSearchQuery, setCompletedSearchQuery] = useState('')
  const [isCompactSearch, setIsCompactSearch] = useState(() => (
    typeof window === 'undefined' ? false : isCompactSearchViewport(window.innerWidth)
  ))
  const [followPendingIds, setFollowPendingIds] = useState<string[]>([])

  const navigate = useNavigate()
  const location = useLocation()
  const searchRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  const trimmedSearchQuery = searchQuery.trim()
  const flattenedResults = useMemo<NavbarSearchItem[]>(
    () => [
      ...gameResults.map(game => ({ kind: 'game' as const, id: `navbar-search-option-game-${game.id}`, game })),
      ...userResults.map(searchUser => ({ kind: 'user' as const, id: `navbar-search-option-user-${searchUser.id}`, user: searchUser })),
    ],
    [gameResults, userResults]
  )

  const activeResultId = activeResultIndex >= 0 && activeResultIndex < flattenedResults.length
    ? flattenedResults[activeResultIndex].id
    : undefined
  const hasSearchFeedback =
    searchLoading || Boolean(gameSearchError) || Boolean(userSearchError) || Boolean(userActionError) || gameResults.length > 0 || userResults.length > 0 || completedSearchQuery === trimmedSearchQuery
  const shouldShowEmptyState =
    trimmedSearchQuery.length >= 2 && !searchLoading && !gameSearchError && !userSearchError && gameResults.length === 0 && userResults.length === 0 && completedSearchQuery === trimmedSearchQuery
  const shouldShowSearchDropdown =
    showSearchDropdown && trimmedSearchQuery.length >= 2 && (hasSearchFeedback || shouldShowEmptyState)

  const clearScheduledSearch = useCallback(() => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }, [])

  const closeSearch = useCallback((options?: CloseSearchOptions) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setShowSearchDropdown(false)
    setSearchLoading(false)
    setGameSearchError(null)
    setUserSearchError(null)
    setUserActionError(null)
    setActiveResultIndex(-1)
    if (options?.clearQuery) {
      setSearchQuery('')
      setGameResults([])
      setUserResults([])
      setCompletedSearchQuery('')
      setFollowPendingIds([])
    }
    if (options?.collapseCompact) setShowMobileSearch(false)
  }, [clearScheduledSearch])

  const handleSelectGame = useCallback((game: CatalogGamePreview) => {
    closeSearch({ collapseCompact: true, clearQuery: true })
    navigate(`/games/${game.id}`)
  }, [closeSearch, navigate])

  const handleSelectUser = useCallback((searchUser: UserSearchResult) => {
    closeSearch({ collapseCompact: true, clearQuery: true })
    navigate(getPublicProfilePath(searchUser.username))
  }, [closeSearch, navigate])

  const handleSearchItemSelect = useCallback((item: NavbarSearchItem) => {
    if (item.kind === 'game') {
      handleSelectGame(item.game)
      return
    }
    handleSelectUser(item.user)
  }, [handleSelectGame, handleSelectUser])

  const handleSubmitSearchQuery = useCallback(() => {
    const currentQuery = searchQuery.trim()
    if (!currentQuery) return
    closeSearch({ collapseCompact: true })
    navigate(`/games?q=${encodeURIComponent(currentQuery)}`)
  }, [closeSearch, navigate, searchQuery])

  useEffect(() => () => {
    clearScheduledSearch()
  }, [clearScheduledSearch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncCompactSearch = () => {
      const compactViewport = isCompactSearchViewport(window.innerWidth)
      setIsCompactSearch(compactViewport)
      if (!compactViewport) setShowMobileSearch(false)
    }
    syncCompactSearch()
    window.addEventListener('resize', syncCompactSearch)
    return () => window.removeEventListener('resize', syncCompactSearch)
  }, [])

  useEffect(() => {
    if (showMobileSearch) searchInputRef.current?.focus()
  }, [showMobileSearch])

  useEffect(() => {
    if (activeResultIndex < flattenedResults.length) return
    const timeoutId = window.setTimeout(() => setActiveResultIndex(-1), 0)
    return () => window.clearTimeout(timeoutId)
  }, [activeResultIndex, flattenedResults.length])

  useEffect(() => {
    if (location.pathname !== '/games') return
    const timeoutId = window.setTimeout(() => {
      const queryFromUrl = new URLSearchParams(location.search).get('q')?.trim() || ''
      setSearchQuery(currentValue => (currentValue === queryFromUrl ? currentValue : queryFromUrl))
      setActiveResultIndex(-1)
      if (!queryFromUrl) {
        setCompletedSearchQuery('')
        setGameResults([])
        setUserResults([])
        setGameSearchError(null)
        setUserSearchError(null)
        setUserActionError(null)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [location.pathname, location.search])

  const handleSearchChange = (value: string) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setSearchQuery(value)
    setGameSearchError(null)
    setUserSearchError(null)
    setUserActionError(null)
    setActiveResultIndex(-1)
    const nextQuery = value.trim()
    if (nextQuery.length < 2) {
      setSearchLoading(false)
      setGameResults([])
      setUserResults([])
      setCompletedSearchQuery('')
      setFollowPendingIds([])
      setShowSearchDropdown(false)
      return
    }
    const requestId = searchRequestIdRef.current
    setSearchLoading(true)
    setShowSearchDropdown(true)
    searchTimeoutRef.current = window.setTimeout(async () => {
      const [gamesResult, usersResult] = await Promise.all([
        searchCatalogGamesByTitle(nextQuery),
        searchUsers(nextQuery, { viewerId }),
      ])
      if (searchRequestIdRef.current !== requestId) return
      setGameResults(gamesResult.data)
      setUserResults(usersResult.data)
      setCompletedSearchQuery(nextQuery)
      setGameSearchError(gamesResult.error ? getCatalogSearchErrorMessage(gamesResult.error, t) : null)
      setUserSearchError(usersResult.error ? getUserSearchErrorMessage(usersResult.error, t) : null)
      setSearchLoading(false)
      setActiveResultIndex(-1)
      setShowSearchDropdown(true)
      setFollowPendingIds([])
      searchTimeoutRef.current = null
    }, SEARCH_DEBOUNCE_DELAY)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch({ collapseCompact: isCompactSearch })
      return
    }
    if (event.key === 'ArrowDown' && shouldShowSearchDropdown && flattenedResults.length > 0) {
      event.preventDefault()
      setShowSearchDropdown(true)
      setActiveResultIndex(currentIndex => (currentIndex < 0 ? 0 : (currentIndex + 1) % flattenedResults.length))
      return
    }
    if (event.key === 'ArrowUp' && shouldShowSearchDropdown && flattenedResults.length > 0) {
      event.preventDefault()
      setShowSearchDropdown(true)
      setActiveResultIndex(currentIndex => (currentIndex <= 0 ? flattenedResults.length - 1 : currentIndex - 1))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeResultIndex >= 0 && flattenedResults[activeResultIndex]) {
        handleSearchItemSelect(flattenedResults[activeResultIndex])
        return
      }
      handleSubmitSearchQuery()
    }
  }

  const handleSearchFocus = () => {
    if (trimmedSearchQuery.length >= 2 && hasSearchFeedback) setShowSearchDropdown(true)
  }

  const handleMobileSearchToggle = () => {
    if (!isCompactSearch) return
    setShowMobileSearch(currentValue => {
      const nextValue = !currentValue
      if (!nextValue) closeSearch({ collapseCompact: true, clearQuery: true })
      return nextValue
    })
  }

  const handleToggleFollowFromSearch = async (searchUser: UserSearchResult) => {
    if (!viewerId || searchUser.id === viewerId || followPendingIds.includes(searchUser.id)) return
    const isFollowing = searchUser.isFollowing
    setUserActionError(null)
    setFollowPendingIds(currentIds => (
      currentIds.includes(searchUser.id) ? currentIds : [...currentIds, searchUser.id]
    ))
    const result = isFollowing
      ? await unfollowUser(viewerId, searchUser.id)
      : await followUser(viewerId, searchUser.id)
    if (result.error) {
      setUserActionError(getFollowActionErrorMessage(result.error, isFollowing ? 'unfollow' : 'follow', t))
      setFollowPendingIds(currentIds => currentIds.filter(currentId => currentId !== searchUser.id))
      return
    }
    setUserResults(currentUsers => currentUsers.map(currentUser => (
      currentUser.id === searchUser.id
        ? { ...currentUser, isFollowing: result.data.isFollowing }
        : currentUser
    )))
    setFollowPendingIds(currentIds => currentIds.filter(currentId => currentId !== searchUser.id))
  }

  return {
    activeResultId,
    activeResultIndex,
    closeSearch,
    followPendingIds,
    gameResults,
    gameSearchError,
    handleMobileSearchToggle,
    handleSearchChange,
    handleSearchFocus,
    handleSearchKeyDown,
    handleSelectGame,
    handleSelectUser,
    handleToggleFollowFromSearch,
    isCompactSearch,
    searchInputRef,
    searchLoading,
    searchQuery,
    searchRef,
    searchResultsId: SEARCH_RESULTS_ID,
    setActiveResultIndex,
    shouldShowEmptyState,
    shouldShowSearchDropdown,
    showMobileSearch,
    showSearchDropdown,
    trimmedSearchQuery,
    userActionError,
    userResults,
    userSearchError,
  }
}
