import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useAuth,
  type ProfileUpdateError,
} from '../contexts/AuthContext'
import {
  getProfilePrivacyMode,
  mergeProfilePrivacyModeIntoPrivacySettings,
  type ProfilePrivacyMode,
} from '../utils/profilePrivacy'
import { getPublicProfilePath } from '../utils/profileRoutes'
import { translate, type SupportedLocale } from '../i18n'
import { useI18n } from '../i18n/I18nContext'
import './AccountSettingsPage.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface AccountDeletionModalProps {
  expectedUsername: string
  feedback: FeedbackState | null
  password: string
  isSubmitting: boolean
  username: string
  onChangePassword: (value: string) => void
  onChangeUsername: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

const PRIVACY_OPTIONS: Array<{
  value: ProfilePrivacyMode
  labelKey: string
  descriptionKey: string
}> = [
  {
    value: 'public',
    labelKey: 'common.public',
    descriptionKey: 'settings.privacy.publicDescription',
  },
  {
    value: 'friends',
    labelKey: 'common.friendsOnly',
    descriptionKey: 'settings.privacy.friendsDescription',
  },
  {
    value: 'private',
    labelKey: 'common.private',
    descriptionKey: 'settings.privacy.privateDescription',
  },
]

const LANGUAGE_OPTIONS: Array<{
  value: SupportedLocale
  labelKey: string
}> = [
  {
    value: 'pt-BR',
    labelKey: 'language.portuguese',
  },
  {
    value: 'en-US',
    labelKey: 'language.english',
  },
]

