import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CommunityPost,
  CommunityReactionType,
  CommunityRole,
} from '../../../services/communityService'
import type {
  CommunityFeedActionsProps,
  CommunityFeedComposerProps,
  CommunityFeedListProps,
  CommunityFeedReportTarget,
  CommunityFeedSectionProps,
} from './CommunityFeedSection'

interface MockFilePickerProps {
  buttonLabel: string
  uploadingLabel: string
  file: File | null
  previewUrl: string | null
  disabled?: boolean
  isUploading?: boolean
  onChange: (file: File | null) => void
}

interface MockPostCardProps {
  post: CommunityPost
  currentUserId?: string | null
  currentUserRole?: CommunityRole | null
  activeAnchorId?: string
  onToggleReaction: (post: CommunityPost, reaction: CommunityReactionType) => Promise<void>
  onToggleSave: (post: CommunityPost) => Promise<void>
  onTogglePin: (post: CommunityPost) => Promise<void>
  onCreateComment: (post: CommunityPost, text: string) => Promise<void>
  onLoadMoreComments: (post: CommunityPost) => Promise<boolean>
  onDeletePost: (post: CommunityPost) => void
  onDeleteComment: (post: CommunityPost, commentId: string) => void
  onReport: (target: CommunityFeedReportTarget) => void
  onOpenImage: (url: string, alt: string) => void
}

vi.mock('../../../components/communities/CommunityFilePicker', () => ({
  CommunityFilePicker: ({
    buttonLabel,
    uploadingLabel,
    file,
    previewUrl,
    disabled,
    isUploading,
    onChange,
  }: MockFilePickerProps) => (
    <div
      data-testid="community-file-picker"
      data-disabled={String(Boolean(disabled))}
      data-uploading={String(Boolean(isUploading))}
      data-preview-url={previewUrl || ''}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(new File(['image'], 'post.webp', { type: 'image/webp' }))}
      >
        {isUploading ? uploadingLabel : buttonLabel}
      </button>
      {file ? <span>{file.name}</span> : null}
    </div>
  ),
}))

vi.mock('../../../components/communities/CommunityPostCard', () => ({
  CommunityPostCard: ({
    post,
    currentUserId,
    currentUserRole,
    activeAnchorId,
    onToggleReaction,
    onToggleSave,
    onTogglePin,
    onCreateComment,
    onLoadMoreComments,
    onDeletePost,
    onDeleteComment,
    onReport,
    onOpenImage,
  }: MockPostCardProps) => (
    <article
      data-testid={`community-post-card-${post.id}`}
      data-current-user-id={currentUserId || ''}
      data-current-user-role={currentUserRole || ''}
      data-active-anchor-id={activeAnchorId || ''}
    >
      <button type="button" onClick={() => void onToggleReaction(post, 'curtida')}>
        reaction-{post.id}
      </button>
      <button type="button" onClick={() => void onToggleSave(post)}>save-{post.id}</button>
      <button type="button" onClick={() => void onTogglePin(post)}>pin-{post.id}</button>
      <button type="button" onClick={() => void onCreateComment(post, 'Comment')}>
        comment-{post.id}
      </button>
      <button type="button" onClick={() => void onLoadMoreComments(post)}>
        more-comments-{post.id}
      </button>
      <button type="button" onClick={() => onDeletePost(post)}>delete-{post.id}</button>
      <button type="button" onClick={() => onDeleteComment(post, 'comment-1')}>
        delete-comment-{post.id}
      </button>
      <button
        type="button"
        onClick={() => onReport({ type: 'post', id: post.id, label: 'Report target' })}
      >
        report-{post.id}
      </button>
      <button
        type="button"
        onClick={() => onOpenImage('https://example.com/post.webp', 'Post image')}
      >
        image-{post.id}
      </button>
    </article>
  ),
}))

import { CommunityFeedSection } from './CommunityFeedSection'

afterEach(cleanup)

