import { supabase } from '../supabase-client'

const BUCKET_NAME = 'user-uploads'
const AVATAR_FOLDER = 'avatars'
const DEFAULT_IMAGE_FOLDER = 'images'
const MAX_AVATAR_SIZE_MB = 5

export interface StorageUploadResult {
  path: string
  publicUrl: string
  url: string
}

function sanitizeFileName(fileName: string) {
  const trimmedFileName = fileName.trim().toLowerCase()
  const extensionIndex = trimmedFileName.lastIndexOf('.')
  const baseName =
    extensionIndex > 0 ? trimmedFileName.slice(0, extensionIndex) : trimmedFileName
  const extension = extensionIndex > 0 ? trimmedFileName.slice(extensionIndex) : ''
  const normalizedBaseName = baseName
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${normalizedBaseName || 'arquivo'}${extension}`
}

function normalizeStoragePath(filePath: string | null | undefined) {
  const normalizedPath = filePath?.trim()

  if (!normalizedPath) return null
  if (/^(null|undefined)$/i.test(normalizedPath)) return null
  if (/^([a-z]+:)?\/\//i.test(normalizedPath)) return null
  if (normalizedPath.includes('..') || normalizedPath.includes('\\')) return null
  if (normalizedPath.startsWith('/')) return null

  return normalizedPath
}

export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
  return data.publicUrl
}

export function resolvePublicFileUrl(filePath: string | null | undefined) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  return getPublicUrl(safePath)
}

export function sanitizeAvatarPath(avatarPath: string | null | undefined) {
  const safePath = normalizeStoragePath(avatarPath)

  if (!safePath) return null

  const [ownerId, folderName] = safePath.split('/')
  if (!ownerId || !folderName || folderName !== AVATAR_FOLDER) return null

  return safePath
}

export function resolveAvatarPublicUrl(avatarPath: string | null | undefined) {
  const safeAvatarPath = sanitizeAvatarPath(avatarPath)
  if (!safeAvatarPath) return null

  return getPublicUrl(safeAvatarPath)
}

export function extractAvatarPathFromPublicUrl(avatarUrl: string | null | undefined) {
  const normalizedUrl = avatarUrl?.trim()

  if (!normalizedUrl || /^(null|undefined)$/i.test(normalizedUrl)) return null

  try {
    const parsedUrl = new URL(normalizedUrl)
    const publicPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`
    const prefixIndex = parsedUrl.pathname.indexOf(publicPrefix)

    if (prefixIndex < 0) return null

    const avatarPath = decodeURIComponent(parsedUrl.pathname.slice(prefixIndex + publicPrefix.length))
    return sanitizeAvatarPath(avatarPath)
  } catch {
    return null
  }
}

function buildStoragePath(userId: string, folder: string, fileName: string) {
  return `${userId}/${folder}/${Date.now()}-${sanitizeFileName(fileName)}`
}

async function uploadValidatedFile(
  file: File,
  filePath: string
): Promise<StorageUploadResult | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const publicUrl = getPublicUrl(data.path)

    return {
      path: data.path,
      publicUrl,
      url: publicUrl,
    }
  } catch (error) {
    console.error('Upload exception:', error)
    return null
  }
}

export async function uploadFile(
  file: File,
  userId: string,
  folder = DEFAULT_IMAGE_FOLDER
): Promise<StorageUploadResult | null> {
  const filePath = buildStoragePath(userId, folder, file.name)
  return await uploadValidatedFile(file, filePath)
}

export async function deleteFile(filePath: string): Promise<boolean> {
  const safePath = normalizeStoragePath(filePath)

  if (!safePath) {
    return false
  }

  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([safePath])

    if (error) {
      console.error('Delete error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Delete exception:', error)
    return false
  }
}

export async function listUserFiles(
  userId: string,
  folder = DEFAULT_IMAGE_FOLDER
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(`${userId}/${folder}`, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })

    if (error) {
      console.error('List error:', error)
      return null
    }

    return data.map(file => file.name)
  } catch (error) {
    console.error('List exception:', error)
    return null
  }
}

export async function uploadImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!file.type.startsWith('image/')) {
    console.error('File is not an image')
    return null
  }

  const sizeInMB = file.size / (1024 * 1024)
  if (sizeInMB > maxSizeMB) {
    console.error(`File size exceeds ${maxSizeMB}MB limit`)
    return null
  }

  return await uploadFile(file, userId)
}

export async function uploadAvatarImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!file.type.startsWith('image/')) {
    console.error('Avatar file is not an image')
    return null
  }

  const sizeInMB = file.size / (1024 * 1024)
  if (sizeInMB > maxSizeMB) {
    console.error(`Avatar file size exceeds ${maxSizeMB}MB limit`)
    return null
  }

  const avatarPath = buildStoragePath(userId, AVATAR_FOLDER, file.name)
  return await uploadValidatedFile(file, avatarPath)
}

export async function downloadFile(filePath: string): Promise<Blob | null> {
  const safePath = normalizeStoragePath(filePath)

  if (!safePath) {
    return null
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(safePath)

    if (error) {
      console.error('Download error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Download exception:', error)
    return null
  }
}
