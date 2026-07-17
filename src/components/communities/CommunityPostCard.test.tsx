import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CommunityPost, CommunityPostComment } from '../../services/communityService'
import { CommunityPostCard } from './CommunityPostCard'

vi.mock('../UserAvatar', () => ({
  UserAvatar: () => <span data-testid="user-avatar" />,
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: string }) => (
      params?.count === undefined ? key : `${key}:${params.count}`
    ),
    formatDate: (value: string) => value,
    formatNumber: (value: number) => String(value),
  }),
}))

vi.mock('../../utils/profileRoutes', () => ({
  getOptionalPublicProfilePath: () => null,
}))

afterEach(cleanup)

function makeComment(index: number): CommunityPostComment {
  return {
    id: `comment-${index}`,
    post_id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: `author-${index}`,
    texto: `Comment ${index}`,
    created_at: `2026-07-${String(index).padStart(2, '0')}T00:00:00.000Z`,
    updated_at: `2026-07-${String(index).padStart(2, '0')}T00:00:00.000Z`,
    autor: null,
  }
}

function makePost(comments: CommunityPostComment[], nextOffset: number): CommunityPost {
  return {
    id: 'post-1',
    comunidade_id: 'community-1',
    autor_id: 'author-1',
    texto: 'Post',
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 0,
    dislikes_count: 0,
    comentarios_count: 6,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    fixado: false,
    fixado_em: null,
    fixado_por: null,
    autor: null,
    comentarios: comments,
    commentsNextOffset: nextOffset,
    currentUserReaction: null,
    savedByCurrentUser: false,
    canInteract: false,
    canDelete: false,
    canPin: false,
  }
}

const noopAsync = vi.fn(async () => undefined)
const noop = vi.fn()

function ProgressiveCard({
  onLoad,
}: {
  onLoad: (post: CommunityPost) => Promise<boolean>
}) {
  const [post, setPost] = useState(() => makePost([1, 2, 3].map(makeComment), 3))

  return (
    <CommunityPostCard
      post={post}
      onToggleReaction={noopAsync}
      onToggleSave={noopAsync}
      onTogglePin={noopAsync}
      onCreateComment={noopAsync}
      onLoadMoreComments={async currentPost => {
        const loaded = await onLoad(currentPost)
        if (loaded) setPost(makePost([1, 2, 3, 4, 5, 6].map(makeComment), 6))
        return loaded
      }}
      onDeletePost={noop}
      onDeleteComment={noop}
      onReport={noop}
      onOpenImage={noop}
    />
  )
}

describe('CommunityPostCard progressive comments', () => {
  it('loads the next batch before revealing three more comments', async () => {
    const onLoad = vi.fn(async () => true)
    render(
      <MemoryRouter>
        <ProgressiveCard onLoad={onLoad} />
      </MemoryRouter>
    )

    expect(screen.getByText('Comment 3')).toBeInTheDocument()
    expect(screen.queryByText('Comment 4')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: 'communities.post.moreComments:3',
    }))

    expect(await screen.findByText('Comment 6')).toBeInTheDocument()
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', {
      name: 'communities.post.moreComments:3',
    })).not.toBeInTheDocument()
  })

  it('ignores duplicate clicks while the same comment page is in flight', async () => {
    let resolveRequest!: (value: boolean) => void
    const onLoad = vi.fn(() => new Promise<boolean>(resolve => {
      resolveRequest = resolve
    }))
    render(
      <MemoryRouter>
        <ProgressiveCard onLoad={onLoad} />
      </MemoryRouter>
    )

    const button = screen.getByRole('button', {
      name: 'communities.post.moreComments:3',
    })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onLoad).toHaveBeenCalledTimes(1)
    await act(async () => resolveRequest(true))
    expect(await screen.findByText('Comment 6')).toBeInTheDocument()
  })
})