function createPost(id: string): CommunityPost {
  return {
    id,
    comunidade_id: 'community-1',
    autor_id: 'author-1',
    texto: `Post ${id}`,
    imagem_path: null,
    imagem_url: null,
    curtidas_count: 0,
    dislikes_count: 0,
    comentarios_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    fixado: false,
    fixado_em: null,
    fixado_por: null,
    autor: null,
    comentarios: [],
    currentUserReaction: null,
    savedByCurrentUser: false,
    canInteract: true,
    canDelete: false,
    canPin: false,
  }
}

function createComposer(
  overrides: Partial<CommunityFeedComposerProps> = {}
): CommunityFeedComposerProps {
  return {
    canPost: true,
    isAuthenticated: true,
    unavailableMessage: 'Posting unavailable',
    text: '',
    imageFile: null,
    imagePreviewUrl: null,
    submitting: false,
    ...overrides,
  }
}

function createList(
  overrides: Partial<CommunityFeedListProps> = {}
): CommunityFeedListProps {
  return {
    posts: [],
    loading: false,
    currentUserId: 'viewer-1',
    currentUserRole: 'membro',
    activeAnchorId: '',
    page: 1,
    totalPages: 1,
    ...overrides,
  }
}

function createActions(): CommunityFeedActionsProps {
  return {
    onCreatePost: vi.fn(event => event.preventDefault()),
    onPostTextChange: vi.fn(),
    onPostImageFileChange: vi.fn(),
    onToggleReaction: vi.fn(async () => undefined),
    onToggleSave: vi.fn(async () => undefined),
    onTogglePin: vi.fn(async () => undefined),
    onCreateComment: vi.fn(async () => undefined),
    onLoadMoreComments: vi.fn(async () => true),
    onDeletePost: vi.fn(),
    onDeleteComment: vi.fn(),
    onReport: vi.fn(),
    onOpenImage: vi.fn(),
    onPageChange: vi.fn(),
  }
}

function createTranslate() {
  return vi.fn<CommunityFeedSectionProps['t']>((key, params) => (
    key === 'communities.post.pageLabel'
      ? `${key}:${params?.page}/${params?.total}`
      : key
  ))
}

