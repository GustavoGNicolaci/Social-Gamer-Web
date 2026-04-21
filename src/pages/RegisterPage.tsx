import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, type RegisterFieldErrors } from '../contexts/AuthContext'

function RegisterPage() {
  const navigate = useNavigate()
  const { register, user } = useAuth()

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<RegisterFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    setErrors((prev) => {
      if (!prev[name as keyof RegisterFieldErrors] && !prev.submit) {
        return prev
      }

      return {
        ...prev,
        [name]: '',
        submit: '',
      }
    })
  }

  const validateForm = (): RegisterFieldErrors => {
    const nextErrors: RegisterFieldErrors = {}

    if (!formData.username.trim()) {
      nextErrors.username = 'Nome de usuario e obrigatorio.'
    }

    if (!formData.name.trim()) {
      nextErrors.name = 'Nome completo e obrigatorio.'
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email e obrigatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Digite um email valido.'
    }

    if (!formData.password) {
      nextErrors.password = 'Senha e obrigatoria.'
    } else if (formData.password.length < 6) {
      nextErrors.password = 'A senha deve ter pelo menos 6 caracteres.'
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirme sua senha.'
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'As senhas nao coincidem.'
    }

    return nextErrors
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const result = await register({
        username: formData.username,
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      if (result.status === 'validation_error') {
        setErrors(result.fieldErrors)
        return
      }

      if (result.status === 'system_error') {
        setErrors({
          submit: result.message,
        })
        return
      }

      if (result.status === 'authenticated') {
        navigate('/')
        return
      }

      setShowEmailConfirmation(true)
      setErrors({})
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="register-container">
        <div className="register-box">
          <h1>Criar Conta</h1>
          <p>Junte-se a comunidade!</p>

          {showEmailConfirmation ? (
            <div className="success-banner" role="status" aria-live="polite">
              <p>Confirme no email</p>
            </div>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="username">Nome de usuario</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Seu username"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.username)}
                  className={errors.username ? 'input-error' : ''}
                />
                {errors.username && <span className="error-message">{errors.username}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="name">Nome Completo</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.name)}
                  className={errors.name ? 'input-error' : ''}
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.email)}
                  className={errors.email ? 'input-error' : ''}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Senha</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Sua senha"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  className={errors.password ? 'input-error' : ''}
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Senha</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirme sua senha"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className={errors.confirmPassword ? 'input-error' : ''}
                />
                {errors.confirmPassword && (
                  <span className="error-message">{errors.confirmPassword}</span>
                )}
              </div>

              {errors.submit && (
                <div className="error-banner" role="alert">
                  {errors.submit}
                </div>
              )}

              <button type="submit" className="register-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Criando conta...' : 'Criar Conta'}
              </button>
            </form>
          )}

          <div className="register-footer">
            <p>
              Ja tem conta?{' '}
              <Link to="/login" className="register-link">
                Faca login aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
