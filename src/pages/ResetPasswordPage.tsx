import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import PasswordRequirementsPanel from '../components/auth/PasswordRequirementsPanel'
import { useAuth } from '../contexts/AuthContext'
import { INVALID_RESET_LINK_MESSAGE } from '../utils/authErrorMessages'
import { getPasswordValidationError } from '../utils/passwordValidation'

const CONFIRM_PASSWORD_REQUIRED_MESSAGE = 'Confirme a nova senha.'
const CONFIRM_PASSWORD_MISMATCH_MESSAGE = 'As senhas nao coincidem.'
const RESET_PASSWORD_SUCCESS_MESSAGE = 'Senha redefinida com sucesso. Faca login com sua nova senha.'
const HERO_HIGHLIGHTS = [
  'Nova senha validada com os mesmos criterios do cadastro.',
  'Feedback em tempo real para deixar o processo mais claro.',
  'Depois do sucesso, voce volta ao login com confirmacao visual.',
]

const getConfirmPasswordMismatchError = (password: string, confirmPassword: string) => {
  if (!confirmPassword) {
    return null
  }

  return password === confirmPassword ? null : CONFIRM_PASSWORD_MISMATCH_MESSAGE
}

function ResetPasswordPage() {
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
      setConfirmPasswordError(getConfirmPasswordMismatchError(value, confirmPassword))
    }
  }

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value)
    setSubmitError(null)
    setConfirmPasswordError(getConfirmPasswordMismatchError(password, value))
  }

  const validateForm = () => {
    const nextPasswordError = getPasswordValidationError(password)
    const nextConfirmPasswordError = !confirmPassword
      ? CONFIRM_PASSWORD_REQUIRED_MESSAGE
      : password !== confirmPassword
        ? CONFIRM_PASSWORD_MISMATCH_MESSAGE
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
          successMessage: RESET_PASSWORD_SUCCESS_MESSAGE,
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = (
    <div className="auth-link-groups">
      <div className="auth-link-row">
        <span>Quer voltar agora?</span>
        <Link to="/login" className="auth-link">
          Ir para o login
        </Link>
      </div>

      <div className="auth-link-row">
        <span>Precisa de um novo link?</span>
        <Link to="/esqueci-a-senha" className="auth-link">
          Solicitar novamente
        </Link>
      </div>
    </div>
  )

  if (loading) {
    return (
      <AuthShell
        title="Resetar Senha"
        subtitle="Estamos validando seu link de redefinicao."
        heroEyebrow="Social Gamer"
        heroTitle="Quase la para recuperar o acesso"
        heroDescription="Assim que a sessao de recuperacao for confirmada, voce podera escolher uma nova senha."
        heroHighlights={HERO_HIGHLIGHTS}
        layout="wide"
        footer={footer}
      >
        <AuthStatusBanner tone="info">Validando seu link de redefinicao...</AuthStatusBanner>
      </AuthShell>
    )
  }

  if (!user) {
    return (
      <AuthShell
        title="Resetar Senha"
        subtitle="Seu link de redefinicao precisa estar valido para continuar."
        heroEyebrow="Social Gamer"
        heroTitle="Solicite um novo link com seguranca"
        heroDescription="Se o link expirou ou ficou invalido, voce pode pedir uma nova mensagem de redefinicao em poucos segundos."
        heroHighlights={HERO_HIGHLIGHTS}
        layout="wide"
        footer={footer}
      >
        <div className="auth-empty-state">
          <AuthStatusBanner tone="error">{INVALID_RESET_LINK_MESSAGE}</AuthStatusBanner>
          <p>Abra o email mais recente enviado pelo sistema ou solicite um novo link para continuar.</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Resetar Senha"
      subtitle="Defina uma nova senha para voltar a entrar com seguranca."
      heroEyebrow="Social Gamer"
      heroTitle="Escolha uma nova senha"
      heroDescription="Atualize sua senha com os mesmos criterios usados no cadastro e volte para a sua conta com tranquilidade."
      heroHighlights={HERO_HIGHLIGHTS}
      layout="wide"
      footer={footer}
    >
      {submitError ? <AuthStatusBanner tone="error">{submitError}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-password-section">
          <div className="auth-password-fields">
            <div className="auth-field">
              <label htmlFor="reset-password">Nova senha</label>
              <input
                type="password"
                id="reset-password"
                className={`auth-input${passwordError ? ' is-error' : ''}`}
                placeholder="Crie uma nova senha"
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
              <label htmlFor="reset-confirm-password">Confirmar nova senha</label>
              <input
                type="password"
                id="reset-confirm-password"
                className={`auth-input${confirmPasswordError ? ' is-error' : ''}`}
                placeholder="Repita a nova senha"
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
            {isSubmitting ? 'Salvando nova senha...' : 'Salvar nova senha'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
