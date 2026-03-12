import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { login, user } = useAuth()

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const { error } = await login(email, password)
    if (error) {
      setErrorMessage(error.message || 'Falha no login')
      return
    }
    navigate('/')
  }

  return (
    <div className="page-container">
      <div className="login-container">
        <div className="login-box">
          <h1>Login</h1>
          <p>Entre em sua conta</p>

          <form onSubmit={handleLogin}>
            {errorMessage && <div className="error-banner">{errorMessage}</div>}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit-btn">
              Entrar
            </button>
          </form>

          <div className="login-footer">
            <p>Não tem conta? <Link to="/register">Registre-se aqui</Link></p>
            <p><a href="#forgot">Esqueceu sua senha?</a></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
