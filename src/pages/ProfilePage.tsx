import { useEffect, useState, type ChangeEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import { uploadImage } from '../services/storageService'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [bioFeedback, setBioFeedback] = useState<string | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return

    setAvatarUrl(profile.avatar_url)
    setBio(profile.bio || '')
  }, [profile])

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
    } catch (error) {
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
                      {profile.nome_completo ? profile.nome_completo.charAt(0).toUpperCase() : 'U'}
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
                <span className="profile-eyebrow">Seu perfil</span>
                <h1>{profile.nome_completo || 'Nome nao informado'}</h1>
                <p className="profile-handle">@{profile.username || 'usuario'}</p>
                <p className="profile-summary">
                  Sua pagina mostra apenas os dados publicos do perfil. O email nao aparece aqui.
                </p>

                <div className="profile-highlights">
                  <div className="profile-highlight-card">
                    <span className="profile-highlight-label">Nome exibido</span>
                    <strong>{profile.nome_completo || 'Nao informado'}</strong>
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
          <article className="profile-detail-card">
            <span className="profile-card-kicker">Identidade publica</span>
            <h2>Como seu perfil aparece</h2>

            <div className="profile-detail-list">
              <div className="profile-detail-row">
                <span>Nome completo</span>
                <strong>{profile.nome_completo || 'Nao informado'}</strong>
              </div>
              <div className="profile-detail-row">
                <span>Username</span>
                <strong>@{profile.username || 'usuario'}</strong>
              </div>
              <div className="profile-detail-row">
                <span>Bio atual</span>
                <strong>{bio || 'Sem bio ainda'}</strong>
              </div>
            </div>
          </article>

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
