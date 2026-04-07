import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Navbar.css'

function Navbar() {
  // keep track of the current theme; default to the body class if already set
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )

  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [menuTimeout, setMenuTimeout] = useState<number | null>(null)

  // determine avatar url to display
  const avatarUrl = profile?.avatar_url || ''
  const displayName = profile?.username || user?.email || ''

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
    const timeout = setTimeout(() => {
      setShowMenu(false)
    }, 500) // 500ms delay
    setMenuTimeout(timeout)
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">🎮</span>
          <span className="logo-text">Social Gamer</span>
        </Link>

        {/* Center Navigation */}
        <div className="navbar-menu">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `navbar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-text">Home</span>
            <span className="nav-underline"></span>
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) =>
              `navbar-link${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-text">Games</span>
            <span className="nav-underline"></span>
          </NavLink>
        </div>

        {/* Right Navigation */}
        <div className="navbar-right">
          <button className="theme-btn" onClick={toggleTheme} title="Alternar tema">
            <span className="theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>

          {user ? (
            <div className="user-menu" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <Link
                to="/profile"
                className="user-avatar-btn"
                title="Perfil"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar do usuário" className="user-avatar-img" />
                ) : (
                  <span className="avatar-placeholder">{displayName.charAt(0).toUpperCase()}</span>
                )}
                <span className="user-name">{displayName}</span>
              </Link>
              {showMenu && (
                <div className="user-dropdown">
                  <Link to="/profile" className="dropdown-item" onClick={() => setShowMenu(false)}>
                    Ver Perfil
                  </Link>
                  <button
                    className="dropdown-item logout-btn"
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
