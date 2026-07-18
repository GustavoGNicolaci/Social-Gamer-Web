import { supabase } from '../../../supabase-client'
import type {
  FollowListKind,
  FollowRelationshipMapRow,
  ProfileConnectionRpcRow,
  ProfileFollowListPage,
  ProfileFollowListPageOptions,
  UserServiceResult,
} from '../domain/profileUser'
import {
  mapProfileConnectionRows,
  normalizeUserServiceError,
} from './profileUserMappers'

const DEFAULT_PROFILE_CONNECTIONS_PAGE_SIZE = 20
const MAX_PROFILE_CONNECTIONS_PAGE_SIZE = 99

export async function getFollowRelationshipMaps(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<
  UserServiceResult<{
    following: Map<string, boolean>
    mutualFriends: Map<string, boolean>
  }>
> {
  const uniqueUserIds = Array.from(
    new Set(userIds.filter(userId => userId && userId !== viewerId))
  )
  const followingMap = new Map<string, boolean>()
  const mutualFriendMap = new Map<string, boolean>()

  uniqueUserIds.forEach(userId => {
    followingMap.set(userId, false)
    mutualFriendMap.set(userId, false)
  })

  const emptyMaps = { following: followingMap, mutualFriends: mutualFriendMap }

  if (!viewerId || uniqueUserIds.length === 0) {
    return { data: emptyMaps, error: null }
  }

  try {
    const { data, error } = await supabase.rpc('get_follow_relationship_map', {
      p_user_ids: uniqueUserIds,
    })

    if (error) {
      return {
        data: emptyMaps,
        error: normalizeUserServiceError(
          error,
          'Nao foi possivel carregar as relacoes entre estes usuarios.'
        ),
      }
    }

    ;((data || []) as FollowRelationshipMapRow[]).forEach(row => {
      followingMap.set(row.user_id, row.is_following)
      mutualFriendMap.set(row.user_id, row.is_mutual_friend)
    })

    return { data: emptyMaps, error: null }
  } catch (error) {
    return {
      data: emptyMaps,
      error: normalizeUserServiceError(
        error,
        'Erro inesperado ao carregar as relacoes entre estes usuarios.'
      ),
    }
  }
}

export async function getMutualFriendMap(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<UserServiceResult<Map<string, boolean>>> {
  const result = await getFollowRelationshipMaps(viewerId, userIds)
  return { data: result.data.mutualFriends, error: result.error }
}

export async function getFollowingMap(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<UserServiceResult<Map<string, boolean>>> {
  const result = await getFollowRelationshipMaps(viewerId, userIds)
  return { data: result.data.following, error: result.error }
}

function normalizeProfileConnectionsPageOptions(options: ProfileFollowListPageOptions) {
  const requestedLimit = Math.trunc(options.limit ?? DEFAULT_PROFILE_CONNECTIONS_PAGE_SIZE)
  const requestedOffset = Math.trunc(options.offset ?? 0)

  return {
    limit: Math.min(Math.max(requestedLimit, 1), MAX_PROFILE_CONNECTIONS_PAGE_SIZE),
    offset: Math.max(requestedOffset, 0),
  }
}

export async function getProfileFollowListPage(
  profileId: string,
  kind: FollowListKind,
  viewerId?: string | null,
  options: ProfileFollowListPageOptions = {}
): Promise<UserServiceResult<ProfileFollowListPage>> {
  const { limit, offset } = normalizeProfileConnectionsPageOptions(options)
  const emptyPage: ProfileFollowListPage = {
    items: [],
    hasMore: false,
    nextOffset: offset,
  }

  if (!profileId) {
    return { data: emptyPage, error: null }
  }

  try {
    const { data, error } = await supabase.rpc('get_profile_connections', {
      p_profile_id: profileId,
      p_kind: kind,
      p_limit: limit + 1,
      p_offset: offset,
    })

    if (error) {
      return {
        data: emptyPage,
        error: normalizeUserServiceError(
          error,
          kind === 'followers'
            ? 'Nao foi possivel carregar a lista de seguidores deste perfil.'
            : 'Nao foi possivel carregar a lista de perfis seguidos deste perfil.'
        ),
      }
    }

    const rows = ((data || []) as ProfileConnectionRpcRow[]).slice(0, limit)
    return {
      data: {
        items: mapProfileConnectionRows(rows, viewerId),
        hasMore: (data || []).length > limit,
        nextOffset: offset + rows.length,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: emptyPage,
      error: normalizeUserServiceError(
        error,
        kind === 'followers'
          ? 'Erro inesperado ao carregar os seguidores deste perfil.'
          : 'Erro inesperado ao carregar os perfis seguidos por este perfil.'
      ),
    }
  }
}

export async function getProfileFollowList(
  profileId: string,
  kind: FollowListKind,
  viewerId?: string | null
): Promise<UserServiceResult<import('../domain/profileUser').FollowListUser[]>> {
  if (!profileId) {
    return { data: [], error: null }
  }

  try {
    const pageSize = 100
    const connectionRows: ProfileConnectionRpcRow[] = []
    let offset = 0

    while (true) {
      const { data, error } = await supabase.rpc('get_profile_connections', {
        p_profile_id: profileId,
        p_kind: kind,
        p_limit: pageSize,
        p_offset: offset,
      })

      if (error) {
        return {
          data: [],
          error: normalizeUserServiceError(
            error,
            kind === 'followers'
              ? 'Nao foi possivel carregar a lista de seguidores deste perfil.'
              : 'Nao foi possivel carregar a lista de perfis seguidos deste perfil.'
          ),
        }
      }

      const page = (data || []) as ProfileConnectionRpcRow[]
      connectionRows.push(...page)

      if (page.length < pageSize) break
      offset += pageSize
    }

    return { data: mapProfileConnectionRows(connectionRows, viewerId), error: null }
  } catch (error) {
    return {
      data: [],
      error: normalizeUserServiceError(
        error,
        kind === 'followers'
          ? 'Erro inesperado ao carregar os seguidores deste perfil.'
          : 'Erro inesperado ao carregar os perfis seguidos por este perfil.'
      ),
    }
  }
}
