import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  // keep track of the current theme; default to the body class if already set
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userAvatar] = useState<string | null>(null)

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
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
          
          {isLoggedIn && userAvatar ? (
            <button className="user-avatar-btn" onClick={() => setIsLoggedIn(false)}>
              <img src={userAvatar} alt="Avatar do usuário" className="user-avatar-img" />
            </button>
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
