import type { StorageLocation } from './types'

export const PUBLIC_UPLOADS_BUCKET = 'user-uploads'
export const COMMUNITY_POST_MEDIA_BUCKET = 'community-post-media'
export const AVATAR_FOLDER = 'avatars'
export const COMMUNITY_BANNER_FOLDER = 'communities'
export const COMMUNITY_POST_FOLDER = 'community-posts'
export const DEFAULT_IMAGE_FOLDER = 'images'
export const MAX_IMAGE_SIZE_MB = 5
export const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60
export const STORAGE_LIST_PAGE_SIZE = 100
export const SIGNED_URL_BATCH_SIZE = 100
export const STORAGE_REMOVE_BATCH_SIZE = 1000

const COMMUNITY_POST_MEDIA_REFERENCE_PREFIX = `${COMMUNITY_POST_MEDIA_BUCKET}/`

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
])

export function sanitizeFileName(fileName: string) {
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

export function getFileExtension(fileName: string) {
  const extensionIndex = fileName.trim().toLowerCase().lastIndexOf('.')
  return extensionIndex > 0 ? fileName.trim().toLowerCase().slice(extensionIndex) : ''
}

export function normalizeStoragePath(filePath: string | null | undefined) {
  const normalizedPath = filePath?.trim()

  if (!normalizedPath) return null
  if (/^(null|undefined)$/i.test(normalizedPath)) return null
  if (/^([a-z]+:)?\/\//i.test(normalizedPath)) return null
  if (normalizedPath.includes('..') || normalizedPath.includes('\\')) return null
  if (normalizedPath.startsWith('/')) return null

  return normalizedPath
}

export function stripBucketPrefix(filePath: string, bucketName: string) {
  const prefix = `${bucketName}/`
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}

function isCommunityPostObjectPath(filePath: string) {
  const [ownerId, folderName, fileName] = filePath.split('/')
  return Boolean(ownerId && folderName === COMMUNITY_POST_FOLDER && fileName)
}

export function getCommunityPostMediaObjectPath(
  filePath: string | null | undefined,
) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  if (!safePath.startsWith(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX)) {
    return null
  }

  const objectPath = safePath.slice(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX.length)
  return isCommunityPostObjectPath(objectPath) ? objectPath : null
}

export function getLegacyCommunityPostPublicPath(
  filePath: string | null | undefined,
) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  const publicPath = stripBucketPrefix(safePath, PUBLIC_UPLOADS_BUCKET)
  return isCommunityPostObjectPath(publicPath) ? publicPath : null
}

function getStorageLocation(
  filePath: string | null | undefined,
): StorageLocation | null {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  if (safePath.startsWith(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX)) {
    const objectPath = safePath.slice(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX.length)
    return objectPath
      ? {
          bucketName: COMMUNITY_POST_MEDIA_BUCKET,
          objectPath,
          referencePath: safePath,
        }
      : null
  }

  const publicPath = stripBucketPrefix(safePath, PUBLIC_UPLOADS_BUCKET)
  return publicPath
    ? {
        bucketName: PUBLIC_UPLOADS_BUCKET,
        objectPath: publicPath,
        referencePath: safePath,
      }
    : null
}

export function getUniqueStorageLocations(
  filePaths: Array<string | null | undefined>,
) {
  const locationsByKey = new Map<string, StorageLocation>()

  filePaths.forEach((filePath) => {
    const location = getStorageLocation(filePath)
    if (!location) return

    locationsByKey.set(`${location.bucketName}/${location.objectPath}`, location)
  })

  return Array.from(locationsByKey.values())
}

export function buildStoragePath(
  userId: string,
  folder: string,
  fileName: string,
) {
  return `${userId}/${folder}/${Date.now()}-${sanitizeFileName(fileName)}`
}
