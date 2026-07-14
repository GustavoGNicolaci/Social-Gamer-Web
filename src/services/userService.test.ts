import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../supabase-client', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}))

import {
  followUser,
  getMutualFriendMap,
  getPublicProfileByUsername,
} from './userService'

describe('userService profile projections', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
  })

  it('adapta a projeção pública liberada pelo banco sem acessar usuarios diretamente', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'profile-1',
        username: 'player-one',
        nome_completo: 'Player One',
        avatar_path: 'profile-1/avatar.webp',
        bio: 'Bio pública',
        data_cadastro: '2026-01-01T00:00:00.000Z',
        top_five_entries: [
          { posicao: 2, jogo_id: 20 },
          { posicao: 1, jogo_id: 10 },
          { posicao: 1, jogo_id: 30 },
        ],
        followers_count: 12,
        following_count: 7,
        is_private: false,
        privacy_mode: 'public',
        can_view_restricted_content: true,
      },
      error: null,
    })
    supabaseMocks.rpc.mockReturnValue({ maybeSingle })

    const result = await getPublicProfileByUsername(' player-one ', 'viewer-1')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_public_profile_by_username', {
      p_username: 'player-one',
    })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      id: 'profile-1',
      bio: 'Bio pública',
      followersCount: 12,
      followingCount: 7,
      privacyMode: 'public',
      canViewRestrictedContent: true,
      restrictedContentMessage: null,
    })
    expect(result.data?.topFiveEntries).toEqual([
      { posicao: 1, jogo_id: 10 },
      { posicao: 2, jogo_id: 20 },
    ])
  })

  it('preserva o mascaramento retornado pelo banco para perfil privado', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'profile-private',
        username: 'private-player',
        nome_completo: null,
        avatar_path: null,
        bio: null,
        data_cadastro: '2026-01-01T00:00:00.000Z',
        top_five_entries: [],
        followers_count: 3,
        following_count: 4,
        is_private: true,
        privacy_mode: 'private',
        can_view_restricted_content: false,
      },
      error: null,
    })
    supabaseMocks.rpc.mockReturnValue({ maybeSingle })

    const result = await getPublicProfileByUsername('private-player', 'viewer-1')

    expect(result.data?.bio).toBeNull()
    expect(result.data?.topFiveEntries).toEqual([])
    expect(result.data?.isPrivate).toBe(true)
    expect(result.data?.canViewRestrictedContent).toBe(false)
    expect(result.data?.restrictedContentMessage).toBe('Este perfil esta privado.')
  })

  it('calcula amizade mútua pela RPC vinculada à sessão autenticada', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        { user_id: 'friend-1', is_following: true, is_mutual_friend: true },
        { user_id: 'followed-1', is_following: true, is_mutual_friend: false },
      ],
      error: null,
    })

    const result = await getMutualFriendMap('viewer-1', ['friend-1', 'followed-1'])

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_follow_relationship_map', {
      p_user_ids: ['friend-1', 'followed-1'],
    })
    expect(result.data.get('friend-1')).toBe(true)
    expect(result.data.get('followed-1')).toBe(false)
  })

  it('deixa o banco atribuir id e data da relação de follow', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const single = vi.fn().mockResolvedValue({
      data: {
        is_following: true,
        followers_count: 4,
        following_count: 2,
      },
      error: null,
    })
    supabaseMocks.from.mockReturnValue({ insert })
    supabaseMocks.rpc.mockReturnValue({ single })

    const result = await followUser('viewer-1', 'profile-1')

    expect(insert).toHaveBeenCalledWith({
      seguidor_id: 'viewer-1',
      seguido_id: 'profile-1',
    })
    expect(result.data).toEqual({
      isFollowing: true,
      followersCount: 4,
      followingCount: 2,
    })
  })
})
