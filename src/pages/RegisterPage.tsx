import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import PasswordRequirementsPanel from '../components/auth/PasswordRequirementsPanel'
import { useAuth, type RegisterFieldErrors } from '../contexts/AuthContext'
import {
  INVALID_EMAIL_MESSAGE,
  REQUIRED_EMAIL_MESSAGE,
  isValidEmailAddress,
} from '../utils/authErrorMessages'
import { getPasswordValidationError } from '../utils/passwordValidation'

const CONFIRM_PASSWORD_REQUIRED_MESSAGE = 'Confirme sua senha.'
const CONFIRM_PASSWORD_MISMATCH_MESSAGE = 'As senhas nao coincidem.'
const EMAIL_CONFIRMATION_MESSAGE =
  'Enviamos um link de confirmacao para o seu email. Confira sua caixa de entrada para concluir o cadastro.'
const HERO_HIGHLIGHTS = [
  'Perfil publico com identidade propria.',
  'Wishlist, favoritos e status em um unico lugar.',
  'Senha forte com validacao em tempo real.',
]

const getConfirmPasswordMismatchError = (password: string, confirmPassword: string) => {
  if (!confirmPassword) {
    return null
  }

  return password === confirmPassword ? null : CONFIRM_PASSWORD_MISMATCH_MESSAGE
}

function RegisterPage() {
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
          nextFormData.confirmPassword
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
      nextErrors.username = 'Nome de usuario e obrigatorio.'
    }

    if (!normalizedEmail) {
      nextErrors.email = REQUIRED_EMAIL_MESSAGE
    } else if (!isValidEmailAddress(normalizedEmail)) {
      nextErrors.email = INVALID_EMAIL_MESSAGE
    }

    const passwordError = getPasswordValidationError(formData.password)

    if (passwordError) {
      nextErrors.password = passwordError
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = CONFIRM_PASSWORD_REQUIRED_MESSAGE
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = CONFIRM_PASSWORD_MISMATCH_MESSAGE
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
      title="Criar Conta"
      subtitle="Monte seu perfil gamer e comece a organizar sua jornada."
      heroEyebrow="Social Gamer"
      heroTitle="Crie seu espaco no Social Gamer"
      heroDescription="Cadastre-se para acompanhar sua biblioteca, montar listas e publicar reviews com uma experiencia simples e segura."
      heroHighlights={HERO_HIGHLIGHTS}
      layout="auth"
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>Ja tem conta?</span>
            <Link to="/login" className="auth-link">
              Fazer login
            </Link>
          </div>
        </div>
      }
    >
      {showEmailConfirmation ? (
        <div className="auth-empty-state">
          <AuthStatusBanner tone="success">{EMAIL_CONFIRMATION_MESSAGE}</AuthStatusBanner>
          <p>Depois de confirmar seu email, volte para o login para acessar sua conta.</p>
        </div>
      ) : (
        <>
          {errors.submit ? <AuthStatusBanner tone="error">{errors.submit}</AuthStatusBanner> : null}

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-form-grid auth-form-grid--dual">
              <div className="auth-field">
                <label htmlFor="register-username">Nome de usuario</label>
                <input
                  type="text"
                  id="register-username"
                  name="username"
                  className={`auth-input${errors.username ? ' is-error' : ''}`}
                  placeholder="Seu username"
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
                <label htmlFor="register-name">Nome completo (opcional)</label>
                <input
                  type="text"
                  id="register-name"
                  name="name"
                  className={`auth-input${errors.name ? ' is-error' : ''}`}
                  placeholder="Nome completo (opcional)"
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
              <label htmlFor="register-email">Email</label>
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
                  <label htmlFor="register-password">Senha</label>
                  <input
                    type="password"
                    id="register-password"
                    name="password"
                    className={`auth-input${errors.password ? ' is-error' : ''}`}
                    placeholder="Crie uma senha forte"
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
                  <label htmlFor="register-confirm-password">Confirmar senha</label>
                  <input
                    type="password"
                    id="register-confirm-password"
                    name="confirmPassword"
                    className={`auth-input${errors.confirmPassword ? ' is-error' : ''}`}
                    placeholder="Repita a senha"
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
                {isSubmitting ? 'Criando conta...' : 'Criar conta'}
              </button>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  )
}

export default RegisterPage
