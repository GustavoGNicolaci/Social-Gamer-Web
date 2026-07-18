import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunityPost } from '../../../services/communityService'
import { useCommunityConfirmationController } from './useCommunityConfirmationController'

const mocks = vi.hoisted(() => ({
  deleteCommunity: vi.fn(),
  deleteCommunityComment: vi.fn(),
  deleteCommunityPost: vi.fn(),
  updateCommunityPostingPermission: vi.fn(),
}))

vi.mock('../../../services/communityService', () => ({
  deleteCommunity: mocks.deleteCommunity,
  deleteCommunityComment: mocks.deleteCommunityComment,
  deleteCommunityPost: mocks.deleteCommunityPost,
  updateCommunityPostingPermission: mocks.updateCommunityPostingPermission,
}))

function makePost(): CommunityPost {
  return {
    id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: 'author-1',
    texto: 'Post',
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 0,
    dislikes_count: 0,
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
    canInteract: false,
    canDelete: true,
    canPin: false,
  }
}

describe('useCommunityConfirmationController', () => {
  const reloadAll = vi.fn()
  const navigateToCommunities = vi.fn()
  const publishFeedback = vi.fn()
  const t = vi.fn((key: string) => key)
  const executeMembershipConfirmation = vi.fn()

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    reloadAll.mockReset()
    navigateToCommunities.mockReset()
    publishFeedback.mockReset()
    executeMembershipConfirmation.mockReset()
    t.mockClear()
    reloadAll.mockResolvedValue(undefined)
    executeMembershipConfirmation.mockResolvedValue(false)
    mocks.deleteCommunity.mockResolvedValue({ data: true, error: null })
    mocks.deleteCommunityComment.mockResolvedValue({
      data: true,
      error: null,
    })
    mocks.deleteCommunityPost.mockResolvedValue({
      data: { deletedPaths: [], failedPaths: [] },
      error: null,
    })
    mocks.updateCommunityPostingPermission.mockResolvedValue({
      data: true,
      error: null,
    })
  })

  function renderController() {
    return renderHook(() =>
      useCommunityConfirmationController({
        communityId: 'community-1',
        reloadAll,
        navigateToCommunities,
        publishFeedback,
        t,
      }),
    )
  }

  it('delegates membership confirmations without running content actions', async () => {
    executeMembershipConfirmation.mockResolvedValueOnce(true)
    const { result } = renderController()

    act(() => {
      result.current.open({ kind: 'leave-community' })
    })
    await act(async () => {
      await result.current.execute(executeMembershipConfirmation)
    })

    expect(executeMembershipConfirmation).toHaveBeenCalledWith({
      kind: 'leave-community',
    })
    expect(mocks.deleteCommunity).not.toHaveBeenCalled()
    expect(reloadAll).not.toHaveBeenCalled()
    expect(result.current.submitting).toBe(false)
  })

  it('reports cleanup warnings, closes and reloads after deleting a post', async () => {
    mocks.deleteCommunityPost.mockResolvedValueOnce({
      data: {
        deletedPaths: [],
        failedPaths: ['community-post-media/path.png'],
      },
      error: null,
    })
    const post = makePost()
    const { result } = renderController()

    act(() => {
      result.current.open({ kind: 'delete-post', post })
    })
    expect(result.current.copy).toMatchObject({
      title: 'communities.confirm.deletePost.title',
      tone: 'danger',
    })

    await act(async () => {
      await result.current.execute(executeMembershipConfirmation)
    })

    expect(mocks.deleteCommunityPost).toHaveBeenCalledWith('post-1')
    expect(publishFeedback).toHaveBeenCalledWith({
      tone: 'info',
      message: 'communities.post.deletedWithCleanupWarnings',
    })
    expect(reloadAll).toHaveBeenCalledOnce()
    expect(result.current.state).toBeNull()
  })

  it('navigates after deleting the community without reloading stale data', async () => {
    const { result } = renderController()

    act(() => {
      result.current.open({ kind: 'delete-community' })
    })
    await act(async () => {
      await result.current.execute(executeMembershipConfirmation)
    })

    expect(mocks.deleteCommunity).toHaveBeenCalledWith('community-1')
    expect(navigateToCommunities).toHaveBeenCalledOnce()
    expect(reloadAll).not.toHaveBeenCalled()
  })
})
