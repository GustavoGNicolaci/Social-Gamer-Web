import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { searchCatalogGamesByTitle, type CatalogGamePreview } from '../../services/gameCatalogService'
import { followUser, searchUsers, unfollowUser, type UserSearchResult, type UserServiceError } from '../../services/userService'
import './Navbar.css'

const SEARCH_DEBOUNCE_DELAY = 220

type NavbarSearchItem =
  | { kind: 'game'; id: string; game: CatalogGamePreview }
  | { kind: 'user'; id: string; user: UserSearchResult }

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

function getGameMetaLine(game: CatalogGamePreview) {
  const studio = normalizeList(game.desenvolvedora)[0]
  const primaryPlatform = normalizeList(game.plataformas)[0]
  const year = getCompactYear(game.data_lancamento)
  return [studio || primaryPlatform || 'Ver detalhes do jogo', year].filter(Boolean).join(' - ')
}

function getCatalogSearchErrorMessage(error: { code?: string; message: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return 'Nao foi possivel buscar jogos agora.'
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return 'Nao foi possivel buscar jogos por permissao. Verifique as policies da tabela jogos no Supabase.'
  }
  return 'Nao foi possivel buscar jogos agora.'
}

function getUserSearchErrorMessage(error: UserServiceError | null) {
  if (!error) return 'Nao foi possivel buscar usuarios agora.'
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return 'Nao foi possivel buscar usuarios por permissao. Verifique as policies das tabelas usuarios e seguidores no Supabase.'
  }
  return error.message || 'Nao foi possivel buscar usuarios agora.'
}

function getFollowActionErrorMessage(error: UserServiceError | null, action: 'follow' | 'unfollow') {
  if (!error) return action === 'follow' ? 'Nao foi possivel seguir este usuario agora.' : 'Nao foi possivel deixar de seguir este usuario agora.'
  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  if (error.code === '42501' || fullMessage.includes('permission denied') || fullMessage.includes('row-level security') || fullMessage.includes('policy')) {
    return action === 'follow'
      ? 'Nao foi possivel seguir este usuario por permissao. Verifique as policies INSERT da tabela seguidores.'
      : 'Nao foi possivel deixar de seguir este usuario por permissao. Verifique as policies DELETE da tabela seguidores.'
  }
  return error.message || getUserSearchErrorMessage(error)
}

function isCompactSearchViewport(viewportWidth: number) {
  return viewportWidth <= 960
}

function getPublicProfilePath(username: string) {
  return `/u/${encodeURIComponent(username.trim())}`
}

function Navbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.body.classList.contains('light') ? 'light' : 'dark'))
  const [showMenu, setShowMenu] = useState(false)
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
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const menuCloseTimeoutRef = useRef<number | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  const displayName = profile?.username || user?.email || 'Perfil'
  const profileLabel = profile?.nome_completo || displayName
  const themeToggleLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
  const themeStatusLabel = `Tema atual: ${theme === 'dark' ? 'escuro' : 'claro'}`
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
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [closeMenu, closeSearch, location.pathname])

  useEffect(() => {
    if (!showMenu && !showSearchDropdown && !showMobileSearch) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (showMenu && !menuRef.current?.contains(target)) closeMenu()
      if ((showSearchDropdown || showMobileSearch) && !searchRef.current?.contains(target)) closeSearch({ collapseCompact: isCompactSearch })
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        closeSearch({ collapseCompact: isCompactSearch })
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, closeSearch, isCompactSearch, showMenu, showMobileSearch, showSearchDropdown])

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
      setGameSearchError(gamesResult.error ? getCatalogSearchErrorMessage(gamesResult.error) : null)
      setUserSearchError(usersResult.error ? getUserSearchErrorMessage(usersResult.error) : null)
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
      setUserActionError(getFollowActionErrorMessage(result.error, isFollowing ? 'unfollow' : 'follow'))
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
            <span className="navbar-logo-subtitle">Reviews e comunidade</span>
          </span>
        </Link>
        <div className="navbar-center">
          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Home</NavLink>
            <NavLink to="/games" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Games</NavLink>
          </div>
          <div ref={searchRef} className={`navbar-search-shell${showMobileSearch ? ' is-open' : ''}${shouldShowSearchDropdown ? ' has-dropdown' : ''}`}>
            <button type="button" className={`navbar-search-toggle${showMobileSearch ? ' is-open' : ''}`} aria-label={showMobileSearch ? 'Fechar busca global' : 'Abrir busca global'} aria-expanded={showMobileSearch} aria-controls="navbar-search-panel" onClick={handleMobileSearchToggle}>Buscar</button>
            <div id="navbar-search-panel" className="navbar-search-panel">
              <label className="navbar-search-field" htmlFor="navbar-search-input">
                <span className="navbar-search-field-icon" aria-hidden="true">/</span>
                <input ref={searchInputRef} id="navbar-search-input" type="text" value={searchQuery} className="navbar-search-input" placeholder="Buscar jogos ou usuarios..." autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={shouldShowSearchDropdown} aria-controls={searchResultsId} aria-activedescendant={activeResultId} onChange={event => handleSearchChange(event.target.value)} onFocus={handleSearchFocus} onKeyDown={handleSearchKeyDown} />
              </label>
              {trimmedSearchQuery.length === 1 ? <p className="navbar-search-helper">Continue digitando para ver jogos e usuarios.</p> : null}
              {shouldShowSearchDropdown ? (
                <div className="navbar-search-dropdown" id={searchResultsId} role="listbox">
                  {searchLoading ? <p className="navbar-search-state">Buscando jogos e usuarios...</p> : shouldShowEmptyState ? <p className="navbar-search-state">Nenhum jogo ou usuario encontrado para esse termo.</p> : (
                    <>
                      <section className="navbar-search-group" aria-label="Resultados de jogos">
                        <div className="navbar-search-group-head"><span className="navbar-search-group-title">Jogos</span></div>
                        {gameSearchError && gameResults.length === 0 ? <p className="navbar-search-state is-error">{gameSearchError}</p> : gameResults.length === 0 ? <p className="navbar-search-state">Nenhum jogo encontrado.</p> : gameResults.map((game, index) => (
                          <button key={game.id} id={`navbar-search-option-game-${game.id}`} type="button" role="option" aria-selected={index === activeResultIndex} className={`navbar-search-option${index === activeResultIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveResultIndex(index)} onClick={() => handleSelectGame(game)}>
                            <div className="navbar-search-option-cover">{game.capa_url ? <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} /> : <div className="navbar-search-option-fallback">{getInitial(game.titulo)}</div>}</div>
                            <div className="navbar-search-option-copy"><strong>{game.titulo}</strong><span>{getGameMetaLine(game)}</span></div>
                          </button>
                        ))}
                      </section>
                      <section className="navbar-search-group" aria-label="Resultados de usuarios">
                        <div className="navbar-search-group-head"><span className="navbar-search-group-title">Usuarios</span></div>
                        {userActionError ? <p className="navbar-search-state is-error">{userActionError}</p> : null}
                        {userSearchError && userResults.length === 0 ? <p className="navbar-search-state is-error">{userSearchError}</p> : userResults.length === 0 ? <p className="navbar-search-state">Nenhum usuario encontrado.</p> : userResults.map((searchUser, index) => {
                          const resultIndex = gameResults.length + index
                          const isOwnResult = Boolean(user && searchUser.id === user.id)
                          const isFollowPending = followPendingIds.includes(searchUser.id)
                          const followButtonLabel = isFollowPending ? (searchUser.isFollowing ? 'Atualizando...' : 'Seguindo...') : searchUser.isFollowing ? 'Deixar de seguir' : 'Seguir'
                          return (
                            <div key={searchUser.id} id={`navbar-search-option-user-${searchUser.id}`} role="option" aria-selected={resultIndex === activeResultIndex} className={`navbar-search-option navbar-search-option-user${resultIndex === activeResultIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveResultIndex(resultIndex)} onClick={() => handleSelectUser(searchUser)}>
                              <div className="navbar-search-option-cover">
                                <UserAvatar name={searchUser.nome_completo || searchUser.username} avatarPath={searchUser.avatar_path} imageClassName="navbar-search-user-avatar" fallbackClassName="navbar-search-option-fallback navbar-search-user-avatar-fallback" alt={`Foto de perfil de ${searchUser.nome_completo || searchUser.username}`} />
                              </div>
                              <div className="navbar-search-option-copy"><strong>{searchUser.nome_completo}</strong><span>@{searchUser.username}</span></div>
                              <div className="navbar-search-user-actions">
                                {user && !isOwnResult ? <button type="button" className={`navbar-search-follow-button${searchUser.isFollowing ? ' is-following' : ''}`} onClick={event => { event.stopPropagation(); void handleToggleFollowFromSearch(searchUser) }} disabled={isFollowPending}>{followButtonLabel}</button> : <span className="navbar-search-user-link">{isOwnResult ? 'Seu perfil' : 'Ver perfil'}</span>}
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
          {user ? (
            <div ref={menuRef} className={`navbar-profile-menu${showMenu ? ' is-open' : ''}`} onMouseEnter={handleMenuMouseEnter} onMouseLeave={handleMenuMouseLeave} onBlur={handleMenuBlur}>
              <button type="button" className={`navbar-profile-trigger${showMenu ? ' is-open' : ''}`} aria-expanded={showMenu} aria-haspopup="menu" aria-label={showMenu ? 'Fechar menu do perfil' : 'Abrir menu do perfil'} onClick={() => { clearMenuCloseTimeout(); setShowMenu(currentValue => !currentValue) }}>
                <span className="navbar-avatar-shell">
                  <UserAvatar name={profileLabel} avatarPath={profile?.avatar_path} imageClassName="navbar-avatar-img" fallbackClassName="navbar-avatar-placeholder" alt={`Foto de perfil de ${profileLabel}`} />
                  <span className="navbar-avatar-badge" aria-hidden="true">U</span>
                </span>
                <span className="navbar-profile-copy"><span className="navbar-profile-eyebrow">Seu perfil</span><span className="navbar-profile-name">{displayName}</span></span>
                <span className="navbar-profile-chevron" aria-hidden="true">v</span>
              </button>
              {showMenu ? (
                <div className="navbar-dropdown" role="menu" aria-label="Menu do perfil">
                  <Link to="/profile" className="navbar-dropdown-item" role="menuitem" onClick={closeMenu}><span className="navbar-dropdown-icon" aria-hidden="true">P</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">Ver Perfil</span><span className="navbar-dropdown-hint">Abrir sua pagina de perfil e editar dados permitidos</span></span></Link>
                  <button className="navbar-dropdown-item" type="button" role="menuitem" onClick={() => { setTheme(prev => (prev === 'dark' ? 'light' : 'dark')); closeMenu() }}><span className="navbar-dropdown-icon" aria-hidden="true">T</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">{themeToggleLabel}</span><span className="navbar-dropdown-hint">{themeStatusLabel}</span></span></button>
                  <button className="navbar-dropdown-item is-danger" type="button" role="menuitem" onClick={async () => { await logout(); closeMenu(); navigate('/') }}><span className="navbar-dropdown-icon" aria-hidden="true">S</span><span className="navbar-dropdown-copy"><span className="navbar-dropdown-title">Sair</span><span className="navbar-dropdown-hint">Encerrar sessao atual</span></span></button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="navbar-button auth-btn"><span className="navbar-auth-label-full">Login/Registro</span><span className="navbar-auth-label-short">Entrar</span></Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
