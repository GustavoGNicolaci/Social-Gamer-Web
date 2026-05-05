import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  createCommunity,
  isCommunityCreationLimitError,
  type CommunityCreationQuota,
  type CommunityCategoryValue,
  type CommunityPostingPermission,
  type CommunityVisibility,
} from '../../services/communityService'
import {
  searchCatalogGamesByTitle,
  type CatalogGamePreview,
} from '../../services/gameCatalogService'
import { uploadCommunityBannerImage } from '../../services/storageService'
import { GameCoverImage } from '../GameCoverImage'
import { CommunityFilePicker } from './CommunityFilePicker'

interface CommunityDraft {
  nome: string
  descricao: string
  tipo: string
  categoria: CommunityCategoryValue | ''
  regras: string
  permissaoPostagem: CommunityPostingPermission
  visibilidade: CommunityVisibility
}

type FeedbackTone = 'success' | 'error' | 'info'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface CommunityCreateModalProps {
  creationQuota: CommunityCreationQuota | null
  quotaError: string | null
  quotaLoading: boolean
  onClose: () => void
  onCreated: () => void | Promise<void>
}

const initialDraft: CommunityDraft = {
  nome: '',
  descricao: '',
  tipo: '',
  categoria: '',
  regras: '',
  permissaoPostagem: 'todos_membros',
  visibilidade: 'publica',
}

const POSTING_PERMISSION_OPTIONS: CommunityPostingPermission[] = [
  'todos_membros',
  'somente_admins',
  'somente_lider',
]

