interface TemporarySessionResult {
  data: {
    session?: unknown
  } | null
  error: unknown | null
}

interface TemporarySessionOperations {
  signIn(): Promise<TemporarySessionResult>
  signOut(): Promise<{ error: unknown | null }>
  onCleanupError?(error: unknown): void
}

type GlobalSignOut = (
  accessToken: string,
  scope: 'global'
) => Promise<{ error: unknown | null }>

export type GlobalSessionRevocationResult =
  | { ok: true; error: null }
  | { ok: false; error: unknown }

export function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null

  const match = /^Bearer[\t ]+([^\s]+)$/i.exec(authorizationHeader.trim())
  return match?.[1] || null
}

function reportCleanupError(
  onCleanupError: TemporarySessionOperations['onCleanupError'],
  error: unknown
) {
  try {
    onCleanupError?.(error)
  } catch {
    // A logging failure must not replace the password-validation result.
  }
}

export async function validateWithTemporarySession({
  signIn,
  signOut,
  onCleanupError,
}: TemporarySessionOperations) {
  let temporarySessionCreated = false

  try {
    const { data, error } = await signIn()
    temporarySessionCreated = Boolean(data?.session)
    return !error
  } finally {
    if (temporarySessionCreated) {
      try {
        const { error } = await signOut()

        if (error) {
          reportCleanupError(onCleanupError, error)
        }
      } catch (error) {
        reportCleanupError(onCleanupError, error)
      }
    }
  }
}

export async function revokeGlobalSessions(
  accessToken: string,
  signOut: GlobalSignOut
): Promise<GlobalSessionRevocationResult> {
  try {
    const { error } = await signOut(accessToken, 'global')
    return error ? { ok: false, error } : { ok: true, error: null }
  } catch (error) {
    return { ok: false, error }
  }
}
