import { logClientError } from '../../../utils/clientLogging'
import { supabase } from '../client'
import {
  PUBLIC_UPLOADS_BUCKET,
  STORAGE_LIST_PAGE_SIZE,
  STORAGE_REMOVE_BATCH_SIZE,
  getUniqueStorageLocations,
  normalizeStoragePath,
} from './paths'
import type {
  StorageCleanupResult,
  StorageListEntry,
  StorageLocation,
} from './types'

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

    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage
        .from(PUBLIC_UPLOADS_BUCKET)
        .list(currentPrefix, {
          limit: STORAGE_LIST_PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })

      if (error) {
        logClientError('storage.listAllFilePathsByPrefix', error)
        return {
          data: discoveredPaths,
          error,
        }
      }

      const entries = (data || []) as StorageListEntry[]

      for (const item of entries) {
        const nestedPath = `${currentPrefix}/${item.name}`

        if (item.id) {
          discoveredPaths.push(nestedPath)
          continue
        }

        pendingPrefixes.push(nestedPath)
      }

      if (entries.length < STORAGE_LIST_PAGE_SIZE) {
        break
      }

      offset += STORAGE_LIST_PAGE_SIZE
    }
  }

  return {
    data: discoveredPaths,
    error: null,
  }
}

export async function deleteStorageFiles(
  filePaths: Array<string | null | undefined>,
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

  locations.forEach((location) => {
    const currentLocations = locationsByBucket.get(location.bucketName) || []
    locationsByBucket.set(
      location.bucketName,
      [...currentLocations, location],
    )
  })

  for (const [bucketName, bucketLocations] of locationsByBucket) {
    for (
      let startIndex = 0;
      startIndex < bucketLocations.length;
      startIndex += STORAGE_REMOVE_BATCH_SIZE
    ) {
      const currentChunk = bucketLocations.slice(
        startIndex,
        startIndex + STORAGE_REMOVE_BATCH_SIZE,
      )

      try {
        const { error } = await supabase.storage
          .from(bucketName)
          .remove(currentChunk.map((location) => location.objectPath))

        if (error) {
          logClientError('storage.deleteStorageFiles', error, {
            bucketName,
            paths: currentChunk
              .map((location) => location.referencePath)
              .join(','),
          })
          failedPaths.push(
            ...currentChunk.map((location) => location.referencePath),
          )
          continue
        }

        deletedPaths.push(
          ...currentChunk.map((location) => location.referencePath),
        )
      } catch (error) {
        logClientError('storage.deleteStorageFiles.exception', error, {
          bucketName,
          paths: currentChunk
            .map((location) => location.referencePath)
            .join(','),
        })
        failedPaths.push(
          ...currentChunk.map((location) => location.referencePath),
        )
      }
    }
  }

  return {
    ok: failedPaths.length === 0,
    deletedPaths,
    failedPaths,
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  const result = await deleteStorageFiles([filePath])
  return result.ok && result.deletedPaths.length > 0
}

export async function deleteAllUserFiles(
  userId: string,
): Promise<StorageCleanupResult> {
  const listResult = await listAllFilePathsByPrefix(userId)

  if (listResult.error) {
    return {
      ok: false,
      deletedPaths: [],
      failedPaths: listResult.data,
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

  for (
    let startIndex = 0;
    startIndex < listResult.data.length;
    startIndex += STORAGE_REMOVE_BATCH_SIZE
  ) {
    const currentChunk = listResult.data.slice(
      startIndex,
      startIndex + STORAGE_REMOVE_BATCH_SIZE,
    )

    try {
      const { error } = await supabase.storage
        .from(PUBLIC_UPLOADS_BUCKET)
        .remove(currentChunk)

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
