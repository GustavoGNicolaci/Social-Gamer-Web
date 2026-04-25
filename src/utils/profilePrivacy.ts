export type PrivacySettings = Record<string, unknown>

function isPlainObject(value: unknown): value is PrivacySettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizePrivacySettings(
  value: Record<string, unknown> | null | undefined
): PrivacySettings {
  return isPlainObject(value) ? { ...value } : {}
}

export function isProfilePrivate(value: Record<string, unknown> | null | undefined) {
  return normalizePrivacySettings(value).perfil_privado === true
}

export function mergeProfilePrivateIntoPrivacySettings(
  currentSettings: Record<string, unknown> | null | undefined,
  nextValue: boolean
) {
  return {
    ...normalizePrivacySettings(currentSettings),
    perfil_privado: nextValue,
  }
}