describe('CommunityFeedSection', () => {
  it('preserva o composer, arquivo e callbacks de publicacao quando pode postar', () => {
    const actions = createActions()
    const t = createTranslate()
    const { container } = render(
      <CommunityFeedSection
        t={t}
        composer={createComposer({ text: 'Draft post' })}
        list={createList()}
        actions={actions}
      />
    )

    expect(container.firstElementChild).toHaveClass('community-feed')
    expect(screen.getByRole('heading', { name: 'communities.post.createTitle' }))
      .toBeInTheDocument()
    const textarea = screen.getByPlaceholderText('communities.post.placeholder')
    expect(textarea).toHaveValue('Draft post')

    fireEvent.change(textarea, { target: { value: 'Updated draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'communities.upload.addImage' }))
    fireEvent.submit(container.querySelector('.community-post-form') as HTMLFormElement)

    expect(actions.onPostTextChange).toHaveBeenCalledWith('Updated draft')
    expect(actions.onPostImageFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'post.webp', type: 'image/webp' })
    )
    expect(actions.onCreatePost).toHaveBeenCalledTimes(1)
  })

  it('distingue login obrigatorio de falta de permissao para postar', () => {
    const actions = createActions()
    const t = createTranslate()
    const { rerender } = render(
      <CommunityFeedSection
        t={t}
        composer={createComposer({ canPost: false, isAuthenticated: false })}
        list={createList()}
        actions={actions}
      />
    )

    expect(screen.getByText('communities.post.loginToInteract')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()

    rerender(
      <CommunityFeedSection
        t={t}
        composer={createComposer({
          canPost: false,
          isAuthenticated: true,
          unavailableMessage: 'Admins only',
        })}
        list={createList()}
        actions={actions}
      />
    )

    expect(screen.getByText('Admins only')).toBeInTheDocument()
    expect(screen.queryByText('communities.post.loginToInteract')).not.toBeInTheDocument()
  })

  it('preserva a prioridade entre loading e estado vazio', () => {
    const actions = createActions()
    const t = createTranslate()
    const { rerender } = render(
      <CommunityFeedSection
        t={t}
        composer={createComposer()}
        list={createList({ loading: true, posts: [createPost('hidden')] })}
        actions={actions}
      />
    )

    expect(screen.getByText('communities.post.loading')).toHaveClass('communities-state-card')
    expect(screen.queryByTestId('community-post-card-hidden')).not.toBeInTheDocument()

    rerender(
      <CommunityFeedSection
        t={t}
        composer={createComposer()}
        list={createList({ loading: false, posts: [] })}
        actions={actions}
      />
    )

    expect(screen.getByText('communities.post.empty')).toHaveClass('communities-state-card')
    expect(screen.queryByRole('navigation', { name: 'communities.post.pagination' }))
      .not.toBeInTheDocument()
  })

  it('encaminha cards, deep link, callbacks e atualizadores da paginacao', () => {
    const posts = [createPost('post-a'), createPost('post-b')]
    const actions = createActions()
    const t = createTranslate()
    render(
      <CommunityFeedSection
        t={t}
        composer={createComposer()}
        list={createList({
          posts,
          currentUserId: 'moderator-1',
          currentUserRole: 'admin',
          activeAnchorId: 'community-comment-comment-1',
          page: 2,
          totalPages: 3,
        })}
        actions={actions}
      />
    )

    expect(screen.getByTestId('community-post-card-post-a')).toHaveAttribute(
      'data-active-anchor-id',
      'community-comment-comment-1'
    )
    expect(screen.getByTestId('community-post-card-post-b')).toHaveAttribute(
      'data-current-user-role',
      'admin'
    )
    expect(screen.getByText('communities.post.pageLabel:2/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'reaction-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'save-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'pin-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'comment-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'more-comments-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete-comment-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'report-post-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'image-post-a' }))

    expect(actions.onToggleReaction).toHaveBeenCalledWith(posts[0], 'curtida')
    expect(actions.onToggleSave).toHaveBeenCalledWith(posts[0])
    expect(actions.onTogglePin).toHaveBeenCalledWith(posts[0])
    expect(actions.onCreateComment).toHaveBeenCalledWith(posts[0], 'Comment')
    expect(actions.onLoadMoreComments).toHaveBeenCalledWith(posts[0])
    expect(actions.onDeletePost).toHaveBeenCalledWith(posts[0])
    expect(actions.onDeleteComment).toHaveBeenCalledWith(posts[0], 'comment-1')
    expect(actions.onReport).toHaveBeenCalledWith({
      type: 'post',
      id: 'post-a',
      label: 'Report target',
    })
    expect(actions.onOpenImage).toHaveBeenCalledWith(
      'https://example.com/post.webp',
      'Post image'
    )

    fireEvent.click(screen.getByRole('button', { name: 'communities.post.previousPage' }))
    fireEvent.click(screen.getByRole('button', { name: 'communities.post.nextPage' }))

    const previousUpdate = vi.mocked(actions.onPageChange).mock.calls[0]?.[0]
    const nextUpdate = vi.mocked(actions.onPageChange).mock.calls[1]?.[0]
    expect(typeof previousUpdate).toBe('function')
    expect(typeof nextUpdate).toBe('function')
    if (typeof previousUpdate === 'function' && typeof nextUpdate === 'function') {
      expect(previousUpdate(2)).toBe(1)
      expect(nextUpdate(2)).toBe(3)
    }
  })

  it('desabilita a paginacao nos limites atuais', () => {
    render(
      <CommunityFeedSection
        t={createTranslate()}
        composer={createComposer()}
        list={createList({ posts: [createPost('only-post')], page: 1, totalPages: 1 })}
        actions={createActions()}
      />
    )

    expect(screen.getByRole('button', { name: 'communities.post.previousPage' }))
      .toBeDisabled()
    expect(screen.getByRole('button', { name: 'communities.post.nextPage' }))
      .toBeDisabled()
  })
})
