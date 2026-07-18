import { supabase } from '../../../supabase-client'
import type {
  SearchUsersOptions,
  UserSearchResult,
  UserSearchRow,
  UserServiceResult,
} from '../domain/profileUser'
import { getFollowingMap } from './profileConnectionsRepository'
import {
  dedupeUsersById,
  normalizeUserServiceError,
  sortUsersByRelevance,
} from './profileUserMappers'

const DEFAULT_USER_SEARCH_LIMIT = 5

export async function searchUsers(
  query: string,
  options: SearchUsersOptions = {}
): Promise<UserServiceResult<UserSearchResult[]>> {
  const normalizedQuery = query.trim()
  const limit = options.limit ?? DEFAULT_USER_SEARCH_LIMIT

  if (normalizedQuery.length < 2) {
    return { data: [], error: null }
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
        ...((usernameResponse.data || []) as UserSearchRow[]),
        ...((fullNameResponse.data || []) as UserSearchRow[]),
      ]),
      normalizedQuery
    ).slice(0, limit)
    const followMapResult = await getFollowingMap(
      options.viewerId,
      mergedUsers.map(user => user.id)
    )

    return {
      data: mergedUsers.map(user => ({
        ...user,
        isFollowing: Boolean(
          options.viewerId &&
            options.viewerId !== user.id &&
            followMapResult.data.get(user.id)
        ),
      })),
      error: followMapResult.error,
    }
  } catch (error) {
    return {
      data: [],
      error: normalizeUserServiceError(error, 'Erro inesperado ao buscar usuarios agora.'),
    }
  }
}
