import { logClientError } from '../../../utils/clientLogging'
import { isSupabasePermissionError } from '../../../utils/supabaseErrors'
import { supabase } from '../client'
import {
  COMMUNITY_POST_FOLDER,
  COMMUNITY_POST_MEDIA_BUCKET,
  MAX_IMAGE_SIZE_MB,
  SIGNED_URL_BATCH_SIZE,
  SIGNED_URL_EXPIRES_IN_SECONDS,
  buildStoragePath,
  getCommunityPostMediaObjectPath,
  getLegacyCommunityPostPublicPath,
  normalizeStoragePath,
} from './paths'
import {
  getPublicUrl,
  uploadValidatedFile,
  validateImageUpload,
} from './publicUploads'
import type { StorageUploadResult } from './types'

export async function uploadCommunityPostImage(
  file: File,
  userId: string,
  maxSizeMB = MAX_IMAGE_SIZE_MB,
): Promise<StorageUploadResult | null> {
  if (
    !validateImageUpload(
      file,
      maxSizeMB,
      'storage.uploadCommunityPostImage.validate',
    )
  ) {
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
  filePath: string | null | undefined,
): Promise<string | null> {
  const privateObjectPath = getCommunityPostMediaObjectPath(filePath)

  if (privateObjectPath) {
    try {
      const { data, error } = await supabase.storage
        .from(COMMUNITY_POST_MEDIA_BUCKET)
        .createSignedUrl(
          privateObjectPath,
          SIGNED_URL_EXPIRES_IN_SECONDS,
        )

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
  filePaths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const imageUrlsByPath = new Map<string, string>()
  const uniquePaths = Array.from(
    new Set(
      filePaths.filter(
        (filePath): filePath is string =>
          Boolean(normalizeStoragePath(filePath)),
      ),
    ),
  )
  const privateObjectPathByReference = new Map<string, string>()
  const resolvedUrlsByPath = new Map<string, string>()

  uniquePaths.forEach((filePath) => {
    const privateObjectPath = getCommunityPostMediaObjectPath(filePath)

    if (privateObjectPath) {
      privateObjectPathByReference.set(filePath, privateObjectPath)
      return
    }

    const legacyPublicPath = getLegacyCommunityPostPublicPath(filePath)
    if (legacyPublicPath) {
      resolvedUrlsByPath.set(filePath, getPublicUrl(legacyPublicPath))
    }
  })

  const privateEntries = Array.from(privateObjectPathByReference.entries())

  for (
    let startIndex = 0;
    startIndex < privateEntries.length;
    startIndex += SIGNED_URL_BATCH_SIZE
  ) {
    const currentEntries = privateEntries.slice(
      startIndex,
      startIndex + SIGNED_URL_BATCH_SIZE,
    )
    const currentObjectPaths = currentEntries.map(
      ([, objectPath]) => objectPath,
    )

    try {
      const { data, error } = await supabase.storage
        .from(COMMUNITY_POST_MEDIA_BUCKET)
        .createSignedUrls(
          currentObjectPaths,
          SIGNED_URL_EXPIRES_IN_SECONDS,
        )

      if (error) {
        if (!isSupabasePermissionError(error)) {
          logClientError('storage.resolveCommunityPostImageUrls', error, {
            paths: currentObjectPaths.join(','),
          })
        }
        continue
      }

      const referencePathsByObjectPath = new Map<string, string[]>()

      currentEntries.forEach(([referencePath, objectPath]) => {
        const referencePaths =
          referencePathsByObjectPath.get(objectPath) || []
        referencePathsByObjectPath.set(
          objectPath,
          [...referencePaths, referencePath],
        )
      })

      data.forEach((result, resultIndex) => {
        const objectPath = result.path || currentObjectPaths[resultIndex]
        const referencePaths =
          referencePathsByObjectPath.get(objectPath) || []

        if (result.error) {
          const itemError = { message: result.error }
          if (!isSupabasePermissionError(itemError)) {
            logClientError(
              'storage.resolveCommunityPostImageUrls.item',
              itemError,
              {
                path: referencePaths[0] || objectPath,
              },
            )
          }
          return
        }

        const signedUrl = result.signedUrl
        if (signedUrl) {
          referencePaths.forEach((referencePath) => {
            resolvedUrlsByPath.set(referencePath, signedUrl)
          })
        }
      })
    } catch (error) {
      logClientError('storage.resolveCommunityPostImageUrls.exception', error, {
        paths: currentObjectPaths.join(','),
      })
    }
  }

  uniquePaths.forEach((filePath) => {
    const imageUrl = resolvedUrlsByPath.get(filePath)
    if (imageUrl) imageUrlsByPath.set(filePath, imageUrl)
  })

  return imageUrlsByPath
}
