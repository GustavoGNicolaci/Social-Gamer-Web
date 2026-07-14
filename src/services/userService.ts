import { supabase } from '../supabase-client'
import { normalizeTopFiveEntries, type TopFiveStoredEntry } from '../utils/profileTopFive'
import {
  getRestrictedProfileMessage,
  type ProfilePrivacyMode,
} from '../utils/profilePrivacy'

export interface UserServiceError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface UserSearchResult {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
  isFollowing: boolean
}

export type FollowListKind = 'followers' | 'following'

export interface FollowListUser {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
  isFollowing: boolean
}

export interface PublicUserProfile {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
  bio: string | null
  data_cadastro: string
  topFiveEntries: TopFiveStoredEntry[]
  followersCount: number
  followingCount: number
  isPrivate: boolean
  privacyMode: ProfilePrivacyMode
  canViewRestrictedContent: boolean
  restrictedContentMessage: string | null
}

export interface UserFollowState {
  isFollowing: boolean
  followersCount: number
  followingCount: number
}

interface ServiceResult<T> {
  data: T
  error: UserServiceError | null
}

interface SearchUsersOptions {
  limit?: number
  viewerId?: string | null
}

interface PublicProfileRpcRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
  bio: string | null
  data_cadastro: string
  top_five_entries: unknown
  followers_count: number
  following_count: number
  is_private: boolean
  privacy_mode: string
  can_view_restricted_content: boolean
}

interface UserSearchRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

interface FollowRelationshipMapRow {
  user_id: string
  is_following: boolean
  is_mutual_friend: boolean
}

interface ProfileConnectionRpcRow extends UserSearchRow {
  is_following: boolean
  relationship_started_at: string
}

interface FollowStateRpcRow {
  is_following: boolean
  followers_count: number
  following_count: number
}

const DEFAULT_USER_SEARCH_LIMIT = 5

function normalizeUserServiceError(error: unknown, fallbackMessage: string): UserServiceError {
  if (error && typeof error === 'object') {
    const message =
      'message' in error && typeof error.message === 'string' ? error.message : fallbackMessage
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    const details =
      'details' in error && typeof error.details === 'string' ? error.details : null
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null

    return { code, message, details, hint }
  }

  return { message: fallbackMessage }
}

function dedupeUsersById(users: UserSearchRow[]) {
  return Array.from(new Map(users.map(user => [user.id, user])).values())
}

function getSearchableFullName(user: UserSearchRow) {
  return user.nome_completo?.trim().toLowerCase() || ''
}

function getAlphabeticalDisplayName(user: UserSearchRow) {
  return user.nome_completo?.trim() || user.username
}

function sortUsersByRelevance(users: UserSearchRow[], normalizedQuery: string) {
  const lowerQuery = normalizedQuery.toLowerCase()

  return [...users].sort((leftUser, rightUser) => {
    const leftUsername = leftUser.username.toLowerCase()
    const rightUsername = rightUser.username.toLowerCase()
    const leftName = getSearchableFullName(leftUser)
    const rightName = getSearchableFullName(rightUser)
    const leftExactUsername = leftUsername === lowerQuery ? 1 : 0
    const rightExactUsername = rightUsername === lowerQuery ? 1 : 0
    const leftUsernamePrefix = leftUsername.startsWith(lowerQuery) ? 1 : 0
    const rightUsernamePrefix = rightUsername.startsWith(lowerQuery) ? 1 : 0
    const leftNamePrefix = leftName.startsWith(lowerQuery) ? 1 : 0
    const rightNamePrefix = rightName.startsWith(lowerQuery) ? 1 : 0

    if (leftExactUsername !== rightExactUsername) {
      return rightExactUsername - leftExactUsername
    }

    if (leftUsernamePrefix !== rightUsernamePrefix) {
      return rightUsernamePrefix - leftUsernamePrefix
    }

    if (leftNamePrefix !== rightNamePrefix) {
      return rightNamePrefix - leftNamePrefix
    }

    return compareUsersAlphabetically(leftUser, rightUser)
  })
}

function compareUsersAlphabetically(leftUser: UserSearchRow, rightUser: UserSearchRow) {
  const usernameDelta = leftUser.username.localeCompare(rightUser.username, 'pt-BR')
  if (usernameDelta !== 0) return usernameDelta

  return getAlphabeticalDisplayName(leftUser).localeCompare(
    getAlphabeticalDisplayName(rightUser),
    'pt-BR'
  )
}