export function CommunityCreateModal({
  creationQuota,
  quotaError,
  quotaLoading,
  onClose,
  onCreated,
}: CommunityCreateModalProps) {
  const { user } = useAuth()
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const [draft, setDraft] = useState<CommunityDraft>(initialDraft)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<CatalogGamePreview | null>(null)
  const [gameSearch, setGameSearch] = useState('')
  const [gameResults, setGameResults] = useState<CatalogGamePreview[]>([])
  const [gameSearchLoading, setGameSearchLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setDraft(initialDraft)
    setBannerFile(null)
    setSelectedGame(null)
    setGameSearch('')
    setGameResults([])
    setGameSearchLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    if (submitting) return
    resetForm()
    setFeedback(null)
    onClose()
  }, [onClose, resetForm, submitting])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose])

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(bannerFile)
    setBannerPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [bannerFile])

  useEffect(() => {
    const query = gameSearch.trim()
    if (selectedGame || query.length < 2) {
      setGameResults([])
      setGameSearchLoading(false)
      return
    }

    let isActive = true
    setGameSearchLoading(true)

    const timeoutId = window.setTimeout(async () => {
      const result = await searchCatalogGamesByTitle(query, { limit: 5 })
      if (!isActive) return
      setGameResults(result.data)
      setGameSearchLoading(false)
    }, 240)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [gameSearch, selectedGame])

  const updateDraft = <K extends keyof CommunityDraft>(field: K, value: CommunityDraft[K]) => {
    setDraft(currentDraft => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || submitting) return

    if (creationQuota && !creationQuota.canCreate) {
      setFeedback({ tone: 'error', message: t('communities.create.limitReached') })
      return
    }

    const normalizedName = draft.nome.trim()
    if (normalizedName.length < 3) {
      setFeedback({ tone: 'error', message: t('communities.create.nameMin') })
      return
    }

    let created = false
    setSubmitting(true)
    setFeedback(null)

    try {
      let bannerPath: string | null = null
      if (bannerFile) {
        const uploadResult = await uploadCommunityBannerImage(bannerFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: t('communities.create.bannerUploadError') })
          return
        }
        bannerPath = uploadResult.path
      }

      const result = await createCommunity({
        nome: normalizedName,
        descricao: draft.descricao,
        bannerPath,
        tipo: draft.tipo,
        jogoId: selectedGame?.id || null,
        categoria: draft.categoria || null,
        regras: draft.regras,
        permissaoPostagem: draft.permissaoPostagem,
        visibilidade: draft.visibilidade,
      })

      if (result.error || !result.data) {
        setFeedback({
          tone: 'error',
          message: isCommunityCreationLimitError(result.error)
            ? t('communities.create.limitReached')
            : result.error?.message || t('communities.create.error'),
        })
        return
      }

      resetForm()
      await onCreated()
      created = true
      setSubmitting(false)
      onClose()
    } catch {
      setFeedback({ tone: 'error', message: t('communities.create.error') })
    } finally {
      if (!created) setSubmitting(false)
    }
  }

  return (
    <div className="communities-create-modal-backdrop" role="presentation" onMouseDown={handleClose}>
      <div
        className="communities-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="communities-create-modal-header">
          <div className="communities-create-modal-title-row">
            <span className="communities-create-modal-icon" aria-hidden="true">
              <Users size={20} />
            </span>
            <div>
              <span className="communities-kicker">{t('communities.create.kicker')}</span>
              <h2 id={titleId}>{t('communities.create.modalTitle')}</h2>
              <p id={descriptionId}>{t('communities.create.modalText')}</p>
            </div>
          </div>

          <button
            type="button"
            className="communities-create-modal-close"
            onClick={handleClose}
            disabled={submitting}
            aria-label={t('communities.create.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {feedback ? (
          <p className={`communities-feedback is-${feedback.tone}`}>{feedback.message}</p>
        ) : null}

        {!user ? (
          <div className="communities-login-card">
            <h3>{t('communities.create.loginTitle')}</h3>
            <p>{t('communities.create.loginText')}</p>
            <Link to="/login" className="communities-primary-link" onClick={handleClose}>
              {t('common.login')}
            </Link>
          </div>
        ) : creationQuota && !creationQuota.canCreate ? (
          <div className="communities-limit-card">
            <h3>{t('communities.create.limitTitle')}</h3>
            <p>{t('communities.create.limitReached')}</p>
            <p>{t('communities.create.limitText')}</p>
          </div>
        ) : (
          <form className="communities-form" onSubmit={handleSubmit}>
            {quotaLoading ? (
              <p className="communities-quota-note is-loading">
                {t('communities.create.quotaChecking')}
              </p>
            ) : quotaError ? (
              <p className="communities-quota-note is-error">
                {quotaError}
              </p>
            ) : creationQuota ? (
              <p className="communities-quota-note">
                {t('communities.create.quotaStatus', {
                  count: creationQuota.createdCount,
                  limit: creationQuota.limit,
                  remaining: creationQuota.remaining,
                })}
              </p>
            ) : null}

            <label className="communities-field">
              <span>{t('communities.field.name')}</span>
              <input
                value={draft.nome}
                onChange={event => updateDraft('nome', event.target.value)}
                maxLength={80}
                disabled={submitting}
                required
              />
            </label>

            <label className="communities-field">
              <span>{t('communities.field.description')}</span>
              <textarea
                value={draft.descricao}
                onChange={event => updateDraft('descricao', event.target.value)}
                maxLength={600}
                disabled={submitting}
              />
            </label>

            <div className="communities-form-grid">
              <label className="communities-field">
                <span>{t('communities.field.theme')}</span>
                <input
                  value={draft.tipo}
                  onChange={event => updateDraft('tipo', event.target.value)}
                  placeholder={t('communities.field.themePlaceholder')}
                  disabled={submitting}
                />
              </label>

              <label className="communities-field">
                <span>{t('communities.field.category')}</span>
                <select
                  value={draft.categoria}
                  onChange={event =>
                    updateDraft('categoria', event.target.value as CommunityCategoryValue | '')
                  }
                  disabled={submitting}
                >
                  <option value="">{t('communities.field.categoryPlaceholder')}</option>
                  {COMMUNITY_CATEGORY_VALUES.map(option => (
                    <option key={option} value={option}>
                      {t(`communities.category.${option}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="communities-field">
              <span>{t('communities.field.relatedGame')}</span>
              <input
                value={selectedGame ? selectedGame.titulo : gameSearch}
                onChange={event => {
                  setSelectedGame(null)
                  setGameSearch(event.target.value)
                }}
                placeholder={t('communities.field.relatedGamePlaceholder')}
                disabled={submitting}
              />
            </label>

            {gameSearchLoading ? (
              <p className="communities-helper">{t('communities.create.searchingGames')}</p>
            ) : gameResults.length > 0 && !selectedGame ? (
              <div className="communities-game-results">
                {gameResults.map(game => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => {
                      setSelectedGame(game)
                      setGameSearch(game.titulo)
                      setGameResults([])
                    }}
                    disabled={submitting}
                  >
                    <span className="communities-game-thumb">
                      {game.capa_url ? (
                        <GameCoverImage
                          src={game.capa_url}
                          alt={game.titulo}
                          width={44}
                          height={44}
                        />
                      ) : (
                        game.titulo.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span>{game.titulo}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="communities-form-grid">
              <label className="communities-field">
                <span>{t('communities.field.postingPermission')}</span>
                <select
                  value={draft.permissaoPostagem}
                  onChange={event =>
                    updateDraft(
                      'permissaoPostagem',
                      event.target.value as CommunityPostingPermission
                    )
                  }
                  disabled={submitting}
                >
                  {POSTING_PERMISSION_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {t(`communities.permission.${option}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="communities-field">
                <span>{t('communities.field.visibility')}</span>
                <select
                  value={draft.visibilidade}
                  onChange={event =>
                    updateDraft('visibilidade', event.target.value as CommunityVisibility)
                  }
                  disabled={submitting}
                >
                  <option value="publica">{t('communities.visibility.publica')}</option>
                  <option value="privada">{t('communities.visibility.privada')}</option>
                </select>
              </label>
            </div>

            <label className="communities-field">
              <span>{t('communities.field.rules')}</span>
              <textarea
                value={draft.regras}
                onChange={event => updateDraft('regras', event.target.value)}
                maxLength={3000}
                disabled={submitting}
              />
            </label>

            <CommunityFilePicker
              label={t('communities.field.banner')}
              buttonLabel={t('communities.upload.chooseBanner')}
              removeLabel={t('communities.upload.removeImage')}
              uploadingLabel={t('communities.upload.uploading')}
              previewAlt={t('communities.create.bannerPreview')}
              helperText={t('communities.upload.bannerHelper')}
              file={bannerFile}
              previewUrl={bannerPreviewUrl}
              disabled={submitting}
              isUploading={submitting && Boolean(bannerFile)}
              onChange={setBannerFile}
            />

            <div className="communities-create-modal-actions">
              <button
                type="button"
                className="community-secondary-button"
                onClick={handleClose}
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>

              <button
                type="submit"
                className="communities-primary-button"
                disabled={submitting || quotaLoading}
              >
                <Plus size={18} aria-hidden="true" />
                <span>
                  {submitting ? t('communities.create.creating') : t('communities.create.submit')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
