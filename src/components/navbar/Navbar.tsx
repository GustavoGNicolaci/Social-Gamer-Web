import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { searchCatalogGamesByTitle, type CatalogGamePreview } from '../../services/gameCatalogService'
import { useAuth } from '../../contexts/AuthContext'
import './Navbar.css'

const SEARCH_DEBOUNCE_DELAY = 220

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
  if (Number.isNaN(parsedDate.getTime())) return null

  return String(parsedDate.getFullYear())
}

function getGameMetaLine(game: CatalogGamePreview) {
  const studio = normalizeList(game.desenvolvedora)[0]
  const primaryPlatform = normalizeList(game.plataformas)[0]
  const year = getCompactYear(game.data_lancamento)

  return [studio || primaryPlatform || 'Ver detalhes do jogo', year].filter(Boolean).join(' - ')
}

function getCatalogSearchErrorMessage(error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
} | null) {
  if (!error) {
    return 'Nao foi possivel buscar jogos agora.'
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
    return 'Nao foi possivel buscar jogos por permissao. Verifique as policies da tabela jogos no Supabase.'
  }

  return 'Nao foi possivel buscar jogos agora.'
}

function isCompactSearchViewport(viewportWidth: number) {
  return viewportWidth <= 960
}

function Navbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )
  const [showMenu, setShowMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatalogGamePreview[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [completedSearchQuery, setCompletedSearchQuery] = useState('')
  const [isCompactSearch, setIsCompactSearch] = useState(() =>
    typeof window === 'undefined' ? false : isCompactSearchViewport(window.innerWidth)
  )

  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const menuCloseTimeoutRef = useRef<number | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)

  const avatarUrl = profile?.avatar_url || ''
  const displayName = profile?.username || user?.email || 'Perfil'
  const profileLabel = profile?.nome_completo || displayName
  const avatarFallback = profileLabel.trim().charAt(0).toUpperCase() || 'U'
  const themeToggleLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
  const themeStatusLabel = `Tema atual: ${theme === 'dark' ? 'escuro' : 'claro'}`
  const searchResultsId = 'navbar-search-results'
  const activeResultId =
    activeResultIndex >= 0 && activeResultIndex < searchResults.length
      ? `navbar-search-option-${searchResults[activeResultIndex].id}`
      : undefined
  const trimmedSearchQuery = searchQuery.trim()
  const hasSearchFeedback =
    searchLoading ||
    Boolean(searchError) ||
    searchResults.length > 0 ||
    completedSearchQuery === trimmedSearchQuery
  const shouldShowEmptyState =
    trimmedSearchQuery.length >= 2 &&
    !searchLoading &&
    !searchError &&
    completedSearchQuery === trimmedSearchQuery &&
    searchResults.length === 0
  const shouldShowSearchDropdown =
    showSearchDropdown &&
    trimmedSearchQuery.length >= 2 &&
    (hasSearchFeedback || shouldShowEmptyState)

  const supportsHover = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const clearMenuCloseTimeout = () => {
    if (menuCloseTimeoutRef.current) {
      window.clearTimeout(menuCloseTimeoutRef.current)
      menuCloseTimeoutRef.current = null
    }
  }

  const clearScheduledSearch = () => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
  }

  const openMenu = () => {
    clearMenuCloseTimeout()
    setShowMenu(true)
  }

  const closeMenu = () => {
    clearMenuCloseTimeout()
    setShowMenu(false)
  }

  const closeSearch = (options?: { collapseCompact?: boolean; clearQuery?: boolean }) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setShowSearchDropdown(false)
    setSearchLoading(false)
    setSearchError(null)
    setActiveResultIndex(-1)

    if (options?.clearQuery) {
      setSearchQuery('')
      setSearchResults([])
      setCompletedSearchQuery('')
    }

    if (options?.collapseCompact) {
      setShowMobileSearch(false)
    }
  }

  const scheduleMenuClose = () => {
    clearMenuCloseTimeout()
    menuCloseTimeoutRef.current = window.setTimeout(() => {
      setShowMenu(false)
      menuCloseTimeoutRef.current = null
    }, 180)
  }

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    return () => {
      clearMenuCloseTimeout()
      clearScheduledSearch()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncCompactSearch = () => {
      const compactViewport = isCompactSearchViewport(window.innerWidth)
      setIsCompactSearch(compactViewport)

      if (!compactViewport) {
        setShowMobileSearch(false)
      }
    }

    syncCompactSearch()
    window.addEventListener('resize', syncCompactSearch)

    return () => {
      window.removeEventListener('resize', syncCompactSearch)
    }
  }, [])

  useEffect(() => {
    closeMenu()
    closeSearch({ collapseCompact: true })
  }, [location.pathname])

  useEffect(() => {
    if (!showMenu && !showSearchDropdown && !showMobileSearch) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (showMenu && !menuRef.current?.contains(target)) {
        closeMenu()
      }

      if ((showSearchDropdown || showMobileSearch) && !searchRef.current?.contains(target)) {
        closeSearch({ collapseCompact: isCompactSearch })
      }
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
  }, [isCompactSearch, showMenu, showMobileSearch, showSearchDropdown])

  useEffect(() => {
    if (showMobileSearch) {
      searchInputRef.current?.focus()
    }
  }, [showMobileSearch])

  useEffect(() => {
    if (activeResultIndex >= searchResults.length) {
      setActiveResultIndex(-1)
    }
  }, [activeResultIndex, searchResults])

  useEffect(() => {
    if (location.pathname !== '/games') return

    const queryFromUrl = new URLSearchParams(location.search).get('q')?.trim() || ''

    setSearchQuery(currentValue => (currentValue === queryFromUrl ? currentValue : queryFromUrl))
    setActiveResultIndex(-1)

    if (!queryFromUrl) {
      setCompletedSearchQuery('')
      setSearchResults([])
      setSearchError(null)
    }
  }, [location.pathname, location.search])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleMenuMouseEnter = () => {
    if (supportsHover()) {
      openMenu()
    }
  }

  const handleMenuMouseLeave = () => {
    if (supportsHover()) {
      scheduleMenuClose()
    }
  }

  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (!nextTarget || !menuRef.current?.contains(nextTarget)) {
      closeMenu()
    }
  }

  const handleTriggerClick = () => {
    clearMenuCloseTimeout()
    setShowMenu(prev => !prev)
  }

  const handleThemeClick = () => {
    toggleTheme()
    closeMenu()
  }

  const handleSearchChange = (value: string) => {
    clearScheduledSearch()
    searchRequestIdRef.current += 1
    setSearchQuery(value)
    setSearchError(null)
    setActiveResultIndex(-1)

    const trimmedValue = value.trim()

    if (trimmedValue.length < 2) {
      setSearchLoading(false)
      setSearchResults([])
      setCompletedSearchQuery('')
      setShowSearchDropdown(false)
      return
    }

    const requestId = searchRequestIdRef.current
    setSearchLoading(true)
    setShowSearchDropdown(true)

    searchTimeoutRef.current = window.setTimeout(async () => {
      const { data, error } = await searchCatalogGamesByTitle(trimmedValue)

      if (searchRequestIdRef.current !== requestId) return

      setSearchResults(data)
      setCompletedSearchQuery(trimmedValue)
      setSearchError(error ? getCatalogSearchErrorMessage(error) : null)
      setSearchLoading(false)
      setActiveResultIndex(-1)
      setShowSearchDropdown(true)
      searchTimeoutRef.current = null
    }, SEARCH_DEBOUNCE_DELAY)
  }

  const handleSelectGame = (game: CatalogGamePreview) => {
    closeSearch({ collapseCompact: true, clearQuery: true })
    navigate(`/games/${game.id}`)
  }

  const handleSubmitSearchQuery = () => {
    const trimmedValue = searchQuery.trim()
    if (!trimmedValue) return

    closeSearch({ collapseCompact: true })
    navigate(`/games?q=${encodeURIComponent(trimmedValue)}`)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch({ collapseCompact: isCompactSearch })
      return
    }

    if (event.key === 'ArrowDown' && shouldShowSearchDropdown && searchResults.length > 0) {
      event.preventDefault()
      setShowSearchDropdown(true)
      setActiveResultIndex(currentIndex =>
        currentIndex < 0 ? 0 : (currentIndex + 1) % searchResults.length
      )
      return
    }

    if (event.key === 'ArrowUp' && shouldShowSearchDropdown && searchResults.length > 0) {
      event.preventDefault()
      setShowSearchDropdown(true)
      setActiveResultIndex(currentIndex =>
        currentIndex <= 0 ? searchResults.length - 1 : currentIndex - 1
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (activeResultIndex >= 0 && searchResults[activeResultIndex]) {
        handleSelectGame(searchResults[activeResultIndex])
        return
      }

      handleSubmitSearchQuery()
    }
  }

  const handleSearchFocus = () => {
    if (trimmedSearchQuery.length >= 2 && hasSearchFeedback) {
      setShowSearchDropdown(true)
    }
  }

  const handleMobileSearchToggle = () => {
    if (!isCompactSearch) return

    setShowMobileSearch(currentValue => {
      const nextValue = !currentValue

      if (!nextValue) {
        closeSearch({ collapseCompact: true, clearQuery: true })
      }

      return nextValue
    })
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-icon">{'\uD83C\uDFAE'}</span>
          <span className="navbar-logo-copy">
            <span className="navbar-logo-title">Social Gamer</span>
            <span className="navbar-logo-subtitle">Reviews e comunidade</span>
          </span>
        </Link>

        <div className="navbar-center">
          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
              Home
            </NavLink>
            <NavLink
              to="/games"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            >
              Games
            </NavLink>
          </div>

          <div
            ref={searchRef}
            className={`navbar-search-shell${showMobileSearch ? ' is-open' : ''}${shouldShowSearchDropdown ? ' has-dropdown' : ''}`}
          >
            <button
              type="button"
              className={`navbar-search-toggle${showMobileSearch ? ' is-open' : ''}`}
              aria-label={showMobileSearch ? 'Fechar busca de jogos' : 'Abrir busca de jogos'}
              aria-expanded={showMobileSearch}
              aria-controls="navbar-search-panel"
              onClick={handleMobileSearchToggle}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M21 21L16.65 16.65M18 11C18 14.866 14.866 18 11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div id="navbar-search-panel" className="navbar-search-panel">
              <label className="navbar-search-field" htmlFor="navbar-search-input">
                <span className="navbar-search-field-icon" aria-hidden="true">
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
                  ref={searchInputRef}
                  id="navbar-search-input"
                  type="text"
                  value={searchQuery}
                  className="navbar-search-input"
                  placeholder="Buscar jogos..."
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={shouldShowSearchDropdown}
                  aria-controls={searchResultsId}
                  aria-activedescendant={activeResultId}
                  onChange={event => handleSearchChange(event.target.value)}
                  onFocus={handleSearchFocus}
                  onKeyDown={handleSearchKeyDown}
                />
              </label>

              {trimmedSearchQuery.length === 1 ? (
                <p className="navbar-search-helper">
                  Continue digitando para ver sugestoes do catalogo.
                </p>
              ) : null}

              {shouldShowSearchDropdown ? (
                <div className="navbar-search-dropdown" id={searchResultsId} role="listbox">
                  {searchLoading ? (
                    <p className="navbar-search-state">Buscando jogos...</p>
                  ) : searchError ? (
                    <p className="navbar-search-state is-error">{searchError}</p>
                  ) : shouldShowEmptyState ? (
                    <p className="navbar-search-state">Nenhum jogo encontrado para esse termo.</p>
                  ) : (
                    searchResults.map((game, index) => (
                      <button
                        key={game.id}
                        id={`navbar-search-option-${game.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeResultIndex}
                        className={`navbar-search-option${index === activeResultIndex ? ' is-active' : ''}`}
                        onMouseEnter={() => setActiveResultIndex(index)}
                        onClick={() => handleSelectGame(game)}
                      >
                        <div className="navbar-search-option-cover">
                          {game.capa_url ? (
                            <img src={game.capa_url} alt={`Capa do jogo ${game.titulo}`} />
                          ) : (
                            <div className="navbar-search-option-fallback">
                              {getInitial(game.titulo)}
                            </div>
                          )}
                        </div>

                        <div className="navbar-search-option-copy">
                          <strong>{game.titulo}</strong>
                          <span>{getGameMetaLine(game)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="navbar-actions">
          {user ? (
            <div
              ref={menuRef}
              className={`navbar-profile-menu${showMenu ? ' is-open' : ''}`}
              onMouseEnter={handleMenuMouseEnter}
              onMouseLeave={handleMenuMouseLeave}
              onBlur={handleMenuBlur}
            >
              <button
                type="button"
                className={`navbar-profile-trigger${showMenu ? ' is-open' : ''}`}
                aria-expanded={showMenu}
                aria-haspopup="menu"
                aria-label={showMenu ? 'Fechar menu do perfil' : 'Abrir menu do perfil'}
                onClick={handleTriggerClick}
              >
                <span className="navbar-avatar-shell">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`Foto de perfil de ${profileLabel}`}
                      className="navbar-avatar-img"
                    />
                  ) : (
                    <span className="navbar-avatar-placeholder">{avatarFallback}</span>
                  )}
                  <span className="navbar-avatar-badge" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      className="navbar-avatar-badge-icon"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                        fill="currentColor"
                      />
                      <path
                        d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20V21H4V20Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                </span>

                <span className="navbar-profile-copy">
                  <span className="navbar-profile-eyebrow">Seu perfil</span>
                  <span className="navbar-profile-name">{displayName}</span>
                </span>

                <span className="navbar-profile-chevron" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {showMenu && (
                <div className="navbar-dropdown" role="menu" aria-label="Menu do perfil">
                  <Link
                    to="/profile"
                    className="navbar-dropdown-item"
                    role="menuitem"
                    onClick={closeMenu}
                  >
                    <span className="navbar-dropdown-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M4 20C4 17.2386 7.58172 15 12 15C16.4183 15 20 17.2386 20 20"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="navbar-dropdown-copy">
                      <span className="navbar-dropdown-title">Ver Perfil</span>
                      <span className="navbar-dropdown-hint">Editar foto, bio e dados publicos</span>
                    </span>
                  </Link>

                  <button
                    className="navbar-dropdown-item"
                    type="button"
                    role="menuitem"
                    onClick={handleThemeClick}
                  >
                    <span className="navbar-dropdown-icon" aria-hidden="true">
                      {theme === 'dark' ? (
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M12 4V6.5M12 17.5V20M4 12H6.5M17.5 12H20M6.35 6.35L8.1 8.1M15.9 15.9L17.65 17.65M6.35 17.65L8.1 15.9M15.9 8.1L17.65 6.35"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M20 15.5C19.0817 15.8201 18.0949 16 17.0661 16C12.0889 16 8.05566 11.9706 8.05566 7C8.05566 5.97123 8.23552 4.98444 8.55566 4.06616C5.26025 5.21401 3 8.34639 3 12C3 16.6274 6.37258 20 11 20C14.6536 20 17.786 17.7397 18.9338 14.4443C18.0156 14.7645 17.0288 14.9443 16 14.9443"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="navbar-dropdown-copy">
                      <span className="navbar-dropdown-title">{themeToggleLabel}</span>
                      <span className="navbar-dropdown-hint">{themeStatusLabel}</span>
                    </span>
                  </button>

                  <button
                    className="navbar-dropdown-item is-danger"
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      await logout()
                      closeMenu()
                      navigate('/')
                    }}
                  >
                    <span className="navbar-dropdown-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M14 16L18 12M18 12L14 8M18 12H9"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 4H7C5.89543 4 5 4.89543 5 6V18C5 19.1046 5.89543 20 7 20H10"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="navbar-dropdown-copy">
                      <span className="navbar-dropdown-title">Sair</span>
                      <span className="navbar-dropdown-hint">Encerrar sessao atual</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="navbar-button auth-btn">
              <span className="navbar-auth-label-full">Login/Registro</span>
              <span className="navbar-auth-label-short">Entrar</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
