import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/auth/AuthShell'
import AuthStatusBanner from '../components/auth/AuthStatusBanner'
import { useAuth } from '../contexts/AuthContext'
import {
  INVALID_EMAIL_MESSAGE,
  REQUIRED_EMAIL_MESSAGE,
  isValidEmailAddress,
} from '../utils/authErrorMessages'

const RESET_PASSWORD_SUCCESS_MESSAGE =
  'Se esse e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.'
const HERO_HIGHLIGHTS = [
  'Envio seguro com o fluxo nativo do Supabase Auth.',
  'Mensagem discreta para proteger a privacidade do usuario.',
  'Recuperacao simples, rapida e sem quebrar o fluxo atual.',
]

function ForgotPasswordPage() {
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
      setEmailError(REQUIRED_EMAIL_MESSAGE)
      return
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      setEmailError(INVALID_EMAIL_MESSAGE)
      return
    }

    setIsSubmitting(true)

    try {
      const result = await requestPasswordReset(normalizedEmail)

      if (result.error) {
        setErrorMessage(result.error)
        return
      }

      setSuccessMessage(RESET_PASSWORD_SUCCESS_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Esqueci a senha"
      subtitle="Informe seu email e enviaremos um link seguro para redefinir o acesso."
      heroEyebrow="Social Gamer"
      heroTitle="Recupere seu acesso sem complicacao"
      heroDescription="Use o fluxo nativo do Supabase para gerar um link de redefinicao e voltar a entrar com seguranca."
      heroHighlights={HERO_HIGHLIGHTS}
      footer={
        <div className="auth-link-groups">
          <div className="auth-link-row">
            <span>Lembrou sua senha?</span>
            <Link to="/login" className="auth-link">
              Voltar para o login
            </Link>
          </div>

          <div className="auth-link-row">
            <span>Ainda nao tem conta?</span>
            <Link to="/register" className="auth-link">
              Criar conta
            </Link>
          </div>
        </div>
      }
    >
      {successMessage ? <AuthStatusBanner tone="success">{successMessage}</AuthStatusBanner> : null}
      {errorMessage ? <AuthStatusBanner tone="error">{errorMessage}</AuthStatusBanner> : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="forgot-password-email">Email</label>
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
            {isSubmitting ? 'Enviando link...' : 'Enviar link'}
          </button>
        </div>
      </form>
    </AuthShell>
  )
}

export default ForgotPasswordPage
