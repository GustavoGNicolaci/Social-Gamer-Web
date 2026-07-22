import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogGameDetails } from '../../../services/gameCatalogService'
import { GameDetailsOverview } from './GameDetailsOverview'
import {
  GameDetailsUserActions,
  type GameDetailsUserActionsProps,
} from './GameDetailsUserActions'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      key === 'game.details.profilePanelCurrent' && params?.status
        ? `${key}:${params.status}`
        : key,
    formatDate: () => '01/01/2026',
    formatNumber: (value: number) => String(value),
  }),
}))

vi.mock('../../../components/GameCoverImage', () => ({
  GameCoverImage: ({ alt, className }: { alt: string; className?: string }) => (
    <img alt={alt} className={className} />
  ),
}))

const game: CatalogGameDetails = {
  id: 42,
  igdbId: '42',
  title: 'Test Game',
  titulo: 'Test Game',
  coverUrl: null,
  capa_url: null,
  developer: ['Studio'],
  desenvolvedora: ['Studio'],
  genres: ['RPG'],
  generos: ['RPG'],
  releaseDate: '2026-01-01',
  data_lancamento: '2026-01-01',
  platforms: ['PC'],
  plataformas: ['PC'],
  sourcePrimary: 'igdb',
  importStatus: 'ready',
  slug: 'test-game',
  description: 'Description',
  descricao: 'Description',
  sourceDescription: 'Description',
  shortDescription: 'Short description',
  externalRating: null,
  externalRatingCount: 0,
  externalUpdatedAt: null,
  metadata: null,
  media: [],
  screenshots: [],
  coverMedia: null,
  descriptionLocale: 'en',
  descriptionFallback: true,
  translationStatus: null,
}

type ActionsOverrides = Omit<Partial<GameDetailsUserActionsProps>, 'wishlist' | 'status'> & {
  wishlist?: Partial<GameDetailsUserActionsProps['wishlist']>
  status?: Partial<GameDetailsUserActionsProps['status']>
}

const createActions = (overrides: ActionsOverrides = {}): GameDetailsUserActionsProps => {
  const { wishlist, status, ...rootOverrides } = overrides

  return {
    authenticated: false,
    ...rootOverrides,
    wishlist: {
      loading: false,
      saving: false,
      saved: false,
      feedback: null,
      toggle: vi.fn(),
      ...wishlist,
    },
    status: {
      loading: false,
      saving: false,
      pending: null,
      current: null,
      feedback: null,
      select: vi.fn(),
      ...status,
    },
  }
}

afterEach(cleanup)

describe('GameDetailsOverview', () => {
  it('preserva hero, destaques, descricao e acoes de visitante', () => {
    render(
      <MemoryRouter>
        <GameDetailsOverview
          game={game}
          summary={{ average: 8.5, reviews: 2, comments: 3 }}
          userActions={createActions()}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Test Game' })).toBeInTheDocument()
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    expect(screen.getByText('PC')).toBeInTheDocument()
    expect(screen.getByText('Description')).toHaveClass('game-details-description-body')
    expect(screen.getByText('game.details.descriptionFallbackEnglish')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'game.details.loginToRate' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(screen.getByRole('link', { name: 'game.details.loginToSave' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(screen.queryByText('common.profile')).not.toBeInTheDocument()
  })
})

describe('GameDetailsUserActions', () => {
  it('mantem wishlist, atalhos e feedback para usuario autenticado', () => {
    const onWishlistToggle = vi.fn()

    render(
      <MemoryRouter>
        <GameDetailsUserActions
          {...createActions({
            authenticated: true,
            wishlist: {
              saved: true,
              feedback: { tone: 'success', message: 'wishlist-feedback' },
              toggle: onWishlistToggle,
            },
          })}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'game.details.rateNow' })).toHaveAttribute(
      'href',
      '#game-community'
    )
    const wishlistButton = screen.getByRole('button', { name: 'game.details.inWishlist' })
    expect(wishlistButton).toHaveClass('is-saved')
    fireEvent.click(wishlistButton)
    expect(onWishlistToggle).toHaveBeenCalledTimes(1)
    expect(screen.getByText('wishlist-feedback')).toHaveClass(
      'game-details-feedback',
      'is-success'
    )
    expect(screen.getByText('common.profile')).toBeInTheDocument()
  })

  it('preserva selecao, estado de remocao e callback do status rapido', () => {
    const onStatusSelect = vi.fn()
    const { container, rerender } = render(
      <MemoryRouter>
        <GameDetailsUserActions
          {...createActions({
            authenticated: true,
            status: {
              current: 'zerado',
              pending: 'zerado',
              saving: true,
              select: onStatusSelect,
            },
          })}
        />
      </MemoryRouter>
    )

    const selectedButton = container.querySelector<HTMLButtonElement>(
      '.game-details-profile-status-button.is-zerado.is-selected'
    )
    expect(selectedButton).not.toBeNull()
    expect(selectedButton).toBeDisabled()
    expect(selectedButton).toHaveTextContent('common.removing')
    expect(selectedButton).toHaveTextContent('game.details.profilePanelRemoveHint')

    rerender(
      <MemoryRouter>
        <GameDetailsUserActions
          {...createActions({
            authenticated: true,
            status: {
              current: 'zerado',
              select: onStatusSelect,
            },
          })}
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /game\.status\.zerado/ }))
    expect(onStatusSelect).toHaveBeenCalledWith('zerado')
  })

  it('oferece somente os quatro status atuais para novos registros', () => {
    const { container } = render(
      <MemoryRouter>
        <GameDetailsUserActions
          {...createActions({
            authenticated: true,
          })}
        />
      </MemoryRouter>
    )

    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '.game-details-profile-status-button'
        )
      ).map(button => button.textContent)
    ).toEqual([
      expect.stringContaining('game.status.jogando'),
      expect.stringContaining('game.status.zerado'),
      expect.stringContaining('game.status.dropado'),
      expect.stringContaining('game.status.pausado'),
    ])
    expect(
      screen.queryByRole('button', { name: /game\.status\.planejando/ })
    ).not.toBeInTheDocument()
  })

  it('mantem um status planejando legado visivel, removivel e fora das escolhas atuais', () => {
    const onStatusSelect = vi.fn()
    const { container } = render(
      <MemoryRouter>
        <GameDetailsUserActions
          {...createActions({
            authenticated: true,
            status: {
              current: 'planejando',
              select: onStatusSelect,
            },
          })}
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/profileStatus\.legacyStatus/)).toBeInTheDocument()
    expect(
      container.querySelectorAll('.game-details-profile-status-button')
    ).toHaveLength(4)
    expect(
      screen.queryByRole('button', { name: /game\.status\.planejando/ })
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /profileStatus\.removeLegacyStatus/ })
    )
    expect(onStatusSelect).toHaveBeenCalledWith('planejando')
  })
})
