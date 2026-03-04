import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
          Social Gamer
        </Link>

        {/* Center Navigation */}
        <div className="navbar-menu">
          <Link to="/games" className="navbar-link">
            Games
          </Link>
        </div>

        {/* Right Navigation */}
        <div className="navbar-right">
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <Link to="/login" className="navbar-button login-btn">
            Login
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
