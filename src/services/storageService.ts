import { supabase } from '../supabase-client'
import { logClientError } from '../utils/clientLogging'
import { isSupabasePermissionError } from '../utils/supabaseErrors'

const PUBLIC_UPLOADS_BUCKET = 'user-uploads'
const COMMUNITY_POST_MEDIA_BUCKET = 'community-post-media'
const AVATAR_FOLDER = 'avatars'
const COMMUNITY_BANNER_FOLDER = 'communities'
const COMMUNITY_POST_FOLDER = 'community-posts'
const DEFAULT_IMAGE_FOLDER = 'images'
const MAX_AVATAR_SIZE_MB = 5
const COMMUNITY_POST_MEDIA_REFERENCE_PREFIX = `${COMMUNITY_POST_MEDIA_BUCKET}/`
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

export interface StorageUploadResult {
  path: string
  publicUrl: string
  url: string
}

export interface StorageCleanupResult {
  ok: boolean
  deletedPaths: string[]
  failedPaths: string[]
}

interface StorageListEntry {
  name: string
  id?: string | null
}

interface UploadValidatedFileOptions {
  bucketName?: string
  includePublicUrl?: boolean
  includeBucketInPath?: boolean
  context?: string
}

interface StorageLocation {
  bucketName: string
  objectPath: string
  referencePath: string
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

function getFileExtension(fileName: string) {
  const extensionIndex = fileName.trim().toLowerCase().lastIndexOf('.')
  return extensionIndex > 0 ? fileName.trim().toLowerCase().slice(extensionIndex) : ''
}

function validateImageUpload(file: File, maxSizeMB: number, context: string) {
  const fileType = file.type.trim().toLowerCase()
  const fileExtension = getFileExtension(file.name)

  if (!ALLOWED_IMAGE_MIME_TYPES.has(fileType) || !ALLOWED_IMAGE_EXTENSIONS.has(fileExtension)) {
    logClientError(context, null, {
      reason: 'unsupported_image_type',
      mimeType: fileType || 'unknown',
      extension: fileExtension || 'none',
    })
    return false
  }

  const sizeInMB = file.size / (1024 * 1024)
  if (sizeInMB > maxSizeMB) {
    logClientError(context, null, {
      reason: 'file_too_large',
      maxSizeMB,
      sizeMB: Number(sizeInMB.toFixed(2)),
    })
    return false
  }

  return true
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

function stripBucketPrefix(filePath: string, bucketName: string) {
  const prefix = `${bucketName}/`
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}

function isCommunityPostObjectPath(filePath: string) {
  const [ownerId, folderName, fileName] = filePath.split('/')
  return Boolean(ownerId && folderName === COMMUNITY_POST_FOLDER && fileName)
}

function getCommunityPostMediaObjectPath(filePath: string | null | undefined) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  if (!safePath.startsWith(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX)) {
    return null
  }

  const objectPath = safePath.slice(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX.length)
  return isCommunityPostObjectPath(objectPath) ? objectPath : null
}

function getLegacyCommunityPostPublicPath(filePath: string | null | undefined) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null

  const publicPath = stripBucketPrefix(safePath, PUBLIC_UPLOADS_BUCKET)
  return isCommunityPostObjectPath(publicPath) ? publicPath : null
}

