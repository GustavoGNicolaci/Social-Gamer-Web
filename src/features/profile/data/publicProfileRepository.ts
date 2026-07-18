import { supabase } from '../../../supabase-client'
import type {
  PublicProfileRpcRow,
  PublicUserProfile,
  UserServiceResult,
} from '../domain/profileUser'
import {
  buildPublicProfileResult,
  normalizeUserServiceError,
} from './profileUserMappers'

export async function getPublicProfileByUsername(
  username: string,
  viewerId?: string | null
): Promise<UserServiceResult<PublicUserProfile | null>> {
  const normalizedUsername = username.trim()

  if (!normalizedUsername) {
    return { data: null, error: null }
  }

  try {
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
      return { data: null, error: null }
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
