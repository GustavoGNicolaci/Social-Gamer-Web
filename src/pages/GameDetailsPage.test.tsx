import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogGameDetails } from '../services/gameCatalogService'
import GameDetailsPage from './GameDetailsPage'

const serviceMocks = vi.hoisted(() => ({
  getCatalogGameDetailsById: vi.fn(),
  getGameRatingSummaries: vi.fn(),
  getGameReviewsPage: vi.fn(),
  getReviewByGameAndUserId: vi.fn(),
  getReviewCommentsPage: vi.fn(),
  resolveGameReviewAnchor: vi.fn(),
  getWishlistEntry: vi.fn(),
  getGameStatusEntry: vi.fn(),
}))

const i18nMocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  formatNumber: vi.fn((value: number) => String(value)),
  formatLocalizedDate: vi.fn((value: string | null | undefined) => value || ''),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: i18nMocks.t,
    formatNumber: i18nMocks.formatNumber,
  }),
}))

vi.mock('../i18n', () => ({
  translate: (key: string) => key,
  formatLocalizedDate: i18nMocks.formatLocalizedDate,
}))

vi.mock('../components/GameCoverImage', () => ({
  GameCoverImage: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}))

vi.mock('../components/reviews/ContentReportModal', () => ({
  ContentReportModal: () => <div data-testid="content-report-modal" />,
}))

vi.mock('../features/reviews/components/GameReviewCard', () => ({
  GameReviewCard: () => <article data-testid="game-review-card" />,
}))

vi.mock('../services/gameCatalogService', () => ({
  getCatalogGameDetailsById: serviceMocks.getCatalogGameDetailsById,
}))

vi.mock('../services/reviewService', () => ({
  createReviewComment: vi.fn(),
  deleteReviewComment: vi.fn(),
  deleteReview: vi.fn(),
  getGameRatingSummaries: serviceMocks.getGameRatingSummaries,
  getGameReviewsPage: serviceMocks.getGameReviewsPage,
  getReviewByGameAndUserId: serviceMocks.getReviewByGameAndUserId,
  getReviewCommentsPage: serviceMocks.getReviewCommentsPage,
  resolveGameReviewAnchor: serviceMocks.resolveGameReviewAnchor,
  saveReview: vi.fn(),
  sortCommentsByRelevance: <T,>(comments: T[]) => comments,
  sortReviewsByRelevance: <T,>(reviews: T[]) => reviews,
  toggleReviewLike: vi.fn(),
}))

vi.mock('../services/reviewInteractionsService', () => ({
  deleteContentReport: vi.fn(),
  submitContentReport: vi.fn(),
  toggleCommentDislike: vi.fn(),
  toggleCommentLike: vi.fn(),
  toggleReviewDislike: vi.fn(),
}))

vi.mock('../services/gameStatusService', () => ({
  STATUS_VALUES: ['jogando', 'zerado', 'dropado', 'planejando', 'pausado'],
  deleteGameStatus: vi.fn(),
  getGameStatusEntry: serviceMocks.getGameStatusEntry,
  saveGameStatus: vi.fn(),
}))

vi.mock('../services/wishlistService', () => ({
  addGameToWishlist: vi.fn(),
  deleteWishlistEntry: vi.fn(),
  getWishlistEntry: serviceMocks.getWishlistEntry,
}))

vi.mock('../utils/supabaseErrors', () => ({
  isSupabaseDuplicateError: () => false,
  isSupabasePermissionError: () => false,
  isSupabaseStructureError: () => false,
}))

function makeGame(id: number, title: string): CatalogGameDetails {
  return {
    id,
    igdbId: String(id),
    title,
    titulo: title,
    coverUrl: null,
    capa_url: null,
    developer: ['Studio'],
    desenvolvedora: ['Studio'],
    genres: ['Adventure'],
    generos: ['Adventure'],
    releaseDate: '2026-07-13',
    data_lancamento: '2026-07-13',
    platforms: ['PC'],
    plataformas: ['PC'],
    sourcePrimary: 'igdb',
    importStatus: 'ready',
    slug: title.toLowerCase().replaceAll(' ', '-'),
    description: 'Descricao de caracterizacao.',
    descricao: 'Descricao de caracterizacao.',
    sourceDescription: 'Descricao de caracterizacao.',
    shortDescription: null,
    externalRating: null,
    externalRatingCount: 0,
    externalUpdatedAt: null,
    metadata: null,
    media: [],
    screenshots: [],
    coverMedia: null,
    descriptionLocale: 'pt-BR',
    descriptionFallback: false,
    translationStatus: 'ready',
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function NavigateToSecondGame() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/games/2')}>
      abrir-segundo-jogo
    </button>
  )
}

