import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useAuth,
  type ProfileUpdateError,
} from '../contexts/AuthContext'
import {
  isProfilePrivate,
  mergeProfilePrivateIntoPrivacySettings,
} from '../utils/profilePrivacy'
import { getPublicProfilePath } from '../utils/profileRoutes'
import './AccountSettingsPage.css'

const DELETE_CONFIRMATION_TEXT = 'EXCLUIR'

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface AccountDeletionModalProps {
  confirmation: string
  feedback: FeedbackState | null
  isSubmitting: boolean
  onChangeConfirmation: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

function getSettingsUpdateErrorMessage(_error: ProfileUpdateError | null) {
  void _error
  return 'Nao foi possivel salvar esta configuracao agora. Tente novamente em alguns instantes.'
}

function SettingsFeedback({ feedback }: { feedback: FeedbackState | null }) {
  if (!feedback) return null

  return (
    <p className={`account-settings-feedback is-${feedback.tone}`} role="status">
      {feedback.message}
    </p>
  )
}

function AccountDeletionModal({
  confirmation,
  feedback,
  isSubmitting,
  onChangeConfirmation,
  onClose,
  onConfirm,
}: AccountDeletionModalProps) {
  const canConfirm = confirmation.trim() === DELETE_CONFIRMATION_TEXT && !isSubmitting

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSubmitting, onClose])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!canConfirm) return

    onConfirm()
  }

  return (
    <div
      className="account-settings-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <form
        className="account-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-delete-title"
        aria-describedby="account-delete-description"
        onSubmit={handleSubmit}
        onMouseDown={event => event.stopPropagation()}
      >
        <span className="account-settings-kicker is-danger">Exclusao definitiva</span>
        <h2 id="account-delete-title">Excluir conta</h2>
        <p id="account-delete-description">
          Esta acao remove sua conta, perfil e dados relacionados. Depois de confirmada, ela nao
          podera ser desfeita pela aplicacao.
        </p>

        <label className="account-settings-field">
          <span>Digite EXCLUIR para confirmar</span>
          <input
            type="text"
            value={confirmation}
            onChange={event => onChangeConfirmation(event.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
          />
        </label>

        <SettingsFeedback feedback={feedback} />

        <div className="account-settings-modal-actions">
          <button
            type="button"
            className="account-settings-button is-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="account-settings-button is-danger"
            disabled={!canConfirm}
          >
            {isSubmitting ? 'Excluindo...' : 'Excluir minha conta'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AccountSettingsPage() {
  const navigate = useNavigate()
  const {
    user,
    profile,
    loading,
    updateOwnProfile,
    requestAuthenticatedPasswordReset,
    deleteOwnAccount,
  } = useAuth()

  const [privacySaving, setPrivacySaving] = useState(false)
  const [privacyFeedback, setPrivacyFeedback] = useState<FeedbackState | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteFeedback, setDeleteFeedback] = useState<FeedbackState | null>(null)

  const profileIsPrivate = isProfilePrivate(profile?.configuracoes_privacidade)
  const profilePath = profile?.username ? getPublicProfilePath(profile.username) : '/profile'

  const handleTogglePrivacy = async () => {
    if (!profile || privacySaving) return

    const nextPrivacyValue = !profileIsPrivate

    setPrivacySaving(true)
    setPrivacyFeedback(null)

    const { error } = await updateOwnProfile({
      configuracoes_privacidade: mergeProfilePrivateIntoPrivacySettings(
        profile.configuracoes_privacidade,
        nextPrivacyValue
      ),
    })

    if (error) {
      setPrivacyFeedback({
        tone: 'error',
        message: getSettingsUpdateErrorMessage(error),
      })
      setPrivacySaving(false)
      return
    }

    setPrivacyFeedback({
      tone: 'success',
      message: nextPrivacyValue
        ? 'Seu perfil agora esta privado.'
        : 'Seu perfil agora esta publico.',
    })
    setPrivacySaving(false)
  }

  const handlePasswordResetRequest = async (event: FormEvent) => {
    event.preventDefault()

    if (passwordSubmitting) return

    if (!currentPassword) {
      setPasswordFeedback({
        tone: 'error',
        message: 'Informe sua senha atual para continuar.',
      })
      return
    }

    setPasswordSubmitting(true)
    setPasswordFeedback(null)

    const { error } = await requestAuthenticatedPasswordReset(currentPassword)

    if (error) {
      setPasswordFeedback({
        tone: 'error',
        message: error,
      })
      setPasswordSubmitting(false)
      return
    }

    setCurrentPassword('')
    setPasswordFeedback({
      tone: 'success',
      message: 'Senha atual confirmada. Enviamos um email para voce redefinir a senha.',
    })
    setPasswordSubmitting(false)
  }

  const handleOpenDeleteModal = () => {
    setDeleteConfirmation('')
    setDeleteFeedback(null)
    setIsDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    if (deleteSubmitting) return

    setIsDeleteModalOpen(false)
    setDeleteConfirmation('')
    setDeleteFeedback(null)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim() !== DELETE_CONFIRMATION_TEXT || deleteSubmitting) return

    setDeleteSubmitting(true)
    setDeleteFeedback(null)

    const { error } = await deleteOwnAccount()

    if (error) {
      setDeleteFeedback({
        tone: 'error',
        message: error,
      })
      setDeleteSubmitting(false)
      return
    }

    navigate('/login', {
      replace: true,
      state: {
        successMessage: 'Sua conta foi excluida com sucesso.',
      },
    })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="account-settings-state">
            <span className="account-settings-kicker">Configuracoes</span>
            <h1>Carregando sua conta</h1>
            <p>Estamos buscando suas preferencias com seguranca.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="account-settings-state">
            <span className="account-settings-kicker">Configuracoes</span>
            <h1>Entre para alterar sua conta</h1>
            <p>Apenas o usuario logado pode acessar privacidade, senha e exclusao de conta.</p>
            <Link to="/login" className="account-settings-button is-primary">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <main className="account-settings-page">
          <header className="account-settings-header">
            <div>
              <span className="account-settings-kicker">Conta</span>
              <h1>Configuracoes da conta</h1>
              <p>
                Ajuste como seu perfil aparece, solicite troca de senha e gerencie a permanencia
                da sua conta.
              </p>
            </div>

            <Link to={profilePath} className="account-settings-button is-secondary">
              Ver meu perfil
            </Link>
          </header>

          <section className="account-settings-layout" aria-label="Configuracoes da conta">
            <article className="account-settings-card">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker">Privacidade</span>
                  <h2>Visibilidade do perfil</h2>
                </div>

                <span className={`account-settings-status${profileIsPrivate ? ' is-private' : ''}`}>
                  {profileIsPrivate ? 'Privado' : 'Publico'}
                </span>
              </div>

              <p>
                Quando o perfil esta privado, visitantes veem apenas sua identidade basica. Bio,
                Top 5, conexoes, listas e reviews ficam ocultos da experiencia publica.
              </p>

              <button
                type="button"
                className={`account-settings-toggle${profileIsPrivate ? ' is-on' : ''}`}
                onClick={() => void handleTogglePrivacy()}
                disabled={privacySaving}
                aria-pressed={profileIsPrivate}
              >
                <span className="account-settings-toggle-track" aria-hidden="true">
                  <span className="account-settings-toggle-thumb" />
                </span>
                <span>{privacySaving ? 'Salvando...' : 'Perfil privado'}</span>
              </button>

              <SettingsFeedback feedback={privacyFeedback} />
            </article>

            <article className="account-settings-card">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker">Seguranca</span>
                  <h2>Trocar senha</h2>
                </div>
              </div>

              <p>
                Confirme sua senha atual. Depois disso, enviaremos um link seguro para redefinicao
                no email da sua conta.
              </p>

              <form className="account-settings-form" onSubmit={handlePasswordResetRequest}>
                <label className="account-settings-field">
                  <span>Senha atual</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={event => {
                      setCurrentPassword(event.target.value)
                      setPasswordFeedback(null)
                    }}
                    placeholder="Sua senha atual"
                    autoComplete="current-password"
                    disabled={passwordSubmitting}
                  />
                </label>

                <button
                  type="submit"
                  className="account-settings-button is-primary"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? 'Validando...' : 'Enviar email de redefinicao'}
                </button>
              </form>

              <SettingsFeedback feedback={passwordFeedback} />
            </article>

            <article className="account-settings-card is-danger-zone">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker is-danger">Zona de perigo</span>
                  <h2>Excluir conta</h2>
                </div>
              </div>

              <p>
                A exclusao remove sua conta definitivamente. Antes de executar, a aplicacao tenta
                limpar seus arquivos enviados e entao chama o processo seguro no Supabase.
              </p>

              <button
                type="button"
                className="account-settings-button is-danger"
                onClick={handleOpenDeleteModal}
              >
                Excluir minha conta
              </button>
            </article>
          </section>
        </main>

        {isDeleteModalOpen ? (
          <AccountDeletionModal
            confirmation={deleteConfirmation}
            feedback={deleteFeedback}
            isSubmitting={deleteSubmitting}
            onChangeConfirmation={value => {
              setDeleteConfirmation(value)
              setDeleteFeedback(null)
            }}
            onClose={handleCloseDeleteModal}
            onConfirm={() => void handleDeleteAccount()}
          />
        ) : null}
      </div>
    </div>
  )
}

export default AccountSettingsPage