function getSettingsUpdateErrorMessage(_error: ProfileUpdateError | null, t: (key: string) => string) {
  void _error
  return t('settings.saveError')
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
  expectedUsername,
  feedback,
  password,
  isSubmitting,
  username,
  onChangePassword,
  onChangeUsername,
  onClose,
  onConfirm,
}: AccountDeletionModalProps) {
  const { t } = useI18n()
  const canConfirm = username === expectedUsername && password.length > 0 && !isSubmitting

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
        <span className="account-settings-kicker is-danger">{t('settings.delete.kicker')}</span>
        <h2 id="account-delete-title">{t('settings.delete.title')}</h2>
        <p id="account-delete-description">
          {t('settings.delete.description')}
        </p>

        <label className="account-settings-field">
          <span>{t('common.username')}</span>
          <input
            type="text"
            value={username}
            onChange={event => onChangeUsername(event.target.value)}
            disabled={isSubmitting}
            placeholder={expectedUsername}
            autoComplete="off"
          />
        </label>

        <label className="account-settings-field">
          <span>{t('common.currentPassword')}</span>
          <input
            type="password"
            value={password}
            onChange={event => onChangePassword(event.target.value)}
            disabled={isSubmitting}
            placeholder={t('settings.password.currentPlaceholder')}
            autoComplete="current-password"
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
            {t('common.cancel')}
          </button>

          <button
            type="submit"
            className="account-settings-button is-danger"
            disabled={!canConfirm}
          >
            {isSubmitting ? t('settings.delete.submitting') : t('settings.delete.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}

function AccountSettingsPage() {
  const navigate = useNavigate()
  const { locale, setLocale, t } = useI18n()
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
  const [languageSaving, setLanguageSaving] = useState(false)
  const [languageFeedback, setLanguageFeedback] = useState<FeedbackState | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteUsername, setDeleteUsername] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteFeedback, setDeleteFeedback] = useState<FeedbackState | null>(null)

  const privacyMode = getProfilePrivacyMode(profile?.configuracoes_privacidade)
  const profilePath = profile?.username ? getPublicProfilePath(profile.username) : '/profile'

  const handleChangePrivacyMode = async (nextPrivacyMode: ProfilePrivacyMode) => {
    if (!profile || privacySaving) return
    if (nextPrivacyMode === privacyMode) return

    setPrivacySaving(true)
    setPrivacyFeedback(null)

    const { error } = await updateOwnProfile({
      configuracoes_privacidade: mergeProfilePrivacyModeIntoPrivacySettings(
        profile.configuracoes_privacidade,
        nextPrivacyMode
      ),
    })

    if (error) {
      setPrivacyFeedback({
        tone: 'error',
        message: getSettingsUpdateErrorMessage(error, t),
      })
      setPrivacySaving(false)
      return
    }

    setPrivacyFeedback({
      tone: 'success',
      message:
        nextPrivacyMode === 'public'
          ? t('settings.privacy.savedPublic')
          : nextPrivacyMode === 'friends'
            ? t('settings.privacy.savedFriends')
            : t('settings.privacy.savedPrivate'),
    })
    setPrivacySaving(false)
  }

  const handleChangeLocale = async (nextLocale: SupportedLocale) => {
    if (languageSaving || nextLocale === locale) return

    setLanguageSaving(true)
    setLanguageFeedback(null)

    try {
      await setLocale(nextLocale)
      setLanguageFeedback({
        tone: 'success',
        message: translate('settings.language.saved', undefined, nextLocale),
      })
    } catch {
      setLanguageFeedback({
        tone: 'error',
        message: t('settings.language.saveError'),
      })
    } finally {
      setLanguageSaving(false)
    }
  }

  const handlePasswordResetRequest = async (event: FormEvent) => {
    event.preventDefault()

    if (passwordSubmitting) return

    if (!currentPassword) {
      setPasswordFeedback({
        tone: 'error',
        message: t('settings.password.currentRequired'),
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
      message: t('settings.password.success'),
    })
    setPasswordSubmitting(false)
  }

  const handleOpenDeleteModal = () => {
    setDeleteUsername('')
    setDeletePassword('')
    setDeleteFeedback(null)
    setIsDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    if (deleteSubmitting) return

    setIsDeleteModalOpen(false)
    setDeleteUsername('')
    setDeletePassword('')
    setDeleteFeedback(null)
  }

  const handleDeleteAccount = async () => {
    if (!profile || deleteSubmitting) return

    if (deleteUsername !== profile.username) {
      setDeleteFeedback({
        tone: 'error',
        message: t('settings.delete.usernameMismatch'),
      })
      return
    }

    if (!deletePassword) {
      setDeleteFeedback({
        tone: 'error',
        message: t('settings.delete.passwordRequired'),
      })
      return
    }

    setDeleteSubmitting(true)
    setDeleteFeedback(null)

    const { error } = await deleteOwnAccount({
      username: deleteUsername,
      currentPassword: deletePassword,
    })

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
        successMessage: t('settings.delete.success'),
      },
    })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="account-settings-state">
            <span className="account-settings-kicker">{t('common.settings')}</span>
            <h1>{t('settings.loadingTitle')}</h1>
            <p>{t('settings.loadingText')}</p>
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
            <span className="account-settings-kicker">{t('common.settings')}</span>
            <h1>{t('settings.loginTitle')}</h1>
            <p>{t('settings.loginText')}</p>
            <Link to="/login" className="account-settings-button is-primary">
              {t('auth.login.submit')}
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
              <span className="account-settings-kicker">{t('common.myAccount')}</span>
              <h1>{t('settings.title')}</h1>
              <p>
                {t('settings.description')}
              </p>
            </div>

            <Link to={profilePath} className="account-settings-button is-secondary">
              {t('settings.viewMyProfile')}
            </Link>
          </header>

          <section className="account-settings-layout" aria-label={t('settings.title')}>
            <article className="account-settings-card">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker">{t('common.privacy')}</span>
                  <h2>{t('settings.privacy.title')}</h2>
                </div>

                <span className={`account-settings-status is-${privacyMode}`}>
                  {privacyMode === 'public'
                    ? t('common.public')
                    : privacyMode === 'friends'
                      ? t('common.friendsOnly')
                      : t('common.private')}
                </span>
              </div>

              <p>
                {t('settings.privacy.description')}
              </p>

              <div
                className="account-settings-privacy-options"
                role="radiogroup"
                aria-label={t('settings.privacy.title')}
              >
                {PRIVACY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`account-settings-privacy-option${
                      privacyMode === option.value ? ' is-selected' : ''
                    }`}
                    role="radio"
                    aria-checked={privacyMode === option.value}
                    onClick={() => void handleChangePrivacyMode(option.value)}
                    disabled={privacySaving}
                  >
                    <strong>{t(option.labelKey)}</strong>
                    <span>{t(option.descriptionKey)}</span>
                  </button>
                ))}
              </div>

              <SettingsFeedback feedback={privacyFeedback} />
            </article>

            <article className="account-settings-card">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker">{t('settings.language.current')}</span>
                  <h2>{t('settings.language.title')}</h2>
                </div>

                <span className="account-settings-status">
                  {locale === 'pt-BR' ? t('language.portuguese') : t('language.english')}
                </span>
              </div>

              <p>{t('settings.language.description')}</p>

              <div
                className="account-settings-privacy-options"
                role="radiogroup"
                aria-label={t('settings.language.title')}
              >
                {LANGUAGE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`account-settings-privacy-option${
                      locale === option.value ? ' is-selected' : ''
                    }`}
                    role="radio"
                    aria-checked={locale === option.value}
                    onClick={() => void handleChangeLocale(option.value)}
                    disabled={languageSaving}
                  >
                    <strong>{t(option.labelKey)}</strong>
                    <span>{option.value}</span>
                  </button>
                ))}
              </div>

              <SettingsFeedback feedback={languageFeedback} />
            </article>

            <article className="account-settings-card">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker">{t('common.security')}</span>
                  <h2>{t('settings.password.title')}</h2>
                </div>
              </div>

              <p>
                {t('settings.password.description')}
              </p>

              <form className="account-settings-form" onSubmit={handlePasswordResetRequest}>
                <label className="account-settings-field">
                  <span>{t('common.currentPassword')}</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={event => {
                      setCurrentPassword(event.target.value)
                      setPasswordFeedback(null)
                    }}
                    placeholder={t('settings.password.currentPlaceholder')}
                    autoComplete="current-password"
                    disabled={passwordSubmitting}
                  />
                </label>

                <button
                  type="submit"
                  className="account-settings-button is-primary"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? t('settings.password.submitting') : t('settings.password.submit')}
                </button>
              </form>

              <SettingsFeedback feedback={passwordFeedback} />
            </article>

            <article className="account-settings-card is-danger-zone">
              <div className="account-settings-card-header">
                <div>
                  <span className="account-settings-kicker is-danger">{t('common.dangerZone')}</span>
                  <h2>{t('settings.delete.title')}</h2>
                </div>
              </div>

              <p>
                {t('settings.delete.zoneText')}
              </p>

              <button
                type="button"
                className="account-settings-button is-danger"
                onClick={handleOpenDeleteModal}
              >
                {t('settings.delete.submit')}
              </button>
            </article>
          </section>
        </main>

        {isDeleteModalOpen ? (
          <AccountDeletionModal
            expectedUsername={profile.username}
            feedback={deleteFeedback}
            password={deletePassword}
            isSubmitting={deleteSubmitting}
            username={deleteUsername}
            onChangePassword={value => {
              setDeletePassword(value)
              setDeleteFeedback(null)
            }}
            onChangeUsername={value => {
              setDeleteUsername(value)
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
