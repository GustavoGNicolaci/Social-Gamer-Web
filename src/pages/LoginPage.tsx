import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { isValidEmailAddress } from '../utils/authErrorMessages'

interface LoginLocationState {
  successMessage?: string
}

interface LoginFieldErrors {
  email?: string
  password?: string
}

function LoginPage() {
  const { t } = useI18n()
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
      validationErrors.email = t('auth.emailRequired')
    } else if (!isValidEmailAddress(normalizedEmail)) {
      validationErrors.email = t('auth.invalidEmail')
    }

    if (!password) {
      validationErrors.password = t('auth.loginPasswordRequired')
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
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      heroEyebrow={t('common.appName')}
      heroTitle={t('auth.login.heroTitle')}
      heroDescription={t('auth.login.heroDescription')}
      heroHighlights={[
        t('auth.login.highlight1'),
        t('auth.login.highlight2'),
        t('auth.login.highlight3'),
      ]}
      layout="auth"
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>{t('auth.login.noAccount')}</span>
            <Link to="/register" className="auth-link">
              {t('common.register')}
            </Link>
          </div>

          <div className="auth-link-row">
            <span>{t('auth.login.needRecover')}</span>
            <Link to="/esqueci-a-senha" className="auth-link">
              {t('auth.login.forgotPassword')}
            </Link>
          </div>
        </div>
      }
    >
      {successMessage ? <AuthStatusBanner tone="success">{successMessage}</AuthStatusBanner> : null}
      {errorMessage ? <AuthStatusBanner tone="error">{errorMessage}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="login-email">{t('common.email')}</label>
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
          <label htmlFor="login-password">{t('common.password')}</label>
          <input
            type="password"
            id="login-password"
            className={`auth-input${fieldErrors.password ? ' is-error' : ''}`}
            placeholder={t('common.password')}
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
            {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default LoginPage
