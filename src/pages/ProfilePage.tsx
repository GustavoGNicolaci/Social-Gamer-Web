import { useEffect, useState, type ChangeEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import { uploadImage } from '../services/storageService'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [isSavingInfo, setIsSavingInfo] = useState(false)
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [infoFeedback, setInfoFeedback] = useState<string | null>(null)
  const [bioFeedback, setBioFeedback] = useState<string | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return

    setAvatarUrl(profile.avatar_url)
    setBio(profile.bio || '')

    if (!isEditingInfo) {
      setDisplayName(profile.nome_completo || '')
      setUsername(profile.username || '')
    }
  }, [profile, isEditingInfo])

  if (!user || !profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-loading-card">
            <span className="profile-loading-badge">Perfil</span>
            <h1>Carregando seu espaco</h1>
            <p>Estamos preparando suas informacoes e avatar.</p>
          </div>
        </div>
      </div>
    )
  }

  const joinedDate = profile.data_cadastro
    ? new Date(profile.data_cadastro).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data nao informada'

  const resetProfileInfoDraft = () => {
    setDisplayName(profile.nome_completo || '')
    setUsername(profile.username || '')
  }

  const handleStartInfoEdit = () => {
    resetProfileInfoDraft()
    setInfoFeedback(null)
    setIsEditingInfo(true)
  }

  const handleCancelInfoEdit = () => {
    resetProfileInfoDraft()
    setInfoFeedback(null)
    setIsEditingInfo(false)
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAvatarFeedback(null)
    setIsUploadingAvatar(true)

    try {
      const result = await uploadImage(file, user.id)
      if (!result) {
        setAvatarFeedback('Nao foi possivel enviar a nova foto.')
        return
      }

      const { error } = await supabase
        .from('usuarios')
        .update({
          avatar_url: result.url,
        })
        .eq('id', user.id)

      if (error) {
        setAvatarFeedback('Nao foi possivel atualizar a foto no perfil.')
        return
      }

      setAvatarUrl(result.url)
      await refreshProfile()
      setAvatarFeedback('Foto de perfil atualizada com sucesso.')
    } catch {
      setAvatarFeedback('Nao foi possivel atualizar a foto agora.')
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSaveBio = async () => {
    setBioFeedback(null)
    setIsSavingBio(true)

    const trimmedBio = bio.trim()
    const { error } = await supabase
      .from('usuarios')
      .update({
        bio: trimmedBio || null,
      })
      .eq('id', user.id)

    if (error) {
      setBioFeedback('Nao foi possivel salvar sua bio.')
      setIsSavingBio(false)
      return
    }

    setBio(trimmedBio)
    await refreshProfile()
    setBioFeedback('Bio salva com sucesso.')
    setIsSavingBio(false)
  }

  const handleSaveProfileInfo = async () => {
    const trimmedName = displayName.trim()
    const trimmedUsername = username.trim()

    if (!trimmedName || !trimmedUsername) {
      setInfoFeedback('Nome exibido e username sao obrigatorios.')
      return
    }

    const currentName = profile.nome_completo?.trim() || ''
    const currentUsername = profile.username?.trim() || ''

    if (trimmedName === currentName && trimmedUsername === currentUsername) {
      setInfoFeedback(null)
      setIsEditingInfo(false)
      return
    }

    setInfoFeedback(null)
    setIsSavingInfo(true)

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome_completo: trimmedName,
          username: trimmedUsername,
        })
        .eq('id', user.id)

      if (error) {
        const duplicateUsername =
          error.code === '23505' ||
          error.details?.includes('Key (username)') ||
          error.message.toLowerCase().includes('duplicate')

        setInfoFeedback(
          duplicateUsername
            ? 'Esse username ja esta em uso. Tente outro.'
            : 'Nao foi possivel atualizar seus dados agora.'
        )
        return
      }

      setDisplayName(trimmedName)
      setUsername(trimmedUsername)
      await refreshProfile()
      setInfoFeedback('Informacoes do perfil atualizadas com sucesso.')
      setIsEditingInfo(false)
    } catch {
      setInfoFeedback('Nao foi possivel atualizar seus dados agora.')
    } finally {
      setIsSavingInfo(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-content profile-page">
        <section className="profile-hero">
          <div className="profile-hero-glow profile-hero-glow-left"></div>
          <div className="profile-hero-glow profile-hero-glow-right"></div>

          <div className="profile-hero-main profile-hero-main-single">
            <div className="profile-identity-card">
              <div className="profile-avatar-column">
                <label
                  htmlFor="profile-avatar-input"
                  className={`profile-avatar-trigger${isUploadingAvatar ? ' is-uploading' : ''}`}
                  title="Clique para trocar a foto"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="avatar-img profile-avatar-large" />
                  ) : (
                    <div className="avatar-placeholder-large profile-avatar-large">
                      {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
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

                <div className="profile-status-pill">Conta ativa</div>
                {avatarFeedback && <p className="profile-inline-feedback">{avatarFeedback}</p>}
              </div>

              <div className="profile-info-column">
                <div className="profile-info-header">
                  <span className="profile-eyebrow">Seu perfil</span>
                  <button
                    type="button"
                    className={`profile-edit-button${isEditingInfo ? ' is-active' : ''}`}
                    onClick={isEditingInfo ? handleCancelInfoEdit : handleStartInfoEdit}
                    disabled={isSavingInfo}
                    aria-label={
                      isEditingInfo
                        ? 'Cancelar edicao das informacoes do perfil'
                        : 'Editar informacoes do perfil'
                    }
                    aria-pressed={isEditingInfo}
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
                    <span>{isEditingInfo ? 'Cancelar' : 'Editar'}</span>
                  </button>
                </div>

                {isEditingInfo ? (
                  <>
                    <form
                      className="profile-info-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleSaveProfileInfo()
                      }}
                    >
                      <label className="profile-inline-field">
                        <span>Nome exibido</span>
                        <input
                          type="text"
                          className="profile-inline-input"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Como seu nome aparece no perfil"
                          disabled={isSavingInfo}
                        />
                      </label>

                      <label className="profile-inline-field">
                        <span>Username</span>
                        <div className="profile-inline-input-wrap">
                          <span className="profile-inline-input-prefix">@</span>
                          <input
                            type="text"
                            className="profile-inline-input profile-inline-input-plain"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="seuusername"
                            disabled={isSavingInfo}
                          />
                        </div>
                      </label>

                      <p className="profile-summary">
                        Atualize os dados publicos exibidos no seu perfil. O email continua privado.
                      </p>

                      <div className="profile-info-actions">
                        <button
                          type="button"
                          className="profile-secondary-button"
                          onClick={handleCancelInfoEdit}
                          disabled={isSavingInfo}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="profile-save-button" disabled={isSavingInfo}>
                          {isSavingInfo ? 'Salvando...' : 'Salvar dados'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <h1>{displayName || 'Nome nao informado'}</h1>
                    <p className="profile-handle">@{username || 'usuario'}</p>
                    <p className="profile-summary">
                      Sua pagina mostra apenas os dados publicos do perfil. O email nao aparece aqui.
                    </p>
                  </>
                )}

                {infoFeedback && (
                  <p className="profile-inline-feedback profile-inline-feedback-left">
                    {infoFeedback}
                  </p>
                )}

                <div className="profile-highlights">
                  <div className="profile-highlight-card">
                    <span className="profile-highlight-label">Nome exibido</span>
                    <strong>{displayName || 'Nao informado'}</strong>
                  </div>
                  <div className="profile-highlight-card">
                    <span className="profile-highlight-label">Membro desde</span>
                    <strong>{joinedDate}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-details-grid">
          <article className="profile-detail-card profile-detail-card-accent">
            <span className="profile-card-kicker">Bio</span>
            <h2>Conte um pouco sobre voce</h2>
            <p>
              Escreva uma bio curta para aparecer no seu perfil e deixar sua conta mais pessoal.
            </p>

            <textarea
              className="profile-bio-input"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={220}
              placeholder="Ex.: Fa de RPGs, viciado em multiplayer competitivo e sempre procurando novos jogos."
            />

            <div className="profile-bio-footer">
              <span className="profile-bio-counter">{bio.length}/220</span>
              <button
                type="button"
                className="profile-save-button"
                onClick={handleSaveBio}
                disabled={isSavingBio}
              >
                {isSavingBio ? 'Salvando...' : 'Salvar bio'}
              </button>
            </div>

            {bioFeedback && <p className="profile-inline-feedback">{bioFeedback}</p>}
          </article>
        </section>
      </div>
    </div>
  )
}
