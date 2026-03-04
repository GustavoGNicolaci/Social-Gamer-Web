import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Aqui você implementaria a lógica de autenticação real
    console.log('Login attempt:', { email, password })
    // Redirecionar para home após login bem-sucedido
    navigate('/')
  }

  return (
    <div className="page-container">
      <div className="login-container">
        <div className="login-box">
          <h1>Login 🎮</h1>
          <p>Entre em sua conta para começar a jogar</p>
          
          <form onSubmit={handleLogin}>
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
            <p>Não tem conta? <a href="#signup">Registre-se aqui</a></p>
            <p><a href="#forgot">Esqueceu sua senha?</a></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
