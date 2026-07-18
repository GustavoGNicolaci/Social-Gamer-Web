import { normalizeTopFiveEntries } from '../../../utils/profileTopFive'
import {
  getRestrictedProfileMessage,
  type ProfilePrivacyMode,
} from '../../../utils/profilePrivacy'
import type {
  FollowListUser,
  ProfileConnectionRpcRow,
  PublicProfileRpcRow,
  PublicUserProfile,
  UserSearchRow,
  UserServiceError,
} from '../domain/profileUser'

export function normalizeUserServiceError(
  error: unknown,
  fallbackMessage: string
): UserServiceError {
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

export function buildPublicProfileResult(row: PublicProfileRpcRow): PublicUserProfile {
  const privacyMode: ProfilePrivacyMode =
    row.privacy_mode === 'friends' || row.privacy_mode === 'private'
      ? row.privacy_mode
      : 'public'
  const canViewRestrictedContent = row.can_view_restricted_content

  return {
    id: row.id,
    username: row.username,
    nome_completo: row.nome_completo,
    avatar_path: row.avatar_path,
    bio: row.bio,
    data_cadastro: row.data_cadastro,
    topFiveEntries: normalizeTopFiveEntries(row.top_five_entries),
    followersCount: Number(row.followers_count) || 0,
    followingCount: Number(row.following_count) || 0,
    isPrivate: row.is_private,
    privacyMode,
    canViewRestrictedContent,
    restrictedContentMessage: canViewRestrictedContent
      ? null
      : getRestrictedProfileMessage(privacyMode),
  }
}

export function mapProfileConnectionRows(
  rows: ProfileConnectionRpcRow[],
  viewerId: string | null | undefined
): FollowListUser[] {
  return rows.map(row => ({
    id: row.id,
    username: row.username,
    nome_completo: row.nome_completo,
    avatar_path: row.avatar_path,
    isFollowing: Boolean(viewerId && viewerId !== row.id && row.is_following),
  }))
}

export function dedupeUsersById(users: UserSearchRow[]) {
  return Array.from(new Map(users.map(user => [user.id, user])).values())
}

function getSearchableFullName(user: UserSearchRow) {
  return user.nome_completo?.trim().toLowerCase() || ''
}

function getAlphabeticalDisplayName(user: UserSearchRow) {
  return user.nome_completo?.trim() || user.username
}

function compareUsersAlphabetically(leftUser: UserSearchRow, rightUser: UserSearchRow) {
  const usernameDelta = leftUser.username.localeCompare(rightUser.username, 'pt-BR')
  if (usernameDelta !== 0) return usernameDelta
  return getAlphabeticalDisplayName(leftUser).localeCompare(
    getAlphabeticalDisplayName(rightUser),
    'pt-BR'
  )
}

export function sortUsersByRelevance(users: UserSearchRow[], normalizedQuery: string) {
  const lowerQuery = normalizedQuery.toLowerCase()

  return [...users].sort((leftUser, rightUser) => {
    const leftUsername = leftUser.username.toLowerCase()
    const rightUsername = rightUser.username.toLowerCase()
    const leftName = getSearchableFullName(leftUser)
    const rightName = getSearchableFullName(rightUser)
    const exactDelta =
      Number(rightUsername === lowerQuery) - Number(leftUsername === lowerQuery)
    if (exactDelta !== 0) return exactDelta

    const usernamePrefixDelta =
      Number(rightUsername.startsWith(lowerQuery)) - Number(leftUsername.startsWith(lowerQuery))
    if (usernamePrefixDelta !== 0) return usernamePrefixDelta

    const namePrefixDelta =
      Number(rightName.startsWith(lowerQuery)) - Number(leftName.startsWith(lowerQuery))
    if (namePrefixDelta !== 0) return namePrefixDelta

    return compareUsersAlphabetically(leftUser, rightUser)
  })
}
