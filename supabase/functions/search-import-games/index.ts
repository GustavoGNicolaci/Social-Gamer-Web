import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  allowedIgdbGameTypeClause,
  escapeIgdbSearch,
  excludedIgdbThemeClause,
  filterAllowedIgdbGames,
  getIgdbGameType,
  getIgdbImageUrl,
  igdbBaseUrl,
  normalizeNamedEntities,
  normalizeText,
  provider,
  slugify,
  twitchTokenUrl,
  uniqueValues,
  unixDateToIso,
  unixDateToIsoDate,
  type IgdbGame,
  type NamedEntityInput,
} from '../_shared/igdb.ts'
import { resolveCors } from '../_shared/cors.ts'

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

type JsonRecord = Record<string, unknown>

interface SearchImportBody {
  query?: unknown
  limit?: unknown
}

interface CatalogGamePreview {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  plataformas: string[] | null
}

interface ImportPayload {
  provider: string
  importedCount: number
  games: CatalogGamePreview[]
}

interface ImportCacheEntry {
  expiresAt: number
  payload: ImportPayload
}

interface DurableImportCacheRow {
  game_ids: number[] | null
  expires_at: string
}

interface RateLimitReservationRow {
  allowed: boolean
  remaining: number
  reset_at: string
  already_reserved: boolean
}

const maxLimit = 10
const defaultLimit = 10
const maxQueryLength = 200
const externalAttemptLimit = 10
const importCacheTtlMs = 60 * 60 * 1000
const maxCachedQueries = 250

let cachedIgdbToken: { token: string; expiresAt: number } | null = null
const importCache = new Map<string, ImportCacheEntry>()
const inFlightImports = new Map<string, Promise<ImportPayload>>()

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function getJsonSecret(name: string, keyName = 'default') {
  const rawValue = Deno.env.get(name)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    const value = parsed[keyName]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

function getSupabaseAnonKey() {
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ||
    Deno.env.get('SUPABASE_ANON_KEY')?.trim() ||
    getJsonSecret('SUPABASE_PUBLISHABLE_KEYS')
}

function getSupabaseServiceRoleKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim() ||
    getJsonSecret('SUPABASE_SECRET_KEYS')
}

function normalizeLimit(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultLimit
  return Math.max(1, Math.min(Math.trunc(value), maxLimit))
}

function normalizeQuery(value: unknown) {
  return normalizeText(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
}

function getNormalizedQueryKey(query: string) {
  return query.toLocaleLowerCase('en-US')
}

function trimMapToSize<TKey, TValue>(map: Map<TKey, TValue>, maxSize: number) {
  while (map.size > maxSize) {
    const oldestKey = map.keys().next().value as TKey | undefined
    if (oldestKey === undefined) return
    map.delete(oldestKey)
  }
}

function cleanupBestEffortState(now: number) {
  importCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) importCache.delete(key)
  })

  trimMapToSize(importCache, maxCachedQueries)
}

function getCachedImport(queryKey: string, now: number, limit: number) {
  const entry = importCache.get(queryKey)
  if (!entry || entry.expiresAt <= now) {
    if (entry) importCache.delete(queryKey)
    return null
  }

  const games = entry.payload.games.slice(0, limit)
  return {
    ...entry.payload,
    importedCount: games.length,
    games,
  }
}

async function sha256Hex(value: string) {
  const encodedValue = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encodedValue)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function getDurableCacheKey(queryHash: string) {
  return `search-import:v3:${queryHash}`
}

