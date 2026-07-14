import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  from: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrls: vi.fn(),
  logClientError: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
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
  listUserFiles,
  resolveCommunityPostImageUrls,
} from './storageService'

describe('storage service', () => {
  beforeEach(() => {
    storageMocks.from.mockReset()
    storageMocks.list.mockReset()
    storageMocks.remove.mockReset()
    storageMocks.getPublicUrl.mockReset()
    storageMocks.createSignedUrls.mockReset()
    storageMocks.logClientError.mockReset()

    storageMocks.from.mockImplementation((bucketName: string) => {
      if (bucketName === 'community-post-media') {
        return {
          createSignedUrls: storageMocks.createSignedUrls,
        }
      }

      return {
        list: storageMocks.list,
        remove: storageMocks.remove,
        getPublicUrl: storageMocks.getPublicUrl,
      }
    })
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
    expect(storageMocks.list).toHaveBeenNthCalledWith(1, 'user-1/avatars', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    expect(storageMocks.list).toHaveBeenNthCalledWith(2, 'user-1/avatars', {
      limit: 100,
      offset: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
  })

  it('paginates each prefix before recursively deleting user files', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `file-${index}`,
      name: `${index}.jpg`,
    }))

    storageMocks.list.mockImplementation((prefix: string, options: { offset: number }) => {
      if (prefix === 'user-1' && options.offset === 0) {
        return Promise.resolve({ data: firstPage, error: null })
      }

      if (prefix === 'user-1' && options.offset === 100) {
        return Promise.resolve({ data: [{ id: null, name: 'nested' }], error: null })
      }

      return Promise.resolve({
        data: [{ id: 'nested-file', name: 'last.jpg' }],
        error: null,
      })
    })
    storageMocks.remove.mockResolvedValue({ data: [], error: null })

    const result = await deleteAllUserFiles('user-1')

    expect(result.ok).toBe(true)
    expect(result.deletedPaths).toHaveLength(101)
    expect(storageMocks.list).toHaveBeenCalledWith('user-1/nested', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })
    expect(storageMocks.remove).toHaveBeenCalledOnce()
  })

  it('creates signed URLs in a batch and preserves input order with legacy public paths', async () => {
    storageMocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `public:${path}` },
    }))
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
      [
        'user-1/community-posts/first.png',
        'user-2/community-posts/second.png',
      ],
      3600
    )
    expect(Array.from(result.entries())).toEqual([
      ['community-post-media/user-1/community-posts/first.png', 'signed:first'],
      ['user-3/community-posts/legacy.png', 'public:user-3/community-posts/legacy.png'],
      ['community-post-media/user-2/community-posts/second.png', 'signed:second'],
    ])
  })
})