function buildPublicProfileResult(
  publicProfileRow: PublicProfileRpcRow
): PublicUserProfile {
  const privacyMode: ProfilePrivacyMode =
    publicProfileRow.privacy_mode === 'friends' || publicProfileRow.privacy_mode === 'private'
      ? publicProfileRow.privacy_mode
      : 'public'
  const canViewRestrictedContent = publicProfileRow.can_view_restricted_content

  return {
    id: publicProfileRow.id,
    username: publicProfileRow.username,
    nome_completo: publicProfileRow.nome_completo,
    avatar_path: publicProfileRow.avatar_path,
    bio: publicProfileRow.bio,
    data_cadastro: publicProfileRow.data_cadastro,
    topFiveEntries: normalizeTopFiveEntries(publicProfileRow.top_five_entries),
    followersCount: Number(publicProfileRow.followers_count) || 0,
    followingCount: Number(publicProfileRow.following_count) || 0,
    isPrivate: publicProfileRow.is_private,
    privacyMode,
    canViewRestrictedContent,
    restrictedContentMessage: canViewRestrictedContent
      ? null
      : getRestrictedProfileMessage(privacyMode),
  }
}

async function getFollowRelationshipMaps(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<ServiceResult<{
  following: Map<string, boolean>
  mutualFriends: Map<string, boolean>
}>> {
  const uniqueUserIds = Array.from(
    new Set(userIds.filter(userId => userId && userId !== viewerId))
  )
  const followingMap = new Map<string, boolean>()
  const mutualFriendMap = new Map<string, boolean>()

  uniqueUserIds.forEach(userId => {
    followingMap.set(userId, false)
    mutualFriendMap.set(userId, false)
  })

  const emptyMaps = {
    following: followingMap,
    mutualFriends: mutualFriendMap,
  }

  if (!viewerId || uniqueUserIds.length === 0) {
    return {
      data: emptyMaps,
      error: null,
    }
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

    return {
      data: emptyMaps,
      error: null,
    }
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
): Promise<ServiceResult<Map<string, boolean>>> {
  const result = await getFollowRelationshipMaps(viewerId, userIds)

  return {
    data: result.data.mutualFriends,
    error: result.error,
  }
}

async function getFollowingMap(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<ServiceResult<Map<string, boolean>>> {
  const result = await getFollowRelationshipMaps(viewerId, userIds)

  return {
    data: result.data.following,
    error: result.error,
  }
}

function buildSearchUsersResult(
  users: UserSearchRow[],
  viewerId: string | null | undefined,
  followingMap: Map<string, boolean>
): FollowListUser[] {
  return users.map(user => ({
    ...user,
    isFollowing: Boolean(viewerId && viewerId !== user.id && followingMap.get(user.id)),
  }))
}

export async function getProfileFollowList(
  profileId: string,
  kind: FollowListKind,
  viewerId?: string | null
): Promise<ServiceResult<FollowListUser[]>> {
  if (!profileId) {
    return {
      data: [],
      error: null,
    }
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

      if (page.length < pageSize) {
        break
      }

      offset += pageSize
    }

    return {
      data: connectionRows.map(row => ({
        id: row.id,
        username: row.username,
        nome_completo: row.nome_completo,
        avatar_path: row.avatar_path,
        isFollowing: Boolean(viewerId && viewerId !== row.id && row.is_following),
      })),
      error: null,
    }
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

export async function searchUsers(
  query: string,
  options: SearchUsersOptions = {}
): Promise<ServiceResult<UserSearchResult[]>> {
  const normalizedQuery = query.trim()
  const limit = options.limit ?? DEFAULT_USER_SEARCH_LIMIT

  if (normalizedQuery.length < 2) {
    return {
      data: [],
      error: null,
    }
  }

  try {
    const [usernameResponse, fullNameResponse] = await Promise.all([
      supabase
        .from('usuarios')
        .select('id, username, nome_completo, avatar_path')
        .ilike('username', `%${normalizedQuery}%`)
        .limit(limit),
      supabase
        .from('usuarios')
        .select('id, username, nome_completo, avatar_path')
        .ilike('nome_completo', `%${normalizedQuery}%`)
        .limit(limit),
    ])

    if (usernameResponse.error && fullNameResponse.error) {
      return {
        data: [],
        error: normalizeUserServiceError(
          usernameResponse.error,
          'Nao foi possivel buscar usuarios agora.'
        ),
      }
    }

    const mergedUsers = sortUsersByRelevance(
      dedupeUsersById([
        ...(((usernameResponse.data || []) as UserSearchRow[]) || []),
        ...(((fullNameResponse.data || []) as UserSearchRow[]) || []),
      ]),
      normalizedQuery
    ).slice(0, limit)

    const followMapResult = await getFollowingMap(
      options.viewerId,
      mergedUsers.map(user => user.id)
    )

    return {
      data: buildSearchUsersResult(mergedUsers, options.viewerId, followMapResult.data),
      error: followMapResult.error,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeUserServiceError(error, 'Erro inesperado ao buscar usuarios agora.'),
    }
  }
}

export async function getPublicProfileByUsername(
  username: string,
  viewerId?: string | null
): Promise<ServiceResult<PublicUserProfile | null>> {
  const normalizedUsername = username.trim()

  if (!normalizedUsername) {
    return {
      data: null,
      error: null,
    }
  }

  try {
    // Authorization is derived from auth.uid() by the RPC. The argument is kept
    // in this service contract for existing callers and local UI state.
    void viewerId
    const { data, error } = await supabase
      .rpc('get_public_profile_by_username', { p_username: normalizedUsername })
      .maybeSingle()

    if (error) {
      return {
        data: null,
        error: normalizeUserServiceError(error, 'Nao foi possivel carregar este perfil.'),
      }
    }

    if (!data) {
      return {
        data: null,
        error: null,
      }
    }

    return {
      data: buildPublicProfileResult(data as PublicProfileRpcRow),
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: normalizeUserServiceError(error, 'Erro inesperado ao carregar este perfil.'),
    }
  }
}

export async function getFollowState(
  viewerId: string | null | undefined,
  profileId: string
): Promise<ServiceResult<UserFollowState>> {
  if (!profileId) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .rpc('get_profile_follow_state', { p_profile_id: profileId })
      .single()

    if (error) {
      return {
        data: {
          isFollowing: false,
          followersCount: 0,
          followingCount: 0,
        },
        error: normalizeUserServiceError(
          error,
          'Nao foi possivel carregar a relacao entre os usuarios.'
        ),
      }
    }

    const followState = data as FollowStateRpcRow

    return {
      data: {
        isFollowing: Boolean(viewerId && viewerId !== profileId && followState.is_following),
        followersCount: Number(followState.followers_count) || 0,
        followingCount: Number(followState.following_count) || 0,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: normalizeUserServiceError(error, 'Erro inesperado ao carregar a relacao deste perfil.'),
    }
  }
}

export async function followUser(
  viewerId: string,
  profileId: string
): Promise<ServiceResult<UserFollowState>> {
  if (viewerId === profileId) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: {
        message: 'Voce nao pode seguir o proprio perfil.',
      },
    }
  }

  try {
    const { error } = await supabase.from('seguidores').insert({
      seguidor_id: viewerId,
      seguido_id: profileId,
    })

    if (error && error.code !== '23505') {
      return {
        data: {
          isFollowing: false,
          followersCount: 0,
          followingCount: 0,
        },
        error: normalizeUserServiceError(error, 'Nao foi possivel seguir este perfil.'),
      }
    }

    return await getFollowState(viewerId, profileId)
  } catch (error) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: normalizeUserServiceError(error, 'Erro inesperado ao seguir este perfil.'),
    }
  }
}

export async function unfollowUser(
  viewerId: string,
  profileId: string
): Promise<ServiceResult<UserFollowState>> {
  if (viewerId === profileId) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: {
        message: 'Voce nao pode deixar de seguir o proprio perfil.',
      },
    }
  }

  try {
    const { error } = await supabase
      .from('seguidores')
      .delete()
      .eq('seguidor_id', viewerId)
      .eq('seguido_id', profileId)

    if (error) {
      return {
        data: {
          isFollowing: false,
          followersCount: 0,
          followingCount: 0,
        },
        error: normalizeUserServiceError(error, 'Nao foi possivel deixar de seguir este perfil.'),
      }
    }

    return await getFollowState(viewerId, profileId)
  } catch (error) {
    return {
      data: {
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      },
      error: normalizeUserServiceError(error, 'Erro inesperado ao deixar de seguir este perfil.'),
    }
  }
}
