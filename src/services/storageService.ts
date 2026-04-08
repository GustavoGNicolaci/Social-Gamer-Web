import { supabase } from '../supabase-client';

const BUCKET_NAME = 'user-uploads';

/**
 * Upload de arquivo para o bucket do usuário
 */
export async function uploadFile(
  file: File,
  userId: string,
  folder?: string
): Promise<{ path: string; url: string } | null> {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = folder ? `${userId}/${folder}/${fileName}` : `${userId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const url = getPublicUrl(filePath);
    return { path: data.path, url };
  } catch (error) {
    console.error('Upload exception:', error);
    return null;
  }
}

/**
 * Obter URL pública de um arquivo
 */
export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Deletar arquivo do bucket
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete exception:', error);
    return false;
  }
}

/**
 * Listar arquivos do usuário
 */
export async function listUserFiles(
  userId: string,
  folder?: string
): Promise<string[] | null> {
  try {
    const path = folder ? `${userId}/${folder}` : userId;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('List error:', error);
      return null;
    }

    return data.map(file => file.name);
  } catch (error) {
    console.error('List exception:', error);
    return null;
  }
}

/**
 * Upload de imagem com validação
 */
export async function uploadImage(
  file: File,
  userId: string,
  maxSizeMB: number = 5
): Promise<{ path: string; url: string } | null> {
  // Validar tipo
  if (!file.type.startsWith('image/')) {
    console.error('File is not an image');
    return null;
  }

  // Validar tamanho
  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > maxSizeMB) {
    console.error(`File size exceeds ${maxSizeMB}MB limit`);
    return null;
  }

  return uploadFile(file, userId, 'images');
}

/**
 * Download/obter arquivo
 */
export async function downloadFile(filePath: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      console.error('Download error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Download exception:', error);
    return null;
  }
}
