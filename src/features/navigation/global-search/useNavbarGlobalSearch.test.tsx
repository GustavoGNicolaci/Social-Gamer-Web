import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import type { CatalogGamePreview } from '../../../services/gameCatalogService'
import type { UserSearchResult } from '../../../services/userService'
import { useNavbarGlobalSearch } from './useNavbarGlobalSearch'

const serviceMocks = vi.hoisted(() => ({
  followUser: vi.fn(),
  searchCatalogGamesByTitle: vi.fn(),
  searchUsers: vi.fn(),
  unfollowUser: vi.fn(),
}))

vi.mock('../../../services/gameCatalogService', () => ({
  searchCatalogGamesByTitle: serviceMocks.searchCatalogGamesByTitle,
}))

vi.mock('../../../services/userService', () => ({
  followUser: serviceMocks.followUser,
  searchUsers: serviceMocks.searchUsers,
  unfollowUser: serviceMocks.unfollowUser,
}))

const game: CatalogGamePreview = {
  id: 7,
  igdbId: '7',
  title: 'Halo',
  titulo: 'Halo',
  coverUrl: null,
  capa_url: null,
  developer: ['Bungie'],
  desenvolvedora: ['Bungie'],
  genres: ['Shooter'],
  generos: ['Shooter'],
  releaseDate: '2001-11-15',
  data_lancamento: '2001-11-15',
  platforms: ['Xbox'],
  plataformas: ['Xbox'],
  sourcePrimary: 'igdb',
  importStatus: 'ready',
}

const searchUser: UserSearchResult = {
  id: 'target-user',
  username: 'cortana',
  nome_completo: 'Cortana',
  avatar_path: null,
  isFollowing: false,
}

function RouterWrapper({ children }: PropsWithChildren) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useNavbarGlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    serviceMocks.searchCatalogGamesByTitle.mockResolvedValue({ data: [game], error: null })
    serviceMocks.searchUsers.mockResolvedValue({ data: [searchUser], error: null })
    serviceMocks.followUser.mockResolvedValue({
      data: { isFollowing: true, followersCount: 1, followingCount: 1 },
      error: null,
    })
    serviceMocks.unfollowUser.mockResolvedValue({
      data: { isFollowing: false, followersCount: 0, followingCount: 0 },
      error: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('respeita o limite mínimo e executa as buscas após o debounce', async () => {
    const { result } = renderHook(
      () => useNavbarGlobalSearch({ viewerId: 'viewer-user', t: key => key }),
      { wrapper: RouterWrapper }
    )

    act(() => result.current.handleSearchChange('h'))
    await act(() => vi.advanceTimersByTimeAsync(220))

    expect(serviceMocks.searchCatalogGamesByTitle).not.toHaveBeenCalled()
    expect(serviceMocks.searchUsers).not.toHaveBeenCalled()
    expect(result.current.shouldShowSearchDropdown).toBe(false)

    act(() => result.current.handleSearchChange('Halo'))
    expect(result.current.searchLoading).toBe(true)
    expect(serviceMocks.searchCatalogGamesByTitle).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(220))

    expect(serviceMocks.searchCatalogGamesByTitle).toHaveBeenCalledWith('Halo')
    expect(serviceMocks.searchUsers).toHaveBeenCalledWith('Halo', { viewerId: 'viewer-user' })
    expect(result.current.gameResults).toEqual([game])
    expect(result.current.userResults).toEqual([searchUser])
    expect(result.current.shouldShowSearchDropdown).toBe(true)
  })

  it('atualiza somente o resultado seguido após a mutação', async () => {
    const { result } = renderHook(
      () => useNavbarGlobalSearch({ viewerId: 'viewer-user', t: key => key }),
      { wrapper: RouterWrapper }
    )

    act(() => result.current.handleSearchChange('Cortana'))
    await act(() => vi.advanceTimersByTimeAsync(220))

    await act(async () => {
      await result.current.handleToggleFollowFromSearch(result.current.userResults[0])
    })

    expect(serviceMocks.followUser).toHaveBeenCalledWith('viewer-user', 'target-user')
    expect(serviceMocks.unfollowUser).not.toHaveBeenCalled()
    expect(result.current.userResults[0].isFollowing).toBe(true)
    expect(result.current.followPendingIds).toEqual([])
  })
})
