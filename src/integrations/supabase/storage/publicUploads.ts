import { logClientError } from '../../../utils/clientLogging'
import { supabase } from '../client'
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  AVATAR_FOLDER,
  COMMUNITY_BANNER_FOLDER,
  COMMUNITY_POST_MEDIA_BUCKET,
  DEFAULT_IMAGE_FOLDER,
  MAX_IMAGE_SIZE_MB,
  PUBLIC_UPLOADS_BUCKET,
  STORAGE_LIST_PAGE_SIZE,
  buildStoragePath,
  getFileExtension,
  normalizeStoragePath,
  stripBucketPrefix,
} from './paths'
import type {
  StorageUploadResult,
  UploadValidatedFileOptions,
} from './types'

export function validateImageUpload(
  file: File,
  maxSizeMB: number,
  context: string,
) {
  const fileType = file.type.trim().toLowerCase()
  const fileExtension = getFileExtension(file.name)

  if (
    !ALLOWED_IMAGE_MIME_TYPES.has(fileType)
    || !ALLOWED_IMAGE_EXTENSIONS.has(fileExtension)
  ) {
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

export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(PUBLIC_UPLOADS_BUCKET)
    .getPublicUrl(filePath)
  return data.publicUrl
}

export function resolvePublicFileUrl(
  filePath: string | null | undefined,
) {
  const safePath = normalizeStoragePath(filePath)
  if (!safePath) return null
  if (safePath.startsWith(`${COMMUNITY_POST_MEDIA_BUCKET}/`)) return null

  return getPublicUrl(stripBucketPrefix(safePath, PUBLIC_UPLOADS_BUCKET))
}

export function sanitizeAvatarPath(
  avatarPath: string | null | undefined,
) {
  const safePath = normalizeStoragePath(avatarPath)

  if (!safePath) return null

  const [ownerId, folderName] = safePath.split('/')
  if (!ownerId || !folderName || folderName !== AVATAR_FOLDER) return null

  return safePath
}

export function resolveAvatarPublicUrl(
  avatarPath: string | null | undefined,
) {
  const safeAvatarPath = sanitizeAvatarPath(avatarPath)
  if (!safeAvatarPath) return null

  return getPublicUrl(safeAvatarPath)
}

export function extractAvatarPathFromPublicUrl(
  avatarUrl: string | null | undefined,
) {
  const normalizedUrl = avatarUrl?.trim()

  if (!normalizedUrl || /^(null|undefined)$/i.test(normalizedUrl)) return null

  try {
    const parsedUrl = new URL(normalizedUrl)
    const publicPrefix = `/storage/v1/object/public/${PUBLIC_UPLOADS_BUCKET}/`
    const prefixIndex = parsedUrl.pathname.indexOf(publicPrefix)

    if (prefixIndex < 0) return null

    const avatarPath = decodeURIComponent(
      parsedUrl.pathname.slice(prefixIndex + publicPrefix.length),
    )
    return sanitizeAvatarPath(avatarPath)
  } catch {
    return null
  }
}

export async function uploadValidatedFile(
  file: File,
  filePath: string,
  options: UploadValidatedFileOptions = {},
): Promise<StorageUploadResult | null> {
  const bucketName = options.bucketName || PUBLIC_UPLOADS_BUCKET
  const includePublicUrl = options.includePublicUrl ?? true
  const context = options.context || 'storage.uploadValidatedFile'

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      logClientError(context, error)
      return null
    }

    const publicUrl = includePublicUrl ? getPublicUrl(data.path) : ''
    const storedPath = options.includeBucketInPath
      ? `${bucketName}/${data.path}`
      : data.path

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
  folder = DEFAULT_IMAGE_FOLDER,
): Promise<StorageUploadResult | null> {
  const filePath = buildStoragePath(userId, folder, file.name)
  return await uploadValidatedFile(file, filePath)
}

export async function listUserFiles(
  userId: string,
  folder = DEFAULT_IMAGE_FOLDER,
): Promise<string[] | null> {
  try {
    const fileNames: string[] = []
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage
        .from(PUBLIC_UPLOADS_BUCKET)
        .list(`${userId}/${folder}`, {
          limit: STORAGE_LIST_PAGE_SIZE,
          offset,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        logClientError('storage.listUserFiles', error)
        return null
      }

      const entries = data || []
      fileNames.push(...entries.map((file) => file.name))

      if (entries.length < STORAGE_LIST_PAGE_SIZE) {
        break
      }

      offset += STORAGE_LIST_PAGE_SIZE
    }

    return fileNames
  } catch (error) {
    logClientError('storage.listUserFiles.exception', error)
    return null
  }
}

export async function uploadImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_IMAGE_SIZE_MB,
): Promise<StorageUploadResult | null> {
  if (!validateImageUpload(file, maxSizeMB, 'storage.uploadImage.validate')) {
    return null
  }

  return await uploadFile(file, userId)
}

export async function uploadAvatarImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_IMAGE_SIZE_MB,
): Promise<StorageUploadResult | null> {
  if (
    !validateImageUpload(
      file,
      maxSizeMB,
      'storage.uploadAvatarImage.validate',
    )
  ) {
    return null
  }

  const avatarPath = buildStoragePath(userId, AVATAR_FOLDER, file.name)
  return await uploadValidatedFile(file, avatarPath)
}

export async function uploadCommunityBannerImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_IMAGE_SIZE_MB,
): Promise<StorageUploadResult | null> {
  if (
    !validateImageUpload(
      file,
      maxSizeMB,
      'storage.uploadCommunityBannerImage.validate',
    )
  ) {
    return null
  }

  return await uploadFile(file, userId, COMMUNITY_BANNER_FOLDER)
}

export async function downloadFile(filePath: string): Promise<Blob | null> {
  const safePath = normalizeStoragePath(filePath)

  if (!safePath) {
    return null
  }

  try {
    const { data, error } = await supabase.storage
      .from(PUBLIC_UPLOADS_BUCKET)
      .download(safePath)

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
