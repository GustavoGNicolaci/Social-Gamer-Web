import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { FollowListUser } from '../../services/userService'

const userServiceMocks = vi.hoisted(() => ({
  followUser: vi.fn(),
  getProfileFollowListPage: vi.fn(),
  unfollowUser: vi.fn(),
}))

const translations: Record<string, string> = {
  'common.followers': 'Followers',
  'common.following': 'Following',
  'connections.loadMore': 'Load more',
  'connections.loadingMore': 'Loading more...',
  'connections.loadingFollowers': 'Loading followers',
  'connections.loadingFollowing': 'Loading following',
  'connections.permissionError': 'Permission denied',
  'connections.emptyFollowers': 'No followers yet',
}

const translate = (key: string) => translations[key] ?? key

vi.mock('../../services/userService', () => userServiceMocks)

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: translate,
    formatNumber: (value: number) => String(value),
  }),
}))

vi.mock('../UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}))

import { ProfileConnectionsModal } from './ProfileConnectionsModal'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: value => resolvePromise?.(value),
  }
}

function createUser(index: number, prefix = 'follower'): FollowListUser {
  return {
    id: `${prefix}-${index}`,
    username: `${prefix}-${index}`,
    nome_completo: null,
    avatar_path: null,
    isFollowing: false,
  }
}

function createPage(items: FollowListUser[], hasMore: boolean, nextOffset: number) {
  return {
    data: {
      items,
      hasMore,
      nextOffset,
    },
    error: null,
  }
}

const defaultProps = {
  initialTab: 'followers' as const,
  profileId: 'profile-1',
  profileUsername: 'player-one',
  profileDisplayName: 'Player One',
  viewerId: 'viewer-1',
  isOwnerView: false,
  followersCount: 21,
  followingCount: 1,
  followersRefreshKey: 0,
  onClose: vi.fn(),
  onRefreshFollowState: vi.fn(),
}

function renderModal(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <MemoryRouter>
      <ProfileConnectionsModal {...defaultProps} {...overrides} />
    </MemoryRouter>
  )
}

describe('ProfileConnectionsModal', () => {
  beforeEach(() => {
    userServiceMocks.followUser.mockReset()
    userServiceMocks.getProfileFollowListPage.mockReset()
    userServiceMocks.unfollowUser.mockReset()
    defaultProps.onClose.mockReset()
    defaultProps.onRefreshFollowState.mockReset()

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('carrega a lista em páginas e adiciona a próxima página sem substituir os itens atuais', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => createUser(index + 1))
    userServiceMocks.getProfileFollowListPage
      .mockResolvedValueOnce(createPage(firstPage, true, 20))
      .mockResolvedValueOnce(createPage([createUser(21)], false, 21))

    renderModal()

    expect(await screen.findByText('@follower-1')).toBeInTheDocument()
    expect(userServiceMocks.getProfileFollowListPage).toHaveBeenNthCalledWith(
      1,
      'profile-1',
      'followers',
      'viewer-1',
      { limit: 20, offset: 0 }
    )
    expect(screen.queryByText('@follower-21')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('@follower-21')).toBeInTheDocument()
    expect(screen.getByText('@follower-1')).toBeInTheDocument()
    expect(userServiceMocks.getProfileFollowListPage).toHaveBeenNthCalledWith(
      2,
      'profile-1',
      'followers',
      'viewer-1',
      { limit: 20, offset: 20 }
    )
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('carrega seguidores e seguindo de forma independente ao trocar de aba', async () => {
    userServiceMocks.getProfileFollowListPage
      .mockResolvedValueOnce(createPage([createUser(1)], false, 1))
      .mockResolvedValueOnce(createPage([createUser(1, 'following')], false, 1))

    renderModal()

    expect(await screen.findByText('@follower-1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Following/ }))

    expect(await screen.findByText('@following-1')).toBeInTheDocument()
    expect(userServiceMocks.getProfileFollowListPage).toHaveBeenNthCalledWith(
      2,
      'profile-1',
      'following',
      'viewer-1',
      { limit: 20, offset: 0 }
    )
  })

  it('mantém os itens carregados quando uma página adicional falha e permite tentar novamente', async () => {
    userServiceMocks.getProfileFollowListPage
      .mockResolvedValueOnce(createPage([createUser(1)], true, 1))
      .mockResolvedValueOnce({
        data: { items: [], hasMore: false, nextOffset: 1 },
        error: { code: '42501', message: 'permission denied' },
      })
      .mockResolvedValueOnce(createPage([createUser(2)], false, 2))

    renderModal()

    expect(await screen.findByText('@follower-1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Permission denied')).toBeInTheDocument()
    expect(screen.getByText('@follower-1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('@follower-2')).toBeInTheDocument()
    expect(screen.queryByText('Permission denied')).not.toBeInTheDocument()
  })

  it('descarta uma resposta antiga quando uma atualização força uma nova requisição', async () => {
    const staleRequest = createDeferred<ReturnType<typeof createPage>>()
    const freshRequest = createDeferred<ReturnType<typeof createPage>>()
    userServiceMocks.getProfileFollowListPage
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(freshRequest.promise)

    const { rerender } = renderModal()

    await waitFor(() => {
      expect(userServiceMocks.getProfileFollowListPage).toHaveBeenCalledTimes(1)
    })

    rerender(
      <MemoryRouter>
        <ProfileConnectionsModal {...defaultProps} followersRefreshKey={1} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(userServiceMocks.getProfileFollowListPage).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      freshRequest.resolve(createPage([createUser(2, 'fresh')], false, 1))
      await freshRequest.promise
    })
    expect(await screen.findByText('@fresh-2')).toBeInTheDocument()

    await act(async () => {
      staleRequest.resolve(createPage([createUser(1, 'stale')], false, 1))
      await staleRequest.promise
    })

    expect(screen.queryByText('@stale-1')).not.toBeInTheDocument()
    expect(screen.getByText('@fresh-2')).toBeInTheDocument()
  })

  it('mostra o estado vazio sem consultar a RPC quando a contagem é zero', async () => {
    renderModal({ followersCount: 0 })

    expect(await screen.findByText('No followers yet')).toBeInTheDocument()
    expect(userServiceMocks.getProfileFollowListPage).not.toHaveBeenCalled()
  })
})
