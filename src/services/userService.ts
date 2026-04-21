import { supabase } from '../supabase-client'
import { getTopFiveEntriesFromPrivacySettings, type TopFiveStoredEntry } from '../utils/profileTopFive'

export interface UserServiceError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface UserSearchResult {
  id: string
  username: string
  nome_completo: string
  avatar_path: string | null
  isFollowing: boolean
}

export interface PublicUserProfile {
  id: string
  username: string
  nome_completo: string
  avatar_path: string | null
  bio: string | null
  data_cadastro: string
  topFiveEntries: TopFiveStoredEntry[]
  followersCount: number
  followingCount: number
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

interface PublicUserRow {
  id: string
  username: string
  nome_completo: string
  avatar_path: string | null
  bio: string | null
  data_cadastro: string
  configuracoes_privacidade: Record<string, unknown> | null
}

interface UserSearchRow {
  id: string
  username: string
  nome_completo: string
  avatar_path: string | null
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

function sortUsersByRelevance(users: UserSearchRow[], normalizedQuery: string) {
  const lowerQuery = normalizedQuery.toLowerCase()

  return [...users].sort((leftUser, rightUser) => {
    const leftUsername = leftUser.username.toLowerCase()
    const rightUsername = rightUser.username.toLowerCase()
    const leftName = leftUser.nome_completo.toLowerCase()
    const rightName = rightUser.nome_completo.toLowerCase()
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

    const usernameDelta = leftUser.username.localeCompare(rightUser.username, 'pt-BR')
    if (usernameDelta !== 0) return usernameDelta

    return leftUser.nome_completo.localeCompare(rightUser.nome_completo, 'pt-BR')
  })
}

async function getFollowingMap(
  viewerId: string | null | undefined,
  userIds: string[]
): Promise<ServiceResult<Map<string, boolean>>> {
  const followingMap = new Map<string, boolean>()

  userIds.forEach(userId => {
    followingMap.set(userId, false)
  })

  if (!viewerId || userIds.length === 0) {
    return {
      data: followingMap,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('seguidores')
      .select('seguido_id')
      .eq('seguidor_id', viewerId)
      .in('seguido_id', userIds.filter(userId => userId !== viewerId))

    if (error) {
      return {
        data: followingMap,
        error: normalizeUserServiceError(
          error,
          'Nao foi possivel carregar o estado de follow destes usuarios.'
        ),
      }
    }

    ;((data || []) as Array<{ seguido_id: string }>).forEach(row => {
      followingMap.set(row.seguido_id, true)
    })

    return {
      data: followingMap,
      error: null,
    }
  } catch (error) {
    return {
      data: followingMap,
      error: normalizeUserServiceError(
        error,
        'Erro inesperado ao carregar o estado de follow destes usuarios.'
      ),
    }
  }
}

function buildSearchUsersResult(
  users: UserSearchRow[],
  viewerId: string | null | undefined,
  followingMap: Map<string, boolean>
): UserSearchResult[] {
  return users.map(user => ({
    ...user,
    isFollowing: Boolean(viewerId && viewerId !== user.id && followingMap.get(user.id)),
  }))
}

async function getFollowCounts(profileId: string): Promise<ServiceResult<{
  followersCount: number
  followingCount: number
}>> {
  try {
    const [followersResponse, followingResponse] = await Promise.all([
      supabase.from('seguidores').select('id', { count: 'exact', head: true }).eq('seguido_id', profileId),
      supabase.from('seguidores').select('id', { count: 'exact', head: true }).eq('seguidor_id', profileId),
    ])

    if (followersResponse.error) {
      return {
        data: {
          followersCount: 0,
          followingCount: 0,
        },
        error: normalizeUserServiceError(
          followersResponse.error,
          'Nao foi possivel carregar a contagem de seguidores.'
        ),
      }
    }

    if (followingResponse.error) {
      return {
        data: {
          followersCount: 0,
          followingCount: 0,
        },
        error: normalizeUserServiceError(
          followingResponse.error,
          'Nao foi possivel carregar a contagem de perfis seguidos.'
        ),
      }
    }

    return {
      data: {
        followersCount: followersResponse.count || 0,
        followingCount: followingResponse.count || 0,
      },
      error: null,
    }
  } catch (error) {
    return {
      data: {
        followersCount: 0,
        followingCount: 0,
      },
      error: normalizeUserServiceError(error, 'Erro inesperado ao carregar as contagens deste perfil.'),
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
  username: string
): Promise<ServiceResult<PublicUserProfile | null>> {
  const normalizedUsername = username.trim()

  if (!normalizedUsername) {
    return {
      data: null,
      error: null,
    }
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username, nome_completo, avatar_path, bio, data_cadastro, configuracoes_privacidade')
      .eq('username', normalizedUsername)
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

    const publicProfileRow = data as PublicUserRow
    const followCountsResult = await getFollowCounts(publicProfileRow.id)

    return {
      data: {
        id: publicProfileRow.id,
        username: publicProfileRow.username,
        nome_completo: publicProfileRow.nome_completo,
        avatar_path: publicProfileRow.avatar_path,
        bio: publicProfileRow.bio,
        data_cadastro: publicProfileRow.data_cadastro,
        topFiveEntries: getTopFiveEntriesFromPrivacySettings(
          publicProfileRow.configuracoes_privacidade
        ),
        followersCount: followCountsResult.data.followersCount,
        followingCount: followCountsResult.data.followingCount,
      },
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
    const [followCountsResult, viewerRelationshipResponse] = await Promise.all([
      getFollowCounts(profileId),
      viewerId && viewerId !== profileId
        ? supabase
            .from('seguidores')
            .select('id')
            .eq('seguidor_id', viewerId)
            .eq('seguido_id', profileId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (followCountsResult.error) {
      return {
        data: {
          isFollowing: false,
          followersCount: followCountsResult.data.followersCount,
          followingCount: followCountsResult.data.followingCount,
        },
        error: followCountsResult.error,
      }
    }

    if (viewerRelationshipResponse.error) {
      return {
        data: {
          isFollowing: false,
          followersCount: followCountsResult.data.followersCount,
          followingCount: followCountsResult.data.followingCount,
        },
        error: normalizeUserServiceError(
          viewerRelationshipResponse.error,
          'Nao foi possivel carregar a relacao entre os usuarios.'
        ),
      }
    }

    return {
      data: {
        isFollowing: Boolean(viewerId && viewerId !== profileId && viewerRelationshipResponse.data),
        followersCount: followCountsResult.data.followersCount,
        followingCount: followCountsResult.data.followingCount,
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
      data_inicio: new Date().toISOString(),
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
