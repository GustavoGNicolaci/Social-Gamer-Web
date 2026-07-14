export interface CorsResolution {
  allowed: boolean
  headers: Record<string, string>
}

type EnvReader = (name: string) => string | undefined

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function normalizeConfiguredOrigin(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function getConfiguredOrigins(readEnv: EnvReader) {
  const configuredValue = readEnv('CORS_ALLOWED_ORIGINS') || ''

  return new Set(
    configuredValue
      .split(/[\n,]/)
      .map(normalizeConfiguredOrigin)
      .filter((origin): origin is string => Boolean(origin) && origin !== '*')
  )
}

function isLoopbackOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

function localOriginsAreEnabled(readEnv: EnvReader) {
  const explicitSetting = readEnv('CORS_ALLOW_LOCALHOST')?.trim().toLowerCase()
  if (explicitSetting === 'true') return true
  if (explicitSetting === 'false') return false

  const supabaseUrl = readEnv('SUPABASE_URL')
  return Boolean(supabaseUrl && isLoopbackOrigin(supabaseUrl))
}

export function resolveCors(
  request: Request,
  readEnv: EnvReader
): CorsResolution {
  const origin = request.headers.get('Origin')

  if (!origin) {
    return {
      allowed: true,
      headers: { ...baseCorsHeaders },
    }
  }

  const normalizedOrigin = normalizeConfiguredOrigin(origin)
  const configuredOrigins = getConfiguredOrigins(readEnv)
  const originAllowed = Boolean(
    normalizedOrigin && (
      configuredOrigins.has(normalizedOrigin) ||
      (localOriginsAreEnabled(readEnv) && isLoopbackOrigin(normalizedOrigin))
    )
  )

  if (!originAllowed || !normalizedOrigin) {
    return {
      allowed: false,
      headers: {
        ...baseCorsHeaders,
        Vary: 'Origin',
      },
    }
  }

  return {
    allowed: true,
    headers: {
      ...baseCorsHeaders,
      'Access-Control-Allow-Origin': normalizedOrigin,
      Vary: 'Origin',
    },
  }
}
