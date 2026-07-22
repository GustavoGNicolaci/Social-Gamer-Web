import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, FormEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../services/reviewService'
import { GameReviewCard } from './GameReviewCard'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: string | number; name?: string }) => {
      if (params?.count !== undefined) return `${key}:${params.count}`
      if (params?.name !== undefined) return `${key}:${params.name}`
      return key
    },
    formatNumber: (value: number) => String(value),
  }),
}))

const review: ReviewItem = {
  id: 'review-1',
  usuario_id: 'author-1',
  jogo_id: 7,
  nota: 9,
  texto_review: 'Uma review de caracterizacao.',
  curtidas: 2,
  data_publicacao: '2026-07-13T12:00:00.000Z',
  editado_em: null,
  usuario: {
    id: 'author-1',
    username: 'reviewer',
    avatar_path: null,
  },
  comentarios: [
    {
      id: 'comment-1',
      usuario_id: 'viewer-1',
      review_id: 'review-1',
      texto: 'Comentario visivel',
      data_comentario: '2026-07-13T13:00:00.000Z',
      editado_em: null,
      usuario: {
        id: 'viewer-1',
        username: 'viewer',
        avatar_path: null,
      },
      curtidas: 1,
      likedByCurrentUser: false,
      canLike: false,
      dislikes: 0,
      dislikedByCurrentUser: false,
      canDislike: false,
      currentUserReport: null,
    },
    {
      id: 'comment-2',
      usuario_id: 'author-2',
      review_id: 'review-1',
      texto: 'Comentario inicialmente oculto',
      data_comentario: '2026-07-13T14:00:00.000Z',
      editado_em: null,
      usuario: {
        id: 'author-2',
        username: 'second-author',
        avatar_path: null,
      },
      curtidas: 0,
      likedByCurrentUser: false,
      canLike: true,
      dislikes: 0,
      dislikedByCurrentUser: false,
      canDislike: true,
      currentUserReport: null,
    },
  ],
  likedByCurrentUser: false,
  canLike: true,
  dislikes: 1,
  dislikedByCurrentUser: false,
  canDislike: true,
  currentUserReport: null,
}

afterEach(cleanup)

function renderCard(overrides: Partial<ComponentProps<typeof GameReviewCard>> = {}) {
  const props: ComponentProps<typeof GameReviewCard> = {
    review,
    currentUserId: 'viewer-1',
    visibleCommentCount: 1,
    totalCommentCount: 2,
    commentText: '',
    isSubmittingComment: false,
    isLoadingComments: false,
    isReviewReactionPending: false,
    isReviewDeletePending: false,
    pendingCommentReactionIds: [],
    onToggleReviewLike: vi.fn(),
    onToggleReviewDislike: vi.fn(),
    onDeleteReview: vi.fn(),
    onToggleCommentLike: vi.fn(),
    onToggleCommentDislike: vi.fn(),
    onDeleteComment: vi.fn(),
    onOpenReportModal: vi.fn(),
    onExpandComments: vi.fn(),
    onSubmitComment: vi.fn(event => event.preventDefault()),
    onCommentTextChange: vi.fn(),
    ...overrides,
  }

  render(
    <MemoryRouter>
      <GameReviewCard {...props} />
    </MemoryRouter>
  )

  return props
}

describe('GameReviewCard', () => {
  it('preserva o card, limita comentarios e encaminha as acoes da review', () => {
    const props = renderCard()

    expect(document.querySelector('#review-review-1.game-review-card')).toBeInTheDocument()
    expect(screen.getByText('Uma review de caracterizacao.')).toBeInTheDocument()
    expect(screen.getByText('Comentario visivel')).toBeInTheDocument()
    expect(screen.queryByText('Comentario inicialmente oculto')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'game.details.likeReview' }))
    expect(props.onToggleReviewLike).toHaveBeenCalledWith(review)
    expect(screen.getByRole('button', { name: 'game.details.likeReview' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )

    fireEvent.click(screen.getByRole('button', { name: 'game.details.moreCommentsAria:1' }))
    expect(props.onExpandComments).toHaveBeenCalledWith('review-1', 2)

    fireEvent.click(screen.getByRole('button', { name: 'game.details.reportReview' }))
    expect(props.onOpenReportModal).toHaveBeenCalledWith('review', 'review-1', 'review-1')
  })

  it('mantem o comentario controlado pela pagina e encaminha envio e exclusao', () => {
    const onCommentTextChange = vi.fn()
    const onSubmitComment = vi.fn((_: string, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
    })
    const onDeleteComment = vi.fn()
    renderCard({ onCommentTextChange, onSubmitComment, onDeleteComment })

    const input = screen.getByPlaceholderText('game.details.commentPlaceholder')
    fireEvent.change(input, { target: { value: 'Novo comentario' } })
    expect(onCommentTextChange).toHaveBeenCalledWith('review-1', 'Novo comentario')

    fireEvent.submit(input.closest('form')!)
    expect(onSubmitComment).toHaveBeenCalledWith('review-1', expect.any(Object))

    fireEvent.click(screen.getByRole('button', { name: 'game.details.deleteComment' }))
    expect(onDeleteComment).toHaveBeenCalledWith('review-1', review.comentarios[0])
  })

  it('usa o total remoto para mostrar mais e bloqueia novo clique durante a carga', () => {
    const onExpandComments = vi.fn()
    renderCard({
      totalCommentCount: 6,
      visibleCommentCount: 2,
      onExpandComments,
    })

    fireEvent.click(screen.getByRole('button', { name: 'game.details.moreCommentsAria:4' }))
    expect(onExpandComments).toHaveBeenCalledWith('review-1', 6)

    cleanup()
    renderCard({
      totalCommentCount: 6,
      visibleCommentCount: 2,
      isLoadingComments: true,
    })
    expect(screen.getByRole('button', { name: 'game.details.moreCommentsAria:4' })).toBeDisabled()
  })
})
