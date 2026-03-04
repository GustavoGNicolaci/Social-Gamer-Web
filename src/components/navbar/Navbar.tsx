import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
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
          <Link to="/login" className="navbar-button login-btn">
            Login
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
