export type PrivacySettings = Record<string, unknown>
export type ProfilePrivacyMode = 'public' | 'friends' | 'private'

interface ViewRestrictedProfileParams {
  ownerId: string | null | undefined
  viewerId: string | null | undefined
  privacyMode: ProfilePrivacyMode
  isMutualFriend?: boolean
}

function isPlainObject(value: unknown): value is PrivacySettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizePrivacySettings(
  value: Record<string, unknown> | null | undefined
): PrivacySettings {
  return isPlainObject(value) ? { ...value } : {}
}

export function isProfilePrivate(value: Record<string, unknown> | null | undefined) {
  return getProfilePrivacyMode(value) === 'private'
}

export function mergeProfilePrivateIntoPrivacySettings(
  currentSettings: Record<string, unknown> | null | undefined,
  nextValue: boolean
) {
  return mergeProfilePrivacyModeIntoPrivacySettings(
    currentSettings,
    nextValue ? 'private' : 'public'
  )
}

export function isFriendsOnlyProfile(value: Record<string, unknown> | null | undefined) {
  return getProfilePrivacyMode(value) === 'friends'
}

export function getProfilePrivacyMode(
  value: Record<string, unknown> | null | undefined
): ProfilePrivacyMode {
  const settings = normalizePrivacySettings(value)

  if (settings.perfil_privado === true) {
    return 'private'
  }

  if (settings.somente_amigos === true) {
    return 'friends'
  }

  return 'public'
}

export function canViewRestrictedProfile({
  ownerId,
  viewerId,
  privacyMode,
  isMutualFriend = false,
}: ViewRestrictedProfileParams) {
  if (privacyMode === 'public') {
    return true
  }

  if (ownerId && viewerId && ownerId === viewerId) {
    return true
  }

  if (privacyMode === 'friends') {
    return isMutualFriend
  }

  return false
}

export function getRestrictedProfileMessage(privacyMode: ProfilePrivacyMode) {
  return privacyMode === 'friends'
    ? 'Este perfil esta visivel apenas para amigos.'
    : 'Este perfil esta privado.'
}

export function mergeProfilePrivacyModeIntoPrivacySettings(
  currentSettings: Record<string, unknown> | null | undefined,
  nextMode: ProfilePrivacyMode
) {
  return {
    ...normalizePrivacySettings(currentSettings),
    perfil_privado: nextMode === 'private',
    somente_amigos: nextMode === 'friends',
  }
}