function getStorageLocation(filePath: string | null | undefined): StorageLocation | null {
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

function getUniqueStorageLocations(filePaths: Array<string | null | undefined>) {
  const locationsByKey = new Map<string, StorageLocation>()

  filePaths.forEach(filePath => {
    const location = getStorageLocation(filePath)
    if (!location) return

    locationsByKey.set(`${location.bucketName}/${location.objectPath}`, location)
  })

  return Array.from(locationsByKey.values())
}

export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(PUBLIC_UPLOADS_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

export function resolvePublicFileUrl(filePath: string | null | undefined) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null
  if (safePath.startsWith(COMMUNITY_POST_MEDIA_REFERENCE_PREFIX)) return null

  return getPublicUrl(stripBucketPrefix(safePath, PUBLIC_UPLOADS_BUCKET))
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
    const publicPrefix = `/storage/v1/object/public/${PUBLIC_UPLOADS_BUCKET}/`
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

async function listAllFilePathsByPrefix(prefix: string) {
  const normalizedPrefix = normalizeStoragePath(prefix)

  if (!normalizedPrefix) {
    return {
      data: [] as string[],
      error: null,
    }
  }

  const pendingPrefixes = [normalizedPrefix]
  const discoveredPaths: string[] = []

  while (pendingPrefixes.length > 0) {
    const currentPrefix = pendingPrefixes.shift()

    if (!currentPrefix) {
      continue
    }

    const { data, error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).list(currentPrefix, {
      limit: 100,
      offset: 0,
    })

    if (error) {
      logClientError('storage.listAllFilePathsByPrefix', error)
      return {
        data: discoveredPaths,
        error,
      }
    }

    for (const item of (data || []) as StorageListEntry[]) {
      const nestedPath = `${currentPrefix}/${item.name}`

      if (item.id) {
        discoveredPaths.push(nestedPath)
        continue
      }

      pendingPrefixes.push(nestedPath)
    }
  }

  return {
    data: discoveredPaths,
    error: null,
  }
}

async function uploadValidatedFile(
  file: File,
  filePath: string,
  options: UploadValidatedFileOptions = {}
): Promise<StorageUploadResult | null> {
  const bucketName = options.bucketName || PUBLIC_UPLOADS_BUCKET
  const includePublicUrl = options.includePublicUrl ?? true
  const context = options.context || 'storage.uploadValidatedFile'

  try {
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) {
      logClientError(context, error)
      return null
    }

    const publicUrl = includePublicUrl ? getPublicUrl(data.path) : ''
    const storedPath = options.includeBucketInPath ? `${bucketName}/${data.path}` : data.path

    return {
      path: storedPath,
      publicUrl,
      url: publicUrl,
    }
  } catch (error) {
    logClientError(`${context}.exception`, error)
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
  const result = await deleteStorageFiles([filePath])
  return result.ok && result.deletedPaths.length > 0
}

export async function deleteStorageFiles(
  filePaths: Array<string | null | undefined>
): Promise<StorageCleanupResult> {
  const locations = getUniqueStorageLocations(filePaths)

  if (locations.length === 0) {
    return {
      ok: true,
      deletedPaths: [],
      failedPaths: [],
    }
  }

  const deletedPaths: string[] = []
  const failedPaths: string[] = []
  const locationsByBucket = new Map<string, StorageLocation[]>()

  locations.forEach(location => {
    const currentLocations = locationsByBucket.get(location.bucketName) || []
    locationsByBucket.set(location.bucketName, [...currentLocations, location])
  })

  for (const [bucketName, bucketLocations] of locationsByBucket) {
    for (let startIndex = 0; startIndex < bucketLocations.length; startIndex += 1000) {
      const currentChunk = bucketLocations.slice(startIndex, startIndex + 1000)

      try {
        const { error } = await supabase.storage
          .from(bucketName)
          .remove(currentChunk.map(location => location.objectPath))

        if (error) {
          logClientError('storage.deleteStorageFiles', error, {
            bucketName,
            paths: currentChunk.map(location => location.referencePath).join(','),
          })
          failedPaths.push(...currentChunk.map(location => location.referencePath))
          continue
        }

        deletedPaths.push(...currentChunk.map(location => location.referencePath))
      } catch (error) {
        logClientError('storage.deleteStorageFiles.exception', error, {
          bucketName,
          paths: currentChunk.map(location => location.referencePath).join(','),
        })
        failedPaths.push(...currentChunk.map(location => location.referencePath))
      }
    }
  }

  return {
    ok: failedPaths.length === 0,
    deletedPaths,
    failedPaths,
  }
}

export async function listUserFiles(
  userId: string,
  folder = DEFAULT_IMAGE_FOLDER
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).list(`${userId}/${folder}`, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })

    if (error) {
      logClientError('storage.listUserFiles', error)
      return null
    }

    return data.map(file => file.name)
  } catch (error) {
    logClientError('storage.listUserFiles.exception', error)
    return null
  }
}

