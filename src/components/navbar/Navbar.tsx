import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Gamepad2, Home, LogIn, LogOut, Menu, Moon, Settings, Sun, User, Users, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import { NotificationsButton } from '../notifications/NotificationsButton'
import { UserAvatar } from '../UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nContext'
import type { TranslationParams } from '../../i18n'
import { searchCatalogGamesByTitle, type CatalogGamePreview } from '../../services/gameCatalogService'
import { followUser, searchUsers, unfollowUser, type UserSearchResult, type UserServiceError } from '../../services/userService'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import './Navbar.css'

const SEARCH_DEBOUNCE_DELAY = 220

type NavbarSearchItem =
  | { kind: 'game'; id: string; game: CatalogGamePreview }
  | { kind: 'user'; id: string; user: UserSearchResult }

type TranslateFunction = (key: string, params?: TranslationParams) => string

function normalizeList(value: string[] | string | null | undefined) {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean)
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function getCompactYear(value: string | null | undefined) {
  if (!value) return null
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : String(parsedDate.getFullYear())
}

function getGameMetaLine(game: CatalogGamePreview, t: TranslateFunction) {
  const studio = normalizeList(game.desenvolvedora)[0]
  const primaryPlatform = normalizeList(game.plataformas)[0]
  const year = getCompactYear(game.data_lancamento)
  return [studio || primaryPlatform || t('navbar.search.gameMetaFallback'), year].filter(Boolean).join(' - ')
}

function iconMenuUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 20C4.9 16.8 7.9 14.5 12 14.5C16.1 14.5 19.1 16.8 20 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconMenuSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13.5C19.46 13.01 19.5 12.51 19.5 12C19.5 11.49 19.46 10.99 19.4 10.5L21.2 9.1L19.4 5.9L17.2 6.5C16.43 5.84 15.53 5.33 14.55 5.03L14 2.8H10L9.45 5.03C8.47 5.33 7.57 5.84 6.8 6.5L4.6 5.9L2.8 9.1L4.6 10.5C4.54 10.99 4.5 11.49 4.5 12C4.5 12.51 4.54 13.01 4.6 13.5L2.8 14.9L4.6 18.1L6.8 17.5C7.57 18.16 8.47 18.67 9.45 18.97L10 21.2H14L14.55 18.97C15.53 18.67 16.43 18.16 17.2 17.5L19.4 18.1L21.2 14.9L19.4 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconMenuTheme() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12.79C20.13 13.15 19.17 13.35 18.17 13.35C14.21 13.35 11 10.14 11 6.18C11 5.18 11.2 4.22 11.56 3.35C7.34 3.55 4 7.03 4 11.3C4 15.7 7.58 19.28 11.98 19.28C16.25 19.28 19.73 15.94 21 12.79Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconMenuLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M14 16L18 12L14 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 4H7C5.9 4 5 4.9 5 6V18C5 19.1 5.9 20 7 20H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconAvatarBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 13C14.2091 13 16 11.2091 16 9C16 6.79086 14.2091 5 12 5C9.79086 5 8 6.79086 8 9C8 11.2091 9.79086 13 12 13Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6.5 19C7.5 16.7 9.5 15.3 12 15.3C14.5 15.3 16.5 16.7 17.5 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function iconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 10L12 15L17 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getCatalogSearchErrorMessage(
  error: { code?: string; message: string; details?: string | null; hint?: string | null } | null,
  t: TranslateFunction
) {
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

function getFollowActionErrorMessage(error: UserServiceError | null, action: 'follow' | 'unfollow', t: TranslateFunction) {
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

function Navbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.body.classList.contains('light') ? 'light' : 'dark'))
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
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
  const [isCompactSearch, setIsCompactSearch] = useState(() => (typeof window === 'undefined' ? false : isCompactSearchViewport(window.innerWidth)))
  const [followPendingIds, setFollowPendingIds] = useState<string[]>([])

  const { user, profile, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const menuCloseTimeoutRef = useRef<number | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  const displayName = profile?.username || user?.email || t('common.profile')
  const profileLabel = profile?.nome_completo?.trim() || displayName
  const ownProfilePath = profile?.username ? getPublicProfilePath(profile.username) : '/profile'
  const themeToggleLabel = theme === 'dark' ? t('navbar.theme.light') : t('navbar.theme.dark')
  const themeStatusLabel = t('navbar.theme.current', {
    theme: theme === 'dark' ? t('navbar.theme.darkName') : t('navbar.theme.lightName'),
  })
  const searchResultsId = 'navbar-search-results'
  const trimmedSearchQuery = searchQuery.trim()

  const flattenedResults = useMemo<NavbarSearchItem[]>(
    () => [
      ...gameResults.map(game => ({ kind: 'game' as const, id: `navbar-search-option-game-${game.id}`, game })),
      ...userResults.map(searchUser => ({ kind: 'user' as const, id: `navbar-search-option-user-${searchUser.id}`, user: searchUser })),
    ],
    [gameResults, userResults]
  )

  const activeResultId = activeResultIndex >= 0 && activeResultIndex < flattenedResults.length ? flattenedResults[activeResultIndex].id : undefined
  const hasSearchFeedback =
    searchLoading || Boolean(gameSearchError) || Boolean(userSearchError) || Boolean(userActionError) || gameResults.length > 0 || userResults.length > 0 || completedSearchQuery === trimmedSearchQuery
  const shouldShowEmptyState =
    trimmedSearchQuery.length >= 2 && !searchLoading && !gameSearchError && !userSearchError && gameResults.length === 0 && userResults.length === 0 && completedSearchQuery === trimmedSearchQuery
  const shouldShowSearchDropdown = showSearchDropdown && trimmedSearchQuery.length >= 2 && (hasSearchFeedback || shouldShowEmptyState)

  const supportsHover = useCallback(() => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches, [])
  const clearMenuCloseTimeout = useCallback(() => {
    if (menuCloseTimeoutRef.current) {
      window.clearTimeout(menuCloseTimeoutRef.current)
      menuCloseTimeoutRef.current = null
    }
  }, [])
  const clearScheduledSearch = useCallback(() => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }, [])
  const openMenu = useCallback(() => {
    clearMenuCloseTimeout()
    setShowMenu(true)
  }, [clearMenuCloseTimeout])
  const closeMenu = useCallback(() => {
    clearMenuCloseTimeout()
    setShowMenu(false)
  }, [clearMenuCloseTimeout])
  const closeMobileMenu = useCallback(() => {
    setShowMobileMenu(false)
  }, [])
  const closeSearch = useCallback((options?: { collapseCompact?: boolean; clearQuery?: boolean }) => {
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
  const scheduleMenuClose = useCallback(() => {
    clearMenuCloseTimeout()
    menuCloseTimeoutRef.current = window.setTimeout(() => {
      setShowMenu(false)
      menuCloseTimeoutRef.current = null
    }, 180)
  }, [clearMenuCloseTimeout])
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
  const handleThemeAction = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
    closeMenu()
    closeMobileMenu()
  }, [closeMenu, closeMobileMenu])
  const handleLogoutAction = useCallback(async () => {
    await logout()
    closeMenu()
    closeMobileMenu()
    navigate('/')
  }, [closeMenu, closeMobileMenu, logout, navigate])
  const handleMobileNavigation = useCallback(() => {
    closeMobileMenu()
    closeMenu()
    closeSearch({ collapseCompact: true })
  }, [closeMenu, closeMobileMenu, closeSearch])

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => () => {
    clearMenuCloseTimeout()
    clearScheduledSearch()
  }, [clearMenuCloseTimeout, clearScheduledSearch])

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
    const frameId = window.requestAnimationFrame(() => {
      closeMenu()
      closeSearch({ collapseCompact: true })
      closeMobileMenu()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [closeMenu, closeMobileMenu, closeSearch, location.hash, location.pathname])

  useEffect(() => {
    if (!showMenu && !showSearchDropdown && !showMobileSearch && !showMobileMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (showMenu && !menuRef.current?.contains(target)) closeMenu()
      if ((showSearchDropdown || showMobileSearch) && !searchRef.current?.contains(target)) closeSearch({ collapseCompact: isCompactSearch })
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        closeMobileMenu()
        closeSearch({ collapseCompact: isCompactSearch })
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, closeMobileMenu, closeSearch, isCompactSearch, showMenu, showMobileMenu, showMobileSearch, showSearchDropdown])

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
        searchUsers(nextQuery, { viewerId: user?.id }),
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
    if (!user || searchUser.id === user.id || followPendingIds.includes(searchUser.id)) return
    const isFollowing = searchUser.isFollowing
    setUserActionError(null)
    setFollowPendingIds(currentIds => (currentIds.includes(searchUser.id) ? currentIds : [...currentIds, searchUser.id]))
    const result = isFollowing ? await unfollowUser(user.id, searchUser.id) : await followUser(user.id, searchUser.id)
    if (result.error) {
      setUserActionError(getFollowActionErrorMessage(result.error, isFollowing ? 'unfollow' : 'follow', t))
      setFollowPendingIds(currentIds => currentIds.filter(currentId => currentId !== searchUser.id))
      return
    }
    setUserResults(currentUsers => currentUsers.map(currentUser => currentUser.id === searchUser.id ? { ...currentUser, isFollowing: result.data.isFollowing } : currentUser))
    setFollowPendingIds(currentIds => currentIds.filter(currentId => currentId !== searchUser.id))
  }

  const handleMenuMouseEnter = () => {
    if (supportsHover()) openMenu()
  }
  const handleMenuMouseLeave = () => {
    if (supportsHover()) scheduleMenuClose()
  }
  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (!nextTarget || !menuRef.current?.contains(nextTarget)) closeMenu()
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-icon">SG</span>
            <span className="navbar-logo-copy">
              <span className="navbar-logo-title">Social Gamer</span>
            <span className="navbar-logo-subtitle">{t('navbar.subtitle')}</span>
          </span>
        </Link>
        <div className="navbar-center">
          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>{t('common.home')}</NavLink>
            <NavLink to="/games" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>{t('common.games')}</NavLink>
            <NavLink to="/comunidades" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>{t('communities.nav')}</NavLink>
          </div>
          <div ref={searchRef} className={`navbar-search-shell${showMobileSearch ? ' is-open' : ''}${shouldShowSearchDropdown ? ' has-dropdown' : ''}`}>
            <button type="button" className={`navbar-search-toggle${showMobileSearch ? ' is-open' : ''}`} aria-label={showMobileSearch ? t('navbar.search.close') : t('navbar.search.open')} aria-expanded={showMobileSearch} aria-controls="navbar-search-panel" onClick={handleMobileSearchToggle}>{t('common.search')}</button>
            <div id="navbar-search-panel" className="navbar-search-panel">
              <label className="navbar-search-field" htmlFor="navbar-search-input">
                <span className="navbar-search-field-icon" aria-hidden="true">/</span>
                <input ref={searchInputRef} id="navbar-search-input" type="text" value={searchQuery} className="navbar-search-input" placeholder={t('navbar.search.placeholder')} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={shouldShowSearchDropdown} aria-controls={searchResultsId} aria-activedescendant={activeResultId} onChange={event => handleSearchChange(event.target.value)} onFocus={handleSearchFocus} onKeyDown={handleSearchKeyDown} />
              </label>
              {trimmedSearchQuery.length === 1 ? <p className="navbar-search-helper">{t('navbar.search.keepTyping')}</p> : null}
              {shouldShowSearchDropdown ? (
                <div className="navbar-search-dropdown" id={searchResultsId} role="listbox">
                  {searchLoading ? <p className="navbar-search-state">{t('navbar.search.loading')}</p> : shouldShowEmptyState ? <p className="navbar-search-state">{t('navbar.search.empty')}</p> : (
                    <>
                      <section className="navbar-search-group" aria-label={t('navbar.search.gameResults')}>
                        <div className="navbar-search-group-head"><span className="navbar-search-group-title">{t('navbar.search.games')}</span></div>
                        {gameSearchError && gameResults.length === 0 ? <p className="navbar-search-state is-error">{gameSearchError}</p> : gameResults.length === 0 ? <p className="navbar-search-state">{t('navbar.search.noGame')}</p> : gameResults.map((game, index) => (
                          <button key={game.id} id={`navbar-search-option-game-${game.id}`} type="button" role="option" aria-selected={index === activeResultIndex} className={`navbar-search-option${index === activeResultIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveResultIndex(index)} onClick={() => handleSelectGame(game)}>
                            <div className="navbar-search-option-cover">{game.capa_url ? <GameCoverImage src={game.capa_url} alt={t('catalog.coverAlt', { title: game.titulo })} width={60} height={60} sizes="60px" /> : <div className="navbar-search-option-fallback">{getInitial(game.titulo)}</div>}</div>
                            <div className="navbar-search-option-copy"><strong>{game.titulo}</strong><span>{getGameMetaLine(game, t)}</span></div>
                          </button>
                        ))}
                      </section>
                      <section className="navbar-search-group" aria-label={t('navbar.search.userResults')}>
                        <div className="navbar-search-group-head"><span className="navbar-search-group-title">{t('navbar.search.users')}</span></div>
                        {userActionError ? <p className="navbar-search-state is-error">{userActionError}</p> : null}
                        {userSearchError && userResults.length === 0 ? <p className="navbar-search-state is-error">{userSearchError}</p> : userResults.length === 0 ? <p className="navbar-search-state">{t('navbar.search.noUser')}</p> : userResults.map((searchUser, index) => {
                          const resultIndex = gameResults.length + index
                          const isOwnResult = Boolean(user && searchUser.id === user.id)
                          const isFollowPending = followPendingIds.includes(searchUser.id)
                          const followButtonLabel = isFollowPending ? (searchUser.isFollowing ? t('common.updating') : t('navbar.search.following')) : searchUser.isFollowing ? t('common.unfollow') : t('common.follow')
                          const searchUserFullName = searchUser.nome_completo?.trim() || ''
                          const searchUserDisplayName = searchUserFullName || searchUser.username
                          return (
                            <div key={searchUser.id} id={`navbar-search-option-user-${searchUser.id}`} role="option" aria-selected={resultIndex === activeResultIndex} className={`navbar-search-option navbar-search-option-user${resultIndex === activeResultIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveResultIndex(resultIndex)} onClick={() => handleSelectUser(searchUser)}>
                              <div className="navbar-search-option-cover">
                                <UserAvatar name={searchUserDisplayName} avatarPath={searchUser.avatar_path} imageClassName="navbar-search-user-avatar" fallbackClassName="navbar-search-option-fallback navbar-search-user-avatar-fallback" alt={t('navbar.search.profilePhotoAlt', { name: searchUserDisplayName })} />
                              </div>
                              <div className="navbar-search-option-copy navbar-search-option-copy-user"><strong>@{searchUser.username}</strong>{searchUserFullName ? <span>{searchUserFullName}</span> : null}</div>
                              <div className="navbar-search-user-actions">
                                {user && !isOwnResult ? <button type="button" className={`navbar-search-follow-button${searchUser.isFollowing ? ' is-following' : ''}`} onClick={event => { event.stopPropagation(); void handleToggleFollowFromSearch(searchUser) }} disabled={isFollowPending}>{followButtonLabel}</button> : <span className="navbar-search-user-link">{isOwnResult ? t('navbar.search.ownProfile') : t('common.viewProfile')}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </section>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="navbar-actions">
          {user ? <NotificationsButton userId={user.id} /> : null}
          {user ? (
            <div ref={menuRef} className={`navbar-profile-menu${showMenu ? ' is-open' : ''}`} onMouseEnter={handleMenuMouseEnter} onMouseLeave={handleMenuMouseLeave} onBlur={handleMenuBlur}>
              <button type="button" className={`navbar-profile-trigger${showMenu ? ' is-open' : ''}`} aria-expanded={showMenu} aria-haspopup="menu" aria-label={showMenu ? t('navbar.profile.closeMenu') : t('navbar.profile.openMenu')} onClick={() => { clearMenuCloseTimeout(); setShowMenu(currentValue => !currentValue) }}>
                <span className="navbar-avatar-shell">
                  <UserAvatar name={profileLabel} avatarPath={profile?.avatar_path} imageClassName="navbar-avatar-img" fallbackClassName="navbar-avatar-placeholder" alt={t('navbar.search.profilePhotoAlt', { name: profileLabel })} />
                  <span className="navbar-avatar-badge" aria-hidden="true">
                    <span className="navbar-avatar-badge-icon">{iconAvatarBadge()}</span>
                  </span>
                </span>
                <span className="navbar-profile-copy"><span className="navbar-profile-eyebrow">{t('navbar.profile.eyebrow')}</span><span className="navbar-profile-name">{displayName}</span></span>
                <span className="navbar-profile-chevron" aria-hidden="true">{iconChevron()}</span>
              </button>
              {showMenu ? (
                <div className="navbar-dropdown" role="menu" aria-label={t('navbar.profile.menuLabel')}>
                  <Link to={ownProfilePath} className="navbar-dropdown-item" role="menuitem" onClick={closeMenu}><span className="navbar-dropdown-icon" aria-hidden="true">{iconMenuUser()}</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">{t('common.profile')}</span><span className="navbar-dropdown-hint">{t('navbar.profile.profileHint')}</span></span></Link>
                  <Link to="/configuracoes/conta" className="navbar-dropdown-item" role="menuitem" onClick={closeMenu}><span className="navbar-dropdown-icon" aria-hidden="true">{iconMenuSettings()}</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">{t('common.settings')}</span><span className="navbar-dropdown-hint">{t('navbar.profile.settingsHint')}</span></span></Link>
                  <button className="navbar-dropdown-item" type="button" role="menuitem" onClick={handleThemeAction}><span className="navbar-dropdown-icon" aria-hidden="true">{iconMenuTheme()}</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">{themeToggleLabel}</span><span className="navbar-dropdown-hint">{themeStatusLabel}</span></span></button>
                  <button className="navbar-dropdown-item is-danger" type="button" role="menuitem" onClick={() => void handleLogoutAction()}><span className="navbar-dropdown-icon" aria-hidden="true">{iconMenuLogout()}</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">{t('common.logout')}</span><span className="navbar-dropdown-hint">{t('navbar.logoutHint')}</span></span></button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="navbar-button auth-btn"><span className="navbar-auth-label-full">{t('navbar.auth.full')}</span><span className="navbar-auth-label-short">{t('navbar.auth.short')}</span></Link>
          )}
          <button
            type="button"
            className={`navbar-mobile-menu-trigger${showMobileMenu ? ' is-open' : ''}`}
            aria-label={showMobileMenu ? t('navbar.mobile.close') : t('navbar.mobile.open')}
            aria-expanded={showMobileMenu}
            aria-controls="navbar-mobile-drawer"
            onClick={() => setShowMobileMenu(currentValue => !currentValue)}
          >
            {showMobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {showMobileMenu ? (
        <>
          <button
            type="button"
            className="navbar-mobile-backdrop"
            aria-label={t('navbar.mobile.close')}
            onClick={closeMobileMenu}
          />
          <aside id="navbar-mobile-drawer" className="navbar-mobile-drawer" aria-label={t('navbar.mobile.menuLabel')}>
            <header className="navbar-mobile-drawer-header">
              <div>
                <span>{t('navbar.mobile.eyebrow')}</span>
                <strong>{t('navbar.mobile.title')}</strong>
              </div>
              <button type="button" className="navbar-mobile-close" aria-label={t('navbar.mobile.close')} onClick={closeMobileMenu}>
                <X />
              </button>
            </header>

            <nav className="navbar-mobile-nav" aria-label={t('navbar.mobile.menuLabel')}>
              <NavLink to="/" className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><Home /><span>{t('common.home')}</span></NavLink>
              <NavLink to="/games" className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><Gamepad2 /><span>{t('common.games')}</span></NavLink>
              <NavLink to="/comunidades" className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><Users /><span>{t('communities.nav')}</span></NavLink>
              {user ? (
                <>
                  <NavLink to={ownProfilePath} className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><User /><span>{t('common.profile')}</span></NavLink>
                  <NavLink to="/configuracoes/conta" className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><Settings /><span>{t('common.settings')}</span></NavLink>
                </>
              ) : (
                <NavLink to="/login" className={({ isActive }) => `navbar-mobile-link${isActive ? ' is-active' : ''}`} onClick={handleMobileNavigation}><LogIn /><span>{t('navbar.auth.short')}</span></NavLink>
              )}
            </nav>

            <div className="navbar-mobile-actions">
              <button type="button" className="navbar-mobile-link" onClick={handleThemeAction}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                <span>{themeToggleLabel}</span>
              </button>
              {user ? (
                <button type="button" className="navbar-mobile-link is-danger" onClick={() => void handleLogoutAction()}>
                  <LogOut />
                  <span>{t('common.logout')}</span>
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </nav>
  )
}

export default Navbar
