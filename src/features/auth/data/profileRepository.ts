import type { User } from '@supabase/supabase-js'
import { supabase } from '../../../supabase-client'
import type {
  UserProfile,
  UserProfileUpdates,
} from '../domain/types'

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeOptionalName = (value?: string | null) => {
  const normalizedValue = typeof value === 'string' ? normalizeWhitespace(value) : ''
  return normalizedValue || null
}

function getMetadataProfile(user: User) {
  const metadata = user.user_metadata as Record<string, unknown> | undefined

  return {
    username: typeof metadata?.username === 'string' ? metadata.username.trim() : '',
    nome_completo:
      typeof metadata?.nome_completo === 'string'
        ? normalizeOptionalName(metadata.nome_completo)
        : null,
  }
}

function getEmailLocalPart(email?: string) {
  if (!email) return ''

  const [localPart] = email.split('@')
  return localPart?.trim().toLowerCase() || ''
}

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase.rpc('get_my_profile').maybeSingle()

    if (error || !data || data.id !== userId) {
      return null
    }

    return data as UserProfile
  } catch {
    return null
  }
}

export async function createProfileFromMetadata(nextUser: User): Promise<UserProfile | null> {
  try {
    const { username, nome_completo } = getMetadataProfile(nextUser)

    if (!username) {
      return null
    }

    const profileData = {
      id: nextUser.id,
      username,
      nome_completo,
      avatar_path: null,
      avatar_url: null,
      bio: null,
      data_cadastro: new Date().toISOString(),
      configuracoes_privacidade: {},
    }

    // The auth listener and the register flow can race to create the same profile.
    const { error } = await supabase
      .from('usuarios')
      .insert(profileData)

    if (error) {
      if (error.code === '23505') {
        return await fetchOwnProfile(nextUser.id)
      }

      return null
    }

    return await fetchOwnProfile(nextUser.id)
  } catch {
    return null
  }
}

export async function repairLegacyProfile(
  nextUser: User,
  currentProfile: UserProfile
): Promise<UserProfile> {
  try {
    const { username: metadataUsername, nome_completo: metadataNomeCompleto } =
      getMetadataProfile(nextUser)

    if (!metadataUsername) {
      return currentProfile
    }

    const normalizedEmail = nextUser.email?.trim().toLowerCase() || ''
    const emailLocalPart = getEmailLocalPart(nextUser.email)
    const normalizedProfileUsername = currentProfile.username?.trim().toLowerCase() || ''
    const normalizedProfileNomeCompleto = currentProfile.nome_completo?.trim().toLowerCase() || ''

    const shouldRepairUsername =
      normalizedProfileUsername === emailLocalPart && currentProfile.username !== metadataUsername

    const shouldRepairNomeCompleto =
      Boolean(metadataNomeCompleto) &&
      normalizedProfileNomeCompleto === normalizedEmail &&
      currentProfile.nome_completo !== metadataNomeCompleto

    if (!shouldRepairUsername && !shouldRepairNomeCompleto) {
      return currentProfile
    }

    const updates: Partial<UserProfile> = {}

    if (shouldRepairUsername) {
      updates.username = metadataUsername
    }

    if (shouldRepairNomeCompleto) {
      updates.nome_completo = metadataNomeCompleto
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', nextUser.id)

    if (error) {
      return currentProfile
    }

    return await fetchOwnProfile(nextUser.id) || currentProfile
  } catch {
    return currentProfile
  }
}

export async function fetchOrCreateProfile(nextUser: User): Promise<UserProfile | null> {
  const existingProfile = await fetchOwnProfile(nextUser.id)

  if (existingProfile) {
    return await repairLegacyProfile(nextUser, existingProfile)
  }

  const createdProfile = await createProfileFromMetadata(nextUser)

  if (createdProfile) {
    return createdProfile
  }

  return await fetchOwnProfile(nextUser.id)
}

export async function updateOwnProfileRecord(
  userId: string,
  updates: UserProfileUpdates
) {
  const { error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', userId)

  return { error }
}
