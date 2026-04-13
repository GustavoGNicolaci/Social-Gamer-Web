import { useEffect, useState, type ChangeEvent } from 'react'
import type { ProfileUpdateError, UserProfile } from '../contexts/AuthContext'
import { useAuth } from '../contexts/AuthContext'
import { uploadImage } from '../services/storageService'
import './ProfilePage.css'

type FeedbackTone = 'success' | 'error'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface ProfileDraft {
  nome_completo: string
  username: string
  bio: string
}

const createProfileDraft = (profile: UserProfile | null): ProfileDraft => ({
  nome_completo: profile?.nome_completo || '',
  username: profile?.username || '',
  bio: profile?.bio || '',
})

const getProfileErrorMessage = (error: ProfileUpdateError | null) => {
  if (!error) {
    return 'Nao foi possivel salvar as alteracoes do perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '23505' ||
    fullMessage.includes('duplicate') ||
    fullMessage.includes('key (username)') ||
    fullMessage.includes('unique')
  ) {
    return 'Esse username ja esta em uso. Tente outro.'
  }

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel atualizar o perfil por permissao. Verifique as policies de UPDATE e SELECT da tabela usuarios no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return 'Nao foi possivel salvar o perfil porque a estrutura da tabela usuarios nao corresponde ao frontend.'
  }

  if (
    fullMessage.includes('nenhum registro') ||
    fullMessage.includes('no rows') ||
    fullMessage.includes('json object requested')
  ) {
    return 'Nao foi possivel confirmar a atualizacao do perfil. Verifique as policies de UPDATE e SELECT da tabela usuarios no Supabase.'
  }

  return 'Nao foi possivel salvar as alteracoes do perfil agora.'
}

