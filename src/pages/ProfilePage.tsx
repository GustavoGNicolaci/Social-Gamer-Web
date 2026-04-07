import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase-client';
import { AvatarUpload } from '../components/AvatarUpload';

/**
 * Página de perfil do usuário
 */
export function ProfilePage() {
  const { user, profile } = useAuth();

  console.log('ProfilePage render:', { user, profile });

  if (!user || !profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <h1>Carregando perfil...</h1>
        </div>
      </div>
    );
  }

  const handleAvatarUploadSuccess = async (url: string) => {
    if (!user) return;

    // Atualizar o perfil no banco de dados
    const { error } = await supabase
      .from('usuarios')
      .update({
        avatar_url: url,
      })
      .eq('id', user.id);

    if (!error) {
      alert('Avatar atualizado com sucesso!');
      // Recarregar a página ou atualizar o contexto
      window.location.reload();
    } else {
      alert('Erro ao atualizar perfil');
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <h1>Perfil</h1>
        <div className="profile-section">
          <div className="profile-avatar">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder-large">{profile.nome_completo ? profile.nome_completo.charAt(0).toUpperCase() : 'U'}</div>
            )}
            <AvatarUpload
              userId={user.id}
              currentAvatarPath={profile.avatar_url || undefined}
              onUploadSuccess={handleAvatarUploadSuccess}
            />
          </div>
          <div className="profile-info">
            <h2>{profile.nome_completo || 'Nome não informado'}</h2>
            {profile.username && <p>@{profile.username}</p>}
            <p>Entrou em {profile.data_cadastro ? new Date(profile.data_cadastro).toLocaleDateString('pt-BR') : 'Data não informada'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
