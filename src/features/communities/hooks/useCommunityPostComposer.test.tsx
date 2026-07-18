import { act, renderHook } from '@testing-library/react'
import type { FormEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommunityPostComposer } from './useCommunityPostComposer'

const mocks = vi.hoisted(() => ({
  createCommunityPost: vi.fn(),
  uploadCommunityPostImage: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  createCommunityPost: mocks.createCommunityPost,
}))

vi.mock('../../../services/storageService', () => ({
  uploadCommunityPostImage: mocks.uploadCommunityPostImage,
}))

function makeSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as FormEvent<HTMLFormElement>
}

describe('useCommunityPostComposer', () => {
  const reloadAll = vi.fn()
  const resetPostsPage = vi.fn()
  const publishFeedback = vi.fn()
  const t = vi.fn((key: string) => key)

  beforeEach(() => {
    mocks.createCommunityPost.mockReset()
    mocks.uploadCommunityPostImage.mockReset()
    reloadAll.mockReset()
    resetPostsPage.mockReset()
    publishFeedback.mockReset()
    t.mockClear()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:post-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    mocks.createCommunityPost.mockResolvedValue({
      data: { id: 'post-1' },
      error: null,
    })
    mocks.uploadCommunityPostImage.mockResolvedValue({
      path: 'community-post-media/user-1/community-posts/image.png',
      publicUrl: '',
      url: '',
    })
    reloadAll.mockResolvedValue(undefined)
  })

  it('rejects a post without text or image before any request', async () => {
    const { result } = renderHook(() =>
      useCommunityPostComposer({
        communityId: 'community-1',
        currentUserId: 'user-1',
        reloadAll,
        resetPostsPage,
        publishFeedback,
        t,
      }),
    )

    await act(async () => {
      await result.current.submit(makeSubmitEvent())
    })

    expect(publishFeedback).toHaveBeenCalledWith({
      tone: 'error',
      message: 'communities.post.emptyError',
    })
    expect(mocks.createCommunityPost).not.toHaveBeenCalled()
    expect(mocks.uploadCommunityPostImage).not.toHaveBeenCalled()
  })

  it('uploads first, creates the post and preserves sequential reloadAll', async () => {
    const file = {
      name: 'image.png',
      type: 'image/png',
      size: 1024,
    } as File
    const { result } = renderHook(() =>
      useCommunityPostComposer({
        communityId: 'community-1',
        currentUserId: 'user-1',
        reloadAll,
        resetPostsPage,
        publishFeedback,
        t,
      }),
    )

    act(() => {
      result.current.setText('  New post  ')
      result.current.setImage(file)
    })

    expect(result.current.imagePreviewUrl).toBe('blob:post-preview')

    await act(async () => {
      await result.current.submit(makeSubmitEvent())
    })

    expect(mocks.uploadCommunityPostImage).toHaveBeenCalledWith(
      file,
      'user-1',
    )
    expect(mocks.createCommunityPost).toHaveBeenCalledWith(
      'community-1',
      'New post',
      'community-post-media/user-1/community-posts/image.png',
    )
    expect(
      mocks.uploadCommunityPostImage.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.createCommunityPost.mock.invocationCallOrder[0])
    expect(
      mocks.createCommunityPost.mock.invocationCallOrder[0],
    ).toBeLessThan(reloadAll.mock.invocationCallOrder[0])
    expect(resetPostsPage).toHaveBeenCalledOnce()
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.post.published',
    })
    expect(result.current.text).toBe('')
    expect(result.current.imageFile).toBeNull()
    expect(result.current.imagePreviewUrl).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:post-preview')
  })

  it('stops without creating the post when private image upload fails', async () => {
    mocks.uploadCommunityPostImage.mockResolvedValueOnce(null)
    const file = {
      name: 'image.png',
      type: 'image/png',
      size: 1024,
    } as File
    const { result } = renderHook(() =>
      useCommunityPostComposer({
        communityId: 'community-1',
        currentUserId: 'user-1',
        reloadAll,
        resetPostsPage,
        publishFeedback,
        t,
      }),
    )

    act(() => {
      result.current.setImage(file)
    })
    await act(async () => {
      await result.current.submit(makeSubmitEvent())
    })

    expect(mocks.createCommunityPost).not.toHaveBeenCalled()
    expect(reloadAll).not.toHaveBeenCalled()
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'error',
      message: 'communities.post.imageUploadError',
    })
    expect(result.current.submitting).toBe(false)
  })
})