export function ProfilePage() {
  const { user, profile, loading, updateOwnProfile } = useAuth()
  const [draftProfile, setDraftProfile] = useState<ProfileDraft>(() => createProfileDraft(null))
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<FeedbackState | null>(null)

  useEffect(() => {
    if (profile && !isEditing) {
      setDraftProfile(createProfileDraft(profile))
      return
    }

    if (!profile && !isEditing) {
      setDraftProfile(createProfileDraft(null))
    }
  }, [profile, isEditing])

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Carregando perfil</h1>
            <p>Estamos buscando suas informacoes.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Faça login para acessar seu perfil</h1>
            <p>Entre na sua conta para visualizar e editar seus dados.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>Nao foi possivel carregar seus dados agora. Tente novamente em instantes.</p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnerView = Boolean(user && profile && user.id === profile.id)
  const joinedDate = profile.data_cadastro
    ? new Date(profile.data_cadastro).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data nao informada'

  const visibleName = draftProfile.nome_completo || 'Nome nao informado'
  const visibleUsername = draftProfile.username || 'usuario'
  const visibleBio = draftProfile.bio.trim()

  const resetDraft = () => {
    setDraftProfile(createProfileDraft(profile))
  }

  const handleStartEditing = () => {
    if (!isOwnerView) return

    resetDraft()
    setSaveFeedback(null)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    resetDraft()
    setSaveFeedback(null)
    setIsEditing(false)
  }

  const handleDraftChange = (field: keyof ProfileDraft, value: string) => {
    setDraftProfile((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !isOwnerView) return

    setAvatarFeedback(null)
    setIsUploadingAvatar(true)

    try {
      const result = await uploadImage(file, user.id)
      if (!result) {
        setAvatarFeedback({
          tone: 'error',
          message: 'Nao foi possivel enviar a nova foto.',
        })
        return
      }

      const { error } = await updateOwnProfile({
        avatar_url: result.url,
      })

      if (error) {
        setAvatarFeedback({
          tone: 'error',
          message: getProfileErrorMessage(error),
        })
        return
      }

      setAvatarFeedback({
        tone: 'success',
        message: 'Foto de perfil atualizada com sucesso.',
      })
    } catch (error) {
      console.error('Erro inesperado ao atualizar avatar do perfil:', error)
      setAvatarFeedback({
        tone: 'error',
        message: 'Nao foi possivel atualizar a foto agora.',
      })
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    if (!isOwnerView) return

    const trimmedName = draftProfile.nome_completo.trim()
    const trimmedUsername = draftProfile.username.trim()
    const trimmedBio = draftProfile.bio.trim()
    const currentName = profile.nome_completo?.trim() || ''
    const currentUsername = profile.username?.trim() || ''
    const currentBio = profile.bio?.trim() || ''

    if (!trimmedName || !trimmedUsername) {
      setSaveFeedback({
        tone: 'error',
        message: 'Nome exibido e username sao obrigatorios.',
      })
      return
    }

    if (
      trimmedName === currentName &&
      trimmedUsername === currentUsername &&
      trimmedBio === currentBio
    ) {
      setSaveFeedback(null)
      setIsEditing(false)
      return
    }

    setSaveFeedback(null)
    setIsSaving(true)

    try {
      const { data, error } = await updateOwnProfile({
        nome_completo: trimmedName,
        username: trimmedUsername,
        bio: trimmedBio || null,
      })

      if (error || !data) {
        setSaveFeedback({
          tone: 'error',
          message: getProfileErrorMessage(error),
        })
        return
      }

      setDraftProfile(createProfileDraft(data))
      setSaveFeedback({
        tone: 'success',
        message: 'Perfil atualizado com sucesso.',
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Erro inesperado ao salvar perfil:', error)
      setSaveFeedback({
        tone: 'error',
        message: 'Nao foi possivel salvar as alteracoes do perfil agora.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const avatarContent = profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={`Foto de perfil de ${visibleName}`}
      className="avatar-img profile-avatar-large"
    />
  ) : (
    <div className="avatar-placeholder-large profile-avatar-large">
      {visibleName.charAt(0).toUpperCase()}
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="profile-page">
          <section className="profile-card">
            <div className="profile-card-glow profile-card-glow-left"></div>
            <div className="profile-card-glow profile-card-glow-right"></div>

            <div className="profile-card-main">
              <div className="profile-avatar-column">
                {isOwnerView ? (
                  <>
                    <label
                      htmlFor="profile-avatar-input"
                      className={`profile-avatar-trigger${isUploadingAvatar ? ' is-uploading' : ''}`}
                      title="Clique para trocar a foto"
                    >
                      {avatarContent}
                      <span className="profile-avatar-overlay">
                        {isUploadingAvatar ? 'Enviando foto...' : 'Trocar foto'}
                      </span>
                    </label>

                    <input
                      id="profile-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={isUploadingAvatar}
                      className="profile-avatar-input"
                    />
                  </>
                ) : (
                  <div className="profile-avatar-shell">{avatarContent}</div>
                )}

                {avatarFeedback && (
                  <p className={`profile-feedback profile-feedback-center is-${avatarFeedback.tone}`}>
                    {avatarFeedback.message}
                  </p>
                )}
              </div>

              <div className="profile-info-column">
                <div className="profile-info-header">
                  <div className="profile-heading">
                    <span className="profile-eyebrow">Perfil</span>
                    <h1>{visibleName}</h1>
                    <p className="profile-handle">@{visibleUsername}</p>
                  </div>

                  {isOwnerView && (
                    <button
                      type="button"
                      className={`profile-edit-button${isEditing ? ' is-active' : ''}`}
                      onClick={isEditing ? handleCancelEditing : handleStartEditing}
                      disabled={isSaving || isUploadingAvatar}
                      aria-label={isEditing ? 'Cancelar edicao do perfil' : 'Editar perfil'}
                      aria-pressed={isEditing}
                    >
                      <span className="profile-edit-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M4 20H8L18 10C18.5304 9.46957 18.8284 8.75022 18.8284 8C18.8284 7.24978 18.5304 6.53043 18 6C17.4696 5.46957 16.7502 5.17157 16 5.17157C15.2498 5.17157 14.5304 5.46957 14 6L4 16V20Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13 7L17 11"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
                    </button>
                  )}
                </div>

                <div className="profile-meta">
                  <div className="profile-meta-item">
                    <span>Membro desde</span>
                    <strong>{joinedDate}</strong>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    className="profile-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSaveProfile()
                    }}
                  >
                    <div className="profile-form-grid">
                      <label className="profile-field">
                        <span>Nome exibido</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={draftProfile.nome_completo}
                          onChange={(event) => handleDraftChange('nome_completo', event.target.value)}
                          placeholder="Como seu nome aparece no perfil"
                          disabled={isSaving}
                        />
                      </label>

                      <label className="profile-field">
                        <span>Username</span>
                        <div className="profile-input-wrap">
                          <span className="profile-input-prefix">@</span>
                          <input
                            type="text"
                            className="profile-input profile-input-plain"
                            value={draftProfile.username}
                            onChange={(event) => handleDraftChange('username', event.target.value)}
                            placeholder="seuusername"
                            disabled={isSaving}
                          />
                        </div>
                      </label>
                    </div>

                    <label className="profile-field">
                      <span>Bio</span>
                      <textarea
                        className="profile-textarea"
                        value={draftProfile.bio}
                        onChange={(event) => handleDraftChange('bio', event.target.value)}
                        maxLength={220}
                        placeholder="Fale um pouco sobre voce."
                        disabled={isSaving}
                      />
                    </label>

                    <div className="profile-form-footer">
                      <span className="profile-counter">{draftProfile.bio.length}/220</span>

                      <div className="profile-actions">
                        <button
                          type="button"
                          className="profile-secondary-button"
                          onClick={handleCancelEditing}
                          disabled={isSaving}
                        >
                          Cancelar
                        </button>

                        <button type="submit" className="profile-save-button" disabled={isSaving}>
                          {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="profile-bio-block">
                    <span className="profile-section-label">Bio</span>
                    <p className={`profile-bio-copy${visibleBio ? '' : ' is-empty'}`}>
                      {visibleBio || 'Sem bio informada.'}
                    </p>
                  </div>
                )}

                {saveFeedback && (
                  <p className={`profile-feedback is-${saveFeedback.tone}`}>{saveFeedback.message}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
