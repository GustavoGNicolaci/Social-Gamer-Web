import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileReviewItem } from '../../services/reviewService'
import { ProfileReviewsSection } from './ProfileReviewsSection'

const mocks = vi.hoisted(() => ({
  translate: (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}:${Object.values(params).join(':')}`
  },
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    formatDate: () => '14 jul. 2026',
    formatNumber: (value: number) => String(value),
    t: mocks.translate,
  }),
}))

vi.mock('../GameCoverImage', () => ({
  GameCoverImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const review: ProfileReviewItem = {
  id: 'review-42',
  usuario_id: 'user-1',
  jogo_id: 42,
  nota: 8.5,
  texto_review: 'Um comentario que explica a avaliacao.',
  curtidas: 3,
  data_publicacao: '2026-07-14T12:00:00.000Z',
  editado_em: null,
  usuario: {
    id: 'user-1',
    username: 'player',
    avatar_path: null,
  },
  comentarios: [],
  likedByCurrentUser: false,
  canLike: true,
  dislikes: 0,
  dislikedByCurrentUser: false,
  canDislike: true,
  currentUserReport: null,
  jogo: {
    id: 42,
    titulo: 'Review Game',
    capa_url: '/review-game.jpg',
  },
}

const defaultProps: ComponentProps<typeof ProfileReviewsSection> = {
  items: [review],
  isLoading: false,
  errorMessage: null,
  countLabel: '1',
  totalCount: 1,
  hasMore: false,
  isLoadingMore: false,
  isOwnerView: false,
  onLoadMore: vi.fn().mockResolvedValue(undefined),
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="current-location">{location.pathname}</output>
}

function renderSection(
  overrides: Partial<ComponentProps<typeof ProfileReviewsSection>> = {}
) {
  return render(
    <MemoryRouter initialEntries={['/profile/player']}>
      <LocationProbe />
      <Routes>
        <Route
          path="/profile/:username"
          element={<ProfileReviewsSection {...defaultProps} {...overrides} />}
        />
        <Route path="/games/:gameId" element={<p>game-details-destination</p>} />
      </Routes>
    </MemoryRouter>
  )
}

function expectBefore(earlier: HTMLElement, later: HTMLElement) {
  expect(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProfileReviewsSection', () => {
  it('organiza a informacao dentro do link e navega para os detalhes do jogo', () => {
    renderSection()

    const reviewLink = screen.getByRole('link', { name: /Review Game/ })
    expect(reviewLink).toHaveAttribute('href', '/games/42')

    const content = within(reviewLink)
    const title = content.getByRole('heading', { level: 3, name: 'Review Game' })
    const score = content.getByText('profileReviews.score:8.5/10')
    const date = content.getByText('profileReviews.reviewedAt:14 jul. 2026')
    const comment = content.getByText('Um comentario que explica a avaliacao.')
    const cta = content.getByText('common.viewGameDetails')

    expectBefore(title, score)
    expectBefore(title, date)
    expectBefore(title, comment)
    expectBefore(title, cta)

    fireEvent.click(reviewLink)

    expect(screen.getByTestId('current-location')).toHaveTextContent('/games/42')
    expect(screen.getByText('game-details-destination')).toBeInTheDocument()
  })

  it('mostra um estado explicito quando a review nao possui comentario', () => {
    renderSection({
      items: [{ ...review, texto_review: null }],
    })

    const reviewLink = screen.getByRole('link', { name: /Review Game/ })
    expect(within(reviewLink).getByText('profileReviews.noComment')).toBeInTheDocument()
  })

  it('exclui a review do proprietario sem acionar a navegacao do card', async () => {
    const onDeleteReview = vi.fn().mockResolvedValue({ ok: true })
    renderSection({ isOwnerView: true, onDeleteReview })

    fireEvent.click(screen.getByRole('button', { name: 'profileReviews.delete' }))

    await waitFor(() => {
      expect(onDeleteReview).toHaveBeenCalledWith('review-42')
    })
    expect(screen.getByTestId('current-location')).toHaveTextContent('/profile/player')
    expect(screen.queryByText('game-details-destination')).not.toBeInTheDocument()
  })

  it('carrega mais reviews mantendo a contagem restante no rotulo', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    renderSection({
      totalCount: 3,
      hasMore: true,
      onLoadMore,
    })

    const loadMoreButton = screen.getByRole('button', {
      name: 'profileReviews.moreWithCount:2',
    })
    fireEvent.click(loadMoreButton)

    await waitFor(() => expect(onLoadMore).toHaveBeenCalledOnce())
  })
})
