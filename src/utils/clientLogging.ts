type SafeLogValue = string | number | boolean | null | undefined
type SafeLogMetadata = Record<string, SafeLogValue>

function getErrorField(error: Record<string, unknown>, field: string) {
  const value = error[field]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function normalizeClientError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const errorRecord = error as Record<string, unknown>

  return {
    name: getErrorField(errorRecord, 'name'),
    code: getErrorField(errorRecord, 'code'),
    status: getErrorField(errorRecord, 'status'),
    message: getErrorField(errorRecord, 'message'),
  }
}

function normalizeMetadata(metadata?: SafeLogMetadata) {
  if (!metadata) return undefined

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function logClientError(
  context: string,
  error?: unknown,
  metadata?: SafeLogMetadata
) {
  if (!import.meta.env.DEV) {
    console.error(`[${context}]`)
    return
  }

  console.error(`[${context}]`, {
    error: normalizeClientError(error),
    metadata: normalizeMetadata(metadata),
  })
}