async function getDurableCachedImport(
  adminClient: SupabaseClient,
  cacheKey: string,
  now: number,
  limit: number
): Promise<ImportPayload | null> {
  const { data, error } = await adminClient
    .from('game_catalog_cache')
    .select('game_ids, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle()

  if (error || !data) return null

  const cacheRow = data as DurableImportCacheRow
  if (Date.parse(cacheRow.expires_at) <= now) return null

  const gameIds = Array.from(new Set(
    (cacheRow.game_ids || [])
      .map(gameId => Number(gameId))
      .filter(gameId => Number.isInteger(gameId) && gameId > 0)
  ))

  if (gameIds.length === 0) {
    return { provider, importedCount: 0, games: [] }
  }

  const { data: gameRows, error: gamesError } = await adminClient
    .from('jogos')
    .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
    .in('id', gameIds)
    .or('status_importacao.is.null,status_importacao.neq.stale')

  if (gamesError) return null

  const gamesById = new Map(
    ((gameRows || []) as CatalogGamePreview[]).map(game => [Number(game.id), game])
  )
  const games = gameIds
    .flatMap(gameId => {
      const game = gamesById.get(gameId)
      return game ? [game] : []
    })
    .slice(0, limit)

  return {
    provider,
    importedCount: games.length,
    games,
  }
}

async function saveDurableImportCache(
  adminClient: SupabaseClient,
  cacheKey: string,
  queryKey: string,
  now: number,
  payload: ImportPayload
) {
  try {
    const { error } = await adminClient
      .from('game_catalog_cache')
      .upsert({
        cache_key: cacheKey,
        provider,
        request: {
          kind: 'search_import',
          normalized_query: queryKey,
        },
        game_ids: payload.games.map(game => game.id),
        has_next_page: false,
        expires_at: new Date(now + importCacheTtlMs).toISOString(),
      }, { onConflict: 'cache_key' })

    if (error) {
      logEdgeError('Could not persist search import cache', error, { cacheKey })
    }
  } catch (error) {
    logEdgeError('Could not persist search import cache', error, { cacheKey })
  }
}

async function reserveDurableExternalAttempt(
  adminClient: SupabaseClient,
  userId: string,
  queryHash: string
) {
  const { data, error } = await adminClient.rpc('reserve_game_import_attempt', {
    p_user_id: userId,
    p_query_hash: queryHash,
    p_limit: externalAttemptLimit,
    p_window_seconds: 60 * 60,
  })

  if (error) throw error

  const reservation = (Array.isArray(data) ? data[0] : data) as
    | RateLimitReservationRow
    | null

  if (!reservation) throw new Error('Rate limit reservation returned no result')

  return reservation
}

function getRateLimitPayload(reservation?: RateLimitReservationRow | null) {
  return {
    limit: externalAttemptLimit,
    remaining: reservation?.remaining ?? null,
    resetAt: reservation?.reset_at || null,
    scope: 'database',
    cached: !reservation,
  }
}

async function readBody(request: Request): Promise<SearchImportBody> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body as SearchImportBody : {}
  } catch {
    return {}
  }
}

function getErrorField(error: unknown, fieldName: 'code' | 'message' | 'details' | 'hint' | 'name') {
  if (!error || typeof error !== 'object' || !(fieldName in error)) return null
  const value = (error as Record<string, unknown>)[fieldName]
  return typeof value === 'string' ? value : null
}

function normalizeErrorForLog(error: unknown) {
  if (!error) return null
  if (typeof error !== 'object') return { message: String(error) }

  return {
    name: getErrorField(error, 'name'),
    code: getErrorField(error, 'code'),
    message: getErrorField(error, 'message') || (error instanceof Error ? error.message : null),
    details: getErrorField(error, 'details'),
    hint: getErrorField(error, 'hint'),
  }
}

function logEdgeError(message: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error(message, {
    ...context,
    error: normalizeErrorForLog(error),
  })
}

function buildIgdbGameQuery(query: string, limit: number) {
  return `
    search "${escapeIgdbSearch(query)}";
    fields
      name,
      category,
      game_type,
      slug,
      summary,
      storyline,
      cover.image_id,
      cover.width,
      cover.height,
      screenshots.image_id,
      screenshots.width,
      screenshots.height,
      first_release_date,
      platforms.id,
      platforms.name,
      genres.id,
      genres.name,
      themes.id,
      themes.name,
      themes.slug,
      game_modes.id,
      game_modes.name,
      involved_companies.developer,
      involved_companies.publisher,
      involved_companies.company.id,
      involved_companies.company.name,
      rating,
      rating_count,
      aggregated_rating,
      aggregated_rating_count,
      total_rating,
      total_rating_count,
      websites.category,
      websites.url,
      external_games.category,
      external_games.uid,
      external_games.url,
      updated_at;
    where version_parent = null
      & ${allowedIgdbGameTypeClause}
      & ${excludedIgdbThemeClause};
    limit ${limit};
  `
}

