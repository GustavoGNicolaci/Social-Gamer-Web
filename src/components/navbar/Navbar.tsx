import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Navbar.css'

function Navbar() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )

  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [menuTimeout, setMenuTimeout] = useState<number | null>(null)

  const avatarUrl = profile?.avatar_url || ''
  const displayName = profile?.username || user?.email || 'Perfil'
  const profileLabel = profile?.nome_completo || displayName
  const avatarFallback = profileLabel.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [theme])

  useEffect(() => {
    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout)
      }
    }
  }, [menuTimeout])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleMouseEnter = () => {
    if (menuTimeout) {
      clearTimeout(menuTimeout)
      setMenuTimeout(null)
    }

    setShowMenu(true)
  }

  const handleMouseLeave = () => {
    const timeout = window.setTimeout(() => {
      setShowMenu(false)
    }, 500)

    setMenuTimeout(timeout)
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">{'\uD83C\uDFAE'}</span>
          <span className="logo-text">Social Gamer</span>
        </Link>

        <div className="navbar-menu">
          <NavLink to="/" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
            <span className="nav-text">Home</span>
            <span className="nav-underline"></span>
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-text">Games</span>
            <span className="nav-underline"></span>
          </NavLink>
        </div>

        <div className="navbar-right">
          <button className="theme-btn" onClick={toggleTheme} title="Alternar tema" type="button">
            <span className="theme-icon">
              {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
            </span>
          </button>

          {user ? (
            <div className="user-menu" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <Link to="/profile" className="user-avatar-btn" title="Perfil">
                <span className="user-avatar-shell">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`Foto de perfil de ${profileLabel}`}
                      className="user-avatar-img"
                    />
                  ) : (
                    <span className="avatar-placeholder">{avatarFallback}</span>
                  )}
                  <span className="user-profile-badge" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      className="user-profile-icon"
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
                <span className="user-name">{displayName}</span>
              </Link>

              {showMenu && (
                <div className="user-dropdown">
                  <Link to="/profile" className="dropdown-item" onClick={() => setShowMenu(false)}>
                    Ver Perfil
                  </Link>
                  <button
                    className="dropdown-item logout-btn"
                    type="button"
                    onClick={async () => {
                      await logout()
                      setShowMenu(false)
                      navigate('/')
                    }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="navbar-button auth-btn">
              <span>Login/Registro</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
