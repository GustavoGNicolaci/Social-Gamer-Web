import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase-client';
import { AvatarUpload } from '../components/AvatarUpload';

/**
 * Exemplo de como usar o serviço de storage em uma página
 */
export function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      // Carregar perfil do usuário
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);
      }
    };

    getUser();
  }, []);

  const handleAvatarUploadSuccess = async (url: string, path: string) => {
    if (!user) return;

    // Atualizar o perfil no banco de dados
    const { error } = await supabase
      .from('profiles')
      .update({
        avatar_url: url,
        avatar_path: path,
      })
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, avatar_url: url, avatar_path: path });
      alert('Avatar atualizado com sucesso!');
    } else {
      alert('Erro ao atualizar perfil');
    }
  };

  if (!user || !profile) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="profile-page">
      <h1>Perfil de {user.email}</h1>

      <AvatarUpload
        userId={user.id}
        currentAvatarPath={profile?.avatar_path}
        onUploadSuccess={handleAvatarUploadSuccess}
      />

      <div className="profile-info">
        <p>Email: {user.email}</p>
        {profile?.avatar_url && (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            style={{ width: '100px', height: '100px', borderRadius: '50%' }}
          />
        )}
      </div>
    </div>
  );
}
