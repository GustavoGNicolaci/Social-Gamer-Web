import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  // keep track of the current theme; default to the body class if already set
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.body.classList.contains('light') ? 'light' : 'dark'
  )

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
          <Link to="/register" className="navbar-button register-btn">
            <span>Registrar</span>
          </Link>
          <Link to="/login" className="navbar-button login-btn">
            <span>Login</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