async function getIgdbToken(clientId: string, clientSecret: string) {
  const now = Date.now()
  if (cachedIgdbToken && cachedIgdbToken.expiresAt > now + 60_000) {
    return cachedIgdbToken.token
  }

  const tokenUrl = new URL(twitchTokenUrl)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')

  const response = await fetch(tokenUrl, { method: 'POST' })

  if (!response.ok) {
    throw new Error(`IGDB auth failed with status ${response.status}`)
  }

  const payload = await response.json() as { access_token?: string; expires_in?: number }
  if (!payload.access_token) {
    throw new Error('IGDB auth response did not include access_token')
  }

  cachedIgdbToken = {
    token: payload.access_token,
    expiresAt: now + Math.max(60, payload.expires_in || 3600) * 1000,
  }

  return cachedIgdbToken.token
}

async function searchIgdbGames(query: string, limit: number) {
  const clientId = getRequiredEnv('IGDB_CLIENT_ID')
  const clientSecret = getRequiredEnv('IGDB_CLIENT_SECRET')
  const token = await getIgdbToken(clientId, clientSecret)

  const response = await fetch(`${igdbBaseUrl}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body: buildIgdbGameQuery(query, limit),
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`IGDB search failed with status ${response.status}: ${responseText.slice(0, 300)}`)
  }

  const games = await response.json() as IgdbGame[]
  return filterAllowedIgdbGames(games)
}

async function getAuthenticatedUser(
  supabaseUrl: string,
  anonKey: string,
  authorizationHeader: string | null
) {
  if (!authorizationHeader) return null

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: authorizationHeader,
      },
    },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return null

  return data.user
}

async function getExistingIgdbGameIds(adminClient: SupabaseClient, igdbIds: string[]) {
  if (igdbIds.length === 0) return new Map<string, number>()

  const { data, error } = await adminClient
    .from('game_external_ids')
    .select('external_id, jogo_id')
    .eq('provider', provider)
    .in('external_id', igdbIds)

  if (error) throw error

  return new Map((data || []).map(row => [String(row.external_id), Number(row.jogo_id)]))
}

async function ensureUniqueSlug(adminClient: SupabaseClient, baseSlug: string, currentGameId?: number) {
  const { data, error } = await adminClient
    .from('jogos')
    .select('id, slug')
    .eq('slug', baseSlug)
    .maybeSingle()

  if (error) throw error
  if (!data || Number(data.id) === currentGameId) return baseSlug

  return `${baseSlug}-${Date.now().toString(36)}`
}

function isUniqueSlugViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const errorRecord = error as Record<string, unknown>
  return errorRecord.code === '23505' &&
    typeof errorRecord.message === 'string' &&
    errorRecord.message.includes('jogos_slug_unique_idx')
}

function isUniqueIgdbIdViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const errorRecord = error as Record<string, unknown>
  return errorRecord.code === '23505' &&
    typeof errorRecord.message === 'string' &&
    errorRecord.message.includes('jogos_igdb_id_unique_idx')
}

function getMetadataIgdbId(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const igdbMetadata = (metadata as JsonRecord).igdb
  if (!igdbMetadata || typeof igdbMetadata !== 'object') return null

  const igdbId = (igdbMetadata as JsonRecord).id
  return typeof igdbId === 'number' || typeof igdbId === 'string' ? String(igdbId) : null
}

async function findExistingIgdbGameIdBySlug(adminClient: SupabaseClient, slug: string, igdbId: number) {
  const { data, error } = await adminClient
    .from('jogos')
    .select('id, source_primary, metadados')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as { id: number | string; source_primary?: string | null; metadados?: unknown }
  const metadataIgdbId = getMetadataIgdbId(row.metadados)
  if (row.source_primary !== provider && metadataIgdbId !== String(igdbId)) return null

  return Number(row.id)
}

async function findExistingIgdbGameIdByMetadata(adminClient: SupabaseClient, igdbId: number) {
  const { data, error } = await adminClient
    .from('jogos')
    .select('id')
    .eq('metadados->igdb->>id', String(igdbId))
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ? Number(data.id) : null
}

function getCompaniesByRole(game: IgdbGame, role: 'developer' | 'publisher') {
  return uniqueValues(
    (game.involved_companies || [])
      .filter(link => Boolean(link[role]))
      .map(link => normalizeText(link.company?.name))
      .filter(Boolean)
  )
}

function getCompanyInputsByRole(game: IgdbGame, role: 'developer' | 'publisher'): NamedEntityInput[] {
  return getCompaniesByRole(game, role).map(name => {
    const match = (game.involved_companies || []).find(
      link => Boolean(link[role]) && normalizeText(link.company?.name) === name
    )

    return {
      name,
      provider,
      externalId: typeof match?.company?.id === 'number' ? String(match.company.id) : null,
    }
  })
}

async function upsertNamedEntities(
  adminClient: SupabaseClient,
  table: string,
  entities: NamedEntityInput[]
) {
  if (entities.length === 0) return []

  const uniqueBySlug = new Map<string, NamedEntityInput>()
  entities.forEach(entity => {
    uniqueBySlug.set(slugify(entity.name), entity)
  })

  const payload = Array.from(uniqueBySlug.entries()).map(([slug, entity]) => ({
    nome: entity.name,
    slug,
    provider: entity.provider,
    external_id: entity.externalId || null,
  }))

  const { data, error } = await adminClient
    .from(table)
    .upsert(payload, { onConflict: 'slug' })
    .select('id, nome, slug')

  if (error) throw error

  return (data || []) as Array<{ id: number; nome: string; slug: string }>
}

async function replaceSimpleBridge(
  adminClient: SupabaseClient,
  table: string,
  gameId: number,
  foreignKey: string,
  ids: number[]
) {
  const { error: deleteError } = await adminClient
    .from(table)
    .delete()
    .eq('jogo_id', gameId)

  if (deleteError) throw deleteError
  if (ids.length === 0) return

  const { error: insertError } = await adminClient
    .from(table)
    .insert(ids.map(id => ({ jogo_id: gameId, [foreignKey]: id })))

  if (insertError) throw insertError
}

async function replaceCompanyBridge(
  adminClient: SupabaseClient,
  gameId: number,
  developers: Array<{ id: number }>,
  publishers: Array<{ id: number }>
) {
  const { error: deleteError } = await adminClient
    .from('jogo_empresas')
    .delete()
    .eq('jogo_id', gameId)

  if (deleteError) throw deleteError

  const rows = [
    ...developers.map(company => ({ jogo_id: gameId, empresa_id: company.id, papel: 'developer' })),
    ...publishers.map(company => ({ jogo_id: gameId, empresa_id: company.id, papel: 'publisher' })),
  ]

  if (rows.length === 0) return

  const { error: insertError } = await adminClient.from('jogo_empresas').insert(rows)
  if (insertError) throw insertError
}

async function replaceMedia(adminClient: SupabaseClient, gameId: number, game: IgdbGame) {
  const { error: deleteError } = await adminClient
    .from('jogo_midias')
    .delete()
    .eq('jogo_id', gameId)
    .eq('provider', provider)

  if (deleteError) throw deleteError

  const mediaRows: JsonRecord[] = []
  const coverUrl = getIgdbImageUrl(game.cover?.image_id, 'cover_big')

  if (coverUrl) {
    mediaRows.push({
      jogo_id: gameId,
      tipo: 'cover',
      url: coverUrl,
      provider,
      external_media_id: game.cover?.image_id || null,
      width: game.cover?.width || null,
      height: game.cover?.height || null,
      ordem: 0,
      is_primary: true,
    })
  }

  ;(game.screenshots || []).forEach((screenshot, index) => {
    const url = getIgdbImageUrl(screenshot.image_id, 'screenshot_big')
    if (!url) return

    mediaRows.push({
      jogo_id: gameId,
      tipo: 'screenshot',
      url,
      thumbnail_url: getIgdbImageUrl(screenshot.image_id, 'cover_big'),
      provider,
      external_media_id: screenshot.image_id || null,
      width: screenshot.width || null,
      height: screenshot.height || null,
      ordem: index + 1,
      is_primary: false,
    })
  })

  const uniqueMediaRowsByKey = new Map<string, JsonRecord>()

  mediaRows.forEach((row, index) => {
    const externalMediaId = typeof row.external_media_id === 'string' ? row.external_media_id.trim() : ''
    const mediaKey = externalMediaId
      ? `${row.provider || provider}:${externalMediaId}`
      : `${row.tipo || 'media'}:${row.url || index}`

    if (!uniqueMediaRowsByKey.has(mediaKey)) {
      uniqueMediaRowsByKey.set(mediaKey, row)
    }
  })

  const uniqueMediaRows = Array.from(uniqueMediaRowsByKey.values())

  if (uniqueMediaRows.length === 0) return

  const { error: insertError } = await adminClient.from('jogo_midias').insert(uniqueMediaRows)
  if (insertError) throw insertError
}

async function upsertGameStatsShell(adminClient: SupabaseClient, gameId: number) {
  const { error } = await adminClient
    .from('jogo_estatisticas')
    .upsert({ jogo_id: gameId }, { onConflict: 'jogo_id' })

  if (error) throw error
}

function buildGamePayload(game: IgdbGame, slug: string) {
  const title = normalizeText(game.name)
  const genres = normalizeNamedEntities(game.genres).map(entity => entity.name)
  const platforms = normalizeNamedEntities(game.platforms).map(entity => entity.name)
  const developers = getCompaniesByRole(game, 'developer')
  const publishers = getCompaniesByRole(game, 'publisher')
  const coverUrl = getIgdbImageUrl(game.cover?.image_id, 'cover_big')

  return {
    titulo: title,
    slug,
    capa_url: coverUrl,
    desenvolvedora: developers[0] || publishers[0] || null,
    generos: genres.length > 0 ? genres : null,
    data_lancamento: unixDateToIsoDate(game.first_release_date),
    descricao: normalizeText(game.summary) || normalizeText(game.storyline) || null,
    descricao_curta: normalizeText(game.summary).slice(0, 280) || null,
    plataformas: platforms.length > 0 ? platforms : null,
    source_primary: provider,
    status_importacao: 'imported',
    nota_media_externa: typeof game.total_rating === 'number' ? Number(game.total_rating.toFixed(2)) : null,
    nota_media_externa_count: typeof game.total_rating_count === 'number' ? game.total_rating_count : 0,
    external_updated_at: unixDateToIso(game.updated_at),
    metadados: {
      provider,
      igdb: {
        id: game.id,
        slug: game.slug || null,
        category: getIgdbGameType(game),
        game_type: game.game_type ?? null,
        themes: game.themes || [],
        rating: game.rating ?? null,
        rating_count: game.rating_count ?? null,
        aggregated_rating: game.aggregated_rating ?? null,
        aggregated_rating_count: game.aggregated_rating_count ?? null,
        total_rating: game.total_rating ?? null,
        total_rating_count: game.total_rating_count ?? null,
        publishers,
        developers,
        websites: game.websites || [],
        external_games: game.external_games || [],
      },
    },
  }
}

async function upsertGame(
  adminClient: SupabaseClient,
  game: IgdbGame,
  existingGameId?: number
): Promise<CatalogGamePreview | null> {
  const title = normalizeText(game.name)
  if (!title) return null

  const baseSlug = slugify(game.slug || title)
  const providerSlug = `${baseSlug}-${provider}-${game.id}`
  const resolvedGameId = existingGameId ||
    await findExistingIgdbGameIdByMetadata(adminClient, game.id) ||
    await findExistingIgdbGameIdBySlug(adminClient, providerSlug, game.id) ||
    undefined
  const slug = await ensureUniqueSlug(adminClient, resolvedGameId ? baseSlug : providerSlug, resolvedGameId)
  const payload = buildGamePayload(game, slug)

  let response = resolvedGameId
    ? await adminClient
      .from('jogos')
      .update(payload)
      .eq('id', resolvedGameId)
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .single()
    : await adminClient
      .from('jogos')
      .insert(payload)
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .single()

  if (response.error && !resolvedGameId && (
    isUniqueSlugViolation(response.error) ||
    isUniqueIgdbIdViolation(response.error)
  )) {
    const fallbackGameId = await findExistingIgdbGameIdByMetadata(adminClient, game.id) ||
      await findExistingIgdbGameIdBySlug(adminClient, providerSlug, game.id)

    if (fallbackGameId) {
      const fallbackSlug = await ensureUniqueSlug(adminClient, baseSlug, fallbackGameId)
      response = await adminClient
        .from('jogos')
        .update(buildGamePayload(game, fallbackSlug))
        .eq('id', fallbackGameId)
        .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
        .single()
    }
  }

  if (response.error) throw response.error

  const savedGame = response.data as CatalogGamePreview
  const gameId = savedGame.id

  const igdbUrl = game.slug ? `https://www.igdb.com/games/${game.slug}` : null
  const { error: externalIdError } = await adminClient
    .from('game_external_ids')
    .upsert({
      jogo_id: gameId,
      provider,
      external_id: String(game.id),
      url: igdbUrl,
      metadata: {
        slug: game.slug || null,
        external_games: game.external_games || [],
      },
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'provider,external_id' })

  if (externalIdError) throw externalIdError

  const genreRows = await upsertNamedEntities(adminClient, 'generos', normalizeNamedEntities(game.genres))
  const platformRows = await upsertNamedEntities(adminClient, 'plataformas', normalizeNamedEntities(game.platforms))
  const modeRows = await upsertNamedEntities(adminClient, 'modos_jogo', normalizeNamedEntities(game.game_modes))
  const developerRows = await upsertNamedEntities(adminClient, 'empresas', getCompanyInputsByRole(game, 'developer'))
  const publisherRows = await upsertNamedEntities(adminClient, 'empresas', getCompanyInputsByRole(game, 'publisher'))

  await replaceSimpleBridge(adminClient, 'jogo_generos', gameId, 'genero_id', genreRows.map(row => row.id))
  await replaceSimpleBridge(adminClient, 'jogo_plataformas', gameId, 'plataforma_id', platformRows.map(row => row.id))
  await replaceSimpleBridge(adminClient, 'jogo_modos_jogo', gameId, 'modo_jogo_id', modeRows.map(row => row.id))
  await replaceCompanyBridge(adminClient, gameId, developerRows, publisherRows)
  await replaceMedia(adminClient, gameId, game)
  await upsertGameStatsShell(adminClient, gameId)

  return savedGame
}

async function importGames(
  adminClient: SupabaseClient,
  query: string,
  limit: number
): Promise<ImportPayload> {
  const igdbGames = await searchIgdbGames(query, limit)
  const existingGameIds = await getExistingIgdbGameIds(
    adminClient,
    igdbGames.map(game => String(game.id))
  )
  const savedGames: CatalogGamePreview[] = []

  for (const game of igdbGames) {
    const savedGame = await upsertGame(adminClient, game, existingGameIds.get(String(game.id)))
    if (savedGame) {
      existingGameIds.set(String(game.id), savedGame.id)
      savedGames.push(savedGame)
    }
  }

  return {
    provider,
    importedCount: savedGames.length,
    games: savedGames,
  }
}

Deno.serve(async request => {
  const cors = resolveCors(request, name => Deno.env.get(name))
  const respond = (
    status: number,
    body: Record<string, unknown>,
    extraHeaders: Record<string, string> = {}
  ) => jsonResponse(status, body, cors.headers, extraHeaders)

  if (!cors.allowed) {
    return respond(403, { error: 'origin_not_allowed' })
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors.headers })
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'method_not_allowed' })
  }

  let supabaseUrl = ''
  let anonKey = ''
  let serviceRoleKey = ''

  try {
    supabaseUrl = getRequiredEnv('SUPABASE_URL')
    anonKey = getSupabaseAnonKey() || ''
    serviceRoleKey = getSupabaseServiceRoleKey() || ''

    if (!anonKey || !serviceRoleKey) {
      throw new Error('Missing Supabase API keys')
    }
  } catch (error) {
    logEdgeError('search-import-games server misconfigured', error)
    return respond(500, { error: 'server_misconfigured' })
  }

  const user = await getAuthenticatedUser(supabaseUrl, anonKey, request.headers.get('Authorization'))
  if (!user) {
    return respond(401, { error: 'not_authenticated' })
  }

  const body = await readBody(request)
  const query = normalizeQuery(body.query)
  const limit = normalizeLimit(body.limit)

  if (query.length < 2) {
    return respond(400, { error: 'query_too_short' })
  }

  if (query.length > maxQueryLength) {
    return respond(400, { error: 'query_too_long' })
  }

  const now = Date.now()
  const queryKey = getNormalizedQueryKey(query)
  const queryHash = await sha256Hex(queryKey)
  const durableCacheKey = getDurableCacheKey(queryHash)
  cleanupBestEffortState(now)

  const cachedPayload = getCachedImport(queryKey, now, limit)
  if (cachedPayload) {
    return respond(200, {
      ...cachedPayload,
      cache: { hit: true, scope: 'edge_instance' },
      rateLimit: getRateLimitPayload(),
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  let durableCachedPayload: ImportPayload | null = null

  try {
    durableCachedPayload = await getDurableCachedImport(
      adminClient,
      durableCacheKey,
      now,
      maxLimit
    )
  } catch (error) {
    logEdgeError('Could not read durable search import cache', error)
  }

  if (durableCachedPayload) {
    importCache.set(queryKey, {
      expiresAt: now + importCacheTtlMs,
      payload: durableCachedPayload,
    })
    trimMapToSize(importCache, maxCachedQueries)

    const games = durableCachedPayload.games.slice(0, limit)
    return respond(200, {
      ...durableCachedPayload,
      importedCount: games.length,
      games,
      cache: { hit: true, scope: 'database' },
      rateLimit: getRateLimitPayload(),
    })
  }

  let importPromise = inFlightImports.get(queryKey)
  let ownsImportPromise = false
  let rateLimitReservation: RateLimitReservationRow | null = null

  if (!importPromise) {
    let reservation: RateLimitReservationRow

    try {
      reservation = await reserveDurableExternalAttempt(adminClient, user.id, queryHash)
    } catch (error) {
      logEdgeError('Could not reserve durable search import quota', error, {
        userId: user.id,
      })
      return respond(503, { error: 'rate_limit_unavailable' })
    }

    rateLimitReservation = reservation

    if (!reservation.allowed) {
      const resetAtMs = Date.parse(reservation.reset_at)
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((Number.isFinite(resetAtMs) ? resetAtMs : now + 60_000) - now) / 1000)
      )
      return respond(429, {
        error: 'rate_limit_exceeded',
        rateLimit: getRateLimitPayload(reservation),
      }, { 'Retry-After': String(retryAfterSeconds) })
    }

    importPromise = importGames(adminClient, query, maxLimit)
    inFlightImports.set(queryKey, importPromise)
    ownsImportPromise = true
  }

  try {
    const payload = await importPromise

    if (ownsImportPromise) {
      importCache.set(queryKey, {
        expiresAt: now + importCacheTtlMs,
        payload,
      })
      trimMapToSize(importCache, maxCachedQueries)
      await saveDurableImportCache(adminClient, durableCacheKey, queryKey, now, payload)
    }

    const games = payload.games.slice(0, limit)
    return respond(200, {
      ...payload,
      importedCount: games.length,
      games,
      cache: {
        hit: !ownsImportPromise,
        scope: ownsImportPromise ? 'database' : 'edge_instance',
      },
      rateLimit: getRateLimitPayload(rateLimitReservation),
    })
  } catch (error) {
    const missingIgdbConfig =
      error instanceof Error &&
      (error.message.includes('Missing IGDB_CLIENT_ID') || error.message.includes('Missing IGDB_CLIENT_SECRET'))

    logEdgeError('search-import-games failed', error, {
      query,
      limit,
      userId: user.id,
    })

    return respond(missingIgdbConfig ? 503 : 500, {
      error: missingIgdbConfig ? 'igdb_not_configured' : 'import_failed',
    })
  } finally {
    if (ownsImportPromise && inFlightImports.get(queryKey) === importPromise) {
      inFlightImports.delete(queryKey)
    }
  }
})
