import React, { useState } from 'react';
import { uploadImage, getPublicUrl, deleteFile } from '../services/storageService';
import './AvatarUpload.css';

interface AvatarUploadProps {
  userId: string;
  currentAvatarPath?: string;
  onUploadSuccess: (url: string, path: string) => void;
  showPreview?: boolean;
}

export function AvatarUpload({
  userId,
  currentAvatarPath,
  onUploadSuccess,
  showPreview = true,
}: AvatarUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    try {
      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Deletar avatar anterior se existir
      if (currentAvatarPath) {
        await deleteFile(currentAvatarPath);
      }

      // Upload do novo avatar
      const result = await uploadImage(file, userId);

      if (result) {
        onUploadSuccess(result.url, result.path);
        setError(null);
      } else {
        setError('Erro ao fazer upload da imagem');
        setPreview(null);
      }
    } catch (err) {
      setError('Erro ao processar arquivo');
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="avatar-upload">
      {showPreview && (
        <div className="avatar-preview">
          {preview ? (
            <img src={preview} alt="Preview" />
          ) : currentAvatarPath ? (
            <img src={getPublicUrl(currentAvatarPath)} alt="Avatar" />
          ) : (
            <div className="placeholder">Sem foto de perfil</div>
          )}
        </div>
      )}

      <label htmlFor="avatar-input" className="upload-button">
        {isLoading ? 'Enviando...' : 'Escolher foto'}
        <input
          id="avatar-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
      </label>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
