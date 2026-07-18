import type { TopFiveStoredEntry } from '../../../utils/profileTopFive'
import type { ProfilePrivacyMode } from '../../../utils/profilePrivacy'

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

export type FollowListUser = UserSearchResult

export interface ProfileFollowListPage {
  items: FollowListUser[]
  hasMore: boolean
  nextOffset: number
}

export interface ProfileFollowListPageOptions {
  limit?: number
  offset?: number
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

export interface UserServiceResult<T> {
  data: T
  error: UserServiceError | null
}

export interface SearchUsersOptions {
  limit?: number
  viewerId?: string | null
}

export interface PublicProfileRpcRow {
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

export interface UserSearchRow {
  id: string
  username: string
  nome_completo: string | null
  avatar_path: string | null
}

export interface FollowRelationshipMapRow {
  user_id: string
  is_following: boolean
  is_mutual_friend: boolean
}

export interface ProfileConnectionRpcRow extends UserSearchRow {
  is_following: boolean
  relationship_started_at: string
}

export interface FollowStateRpcRow {
  is_following: boolean
  followers_count: number
  following_count: number
}
