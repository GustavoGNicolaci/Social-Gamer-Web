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
  getFollowState,
  getProfileFollowList,
  searchUsers,
  unfollowUser,
} from './userService'

function createSearchQuery(response: { data: unknown[]; error: unknown }) {
  const query = {
    select: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn().mockResolvedValue(response),
  }
  query.select.mockReturnValue(query)
  query.ilike.mockReturnValue(query)
  return query
}

describe('userService search, pagination and follow mutations', () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset()
    supabaseMocks.rpc.mockReset()
  })

  it('merges username and name matches, removes duplicates and prioritizes exact usernames', async () => {
    const exactUser = {
      id: 'user-exact',
      username: 'alpha',
      nome_completo: 'Zed',
      avatar_path: null,
    }
    const nameMatch = {
      id: 'user-name',
      username: 'beta',
      nome_completo: 'Alpha Player',
      avatar_path: null,
    }
    supabaseMocks.from
      .mockReturnValueOnce(createSearchQuery({ data: [exactUser], error: null }))
      .mockReturnValueOnce(
        createSearchQuery({ data: [nameMatch, exactUser], error: null })
      )
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        { user_id: 'user-exact', is_following: true, is_mutual_friend: false },
        { user_id: 'user-name', is_following: false, is_mutual_friend: false },
      ],
      error: null,
    })

    const result = await searchUsers(' alpha ', { limit: 5, viewerId: 'viewer-1' })

    expect(result.data.map(user => user.id)).toEqual(['user-exact', 'user-name'])
    expect(result.data[0]?.isFollowing).toBe(true)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_follow_relationship_map', {
      p_user_ids: ['user-exact', 'user-name'],
    })
  })

  it('keeps search results when only one of the two database lookups fails', async () => {
    supabaseMocks.from
      .mockReturnValueOnce(
        createSearchQuery({ data: [], error: { code: '42501', message: 'denied' } })
      )
      .mockReturnValueOnce(
        createSearchQuery({
          data: [{
            id: 'user-name',
            username: 'beta',
            nome_completo: 'Alpha Player',
            avatar_path: null,
          }],
          error: null,
        })
      )

    const result = await searchUsers('alpha')

    expect(result.error).toBeNull()
    expect(result.data.map(user => user.id)).toEqual(['user-name'])
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('loads every connection page until the server returns a partial page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `follower-${index}`,
      username: `follower-${index}`,
      nome_completo: null,
      avatar_path: null,
      is_following: false,
      relationship_started_at: '2026-07-01T00:00:00.000Z',
    }))
    supabaseMocks.rpc
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({
        data: [{
          id: 'follower-last',
          username: 'follower-last',
          nome_completo: null,
          avatar_path: null,
          is_following: true,
          relationship_started_at: '2026-07-02T00:00:00.000Z',
        }],
        error: null,
      })

    const result = await getProfileFollowList('profile-1', 'followers', 'viewer-1')

    expect(result.data).toHaveLength(101)
    expect(supabaseMocks.rpc).toHaveBeenNthCalledWith(2, 'get_profile_connections', {
      p_profile_id: 'profile-1',
      p_kind: 'followers',
      p_limit: 100,
      p_offset: 100,
    })
  })

  it('treats duplicate follows as idempotent and refreshes the relationship', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate' },
    })
    const single = vi.fn().mockResolvedValue({
      data: {
        is_following: true,
        followers_count: 8,
        following_count: 3,
      },
      error: null,
    })
    supabaseMocks.from.mockReturnValue({ insert })
    supabaseMocks.rpc.mockReturnValue({ single })

    const result = await followUser('viewer-1', 'profile-1')

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      isFollowing: true,
      followersCount: 8,
      followingCount: 3,
    })
  })

  it('never marks the current profile as followed even if the RPC says true', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        is_following: true,
        followers_count: 8,
        following_count: 3,
      },
      error: null,
    })
    supabaseMocks.rpc.mockReturnValue({ single })

    const result = await getFollowState('profile-1', 'profile-1')

    expect(result.data.isFollowing).toBe(false)
    expect(result.data.followersCount).toBe(8)
  })

  it('scopes unfollow to both users before refreshing the relationship', async () => {
    const deleteQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    }
    deleteQuery.delete.mockReturnValue(deleteQuery)
    deleteQuery.eq
      .mockReturnValueOnce(deleteQuery)
      .mockResolvedValueOnce({ error: null })
    const single = vi.fn().mockResolvedValue({
      data: {
        is_following: false,
        followers_count: 7,
        following_count: 2,
      },
      error: null,
    })
    supabaseMocks.from.mockReturnValue(deleteQuery)
    supabaseMocks.rpc.mockReturnValue({ single })

    const result = await unfollowUser('viewer-1', 'profile-1')

    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'seguidor_id', 'viewer-1')
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(2, 'seguido_id', 'profile-1')
    expect(result.data.isFollowing).toBe(false)
  })
})
