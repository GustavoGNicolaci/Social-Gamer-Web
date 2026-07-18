import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  from: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  createSignedUrls: vi.fn(),
  logClientError: vi.fn(),
}))

vi.mock('../integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: storageMocks.from,
    },
  },
}))

vi.mock('../utils/clientLogging', () => ({
  logClientError: storageMocks.logClientError,
}))

import {
  deleteAllUserFiles,
  deleteStorageFiles,
  downloadFile,
  extractAvatarPathFromPublicUrl,
  listUserFiles,
  resolveCommunityPostImageUrl,
  resolveCommunityPostImageUrls,
  resolvePublicFileUrl,
  sanitizeAvatarPath,
  uploadAvatarImage,
  uploadCommunityPostImage,
} from './storageService'
import * as storageService from './storageService'

function createFile(
  name: string,
  type: string,
  size = 1024,
) {
  return { name, type, size } as File
}

describe('storage service', () => {
  beforeEach(() => {
    storageMocks.from.mockReset()
    storageMocks.list.mockReset()
    storageMocks.remove.mockReset()
    storageMocks.upload.mockReset()
    storageMocks.download.mockReset()
    storageMocks.getPublicUrl.mockReset()
    storageMocks.createSignedUrl.mockReset()
    storageMocks.createSignedUrls.mockReset()
    storageMocks.logClientError.mockReset()

    storageMocks.from.mockImplementation((bucketName: string) => ({
      list: (prefix: string, options: unknown) =>
        storageMocks.list(bucketName, prefix, options),
      remove: (paths: string[]) =>
        storageMocks.remove(bucketName, paths),
      upload: (path: string, file: File, options: unknown) =>
        storageMocks.upload(bucketName, path, file, options),
      download: (path: string) =>
        storageMocks.download(bucketName, path),
      getPublicUrl: (path: string) =>
        storageMocks.getPublicUrl(bucketName, path),
      createSignedUrl: (path: string, expiresIn: number) =>
        storageMocks.createSignedUrl(bucketName, path, expiresIn),
      createSignedUrls: (paths: string[], expiresIn: number) =>
        storageMocks.createSignedUrls(bucketName, paths, expiresIn),
    }))
  })

  it('preserves every runtime export from the compatibility facade', () => {
    expect(Object.keys(storageService).sort()).toEqual([
      'deleteAllUserFiles',
      'deleteFile',
      'deleteStorageFiles',
      'downloadFile',
      'extractAvatarPathFromPublicUrl',
      'getPublicUrl',
      'listUserFiles',
      'resolveAvatarPublicUrl',
      'resolveCommunityPostImageUrl',
      'resolveCommunityPostImageUrls',
      'resolvePublicFileUrl',
      'sanitizeAvatarPath',
      'uploadAvatarImage',
      'uploadCommunityBannerImage',
      'uploadCommunityPostImage',
      'uploadFile',
      'uploadImage',
    ])
  })

  it('normalizes public and avatar paths without accepting remote or unsafe input', () => {
    storageMocks.getPublicUrl.mockImplementation(
      (_bucketName: string, path: string) => ({
        data: { publicUrl: `public:${path}` },
      }),
    )

    expect(
      resolvePublicFileUrl('user-uploads/user-1/images/cover.png'),
    ).toBe('public:user-1/images/cover.png')
    expect(resolvePublicFileUrl('https://example.test/image.png')).toBeNull()
    expect(resolvePublicFileUrl('../secret.png')).toBeNull()
    expect(
      resolvePublicFileUrl(
        'community-post-media/user-1/community-posts/private.png',
      ),
    ).toBeNull()
    expect(sanitizeAvatarPath('user-1/avatars/avatar.png')).toBe(
      'user-1/avatars/avatar.png',
    )
    expect(sanitizeAvatarPath('user-1/images/avatar.png')).toBeNull()
    expect(
      extractAvatarPathFromPublicUrl(
        'https://project.supabase.co/storage/v1/object/public/user-uploads/user-1/avatars/my%20avatar.png',
      ),
    ).toBe('user-1/avatars/my avatar.png')
    expect(extractAvatarPathFromPublicUrl('not a URL')).toBeNull()
  })

  it('validates image MIME type, extension and the default 5 MB limit', async () => {
    const invalidType = createFile('avatar.exe', 'image/png')
    const oversizedImage = createFile(
      'avatar.png',
      'image/png',
      5 * 1024 * 1024 + 1,
    )

    await expect(uploadAvatarImage(invalidType, 'user-1')).resolves.toBeNull()
    await expect(
      uploadAvatarImage(oversizedImage, 'user-1'),
    ).resolves.toBeNull()

    expect(storageMocks.upload).not.toHaveBeenCalled()
    expect(storageMocks.logClientError).toHaveBeenNthCalledWith(
      1,
      'storage.uploadAvatarImage.validate',
      null,
      {
        reason: 'unsupported_image_type',
        mimeType: 'image/png',
        extension: '.exe',
      },
    )
    expect(storageMocks.logClientError).toHaveBeenNthCalledWith(
      2,
      'storage.uploadAvatarImage.validate',
      null,
      {
        reason: 'file_too_large',
        maxSizeMB: 5,
        sizeMB: 5,
      },
    )
  })

  it('uploads sanitized avatars publicly with the existing cache contract', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234)
    const file = createFile(' Minha Foto.PNG ', 'image/png')
    const expectedPath = 'user-1/avatars/1234-minha-foto.png'

    storageMocks.upload.mockResolvedValue({
      data: { path: expectedPath },
      error: null,
    })
    storageMocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: `public:${expectedPath}` },
    })

    await expect(uploadAvatarImage(file, 'user-1')).resolves.toEqual({
      path: expectedPath,
      publicUrl: `public:${expectedPath}`,
      url: `public:${expectedPath}`,
    })
    expect(storageMocks.upload).toHaveBeenCalledWith(
      'user-uploads',
      expectedPath,
      file,
      {
        cacheControl: '3600',
        upsert: false,
      },
    )
  })

  it('stores community post images privately and returns the bucket-prefixed reference', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5678)
    const file = createFile('Post Image.webp', 'image/webp')
    const objectPath =
      'user-1/community-posts/5678-post-image.webp'

    storageMocks.upload.mockResolvedValue({
      data: { path: objectPath },
      error: null,
    })

    await expect(
      uploadCommunityPostImage(file, 'user-1'),
    ).resolves.toEqual({
      path: `community-post-media/${objectPath}`,
      publicUrl: '',
      url: '',
    })
    expect(storageMocks.upload).toHaveBeenCalledWith(
      'community-post-media',
      objectPath,
      file,
      {
        cacheControl: '3600',
        upsert: false,
      },
    )
    expect(storageMocks.getPublicUrl).not.toHaveBeenCalled()
  })

  it('loads every page when listing files in a user folder', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `file-${index}`,
      name: `${index}.jpg`,
    }))
    storageMocks.list
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({
        data: [{ id: 'file-100', name: '100.jpg' }],
        error: null,
      })

    const result = await listUserFiles('user-1', 'avatars')

    expect(result).toHaveLength(101)
    expect(storageMocks.list).toHaveBeenNthCalledWith(
      1,
      'user-uploads',
      'user-1/avatars',
      {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      },
    )
    expect(storageMocks.list).toHaveBeenNthCalledWith(
      2,
      'user-uploads',
      'user-1/avatars',
      {
        limit: 100,
        offset: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      },
    )
  })

  it('paginates each prefix before recursively deleting user files', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `file-${index}`,
      name: `${index}.jpg`,
    }))

    storageMocks.list.mockImplementation(
      (
        _bucketName: string,
        prefix: string,
        options: { offset: number },
      ) => {
        if (prefix === 'user-1' && options.offset === 0) {
          return Promise.resolve({ data: firstPage, error: null })
        }

        if (prefix === 'user-1' && options.offset === 100) {
          return Promise.resolve({
            data: [{ id: null, name: 'nested' }],
            error: null,
          })
        }

        return Promise.resolve({
          data: [{ id: 'nested-file', name: 'last.jpg' }],
          error: null,
        })
      },
    )
    storageMocks.remove.mockResolvedValue({ data: [], error: null })

    const result = await deleteAllUserFiles('user-1')

    expect(result.ok).toBe(true)
    expect(result.deletedPaths).toHaveLength(101)
    expect(storageMocks.list).toHaveBeenCalledWith(
      'user-uploads',
      'user-1/nested',
      {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      },
    )
    expect(storageMocks.remove).toHaveBeenCalledOnce()
  })

  it('marks discovered paths as failed when recursive listing stops with an error', async () => {
    const listError = { message: 'list failed' }

    storageMocks.list
      .mockResolvedValueOnce({
        data: [
          { id: 'known-file', name: 'known.png' },
          { id: null, name: 'nested' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: listError })

    await expect(deleteAllUserFiles('user-1')).resolves.toEqual({
      ok: false,
      deletedPaths: [],
      failedPaths: ['user-1/known.png'],
    })
    expect(storageMocks.remove).not.toHaveBeenCalled()
    expect(storageMocks.logClientError).toHaveBeenCalledWith(
      'storage.listAllFilePathsByPrefix',
      listError,
    )
  })

  it('deletes in chunks of 1000, groups buckets and reports partial failures', async () => {
    const publicPaths = Array.from(
      { length: 1001 },
      (_, index) => `user-1/images/${index}.png`,
    )
    const privatePath =
      'community-post-media/user-1/community-posts/private.png'

    storageMocks.remove.mockImplementation(
      (bucketName: string) =>
        Promise.resolve({
          data: [],
          error:
            bucketName === 'community-post-media'
              ? { message: 'private remove failed' }
              : null,
        }),
    )

    const result = await deleteStorageFiles([
      ...publicPaths,
      publicPaths[0],
      privatePath,
      '../unsafe.png',
      null,
    ])

    expect(result).toEqual({
      ok: false,
      deletedPaths: publicPaths,
      failedPaths: [privatePath],
    })
    expect(storageMocks.remove).toHaveBeenNthCalledWith(
      1,
      'user-uploads',
      publicPaths.slice(0, 1000),
    )
    expect(storageMocks.remove).toHaveBeenNthCalledWith(
      2,
      'user-uploads',
      publicPaths.slice(1000),
    )
    expect(storageMocks.remove).toHaveBeenNthCalledWith(
      3,
      'community-post-media',
      ['user-1/community-posts/private.png'],
    )
  })

  it('creates signed URLs in a batch and preserves input order with legacy public paths', async () => {
    storageMocks.getPublicUrl.mockImplementation(
      (_bucketName: string, path: string) => ({
        data: { publicUrl: `public:${path}` },
      }),
    )
    storageMocks.createSignedUrls.mockResolvedValue({
      data: [
        {
          error: null,
          path: 'user-2/community-posts/second.png',
          signedUrl: 'signed:second',
        },
        {
          error: null,
          path: 'user-1/community-posts/first.png',
          signedUrl: 'signed:first',
        },
      ],
      error: null,
    })

    const result = await resolveCommunityPostImageUrls([
      'community-post-media/user-1/community-posts/first.png',
      'user-3/community-posts/legacy.png',
      'community-post-media/user-2/community-posts/second.png',
      'community-post-media/user-1/community-posts/first.png',
      null,
    ])

    expect(storageMocks.createSignedUrls).toHaveBeenCalledWith(
      'community-post-media',
      [
        'user-1/community-posts/first.png',
        'user-2/community-posts/second.png',
      ],
      3600,
    )
    expect(Array.from(result.entries())).toEqual([
      [
        'community-post-media/user-1/community-posts/first.png',
        'signed:first',
      ],
      [
        'user-3/community-posts/legacy.png',
        'public:user-3/community-posts/legacy.png',
      ],
      [
        'community-post-media/user-2/community-posts/second.png',
        'signed:second',
      ],
    ])
  })

  it('chunks signed URL requests in groups of 100', async () => {
    const references = Array.from(
      { length: 201 },
      (_, index) =>
        `community-post-media/user-1/community-posts/${index}.png`,
    )
    storageMocks.createSignedUrls.mockImplementation(
      (
        _bucketName: string,
        paths: string[],
      ) =>
        Promise.resolve({
          data: paths.map((path) => ({
            error: null,
            path,
            signedUrl: `signed:${path}`,
          })),
          error: null,
        }),
    )

    const result = await resolveCommunityPostImageUrls(references)

    expect(storageMocks.createSignedUrls).toHaveBeenCalledTimes(3)
    expect(storageMocks.createSignedUrls.mock.calls.map((call) => call[1]))
      .toEqual([
        references.slice(0, 100).map((path) =>
          path.replace('community-post-media/', ''),
        ),
        references.slice(100, 200).map((path) =>
          path.replace('community-post-media/', ''),
        ),
        references.slice(200).map((path) =>
          path.replace('community-post-media/', ''),
        ),
      ])
    expect(Array.from(result.keys())).toEqual(references)
  })

  it('suppresses expected permission errors while resolving private media', async () => {
    const permissionError = {
      code: '42501',
      message: 'permission denied',
    }
    storageMocks.createSignedUrl.mockResolvedValue({
      data: null,
      error: permissionError,
    })
    storageMocks.createSignedUrls.mockResolvedValue({
      data: null,
      error: permissionError,
    })
    const reference =
      'community-post-media/user-1/community-posts/private.png'

    await expect(
      resolveCommunityPostImageUrl(reference),
    ).resolves.toBeNull()
    await expect(
      resolveCommunityPostImageUrls([reference]),
    ).resolves.toEqual(new Map())

    expect(storageMocks.createSignedUrl).toHaveBeenCalledWith(
      'community-post-media',
      'user-1/community-posts/private.png',
      3600,
    )
    expect(storageMocks.logClientError).not.toHaveBeenCalled()
  })

  it('downloads only normalized public object paths', async () => {
    const blob = new Blob(['image'])
    storageMocks.download.mockResolvedValue({ data: blob, error: null })

    await expect(
      downloadFile('user-1/images/image.png'),
    ).resolves.toBe(blob)
    await expect(downloadFile('../unsafe.png')).resolves.toBeNull()

    expect(storageMocks.download).toHaveBeenCalledOnce()
    expect(storageMocks.download).toHaveBeenCalledWith(
      'user-uploads',
      'user-1/images/image.png',
    )
  })
})
