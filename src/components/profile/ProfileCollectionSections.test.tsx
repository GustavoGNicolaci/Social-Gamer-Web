import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameStatusItem } from '../../services/gameStatusService'
import type { CatalogGamePreview } from '../../services/gameCatalogService'
import type { WishlistGameItem } from '../../services/wishlistService'

const mocks = vi.hoisted(() => ({
  searchCatalogGamesByTitle: vi.fn(),
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    locale: 'pt-BR',
    formatDate: (value: string | null | undefined) => value || 'fallback-date',
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key
      return `${key}:${Object.values(params).join(':')}`
    },
  }),
}))

vi.mock('../../services/gameCatalogService', () => ({
  searchCatalogGamesByTitle: mocks.searchCatalogGamesByTitle,
}))

vi.mock('../../services/wishlistService', () => ({
  updateWishlistPriorities: vi.fn(),
}))

import { ProfileGameStatusSection } from './ProfileGameStatusSection'
import { ProfileWishlistSection } from './ProfileWishlistSection'

function createCatalogGame(id: number, title: string): CatalogGamePreview {
  return {
    id,
    igdbId: String(id),
    title,
    titulo: title,
    coverUrl: null,
    capa_url: null,
    developer: [],
    desenvolvedora: [],
    genres: [],
    generos: [],
    releaseDate: null,
    data_lancamento: null,
    platforms: [],
    plataformas: [],
    sourcePrimary: 'igdb',
    importStatus: 'complete',
  }
}

const statusItem: GameStatusItem = {
  id: 'status-1',
  usuario_id: 'user-1',
  jogo_id: 1,
  status: 'jogando',
  created_at: '2026-07-14T12:00:00.000Z',
  favorito: false,
  jogo: createCatalogGame(1, 'Status Game'),
}

function createWishlistItem(id: number): WishlistGameItem {
  return {
    id: `wishlist-${id}`,
    usuario_id: 'user-1',
    jogo_id: id,
    adicionado_em: '2026-07-14T12:00:00.000Z',
    prioridade: id,
    jogo: {
      id,
      titulo: `Wishlist Game ${id}`,
      capa_url: null,
      desenvolvedora: [],
      generos: [],
      data_lancamento: null,
      plataformas: [],
    },
  }
}

const commonStatusProps = {
  userId: 'user-1',
  items: [statusItem],
  isLoading: false,
  errorMessage: null,
  countLabel: '1',
  totalCount: 1,
  hasMore: false,
  isLoadingMore: false,
  isOwnerView: true,
  onSaveStatus: vi.fn().mockResolvedValue({ ok: true }),
  onDeleteStatus: vi.fn().mockResolvedValue({ ok: true }),
  onRefresh: vi.fn().mockResolvedValue(undefined),
  onLoadMore: vi.fn().mockResolvedValue(undefined),
  onControlsChange: vi.fn(),
}

const commonWishlistProps = {
  userId: 'user-1',
  items: [createWishlistItem(1)],
  isLoading: false,
  errorMessage: null,
  countLabel: '1',
  totalCount: 1,
  hasMore: false,
  isLoadingMore: false,
  isPreparingReorder: false,
  isFullyLoaded: true,
  isOwnerView: true,
  onDeleteWishlistItem: vi.fn().mockResolvedValue({ ok: true }),
  onLoadMore: vi.fn().mockResolvedValue(undefined),
  onLoadFullWishlistForReorder: vi.fn().mockResolvedValue({ ok: true }),
}

function renderInRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
})

afterEach(cleanup)

describe('ProfileGameStatusSection', () => {
  it('preserva o card e encaminha alteracao, favorito e remocao do proprietario', async () => {
    const onSaveStatus = vi.fn().mockResolvedValue({ ok: true })
    const onDeleteStatus = vi.fn().mockResolvedValue({ ok: true })
    renderInRouter(
      <ProfileGameStatusSection
        {...commonStatusProps}
        onSaveStatus={onSaveStatus}
        onDeleteStatus={onDeleteStatus}
      />
    )

    expect(screen.getByText('Status Game')).toBeInTheDocument()
    expect(document.querySelector('.profile-status-card')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zerado' } })
    await waitFor(() => {
      expect(onSaveStatus).toHaveBeenCalledWith({
        gameId: 1,
        status: 'zerado',
        favorito: false,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'profileStatus.markFavorite' }))
    await waitFor(() => {
      expect(onSaveStatus).toHaveBeenCalledWith({
        gameId: 1,
        status: 'jogando',
        favorito: true,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'common.remove' }))
    await waitFor(() => expect(onDeleteStatus).toHaveBeenCalledWith('status-1'))
  })

  it('preserva a busca e o composer para adicionar um jogo', async () => {
    const searchedGame = createCatalogGame(2, 'Searched Game')
    const onSaveStatus = vi.fn().mockResolvedValue({ ok: true })
    mocks.searchCatalogGamesByTitle.mockResolvedValue({ data: [searchedGame], error: null })
    renderInRouter(
      <ProfileGameStatusSection
        {...commonStatusProps}
        items={[]}
        totalCount={0}
        countLabel="0"
        onSaveStatus={onSaveStatus}
      />
    )

    fireEvent.change(screen.getByLabelText('profileStatus.searchLabel'), {
      target: { value: 'Searched' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Searched Game/ }))

    expect(document.querySelector('.profile-status-composer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'profileStatus.markFavorite' }))
    fireEvent.submit(screen.getByRole('button', { name: 'profileStatus.saveToProfile' }).closest('form')!)

    await waitFor(() => {
      expect(onSaveStatus).toHaveBeenCalledWith({
        gameId: 2,
        status: 'jogando',
        favorito: true,
      })
    })
  })

  it('preserva o estado de erro e a acao de tentar novamente', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    renderInRouter(
      <ProfileGameStatusSection
        {...commonStatusProps}
        items={[]}
        errorMessage="status-error"
        onRefresh={onRefresh}
      />
    )

    expect(screen.getByText('status-error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'common.tryAgain' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})

describe('ProfileWishlistSection', () => {
  it('preserva o card e encaminha a remocao para o proprietario', async () => {
    const onDeleteWishlistItem = vi.fn().mockResolvedValue({ ok: true })
    renderInRouter(
      <ProfileWishlistSection
        {...commonWishlistProps}
        onDeleteWishlistItem={onDeleteWishlistItem}
      />
    )

    expect(screen.getByText('Wishlist Game 1')).toBeInTheDocument()
    expect(document.querySelector('.profile-wishlist-grid .profile-wishlist-card')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.remove' }))
    await waitFor(() => expect(onDeleteWishlistItem).toHaveBeenCalledWith('wishlist-1'))
  })

  it('mantem a navegacao horizontal quando ha mais de seis jogos', () => {
    renderInRouter(
      <ProfileWishlistSection
        {...commonWishlistProps}
        items={Array.from({ length: 7 }, (_, index) => createWishlistItem(index + 1))}
        totalCount={7}
        countLabel="7"
      />
    )

    expect(screen.getByText('Wishlist Game 1')).toBeInTheDocument()
    expect(screen.queryByText('Wishlist Game 7')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'profileWishlist.nextGroup' }))

    expect(screen.getByText('Wishlist Game 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'profileWishlist.previousGroup' })).toBeInTheDocument()
  })
})
