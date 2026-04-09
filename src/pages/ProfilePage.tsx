import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase-client'
import { AvatarUpload } from '../components/AvatarUpload'

export function ProfilePage() {
  const { user, profile } = useAuth()

  console.log('ProfilePage render:', { user, profile })

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

  const handleAvatarUploadSuccess = async (url: string) => {
    if (!user) return

    const { error } = await supabase
      .from('usuarios')
      .update({
        avatar_url: url,
      })
      .eq('id', user.id)

    if (!error) {
      alert('Avatar atualizado com sucesso!')
      window.location.reload()
    } else {
      alert('Erro ao atualizar perfil')
    }
  }

  return (
    <div className="page-container">
      <div className="page-content profile-page">
        <section className="profile-hero">
          <div className="profile-hero-glow profile-hero-glow-left"></div>
          <div className="profile-hero-glow profile-hero-glow-right"></div>

          <div className="profile-hero-main">
            <div className="profile-identity-card">
              <div className="profile-avatar-column">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="avatar-img profile-avatar-large" />
                ) : (
                  <div className="avatar-placeholder-large profile-avatar-large">
                    {profile.nome_completo ? profile.nome_completo.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <div className="profile-status-pill">Conta ativa</div>
              </div>

              <div className="profile-info-column">
                <span className="profile-eyebrow">Seu perfil</span>
                <h1>{profile.nome_completo || 'Nome nao informado'}</h1>
                <p className="profile-handle">@{profile.username || 'usuario'}</p>
                <p className="profile-summary">
                  Este e o espaco principal da sua conta. Aqui voce pode revisar como seu nome e
                  avatar aparecem para a comunidade.
                </p>

                <div className="profile-highlights">
                  <div className="profile-highlight-card">
                    <span className="profile-highlight-label">Email da conta</span>
                    <strong>{user.email || 'Nao informado'}</strong>
                  </div>
                  <div className="profile-highlight-card">
                    <span className="profile-highlight-label">Membro desde</span>
                    <strong>{joinedDate}</strong>
                  </div>
                </div>
              </div>
            </div>

            <aside className="profile-side-panel">
              <div className="profile-panel-card">
                <h2>Foto de perfil</h2>
                <p>Troque sua foto sem duplicar a visualizacao. A imagem atual continua destacada no topo do perfil.</p>
                <AvatarUpload
                  userId={user.id}
                  currentAvatarPath={profile.avatar_url || undefined}
                  onUploadSuccess={handleAvatarUploadSuccess}
                  showPreview={false}
                />
              </div>
            </aside>
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
                <span>Email</span>
                <strong>{user.email || 'Nao informado'}</strong>
              </div>
            </div>
          </article>

          <article className="profile-detail-card profile-detail-card-accent">
            <span className="profile-card-kicker">Dica rapida</span>
            <h2>Deixe sua conta facil de reconhecer</h2>
            <p>
              Use um nome completo legivel e um avatar marcante. Isso melhora sua presenca na
              navbar, no perfil e nas interacoes com outros jogadores.
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}
