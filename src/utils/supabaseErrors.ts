export interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

export interface NormalizedSupabaseError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export function normalizeSupabaseError(
  error: unknown,
  fallbackMessage: string
): NormalizedSupabaseError {
  if (error && typeof error === 'object') {
    const source = error as SupabaseLikeError

    return {
      code: typeof source.code === 'string' ? source.code : undefined,
      message: typeof source.message === 'string' ? source.message : fallbackMessage,
      details: typeof source.details === 'string' ? source.details : null,
      hint: typeof source.hint === 'string' ? source.hint : null,
    }
  }

  return { message: fallbackMessage }
}

export function getSupabaseErrorText(error: SupabaseLikeError | null | undefined) {
  if (!error) return ''
  return [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function isSupabasePermissionError(error: SupabaseLikeError | null | undefined) {
  const text = getSupabaseErrorText(error)

  return (
    error?.code === '42501' ||
    text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('violates row-level security') ||
    text.includes('policy')
  )
}

export function isSupabaseDuplicateError(error: SupabaseLikeError | null | undefined) {
  const text = getSupabaseErrorText(error)
  return error?.code === '23505' || text.includes('duplicate') || text.includes('unique')
}

export function isSupabaseStructureError(error: SupabaseLikeError | null | undefined) {
  const text = getSupabaseErrorText(error)
  return text.includes('column') || text.includes('relationship') || text.includes('foreign key')
}

export function getRlsEmptyStateError(
  error: SupabaseLikeError | null | undefined,
  fallbackMessage: string
) {
  return isSupabasePermissionError(error) ? null : normalizeSupabaseError(error, fallbackMessage)
}
