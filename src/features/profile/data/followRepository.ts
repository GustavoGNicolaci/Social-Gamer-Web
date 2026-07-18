import { supabase } from '../../../supabase-client'
import type {
  FollowStateRpcRow,
  UserFollowState,
  UserServiceResult,
} from '../domain/profileUser'
import { normalizeUserServiceError } from './profileUserMappers'

const EMPTY_FOLLOW_STATE: UserFollowState = {
  isFollowing: false,
  followersCount: 0,
  followingCount: 0,
}

export async function getFollowState(
  viewerId: string | null | undefined,
  profileId: string
): Promise<UserServiceResult<UserFollowState>> {
  if (!profileId) {
    return { data: { ...EMPTY_FOLLOW_STATE }, error: null }
  }

  try {
    const { data, error } = await supabase
      .rpc('get_profile_follow_state', { p_profile_id: profileId })
      .single()

    if (error) {
      return {
        data: { ...EMPTY_FOLLOW_STATE },
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
      data: { ...EMPTY_FOLLOW_STATE },
      error: normalizeUserServiceError(
        error,
        'Erro inesperado ao carregar a relacao deste perfil.'
      ),
    }
  }
}

export async function followUser(
  viewerId: string,
  profileId: string
): Promise<UserServiceResult<UserFollowState>> {
  if (viewerId === profileId) {
    return {
      data: { ...EMPTY_FOLLOW_STATE },
      error: { message: 'Voce nao pode seguir o proprio perfil.' },
    }
  }

  try {
    const { error } = await supabase.from('seguidores').insert({
      seguidor_id: viewerId,
      seguido_id: profileId,
    })

    if (error && error.code !== '23505') {
      return {
        data: { ...EMPTY_FOLLOW_STATE },
        error: normalizeUserServiceError(error, 'Nao foi possivel seguir este perfil.'),
      }
    }

    return getFollowState(viewerId, profileId)
  } catch (error) {
    return {
      data: { ...EMPTY_FOLLOW_STATE },
      error: normalizeUserServiceError(error, 'Erro inesperado ao seguir este perfil.'),
    }
  }
}

export async function unfollowUser(
  viewerId: string,
  profileId: string
): Promise<UserServiceResult<UserFollowState>> {
  if (viewerId === profileId) {
    return {
      data: { ...EMPTY_FOLLOW_STATE },
      error: { message: 'Voce nao pode deixar de seguir o proprio perfil.' },
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
        data: { ...EMPTY_FOLLOW_STATE },
        error: normalizeUserServiceError(error, 'Nao foi possivel deixar de seguir este perfil.'),
      }
    }

    return getFollowState(viewerId, profileId)
  } catch (error) {
    return {
      data: { ...EMPTY_FOLLOW_STATE },
      error: normalizeUserServiceError(
        error,
        'Erro inesperado ao deixar de seguir este perfil.'
      ),
    }
  }
}
