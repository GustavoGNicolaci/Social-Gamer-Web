import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import PasswordRequirementsPanel from '../components/auth/PasswordRequirementsPanel'
import { useAuth, type RegisterFieldErrors } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { isValidEmailAddress } from '../utils/authErrorMessages'
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

function RegisterPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { register, user } = useAuth()
  const usernameErrorId = useId()
  const nameErrorId = useId()
  const emailErrorId = useId()
  const passwordRequirementsId = useId()
  const passwordErrorId = useId()
  const confirmPasswordErrorId = useId()
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
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    const nextFormData = {
      ...formData,
      [name]: value,
    }

    setFormData(nextFormData)

    setErrors((prev) => {
      const nextErrors = { ...prev }
      let hasChanged = false
      const fieldName = name as keyof RegisterFieldErrors

      if (nextErrors[fieldName]) {
        delete nextErrors[fieldName]
        hasChanged = true
      }

      if (nextErrors.submit) {
        delete nextErrors.submit
        hasChanged = true
      }

      const shouldRevalidateConfirmPassword =
        (name === 'password' && Boolean(nextFormData.confirmPassword)) || name === 'confirmPassword'

      if (shouldRevalidateConfirmPassword) {
        const confirmPasswordError = getConfirmPasswordMismatchError(
          nextFormData.password,
          nextFormData.confirmPassword,
          t('auth.passwordMismatch')
        )

        if (confirmPasswordError) {
          if (nextErrors.confirmPassword !== confirmPasswordError) {
            nextErrors.confirmPassword = confirmPasswordError
            hasChanged = true
          }
        } else if (nextErrors.confirmPassword) {
          delete nextErrors.confirmPassword
          hasChanged = true
        }
      }

      if (!hasChanged) {
        return prev
      }

      return nextErrors
    })
  }

  const validateForm = (): RegisterFieldErrors => {
    const nextErrors: RegisterFieldErrors = {}
    const normalizedEmail = formData.email.trim().toLowerCase()

    if (!formData.username.trim()) {
      nextErrors.username = t('auth.usernameRequired')
    }

    if (!normalizedEmail) {
      nextErrors.email = t('auth.emailRequired')
    } else if (!isValidEmailAddress(normalizedEmail)) {
      nextErrors.email = t('auth.invalidEmail')
    }

    const passwordError = getPasswordValidationError(formData.password)

    if (passwordError) {
      nextErrors.password = passwordError
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = t('auth.confirmPasswordRequired')
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = t('auth.passwordMismatch')
    }

    return nextErrors
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    setHasAttemptedSubmit(true)

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

  const shouldShowPasswordPanel =
    !showEmailConfirmation && (Boolean(formData.password) || isPasswordFocused || hasAttemptedSubmit)
  const shouldValidatePassword = Boolean(formData.password) || hasAttemptedSubmit
  const passwordDescribedBy = [
    shouldShowPasswordPanel ? passwordRequirementsId : null,
    errors.password ? passwordErrorId : null,
  ]
    .filter(Boolean)
    .join(' ')
  const confirmPasswordDescribedBy = errors.confirmPassword ? confirmPasswordErrorId : undefined

  return (
    <AuthShell
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      heroEyebrow={t('common.appName')}
      heroTitle={t('auth.register.heroTitle')}
      heroDescription={t('auth.register.heroDescription')}
      heroHighlights={[
        t('auth.register.highlight1'),
        t('auth.register.highlight2'),
        t('auth.register.highlight3'),
      ]}
      layout="auth"
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>{t('auth.register.hasAccount')}</span>
            <Link to="/login" className="auth-link">
              {t('auth.login.submit')}
            </Link>
          </div>
        </div>
      }
    >
      {showEmailConfirmation ? (
        <div className="auth-empty-state">
          <AuthStatusBanner tone="success">{t('auth.register.emailConfirmation')}</AuthStatusBanner>
          <p>{t('auth.register.afterConfirm')}</p>
        </div>
      ) : (
        <>
          {errors.submit ? <AuthStatusBanner tone="error">{errors.submit}</AuthStatusBanner> : null}

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-form-grid auth-form-grid--dual">
              <div className="auth-field">
                <label htmlFor="register-username">{t('common.username')}</label>
                <input
                  type="text"
                  id="register-username"
                  name="username"
                  className={`auth-input${errors.username ? ' is-error' : ''}`}
                  placeholder={t('common.username')}
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? usernameErrorId : undefined}
                />
                {errors.username ? (
                  <span id={usernameErrorId} className="auth-field-error">
                    {errors.username}
                  </span>
                ) : null}
              </div>

              <div className="auth-field">
                <label htmlFor="register-name">{t('common.fullNameOptional')}</label>
                <input
                  type="text"
                  id="register-name"
                  name="name"
                  className={`auth-input${errors.name ? ' is-error' : ''}`}
                  placeholder={t('common.fullNameOptional')}
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? nameErrorId : undefined}
                />
                {errors.name ? (
                  <span id={nameErrorId} className="auth-field-error">
                    {errors.name}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">{t('common.email')}</label>
              <input
                type="email"
                id="register-email"
                name="email"
                className={`auth-input${errors.email ? ' is-error' : ''}`}
                placeholder="seu@email.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? emailErrorId : undefined}
              />
              {errors.email ? (
                <span id={emailErrorId} className="auth-field-error">
                  {errors.email}
                </span>
              ) : null}
            </div>

            <div className="auth-password-section">
              <div className="auth-password-fields">
                <div className="auth-field">
                  <label htmlFor="register-password">{t('common.password')}</label>
                  <input
                    type="password"
                    id="register-password"
                    name="password"
                    className={`auth-input${errors.password ? ' is-error' : ''}`}
                    placeholder={t('auth.createPasswordPlaceholder')}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={passwordDescribedBy || undefined}
                  />
                  {errors.password ? (
                    <span id={passwordErrorId} className="auth-field-error">
                      {errors.password}
                    </span>
                  ) : null}
                </div>

                <div className="auth-field">
                  <label htmlFor="register-confirm-password">{t('auth.confirmPassword')}</label>
                  <input
                    type="password"
                    id="register-confirm-password"
                    name="confirmPassword"
                    className={`auth-input${errors.confirmPassword ? ' is-error' : ''}`}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={confirmPasswordDescribedBy}
                  />
                  {errors.confirmPassword ? (
                    <span id={confirmPasswordErrorId} className="auth-field-error">
                      {errors.confirmPassword}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="auth-password-support">
                <PasswordRequirementsPanel
                  id={passwordRequirementsId}
                  password={formData.password}
                  shouldValidate={shouldValidatePassword}
                  isVisible={shouldShowPasswordPanel}
                />
              </div>
            </div>

            <div className="auth-actions">
              <button
                type="submit"
                className="auth-button auth-button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
              </button>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  )
}

export default RegisterPage
