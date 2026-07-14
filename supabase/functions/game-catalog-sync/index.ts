import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveCors } from '../_shared/cors.ts'

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

interface SyncBody {
  gameIds?: unknown
  limit?: unknown
  force?: unknown
}

interface GameTranslationSource {
  id: number | string
  titulo: string
  descricao: string | null
}

interface TranslationResult {
  text: string | null
  status: string
  errorMessage: string | null
}

const defaultLimit = 10
const maxLimit = 50

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLimit(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultLimit
  return Math.max(1, Math.min(Math.trunc(value), maxLimit))
}

function normalizeGameIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value
      .map(gameId => Number(gameId))
      .filter(gameId => Number.isInteger(gameId) && gameId > 0)
  )).slice(0, maxLimit)
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function getJsonSecret(name: string, keyName = 'default') {
  const rawValue = Deno.env.get(name)
  if (!rawValue) return null

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>
    const value = parsedValue[keyName]
    return typeof value === 'string' ? value.trim() : null
  } catch {
    return rawValue.trim() || null
  }
}

function getServiceRoleKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim() ||
    getJsonSecret('SUPABASE_SECRET_KEYS')
}

function getPresentedSyncSecret(request: Request) {
  const explicitSecret = request.headers.get('x-catalog-sync-secret')?.trim()
  if (explicitSecret) return explicitSecret

  const authorization = request.headers.get('Authorization')?.trim() || ''
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
}

async function sha256Bytes(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return new Uint8Array(digest)
}

async function secretsMatch(presentedSecret: string, expectedSecret: string) {
  const [presentedHash, expectedHash] = await Promise.all([
    sha256Bytes(presentedSecret),
    sha256Bytes(expectedSecret),
  ])

  let difference = 0
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= presentedHash[index] ^ expectedHash[index]
  }

  return difference === 0
}

async function sha256Hex(value: string) {
  const digest = await sha256Bytes(value)
  return Array.from(digest)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function getDeepLApiUrl(apiKey: string) {
  const configuredUrl = Deno.env.get('DEEPL_API_URL')?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
}

async function translateWithDeepL(
  sourceText: string,
  gameTitle: string
): Promise<TranslationResult> {
  const apiKey = Deno.env.get('DEEPL_API_KEY')?.trim()
  if (!apiKey) {
    return {
      text: null,
      status: 'deepl_not_configured',
      errorMessage: 'DEEPL_API_KEY is not configured.',
    }
  }

  const response = await fetch(`${getDeepLApiUrl(apiKey)}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [sourceText],
      source_lang: 'EN',
      target_lang: 'PT-BR',
      context: `Video game title: ${gameTitle}`,
    }),
  })

  if (!response.ok) {
    const responseText = await response.text()
    return {
      text: null,
      status: 'deepl_error',
      errorMessage: `DeepL failed with status ${response.status}: ${responseText.slice(0, 240)}`,
    }
  }

  const payload = await response.json() as {
    translations?: Array<{ text?: string }>
  }
  const translatedText = payload.translations?.[0]?.text?.trim() || ''

  return translatedText
    ? { text: translatedText, status: 'translated', errorMessage: null }
    : {
        text: null,
        status: 'deepl_empty',
        errorMessage: 'DeepL response did not include translated text.',
      }
}

async function readBody(request: Request): Promise<SyncBody> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body as SyncBody : {}
  } catch {
    return {}
  }
}

async function loadSourceGames(
  client: SupabaseClient,
  gameIds: number[],
  limit: number
) {
  let query = client
    .from('jogos')
    .select('id, titulo, descricao')
    .not('descricao', 'is', null)
    .or('status_importacao.is.null,status_importacao.neq.stale')
    .order('external_updated_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(limit, gameIds.length || limit))

  if (gameIds.length > 0) query = query.in('id', gameIds)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as GameTranslationSource[]
}

async function syncGameTranslation(
  client: SupabaseClient,
  game: GameTranslationSource,
  force: boolean
) {
  const gameId = Number(game.id)
  const sourceText = normalizeText(game.descricao)
  if (!Number.isInteger(gameId) || gameId <= 0 || !sourceText) {
    return { gameId, status: 'skipped_empty' }
  }

  const sourceHash = await sha256Hex(sourceText)
  const { data: cachedTranslation, error: cacheError } = await client
    .from('game_translations')
    .select('status')
    .eq('jogo_id', gameId)
    .eq('field', 'description')
    .eq('target_locale', 'pt-BR')
    .eq('source_hash', sourceHash)
    .eq('status', 'ready')
    .maybeSingle()

  if (cacheError) throw cacheError
  if (cachedTranslation && !force) {
    return { gameId, status: 'cached' }
  }

  const translation = await translateWithDeepL(sourceText, game.titulo)
  const { error: saveError } = await client
    .from('game_translations')
    .upsert({
      jogo_id: gameId,
      provider: 'deepl',
      field: 'description',
      source_locale: 'en-US',
      target_locale: 'pt-BR',
      source_hash: sourceHash,
      translated_text: translation.text,
      status: translation.text ? 'ready' : 'error',
      error_message: translation.errorMessage,
    }, { onConflict: 'jogo_id,field,target_locale,source_hash' })

  if (saveError) throw saveError
  return { gameId, status: translation.status }
}

Deno.serve(async request => {
  const cors = resolveCors(request, name => Deno.env.get(name))
  const respond = (status: number, body: Record<string, unknown>) =>
    jsonResponse(status, body, cors.headers)

  if (!cors.allowed) return respond(403, { error: 'origin_not_allowed' })
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors.headers })
  }
  if (request.method !== 'POST') return respond(405, { error: 'method_not_allowed' })

  let expectedSecret = ''
  let serviceRoleKey = ''

  try {
    expectedSecret = getRequiredEnv('GAME_CATALOG_SYNC_SECRET')
    serviceRoleKey = getServiceRoleKey() || ''
    if (!serviceRoleKey) throw new Error('Missing Supabase service role key')
  } catch {
    return respond(503, { error: 'server_misconfigured' })
  }

  const presentedSecret = getPresentedSyncSecret(request)
  if (!presentedSecret || !await secretsMatch(presentedSecret, expectedSecret)) {
    return respond(401, { error: 'not_authorized' })
  }

  const body = await readBody(request)
  const gameIds = normalizeGameIds(body.gameIds)
  const limit = normalizeLimit(body.limit)
  const force = body.force === true

  if (body.gameIds !== undefined && gameIds.length === 0) {
    return respond(400, { error: 'invalid_game_ids' })
  }

  const client = createClient(getRequiredEnv('SUPABASE_URL'), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const games = await loadSourceGames(client, gameIds, limit)
    const results: Array<{ gameId: number; status: string }> = []

    // Deliberately sequential: this endpoint performs paid external calls and
    // should not create an uncontrolled burst against DeepL.
    for (const game of games) {
      results.push(await syncGameTranslation(client, game, force))
    }

    return respond(200, {
      processedCount: results.length,
      results,
    })
  } catch (error) {
    console.error('game-catalog-sync failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
      requestedGameCount: gameIds.length,
    })
    return respond(500, { error: 'catalog_sync_failed' })
  }
})
