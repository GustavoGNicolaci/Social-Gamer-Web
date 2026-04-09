import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Navbar.css'

function Navbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )
  const [showMenu, setShowMenu] = useState(false)

  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuCloseTimeoutRef = useRef<number | null>(null)

  const avatarUrl = profile?.avatar_url || ''
  const displayName = profile?.username || user?.email || 'Perfil'
  const profileLabel = profile?.nome_completo || displayName
  const avatarFallback = profileLabel.trim().charAt(0).toUpperCase() || 'U'
  const themeToggleLabel = theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
  const themeStatusLabel = `Tema atual: ${theme === 'dark' ? 'escuro' : 'claro'}`

  const supportsHover = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const clearMenuCloseTimeout = () => {
    if (menuCloseTimeoutRef.current) {
      window.clearTimeout(menuCloseTimeoutRef.current)
      menuCloseTimeoutRef.current = null
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
    }
  }, [])

  useEffect(() => {
    if (!showMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showMenu])

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
