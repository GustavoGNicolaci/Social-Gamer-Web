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

export interface StorageListEntry {
  name: string
  id?: string | null
}

export interface UploadValidatedFileOptions {
  bucketName?: string
  includePublicUrl?: boolean
  includeBucketInPath?: boolean
  context?: string
}

export interface StorageLocation {
  bucketName: string
  objectPath: string
  referencePath: string
}
