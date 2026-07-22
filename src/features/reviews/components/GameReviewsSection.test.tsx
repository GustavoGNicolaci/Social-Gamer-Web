import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, FormEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../services/reviewService'
import { GameReviewsSection } from './GameReviewsSection'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: string | number; author?: string }) => {
      if (params?.count !== undefined) return `${key}:${params.count}`
      if (params?.author !== undefined) return `${key}:${params.author}`
      return key
    },
    formatNumber: (value: number) => String(value),
  }),
}))

vi.mock('../../../i18n', () => ({
  formatLocalizedDate: (value: string) => value,
  formatLocalizedNumber: (value: number) => String(value),
  translate: (key: string) => key,
}))

vi.mock('../../../components/UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}))

vi.mock('../../../components/reviews/ContentReportModal', () => ({
  ContentReportModal: ({ targetLabel }: { targetLabel: string }) => (
    <div data-testid="content-report-modal">{targetLabel}</div>
  ),
}))

const publicReview: ReviewItem = {
  id: 'public-review',
  usuario_id: 'author-id',
  jogo_id: 7,
  nota: 9,
  texto_review: 'Review publica',
  curtidas: 2,
  data_publicacao: '2026-07-13T12:00:00.000Z',
  editado_em: null,
  usuario: {
    id: 'author-id',
    username: 'public-author',
    avatar_path: null,
  },
  comentarios: [
    {
      id: 'public-comment',
      usuario_id: 'comment-author-id',
      review_id: 'public-review',
      texto: 'Comentario publico',
      data_comentario: '2026-07-13T13:00:00.000Z',
      editado_em: null,
      usuario: {
        id: 'comment-author-id',
        username: 'comment-author',
        avatar_path: null,
      },
      curtidas: 0,
      likedByCurrentUser: false,
      canLike: false,
      dislikes: 0,
      dislikedByCurrentUser: false,
      canDislike: false,
      currentUserReport: null,
    },
  ],
  likedByCurrentUser: false,
  canLike: false,
  dislikes: 0,
  dislikedByCurrentUser: false,
  canDislike: false,
  currentUserReport: null,
}

function createProps(
  overrides: Partial<ComponentProps<typeof GameReviewsSection>> = {}
): ComponentProps<typeof GameReviewsSection> {
  return {
    form: {
      authenticated: false,
      score: 5,
      setScore: vi.fn(),
      text: '',
      setText: vi.fn(),
      submitting: false,
      feedback: null,
      editing: false,
      submit: vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
    },
    list: {
      userId: null,
      total: 1,
      visible: [publicReview],
      error: null,
      commentCounts: { 'public-review': 1 },
      commentTotals: { 'public-review': 1 },
      commentText: {},
      submittingComments: {},
      pendingReviews: [],
      pendingComments: [],
      deletingReviews: [],
      loadingMoreReviews: false,
      loadingComments: {},
      hidden: 0,
    },
    report: {
      target: null,
      feedback: null,
      submitting: false,
      removing: false,
    },
    actions: {
      refreshReviews: vi.fn(),
      reviewLike: vi.fn(),
      reviewDislike: vi.fn(),
      reviewDelete: vi.fn(),
      commentLike: vi.fn(),
      commentDislike: vi.fn(),
      commentDelete: vi.fn(),
      openReport: vi.fn(),
      expandComments: vi.fn(),
      submitComment: vi.fn(),
      setCommentText: vi.fn(),
      expandReviews: vi.fn(),
      closeReport: vi.fn(),
      submitReport: vi.fn(),
      removeReport: vi.fn(),
    },
    ...overrides,
  }
}

afterEach(cleanup)

describe('GameReviewsSection', () => {
  it('mantem review publica, IDs de deep link e login para visitante', () => {
    const { container } = render(
      <MemoryRouter>
        <GameReviewsSection {...createProps()} />
      </MemoryRouter>
    )

    expect(container.querySelector('#game-community.game-details-reviews')).toBeInTheDocument()
    expect(container.querySelector('#review-public-review.game-review-card')).toBeInTheDocument()
    expect(
      container.querySelector('#comment-public-comment.game-review-comment-card')
    ).toBeInTheDocument()
    expect(screen.getByText('Review publica')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'auth.login.submit' })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('preserva mostrar mais e encaminha a expansao', () => {
    const expandReviews = vi.fn()
    const props = createProps()
    props.list.hidden = 2
    props.actions.expandReviews = expandReviews

    render(
      <MemoryRouter>
        <GameReviewsSection {...props} />
      </MemoryRouter>
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'game.details.moreReviewsAria:2' })
    )
    expect(expandReviews).toHaveBeenCalledTimes(1)
  })

  it('mantem section e modal como irmaos sem wrapper adicional', () => {
    const props = createProps()
    props.report.target = {
      targetType: 'review',
      targetId: 'public-review',
      authorName: 'public-author',
      currentReport: null,
    }

    const { container } = render(
      <MemoryRouter>
        <GameReviewsSection {...props} />
      </MemoryRouter>
    )

    const section = container.querySelector('#game-community')
    const modal = screen.getByTestId('content-report-modal')
    expect(section?.nextElementSibling).toBe(modal)
    expect(modal).toHaveTextContent('game.details.reviewTarget:public-author')
  })

  it('oferece notas como radios e preserva navegacao por setas', () => {
    const props = createProps()
    const setScore = vi.fn()
    props.form.authenticated = true
    props.form.score = 5
    props.form.setScore = setScore

    render(
      <MemoryRouter>
        <GameReviewsSection {...props} />
      </MemoryRouter>
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(10)
    expect(screen.getByRole('radio', { name: '5' })).toBeChecked()

    fireEvent.keyDown(screen.getByRole('radio', { name: '5' }), {
      key: 'ArrowRight',
    })
    expect(setScore).toHaveBeenCalledWith(6)
    expect(screen.getByRole('radio', { name: '6' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('radio', { name: '5' }), {
      key: 'ArrowDown',
    })
    expect(setScore).toHaveBeenLastCalledWith(6)

    fireEvent.keyDown(screen.getByRole('radio', { name: '5' }), {
      key: 'ArrowUp',
    })
    expect(setScore).toHaveBeenLastCalledWith(4)
  })
})