function renderPage(initialEntry = '/games/7', withNavigation = false) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {withNavigation ? <NavigateToSecondGame /> : null}
      <Routes>
        <Route path="/games/:id" element={<GameDetailsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GameDetailsPage characterization', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serviceMocks.getCatalogGameDetailsById.mockResolvedValue({
      data: makeGame(7, 'Jogo de caracterizacao'),
      error: null,
    })
    serviceMocks.getGameReviewsPage.mockResolvedValue({
      data: [],
      error: null,
      totalCount: 0,
      nextOffset: null,
      commentTotals: {},
    })
    serviceMocks.getReviewCommentsPage.mockResolvedValue({
      data: [],
      error: null,
      totalCount: 0,
      nextOffset: null,
    })
    serviceMocks.getReviewByGameAndUserId.mockResolvedValue({ data: null, error: null })
    serviceMocks.resolveGameReviewAnchor.mockResolvedValue({ data: null, error: null })
    serviceMocks.getGameRatingSummaries.mockResolvedValue({
      data: [{ gameId: 7, averageRating: null, reviewCount: 0 }],
      error: null,
    })
    serviceMocks.getWishlistEntry.mockResolvedValue({ data: null, error: null })
    serviceMocks.getGameStatusEntry.mockResolvedValue({ data: null, error: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('mantem o estado de carregamento ate os dados iniciais terminarem', async () => {
    const gameRequest = createDeferred<{ data: CatalogGameDetails; error: null }>()
    const reviewsRequest = createDeferred<{ data: []; error: null }>()
    serviceMocks.getCatalogGameDetailsById.mockReturnValue(gameRequest.promise)
    serviceMocks.getGameReviewsPage.mockReturnValue(reviewsRequest.promise)

    renderPage()

    expect(screen.getByRole('heading', { name: 'game.details.loadingTitle' })).toBeInTheDocument()

    await act(async () => {
      gameRequest.resolve({ data: makeGame(7, 'Jogo carregado'), error: null })
      await gameRequest.promise
    })

    expect(screen.getByRole('heading', { name: 'game.details.loadingTitle' })).toBeInTheDocument()

    await act(async () => {
      reviewsRequest.resolve({ data: [], error: null })
      await reviewsRequest.promise
    })

    expect(await screen.findByRole('heading', { name: 'Jogo carregado' })).toBeInTheDocument()
  })

  it('renderiza o jogo e consulta reviews publicas e resumo de notas', async () => {
    const { container } = renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Jogo de caracterizacao' })
    ).toBeInTheDocument()
    expect(screen.getByText('Descricao de caracterizacao.')).toBeInTheDocument()
    expect(serviceMocks.getCatalogGameDetailsById).toHaveBeenCalledWith(7)
    expect(serviceMocks.getGameReviewsPage).toHaveBeenCalledWith(7, {
      currentUserId: null,
      limit: 3,
      offset: 0,
      initialCommentsLimit: 2,
    })
    expect(serviceMocks.getGameRatingSummaries).toHaveBeenCalledWith([7])
    expect(screen.getByRole('link', { name: 'game.details.loginToRate' })).toHaveAttribute(
      'href',
      '/login'
    )

    const hero = container.querySelector('.game-details-hero')
    const highlights = container.querySelector('.game-details-highlights')
    const infoGrid = container.querySelector('.game-details-info-grid')
    const reviewsSection = container.querySelector('#game-community')

    expect(hero?.nextElementSibling).toBe(highlights)
    expect(highlights?.nextElementSibling).toBe(infoGrid)
    expect(infoGrid?.nextElementSibling).toBe(reviewsSection)
  })

  it('preserva o estado de jogo nao encontrado quando a consulta falha sem dados', async () => {
    serviceMocks.getCatalogGameDetailsById.mockResolvedValue({
      data: null,
      error: { message: 'Falha controlada' },
    })

    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'game.details.notFoundTitle' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'common.goBackToCatalog' })).toHaveAttribute(
      'href',
      '/games'
    )
  })

  it('ignora a resposta obsoleta depois de trocar rapidamente o parametro da rota', async () => {
    const firstRequest = createDeferred<{ data: CatalogGameDetails; error: null }>()
    const secondRequest = createDeferred<{ data: CatalogGameDetails; error: null }>()
    serviceMocks.getCatalogGameDetailsById.mockImplementation((gameId: number) =>
      gameId === 1 ? firstRequest.promise : secondRequest.promise
    )

    renderPage('/games/1', true)
    await waitFor(() => expect(serviceMocks.getCatalogGameDetailsById).toHaveBeenCalledWith(1))

    fireEvent.click(screen.getByRole('button', { name: 'abrir-segundo-jogo' }))
    await waitFor(() => expect(serviceMocks.getCatalogGameDetailsById).toHaveBeenCalledWith(2))

    secondRequest.resolve({ data: makeGame(2, 'Segundo jogo'), error: null })
    expect(await screen.findByRole('heading', { name: 'Segundo jogo' })).toBeInTheDocument()

    firstRequest.resolve({ data: makeGame(1, 'Primeiro jogo obsoleto'), error: null })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Segundo jogo' })).toBeInTheDocument()
      expect(screen.queryByText('Primeiro jogo obsoleto')).not.toBeInTheDocument()
    })
  })
})
