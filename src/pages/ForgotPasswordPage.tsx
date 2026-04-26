import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { isValidEmailAddress } from '../utils/authErrorMessages'

function ForgotPasswordPage() {
  const { t } = useI18n()
  const { requestPasswordReset } = useAuth()
  const emailErrorId = useId()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
    setEmailError(null)
    setErrorMessage(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setEmailError(null)
    setErrorMessage(null)
    setSuccessMessage(null)

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setEmailError(t('auth.emailRequired'))
      return
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setEmailError(t('auth.invalidEmail'))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await requestPasswordReset(normalizedEmail)

      if (result.error) {
        setErrorMessage(result.error)
        return
      }

      setSuccessMessage(t('auth.forgot.success'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      heroEyebrow={t('common.appName')}
      heroTitle={t('auth.forgot.heroTitle')}
      heroDescription={t('auth.forgot.heroDescription')}
      heroHighlights={[
        t('auth.forgot.highlight1'),
        t('auth.forgot.highlight2'),
        t('auth.forgot.highlight3'),
      ]}
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>{t('auth.forgot.remembered')}</span>
            <Link to="/login" className="auth-link">
              {t('auth.forgot.backToLogin')}
            </Link>
          </div>

          <div className="auth-link-row">
            <span>{t('auth.forgot.noAccount')}</span>
            <Link to="/register" className="auth-link">
              {t('common.register')}
            </Link>
          </div>
        </div>
      }
    >
      {successMessage ? <AuthStatusBanner tone="success">{successMessage}</AuthStatusBanner> : null}
      {errorMessage ? <AuthStatusBanner tone="error">{errorMessage}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="forgot-password-email">{t('common.email')}</label>
          <input
            type="email"
            id="forgot-password-email"
            className={`auth-input${emailError ? ' is-error' : ''}`}
            placeholder="seu@email.com"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            disabled={isSubmitting}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
          />
          {emailError ? (
            <span id={emailErrorId} className="auth-field-error">
              {emailError}
            </span>
          ) : null}
        </div>

        <div className="auth-actions">
          <button
            type="submit"
            className="auth-button auth-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default ForgotPasswordPage
