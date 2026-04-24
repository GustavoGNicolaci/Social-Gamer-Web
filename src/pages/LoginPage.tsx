import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import { useAuth } from '../contexts/AuthContext'
import {
  INVALID_EMAIL_MESSAGE,
  REQUIRED_EMAIL_MESSAGE,
  REQUIRED_LOGIN_PASSWORD_MESSAGE,
  isValidEmailAddress,
} from '../utils/authErrorMessages'

interface LoginLocationState {
  successMessage?: string
}

interface LoginFieldErrors {
  email?: string
  password?: string
}

const HERO_HIGHLIGHTS = [
  'Continue de onde parou, sem perder seu progresso.',
  'Organize backlog, favoritos e wishlist em um so lugar.',
  'Entre com seguranca para compartilhar sua opiniao.',
]

function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const initialSuccessMessage =
    (location.state as LoginLocationState | null)?.successMessage ?? null
  const emailErrorId = useId()
  const passwordErrorId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage] = useState<string | null>(initialSuccessMessage)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!initialSuccessMessage) {
      return
    }

    navigate(location.pathname, { replace: true, state: null })
  }, [initialSuccessMessage, location.pathname, navigate])

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleFieldChange =
    (field: 'email' | 'password', setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value)
      setErrorMessage(null)

      setFieldErrors((prev) => {
        if (!prev[field]) {
          return prev
        }

        const nextErrors = { ...prev }
        delete nextErrors[field]
        return nextErrors
      })
    }

  const validateForm = () => {
    const validationErrors: LoginFieldErrors = {}
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      validationErrors.email = REQUIRED_EMAIL_MESSAGE
    } else if (!isValidEmailAddress(normalizedEmail)) {
      validationErrors.email = INVALID_EMAIL_MESSAGE
    }

    if (!password) {
      validationErrors.password = REQUIRED_LOGIN_PASSWORD_MESSAGE
    }

    return validationErrors
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    const validationErrors = validateForm()

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})

    try {
      const { error } = await login(email.trim().toLowerCase(), password)

      if (error) {
        setErrorMessage(error)
        return
      }

      navigate('/')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Login"
      subtitle="Entre para continuar sua jornada gamer."
      heroEyebrow="Social Gamer"
      heroTitle="Volte para sua jornada"
      heroDescription="Acesse seu perfil para acompanhar status, favoritos, wishlist e reviews em um so lugar."
      heroHighlights={HERO_HIGHLIGHTS}
      layout="auth"
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>Nao tem conta?</span>
            <Link to="/register" className="auth-link">
              Criar conta
            </Link>
          </div>

          <div className="auth-link-row">
            <span>Precisa recuperar o acesso?</span>
            <Link to="/esqueci-a-senha" className="auth-link">
              Esqueci minha senha
            </Link>
          </div>
        </div>
      }
    >
      {successMessage ? <AuthStatusBanner tone="success">{successMessage}</AuthStatusBanner> : null}
      {errorMessage ? <AuthStatusBanner tone="error">{errorMessage}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            type="email"
            id="login-email"
            className={`auth-input${fieldErrors.email ? ' is-error' : ''}`}
            placeholder="seu@email.com"
            autoComplete="email"
            value={email}
            onChange={handleFieldChange('email', setEmail)}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          />
          {fieldErrors.email ? (
            <span id={emailErrorId} className="auth-field-error">
              {fieldErrors.email}
            </span>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="login-password">Senha</label>
          <input
            type="password"
            id="login-password"
            className={`auth-input${fieldErrors.password ? ' is-error' : ''}`}
            placeholder="Sua senha"
            autoComplete="current-password"
            value={password}
            onChange={handleFieldChange('password', setPassword)}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
          />
          {fieldErrors.password ? (
            <span id={passwordErrorId} className="auth-field-error">
              {fieldErrors.password}
            </span>
          ) : null}
        </div>

        <div className="auth-actions">
          <button
            type="submit"
            className="auth-button auth-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default LoginPage