export async function deleteAllUserFiles(userId: string): Promise<StorageCleanupResult> {
  const listResult = await listAllFilePathsByPrefix(userId)

  if (listResult.error) {
    return {
      ok: false,
      deletedPaths: listResult.data,
      failedPaths: [],
    }
  }

  if (listResult.data.length === 0) {
    return {
      ok: true,
      deletedPaths: [],
      failedPaths: [],
    }
  }

  const deletedPaths: string[] = []
  const failedPaths: string[] = []

  for (let startIndex = 0; startIndex < listResult.data.length; startIndex += 1000) {
    const currentChunk = listResult.data.slice(startIndex, startIndex + 1000)

    try {
      const { error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).remove(currentChunk)

      if (error) {
        logClientError('storage.deleteAllUserFiles', error)
        return {
          ok: false,
          deletedPaths,
          failedPaths: currentChunk,
        }
      }

      deletedPaths.push(...currentChunk)
    } catch (error) {
      logClientError('storage.deleteAllUserFiles.exception', error)
      return {
        ok: false,
        deletedPaths,
        failedPaths: currentChunk,
      }
    }
  }

  return {
    ok: true,
    deletedPaths,
    failedPaths,
  }
}

export async function uploadImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!validateImageUpload(file, maxSizeMB, 'storage.uploadImage.validate')) {
    return null
  }

  return await uploadFile(file, userId)
}

export async function uploadAvatarImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!validateImageUpload(file, maxSizeMB, 'storage.uploadAvatarImage.validate')) {
    return null
  }

  const avatarPath = buildStoragePath(userId, AVATAR_FOLDER, file.name)
  return await uploadValidatedFile(file, avatarPath)
}

export async function uploadCommunityBannerImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!validateImageUpload(file, maxSizeMB, 'storage.uploadCommunityBannerImage.validate')) {
    return null
  }

  return await uploadFile(file, userId, COMMUNITY_BANNER_FOLDER)
}

export async function uploadCommunityPostImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_AVATAR_SIZE_MB
): Promise<StorageUploadResult | null> {
  if (!validateImageUpload(file, maxSizeMB, 'storage.uploadCommunityPostImage.validate')) {
    return null
  }

  const filePath = buildStoragePath(userId, COMMUNITY_POST_FOLDER, file.name)
  return await uploadValidatedFile(file, filePath, {
    bucketName: COMMUNITY_POST_MEDIA_BUCKET,
    includePublicUrl: false,
    includeBucketInPath: true,
    context: 'storage.uploadCommunityPostImage.upload',
  })
}

export async function resolveCommunityPostImageUrl(
  filePath: string | null | undefined
): Promise<string | null> {
  const privateObjectPath = getCommunityPostMediaObjectPath(filePath)

  if (privateObjectPath) {
    try {
      const { data, error } = await supabase.storage
        .from(COMMUNITY_POST_MEDIA_BUCKET)
        .createSignedUrl(privateObjectPath, SIGNED_URL_EXPIRES_IN_SECONDS)

      if (error) {
        if (!isSupabasePermissionError(error)) {
          logClientError('storage.resolveCommunityPostImageUrl', error)
        }
        return null
      }

      return data.signedUrl || null
    } catch (error) {
      logClientError('storage.resolveCommunityPostImageUrl.exception', error)
      return null
    }
  }

  const legacyPublicPath = getLegacyCommunityPostPublicPath(filePath)
  return legacyPublicPath ? getPublicUrl(legacyPublicPath) : null
}

export async function resolveCommunityPostImageUrls(
  filePaths: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const imageUrlsByPath = new Map<string, string>()
  const uniquePaths = Array.from(
    new Set(filePaths.filter((path): path is string => Boolean(normalizeStoragePath(path))))
  )

  await Promise.all(
    uniquePaths.map(async filePath => {
      const imageUrl = await resolveCommunityPostImageUrl(filePath)
      if (imageUrl) imageUrlsByPath.set(filePath, imageUrl)
    })
  )

  return imageUrlsByPath
}

export async function downloadFile(filePath: string): Promise<Blob | null> {
  const safePath = normalizeStoragePath(filePath)

  if (!safePath) {
    return null
  }

  try {
    const { data, error } = await supabase.storage.from(PUBLIC_UPLOADS_BUCKET).download(safePath)

    if (error) {
      logClientError('storage.downloadFile', error)
      return null
    }

    return data
  } catch (error) {
    logClientError('storage.downloadFile.exception', error)
    return null
  }
}
