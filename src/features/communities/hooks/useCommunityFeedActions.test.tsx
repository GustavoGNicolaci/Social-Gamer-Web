import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunityPost } from '../../../services/communityService'
import { useCommunityFeedActions } from './useCommunityFeedActions'

const mocks = vi.hoisted(() => ({
  createCommunityComment: vi.fn(),
  submitCommunityReport: vi.fn(),
  toggleCommunityPostPinned: vi.fn(),
  toggleCommunityPostReaction: vi.fn(),
  toggleCommunityPostSave: vi.fn(),
  updateCommunityReportStatus: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  createCommunityComment: mocks.createCommunityComment,
  submitCommunityReport: mocks.submitCommunityReport,
  toggleCommunityPostPinned: mocks.toggleCommunityPostPinned,
  toggleCommunityPostReaction: mocks.toggleCommunityPostReaction,
  toggleCommunityPostSave: mocks.toggleCommunityPostSave,
  updateCommunityReportStatus: mocks.updateCommunityReportStatus,
}))

function makePost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: 'author-1',
    texto: 'Post',
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 1,
    dislikes_count: 2,
    comentarios_count: 0,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    fixado: false,
    fixado_em: null,
    fixado_por: null,
    autor: null,
    comentarios: [],
    commentsNextOffset: 0,
    currentUserReaction: null,
    savedByCurrentUser: false,
    canInteract: true,
    canDelete: false,
    canPin: true,
    ...overrides,
  }
}

describe('useCommunityFeedActions', () => {
  const reloadPosts = vi.fn()
  const reloadModeration = vi.fn()
  const setPostsPage = vi.fn()
  const publishFeedback = vi.fn()
  const t = vi.fn((key: string) => key)
  let posts: CommunityPost[]
  const updatePosts = vi.fn(
    (updater: (currentPosts: CommunityPost[]) => CommunityPost[]) => {
      posts = updater(posts)
    },
  )

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    reloadPosts.mockReset()
    reloadModeration.mockReset()
    setPostsPage.mockReset()
    publishFeedback.mockReset()
    updatePosts.mockClear()
    t.mockClear()
    posts = [makePost()]
    reloadPosts.mockResolvedValue(undefined)
    reloadModeration.mockResolvedValue(undefined)
    mocks.toggleCommunityPostReaction.mockResolvedValue({
      data: {
        curtidas_count: 5,
        dislikes_count: 1,
        reacao_atual: 'curtida',
      },
      error: null,
    })
    mocks.toggleCommunityPostSave.mockResolvedValue({
      data: true,
      error: null,
    })
    mocks.toggleCommunityPostPinned.mockResolvedValue({
      data: true,
      error: null,
    })
    mocks.createCommunityComment.mockResolvedValue({
      data: { id: 'comment-1' },
      error: null,
    })
    mocks.submitCommunityReport.mockResolvedValue({
      data: { id: 'report-1' },
      error: null,
    })
    mocks.updateCommunityReportStatus.mockResolvedValue({
      data: true,
      error: null,
    })
  })

  function renderActions(postsPage = 1) {
    return renderHook(
      ({ page }) =>
        useCommunityFeedActions({
          communityId: 'community-1',
          postsPage: page,
          setPostsPage,
          reloadPosts,
          reloadModeration,
          updatePosts,
          publishFeedback,
          t,
        }),
      { initialProps: { page: postsPage } },
    )
  }

  it('applies reaction and save results only to the target post', async () => {
    const { result } = renderActions()

    await act(async () => {
      await result.current.toggleReaction(posts[0], 'curtida')
      await result.current.toggleSave(posts[0])
    })

    expect(posts[0]).toMatchObject({
      curtidas_count: 5,
      dislikes_count: 1,
      currentUserReaction: 'curtida',
      savedByCurrentUser: true,
    })
    expect(updatePosts).toHaveBeenCalledTimes(2)
  })

  it('returns to page one before reloading a newly pinned post', async () => {
    const { result, rerender } = renderActions(2)

    await act(async () => {
      await result.current.togglePinned(posts[0])
    })

    expect(setPostsPage).toHaveBeenCalledWith(1)
    expect(reloadPosts).not.toHaveBeenCalled()

    rerender({ page: 1 })
    await act(async () => {
      await result.current.togglePinned(posts[0])
    })

    expect(reloadPosts).toHaveBeenCalledOnce()
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.post.pinned',
    })
  })

  it('submits a scoped report, reloads moderation and closes the modal', async () => {
    const { result } = renderActions()

    act(() => {
      result.current.report.open({
        type: 'post',
        id: 'post-1',
        label: '@author',
      })
    })
    await act(async () => {
      await result.current.report.submit({
        reason: 'spam',
        description: 'Repeated content',
      })
    })

    expect(mocks.submitCommunityReport).toHaveBeenCalledWith({
      communityId: 'community-1',
      targetType: 'post',
      targetId: 'post-1',
      reason: 'spam',
      description: 'Repeated content',
    })
    expect(reloadModeration).toHaveBeenCalledOnce()
    expect(result.current.report.target).toBeNull()
    expect(publishFeedback).toHaveBeenLastCalledWith({
      tone: 'success',
      message: 'communities.report.sent',
    })
  })

  it('opens and closes the image lightbox state', () => {
    const { result } = renderActions()

    act(() => {
      result.current.lightbox.open('signed:image', 'Post image')
    })
    expect(result.current.lightbox.state).toEqual({
      url: 'signed:image',
      alt: 'Post image',
    })

    act(() => {
      result.current.lightbox.close()
    })
    expect(result.current.lightbox.state).toBeNull()
  })
})
