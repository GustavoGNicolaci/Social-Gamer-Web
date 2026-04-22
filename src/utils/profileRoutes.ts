function normalizeProfileUsername(username: string | null | undefined) {
  const normalizedUsername = username?.trim()
  return normalizedUsername ? normalizedUsername : null
}

export function getPublicProfilePath(username: string) {
  return `/u/${encodeURIComponent(username.trim())}`
}

export function getOptionalPublicProfilePath(username: string | null | undefined) {
  const normalizedUsername = normalizeProfileUsername(username)
  return normalizedUsername ? getPublicProfilePath(normalizedUsername) : null
}
