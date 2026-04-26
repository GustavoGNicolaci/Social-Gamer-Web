import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import PasswordRequirementsPanel from '../components/auth/PasswordRequirementsPanel'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { getPasswordValidationError } from '../utils/passwordValidation'

const getConfirmPasswordMismatchError = (
  password: string,
  confirmPassword: string,
  mismatchMessage: string
) => {
  if (!confirmPassword) {
    return null
  }

  return password === confirmPassword ? null : mismatchMessage
}

function ResetPasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user, loading, updatePassword, logout } = useAuth()
  const passwordRequirementsId = useId()
  const passwordErrorId = useId()
  const confirmPasswordErrorId = useId()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  useEffect(() => {
    if (submitError && user) {
      setSubmitError(null)
    }
  }, [submitError, user])

  const shouldShowPasswordPanel =
    Boolean(password) || isPasswordFocused || hasAttemptedSubmit || isSubmitting
  const shouldValidatePassword = Boolean(password) || hasAttemptedSubmit
  const passwordDescribedBy = [
    shouldShowPasswordPanel ? passwordRequirementsId : null,
    passwordError ? passwordErrorId : null,
  ]
    .filter(Boolean)
    .join(' ')
  const confirmPasswordDescribedBy = confirmPasswordError ? confirmPasswordErrorId : undefined

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    setPasswordError(null)
    setSubmitError(null)

    if (confirmPassword) {
      setConfirmPasswordError(
        getConfirmPasswordMismatchError(value, confirmPassword, t('auth.passwordMismatch'))
      )
    }
  }

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value)
    setSubmitError(null)
    setConfirmPasswordError(
      getConfirmPasswordMismatchError(password, value, t('auth.passwordMismatch'))
    )
  }

  const validateForm = () => {
    const nextPasswordError = getPasswordValidationError(password)
    const nextConfirmPasswordError = !confirmPassword
      ? t('auth.confirmNewPasswordRequired')
      : password !== confirmPassword
        ? t('auth.passwordMismatch')
        : null

    setPasswordError(nextPasswordError)
    setConfirmPasswordError(nextConfirmPasswordError)

    return !nextPasswordError && !nextConfirmPasswordError
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setHasAttemptedSubmit(true)
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await updatePassword(password)

      if (result.error) {
        setSubmitError(result.error)
        return
      }

      await logout()
      navigate('/login', {
        replace: true,
        state: {
          successMessage: t('auth.reset.success'),
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = (
    <div className="auth-link-groups">
      <div className="auth-link-row">
        <span>{t('auth.reset.goBackNow')}</span>
        <Link to="/login" className="auth-link">
          {t('auth.reset.goToLogin')}
        </Link>
      </div>

      <div className="auth-link-row">
        <span>{t('auth.reset.needNewLink')}</span>
        <Link to="/esqueci-a-senha" className="auth-link">
          {t('auth.reset.requestAgain')}
        </Link>
      </div>
    </div>
  )

  if (loading) {
    return (
      <AuthShell
        title={t('auth.reset.title')}
        subtitle={t('auth.reset.subtitleLoading')}
        heroEyebrow={t('common.appName')}
        heroTitle={t('auth.reset.heroLoading')}
        heroDescription={t('auth.reset.heroLoadingDescription')}
        heroHighlights={[
          t('auth.reset.highlight1'),
          t('auth.reset.highlight2'),
          t('auth.reset.highlight3'),
        ]}
        layout="wide"
        footer={footer}
      >
        <AuthStatusBanner tone="info">{t('auth.reset.validating')}</AuthStatusBanner>
      </AuthShell>
    )
  }

  if (!user) {
    return (
      <AuthShell
        title={t('auth.reset.title')}
        subtitle={t('auth.reset.subtitleInvalid')}
        heroEyebrow={t('common.appName')}
        heroTitle={t('auth.reset.heroInvalid')}
        heroDescription={t('auth.reset.heroInvalidDescription')}
        heroHighlights={[
          t('auth.reset.highlight1'),
          t('auth.reset.highlight2'),
          t('auth.reset.highlight3'),
        ]}
        layout="wide"
        footer={footer}
      >
        <div className="auth-empty-state">
          <AuthStatusBanner tone="error">{t('auth.invalidResetLink')}</AuthStatusBanner>
          <p>{t('auth.reset.invalidHelp')}</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      heroEyebrow={t('common.appName')}
      heroTitle={t('auth.reset.heroTitle')}
      heroDescription={t('auth.reset.heroDescription')}
      heroHighlights={[
        t('auth.reset.highlight1'),
        t('auth.reset.highlight2'),
        t('auth.reset.highlight3'),
      ]}
      layout="wide"
      footer={footer}
    >
      {submitError ? <AuthStatusBanner tone="error">{submitError}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-password-section">
          <div className="auth-password-fields">
            <div className="auth-field">
              <label htmlFor="reset-password">{t('auth.reset.newPassword')}</label>
              <input
                type="password"
                id="reset-password"
                className={`auth-input${passwordError ? ' is-error' : ''}`}
                placeholder={t('auth.reset.newPasswordPlaceholder')}
                autoComplete="new-password"
                value={password}
                onChange={(event) => handlePasswordChange(event.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                disabled={isSubmitting}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordDescribedBy || undefined}
              />
              {passwordError ? (
                <span id={passwordErrorId} className="auth-field-error">
                  {passwordError}
                </span>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="reset-confirm-password">{t('auth.reset.confirmNewPassword')}</label>
              <input
                type="password"
                id="reset-confirm-password"
                className={`auth-input${confirmPasswordError ? ' is-error' : ''}`}
                placeholder={t('auth.reset.confirmNewPasswordPlaceholder')}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => handleConfirmPasswordChange(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={confirmPasswordDescribedBy}
              />
              {confirmPasswordError ? (
                <span id={confirmPasswordErrorId} className="auth-field-error">
                  {confirmPasswordError}
                </span>
              ) : null}
            </div>
          </div>

          <div className="auth-password-support">
            <PasswordRequirementsPanel
              id={passwordRequirementsId}
              password={password}
              shouldValidate={shouldValidatePassword}
              isVisible={shouldShowPasswordPanel}
            />
          </div>
        </div>

        <div className="auth-actions">
          <button type="submit" className="auth-button auth-button--primary" disabled={isSubmitting}>
            {isSubmitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
