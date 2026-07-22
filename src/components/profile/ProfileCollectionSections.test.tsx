import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameStatusItem } from '../../services/gameStatusService'
import type { CatalogGamePreview } from '../../services/gameCatalogService'
import type { WishlistGameItem } from '../../services/wishlistService'

const mocks = vi.hoisted(() => ({
  getCatalogGamesByIds: vi.fn(),
  searchCatalogGamesByTitle: vi.fn(),
  translate: (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}:${Object.values(params).join(':')}`
  },
  updateWishlistPriorities: vi.fn(),
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    locale: 'pt-BR',
    formatDate: (value: string | null | undefined) => value || 'fallback-date',
    t: mocks.translate,
  }),
}))

vi.mock('../../services/gameCatalogService', () => ({
  getCatalogGamesByIds: mocks.getCatalogGamesByIds,
  searchCatalogGamesByTitle: mocks.searchCatalogGamesByTitle,
}))

vi.mock('../../services/wishlistService', () => ({
  updateWishlistPriorities: mocks.updateWishlistPriorities,
}))

import { ProfileGameStatusSection } from './ProfileGameStatusSection'
import { ProfileTopFiveSection } from './ProfileTopFiveSection'
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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  mocks.getCatalogGamesByIds.mockResolvedValue({ data: [], error: null })
  mocks.updateWishlistPriorities.mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

    const statusSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(Array.from(statusSelect.options).map(option => option.value)).toEqual([
      'jogando',
      'zerado',
      'dropado',
      'pausado',
    ])
    fireEvent.change(statusSelect, { target: { value: 'zerado' } })
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

    expect(screen.getByLabelText('profileStatus.searchLabel')).toHaveAttribute(
      'aria-controls',
      'profile-status-search-results-user-1'
    )
    fireEvent.click(await screen.findByRole('button', { name: /Searched Game/ }))

    expect(document.querySelector('.profile-status-composer')).toBeInTheDocument()
    const composerStatusSelect = screen.getByRole('combobox')
    expect(
      Array.from((composerStatusSelect as HTMLSelectElement).options).map(
        option => option.value
      )
    ).toEqual(['jogando', 'zerado', 'dropado', 'pausado'])
    expect(
      screen.queryByRole('option', { name: 'game.status.planejando' })
    ).not.toBeInTheDocument()
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

  it('preserva a matematica de pagina e reinicia a pagina ao alterar os controles', () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      ...statusItem,
      id: `status-${index + 1}`,
      jogo_id: index + 1,
      created_at: `2026-07-14T12:00:${String(index + 1).padStart(2, '0')}.000Z`,
      jogo: createCatalogGame(index + 1, `Status Game ${index + 1}`),
    }))
    const onControlsChange = vi.fn()

    renderInRouter(
      <ProfileGameStatusSection
        {...commonStatusProps}
        items={items}
        totalCount={25}
        countLabel="25"
        onControlsChange={onControlsChange}
      />
    )

    expect(screen.queryByText('Status Game 1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'profileStatus.next' }))
    expect(screen.getByText('Status Game 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /profileStatus.sortAria/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'profileStatus.sort.oldest' }))

    expect(screen.getByText('Status Game 1')).toBeInTheDocument()
    expect(onControlsChange).toHaveBeenLastCalledWith({
      sortValue: 'oldest',
      statuses: [],
    })

    fireEvent.click(screen.getByRole('button', { name: /profileStatus.sortAria/ }))
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(4)
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'game.status.planejando' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'game.status.jogando' }))

    expect(onControlsChange).toHaveBeenLastCalledWith({
      sortValue: 'oldest',
      statuses: ['jogando'],
    })
  })

  it('permite trocar ou remover um status planejando legado sem oferece-lo novamente', async () => {
    const onSaveStatus = vi.fn().mockResolvedValue({ ok: true })
    const onDeleteStatus = vi.fn().mockResolvedValue({ ok: true })
    const legacyItem: GameStatusItem = {
      ...statusItem,
      id: 'status-legacy',
      jogo_id: 9,
      status: 'planejando',
      jogo: createCatalogGame(9, 'Legacy Status Game'),
    }

    renderInRouter(
      <ProfileGameStatusSection
        {...commonStatusProps}
        items={[legacyItem]}
        onSaveStatus={onSaveStatus}
        onDeleteStatus={onDeleteStatus}
      />
    )

    expect(screen.getAllByText('profileStatus.legacyStatus').length).toBeGreaterThan(0)
    const statusSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(statusSelect).toHaveValue('planejando')
    expect(
      screen.getByRole('option', { name: 'profileStatus.legacyStatus' })
    ).toBeDisabled()
    expect(
      screen.queryByRole('option', { name: 'game.status.planejando' })
    ).not.toBeInTheDocument()

    fireEvent.change(statusSelect, { target: { value: 'zerado' } })
    await waitFor(() => {
      expect(onSaveStatus).toHaveBeenCalledWith({
        gameId: 9,
        status: 'zerado',
        favorito: false,
      })
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'profileStatus.removeLegacyStatus' })
    )
    await waitFor(() => {
      expect(onDeleteStatus).toHaveBeenCalledWith('status-legacy')
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

  it('mantem a reordenacao otimista, a animacao FLIP e o rollback em caso de erro', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(pointer: fine)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const siblings = this.parentElement ? Array.from(this.parentElement.children) : []
      const index = Math.max(siblings.indexOf(this), 0)
      const left = index * 100

      return {
        x: left,
        y: 0,
        top: 0,
        right: left + 80,
        bottom: 80,
        left,
        width: 80,
        height: 80,
        toJSON: () => ({}),
      }
    })
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    const saveOrder = createDeferred<{
      error: { message: string; details: string; hint: string; code: string }
    }>()
    mocks.updateWishlistPriorities.mockReturnValue(saveOrder.promise)

    renderInRouter(
      <ProfileWishlistSection
        {...commonWishlistProps}
        items={[createWishlistItem(1), createWishlistItem(2), createWishlistItem(3)]}
        totalCount={3}
      />
    )

    const dragHandle = await screen.findByRole('button', {
      name: 'profileWishlist.reorderAria:Wishlist Game 1',
    })
    const targetCard = screen.getByText('Wishlist Game 2').closest('article')
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: vi.fn(),
      setDragImage: vi.fn(),
    }

    fireEvent.dragStart(dragHandle, { dataTransfer })
    fireEvent.dragOver(targetCard!, { dataTransfer })
    fireEvent.drop(targetCard!, { dataTransfer })

    expect(
      screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    ).toEqual(['Wishlist Game 2', 'Wishlist Game 1', 'Wishlist Game 3'])
    expect(mocks.updateWishlistPriorities).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({ id: 'wishlist-2', prioridade: 1 }),
        expect.objectContaining({ id: 'wishlist-1', prioridade: 2 }),
      ])
    )
    await waitFor(() => expect(animate).toHaveBeenCalled())

    await act(async () => {
      saveOrder.resolve({
        error: {
          message: 'database unavailable',
          details: '',
          hint: '',
          code: 'XX000',
        },
      })
      await saveOrder.promise
    })

    expect(
      screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    ).toEqual(['Wishlist Game 1', 'Wishlist Game 2', 'Wishlist Game 3'])
    expect(screen.getByText('profileWishlist.orderSaveError')).toBeInTheDocument()

    delete (HTMLElement.prototype as { animate?: unknown }).animate
  })

  it('oferece reordenacao por botoes e preserva o mesmo rollback', async () => {
    const saveOrder = createDeferred<{
      error: { message: string; details: string; hint: string; code: string }
    }>()
    mocks.updateWishlistPriorities.mockReturnValue(saveOrder.promise)

    renderInRouter(
      <ProfileWishlistSection
        {...commonWishlistProps}
        items={[createWishlistItem(1), createWishlistItem(2), createWishlistItem(3)]}
        totalCount={3}
      />
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'profileWishlist.moveEarlier:Wishlist Game 2',
      })
    )

    expect(
      screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    ).toEqual(['Wishlist Game 2', 'Wishlist Game 1', 'Wishlist Game 3'])
    expect(mocks.updateWishlistPriorities).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({ id: 'wishlist-2', prioridade: 1 }),
        expect.objectContaining({ id: 'wishlist-1', prioridade: 2 }),
      ])
    )

    await act(async () => {
      saveOrder.resolve({
        error: {
          message: 'database unavailable',
          details: '',
          hint: '',
          code: 'XX000',
        },
      })
      await saveOrder.promise
    })

    expect(
      screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    ).toEqual(['Wishlist Game 1', 'Wishlist Game 2', 'Wishlist Game 3'])
  })
})

describe('ProfileTopFiveSection', () => {
  it('mantem o cache visual otimista e restaura a selecao quando a persistencia falha', async () => {
    const currentGame = createCatalogGame(1, 'Current Top Game')
    const replacementGame = createCatalogGame(2, 'Replacement Top Game')
    const saveTopFive = createDeferred<{ ok: boolean; message?: string }>()
    const onSaveTopFive = vi.fn().mockReturnValue(saveTopFive.promise)
    mocks.getCatalogGamesByIds.mockImplementation((gameIds: number[]) =>
      Promise.resolve({
        data: gameIds.includes(1) ? [currentGame] : [],
        error: null,
      })
    )
    mocks.searchCatalogGamesByTitle.mockResolvedValue({
      data: [replacementGame],
      error: null,
    })

    renderInRouter(
      <ProfileTopFiveSection
        isOwnerView
        entries={[{ posicao: 1, jogo_id: 1 }]}
        onSaveTopFive={onSaveTopFive}
      />
    )

    expect(await screen.findByText('Current Top Game')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'profileTopFive.changeGame' }))
    fireEvent.change(screen.getByLabelText('profileTopFive.searchLabel'), {
      target: { value: 'Replacement' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Replacement Top Game/ }))

    expect(onSaveTopFive).toHaveBeenCalledWith([{ posicao: 1, jogo_id: 2 }])
    expect(screen.getAllByText('Replacement Top Game').length).toBeGreaterThan(0)

    await act(async () => {
      saveTopFive.resolve({ ok: false, message: 'top-five-save-failed' })
      await saveTopFive.promise
    })

    expect(screen.getByText('top-five-save-failed')).toBeInTheDocument()
    expect(screen.getAllByText('Current Top Game').length).toBeGreaterThan(0)
  })
})
