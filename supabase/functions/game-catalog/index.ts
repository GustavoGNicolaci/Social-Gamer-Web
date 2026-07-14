import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeText, provider } from '../_shared/igdb.ts'
import { resolveCors } from '../_shared/cors.ts'

declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

type JsonRecord = Record<string, unknown>
type CatalogAction = 'catalog' | 'search' | 'details' | 'facets'
type SupportedLocale = 'pt-BR' | 'en-US'
type CatalogSortOption = 'release-desc' | 'release-asc' | 'rating-desc' | 'rating-asc'

interface CatalogBody {
  action?: unknown
  locale?: unknown
  page?: unknown
  pageSize?: unknown
  limit?: unknown
  query?: unknown
  sort?: unknown
  filters?: unknown
  genres?: unknown
  platforms?: unknown
  developers?: unknown
  gameId?: unknown
  igdbId?: unknown
}

interface CatalogFilters {
  genres: string[]
  platforms: string[]
  developers: string[]
}

interface CatalogRpcRow {
  id: number | string
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  plataformas: string[] | null
  average_rating: number | string | null
  review_count: number | string | null
  total_count: number | string | null
}

interface CatalogFacetRow {
  category: string | null
  value: string | null
  result_count: number | string | null
}

interface LocalGameRow {
  id: number | string
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  descricao: string | null
  descricao_curta: string | null
  plataformas: string[] | null
  slug: string | null
  source_primary: string | null
  status_importacao: string | null
  nota_media_externa: number | string | null
  nota_media_externa_count: number | string | null
  external_updated_at: string | null
  metadados: JsonRecord | null
}

interface LocalMediaRow {
  id: number | string
  tipo: string | null
  url: string | null
  thumbnail_url?: string | null
  provider?: string | null
  external_media_id?: string | null
  width?: number | string | null
  height?: number | string | null
  ordem?: number | string | null
  is_primary?: boolean | null
}

interface LocalStatsRow {
  jogo_id: number | string
  media_usuarios: number | string | null
  reviews_count: number | string | null
}

interface CatalogMetadataRow {
  id: number | string
  source_primary: string | null
  status_importacao: string | null
}

const defaultPageSize = 20
const maxPageSize = 100

class GameNotFoundError extends Error {
  constructor() {
    super('Game was not found in the local catalog')
    this.name = 'GameNotFoundError'
  }
}

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

function normalizeInteger(value: unknown, fallback = 0) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.max(0, Math.trunc(parsedValue))
}

function normalizePositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) return fallback
  return Math.max(1, Math.min(Math.trunc(parsedValue), max))
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function normalizeLocale(value: unknown): SupportedLocale {
  return value === 'en-US' ? 'en-US' : 'pt-BR'
}

function normalizeAction(value: unknown): CatalogAction {
  if (value === 'search' || value === 'details' || value === 'facets') return value
  return 'catalog'
}

function normalizeSort(value: unknown): CatalogSortOption {
  if (value === 'release-asc' || value === 'rating-desc' || value === 'rating-asc') {
    return value
  }

  return 'release-desc'
}

function normalizeList(value: unknown): string[] {
  if (!value) return []
  const values = Array.isArray(value) ? value : [value]

  return Array.from(new Set(
    values
      .map(item => normalizeText(item))
      .filter(Boolean)
  ))
}

function normalizeFilters(body: CatalogBody): CatalogFilters {
  const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
    ? body.filters as Record<string, unknown>
    : {}

  return {
    genres: normalizeList(filters.genres ?? body.genres),
    platforms: normalizeList(filters.platforms ?? body.platforms),
    developers: normalizeList(filters.developers ?? body.developers),
  }
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
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    const value = parsed[keyName]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

function getSupabasePublicKey() {
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ||
    Deno.env.get('SUPABASE_ANON_KEY')?.trim() ||
    getJsonSecret('SUPABASE_PUBLISHABLE_KEYS')
}

function createDatabaseClient(apiKey: string) {
  return createClient(getRequiredEnv('SUPABASE_URL'), apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function getSupabasePublicClient() {
  const publicKey = getSupabasePublicKey()
  if (!publicKey) throw new Error('Missing Supabase public API key')
  return createDatabaseClient(publicKey)
}

async function readBody(request: Request): Promise<CatalogBody> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body as CatalogBody : {}
  } catch {
    return {}
  }
}

function normalizeErrorForLog(error: unknown) {
  if (!error || typeof error !== 'object') return { message: String(error) }

  return {
    name: 'name' in error ? error.name : null,
    code: 'code' in error ? error.code : null,
    message: 'message' in error ? error.message : error instanceof Error ? error.message : null,
    details: 'details' in error ? error.details : null,
    hint: 'hint' in error ? error.hint : null,
  }
}

function logEdgeError(message: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error(message, {
    ...context,
    error: normalizeErrorForLog(error),
  })
}

async function fetchCatalogMetadata(client: SupabaseClient, gameIds: number[]) {
  if (gameIds.length === 0) {
    return {
      externalIds: new Map<number, string>(),
      rows: new Map<number, CatalogMetadataRow>(),
    }
  }

  const [externalIdsResponse, gamesResponse] = await Promise.all([
    client
      .from('game_external_ids')
      .select('jogo_id, external_id')
      .eq('provider', provider)
      .in('jogo_id', gameIds),
    client
      .from('jogos')
      .select('id, source_primary, status_importacao')
      .in('id', gameIds),
  ])

  const externalIds = externalIdsResponse.error
    ? new Map<number, string>()
    : new Map(
      (externalIdsResponse.data || []).map(row => [Number(row.jogo_id), String(row.external_id)])
    )
  const rows = gamesResponse.error
    ? new Map<number, CatalogMetadataRow>()
    : new Map(
      (gamesResponse.data || []).map(row => [Number(row.id), row as CatalogMetadataRow])
    )

  return { externalIds, rows }
}

function toPreview(
  row: CatalogRpcRow,
  externalId: string | null,
  metadata?: CatalogMetadataRow
) {
  const developer = normalizeList(row.desenvolvedora)
  const genres = normalizeList(row.generos)
  const platforms = normalizeList(row.plataformas)

  return {
    id: Number(row.id),
    igdbId: externalId,
    title: row.titulo,
    titulo: row.titulo,
    coverUrl: row.capa_url,
    capa_url: row.capa_url,
    developer,
    desenvolvedora: developer.length > 0 ? developer : null,
    genres,
    generos: genres.length > 0 ? genres : null,
    releaseDate: row.data_lancamento,
    data_lancamento: row.data_lancamento,
    platforms,
    plataformas: platforms.length > 0 ? platforms : null,
    sourcePrimary: metadata?.source_primary || null,
    importStatus: metadata?.status_importacao || null,
    averageRating: normalizeNumber(row.average_rating),
    reviewCount: normalizeInteger(row.review_count),
  }
}

async function handleCatalog(client: SupabaseClient, body: CatalogBody) {
  const page = normalizePositiveInteger(body.page, 1)
  const pageSize = normalizePositiveInteger(body.pageSize ?? body.limit, defaultPageSize, maxPageSize)
  const query = normalizeText(body.query)
  const filters = normalizeFilters(body)
  const offset = (page - 1) * pageSize
  const { data, error } = await client.rpc('search_catalog_games', {
    p_query: query || null,
    p_genres: filters.genres,
    p_platforms: filters.platforms,
    p_developers: filters.developers,
    p_sort: normalizeSort(body.sort),
    p_limit: pageSize,
    p_offset: offset,
  })

  if (error) throw error

  const rows = (data || []) as CatalogRpcRow[]
  const gameIds = rows.map(row => Number(row.id)).filter(gameId => Number.isInteger(gameId) && gameId > 0)
  const metadata = await fetchCatalogMetadata(client, gameIds)
  const items = rows
    .filter(row => metadata.rows.get(Number(row.id))?.status_importacao !== 'stale')
    .map(row => {
      const gameId = Number(row.id)
      return toPreview(
        row,
        metadata.externalIds.get(gameId) || null,
        metadata.rows.get(gameId)
      )
    })
  const totalCount = rows.length > 0 ? normalizeInteger(rows[0].total_count) : 0

  return {
    items,
    page,
    pageSize,
    hasNextPage: offset + items.length < totalCount,
    totalCount,
    cache: { hit: true, source: 'database' },
  }
}

async function handleFacets(client: SupabaseClient, body: CatalogBody) {
  const query = normalizeText(body.query)
  const { data, error } = await client.rpc('get_catalog_facets', {
    p_query: query || null,
  })

  if (error) throw error

  const facets = {
    genres: new Set<string>(),
    platforms: new Set<string>(),
    developers: new Set<string>(),
  }

  ;((data || []) as CatalogFacetRow[]).forEach(row => {
    const value = normalizeText(row.value)
    if (!value) return
    if (row.category === 'genre') facets.genres.add(value)
    if (row.category === 'platform') facets.platforms.add(value)
    if (row.category === 'developer') facets.developers.add(value)
  })

  const sortValues = (values: Set<string>) =>
    Array.from(values).sort((left, right) => left.localeCompare(right))

  return {
    genres: sortValues(facets.genres),
    platforms: sortValues(facets.platforms),
    developers: sortValues(facets.developers),
    cache: { hit: true, source: 'database' },
  }
}

function normalizeMedia(row: LocalMediaRow) {
  const url = row.url?.trim()
  if (!url) return null

  return {
    id: row.id,
    type: row.tipo || 'screenshot',
    url,
    thumbnailUrl: row.thumbnail_url || null,
    provider: row.provider || null,
    externalMediaId: row.external_media_id || null,
    width: normalizeInteger(row.width) || null,
    height: normalizeInteger(row.height) || null,
    order: normalizeInteger(row.ordem),
    isPrimary: Boolean(row.is_primary),
  }
}

type GameMediaPayload = NonNullable<ReturnType<typeof normalizeMedia>>

async function sha256Hex(value: string) {
  const encodedValue = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encodedValue)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function queryStoredTranslation(
  client: SupabaseClient,
  gameId: number,
  sourceHash: string
) {
  return client.rpc('get_catalog_translation', {
    p_game_id: gameId,
    p_field: 'description',
    p_target_locale: 'pt-BR',
    p_source_hash: sourceHash,
  })
}

async function getStoredTranslation(
  publicClient: SupabaseClient,
  gameId: number,
  sourceText: string
) {
  const sourceHash = await sha256Hex(sourceText)
  const publicResponse = await queryStoredTranslation(publicClient, gameId, sourceHash)
  if (publicResponse.error) return null
  return normalizeText(publicResponse.data) || null
}

async function getLocalizedDescription(
  publicClient: SupabaseClient,
  gameId: number,
  sourceText: string | null,
  locale: SupportedLocale
) {
  if (!sourceText) {
    return {
      description: null,
      descriptionLocale: locale,
      descriptionFallback: false,
      translationStatus: 'empty',
    }
  }

  if (locale === 'en-US') {
    return {
      description: sourceText,
      descriptionLocale: 'en-US',
      descriptionFallback: false,
      translationStatus: 'source_en',
    }
  }

  const translatedText = await getStoredTranslation(publicClient, gameId, sourceText)
  if (translatedText) {
    return {
      description: translatedText,
      descriptionLocale: 'pt-BR',
      descriptionFallback: false,
      translationStatus: 'cached_pt',
    }
  }

  return {
    description: sourceText,
    descriptionLocale: 'en-US',
    descriptionFallback: true,
    translationStatus: 'fallback_en',
  }
}

async function fetchLocalGameDetails(
  client: SupabaseClient,
  gameId: number,
  locale: SupportedLocale
) {
  const [gameResponse, externalIdResponse, mediaResponse, statsResponse] = await Promise.all([
    client
      .from('jogos')
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, descricao, descricao_curta, plataformas, slug, source_primary, status_importacao, nota_media_externa, nota_media_externa_count, external_updated_at, metadados')
      .eq('id', gameId)
      .maybeSingle(),
    client
      .from('game_external_ids')
      .select('jogo_id, external_id, last_synced_at')
      .eq('provider', provider)
      .eq('jogo_id', gameId)
      .maybeSingle(),
    client
      .from('jogo_midias')
      .select('id, tipo, url, thumbnail_url, provider, external_media_id, width, height, ordem, is_primary')
      .eq('jogo_id', gameId)
      .order('ordem', { ascending: true }),
    client
      .from('jogo_estatisticas')
      .select('jogo_id, media_usuarios, reviews_count')
      .eq('jogo_id', gameId)
      .maybeSingle(),
  ])

  if (gameResponse.error) throw gameResponse.error
  if (!gameResponse.data) throw new GameNotFoundError()

  const game = gameResponse.data as LocalGameRow
  if (game.status_importacao === 'stale') throw new GameNotFoundError()
  const stats = statsResponse.error ? null : statsResponse.data as LocalStatsRow | null
  const developer = normalizeList(game.desenvolvedora)
  const genres = normalizeList(game.generos)
  const platforms = normalizeList(game.plataformas)
  const media = mediaResponse.error
    ? []
    : ((mediaResponse.data || []) as LocalMediaRow[])
      .map(normalizeMedia)
      .filter((item): item is GameMediaPayload => Boolean(item))
  const coverMedia = media.find(item => item.type === 'cover' && item.isPrimary) ||
    media.find(item => item.type === 'cover') ||
    null
  const localizedDescription = await getLocalizedDescription(
    client,
    gameId,
    game.descricao || null,
    locale
  )
  const externalId = externalIdResponse.error
    ? null
    : normalizeText(externalIdResponse.data?.external_id) || null

  return {
    id: Number(game.id),
    igdbId: externalId,
    title: game.titulo,
    titulo: game.titulo,
    coverUrl: game.capa_url,
    capa_url: game.capa_url,
    developer,
    desenvolvedora: developer.length > 0 ? developer : null,
    genres,
    generos: genres.length > 0 ? genres : null,
    releaseDate: game.data_lancamento,
    data_lancamento: game.data_lancamento,
    platforms,
    plataformas: platforms.length > 0 ? platforms : null,
    sourcePrimary: game.source_primary || null,
    importStatus: game.status_importacao || null,
    averageRating: normalizeNumber(stats?.media_usuarios),
    reviewCount: normalizeInteger(stats?.reviews_count),
    slug: game.slug || null,
    description: localizedDescription.description,
    descricao: localizedDescription.description,
    sourceDescription: game.descricao || null,
    shortDescription: game.descricao_curta || null,
    externalRating: normalizeNumber(game.nota_media_externa),
    externalRatingCount: normalizeInteger(game.nota_media_externa_count),
    externalUpdatedAt: game.external_updated_at || null,
    metadata: game.metadados || null,
    media,
    screenshots: media.filter(item => item.type === 'screenshot'),
    coverMedia,
    descriptionLocale: localizedDescription.descriptionLocale,
    descriptionFallback: localizedDescription.descriptionFallback,
    translationStatus: localizedDescription.translationStatus,
  }
}

async function resolveLocalGameId(client: SupabaseClient, body: CatalogBody) {
  const gameId = normalizeInteger(body.gameId)
  if (gameId) return gameId

  const igdbId = normalizeInteger(body.igdbId)
  if (!igdbId) return 0

  const { data, error } = await client
    .from('game_external_ids')
    .select('jogo_id')
    .eq('provider', provider)
    .eq('external_id', String(igdbId))
    .maybeSingle()

  if (error) throw error
  return normalizeInteger(data?.jogo_id)
}

async function handleDetails(
  client: SupabaseClient,
  body: CatalogBody,
  corsHeaders: Record<string, string>
) {
  const gameId = await resolveLocalGameId(client, body)

  if (!gameId) {
    return jsonResponse(
      normalizeInteger(body.gameId) || normalizeInteger(body.igdbId) ? 404 : 400,
      { error: normalizeInteger(body.gameId) || normalizeInteger(body.igdbId) ? 'game_not_found' : 'game_not_identified' },
      corsHeaders
    )
  }

  try {
    const game = await fetchLocalGameDetails(client, gameId, normalizeLocale(body.locale))
    return jsonResponse(200, {
      game,
      cache: { hit: true, source: 'database' },
      provider,
    }, corsHeaders)
  } catch (error) {
    if (error instanceof GameNotFoundError) {
      return jsonResponse(404, { error: 'game_not_found' }, corsHeaders)
    }

    throw error
  }
}

Deno.serve(async request => {
  const cors = resolveCors(request, name => Deno.env.get(name))

  if (!cors.allowed) {
    return jsonResponse(403, { error: 'origin_not_allowed' }, cors.headers)
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors.headers })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' }, cors.headers)
  }

  const body = await readBody(request)
  const action = normalizeAction(body.action)

  try {
    // Always execute with the public key. Forwarding a caller-provided
    // Authorization header could accidentally turn this read-only endpoint
    // into a privileged proxy when invoked by another trusted backend.
    const publicClient = getSupabasePublicClient()

    if (action === 'details') {
      return await handleDetails(publicClient, body, cors.headers)
    }

    if (action === 'facets') {
      return jsonResponse(200, await handleFacets(publicClient, body), cors.headers)
    }

    return jsonResponse(200, {
      ...await handleCatalog(publicClient, body),
      provider,
    }, cors.headers)
  } catch (error) {
    const missingConfig = error instanceof Error && (
      error.message.includes('Missing SUPABASE_URL') ||
      error.message.includes('Missing Supabase public API key')
    )

    logEdgeError('game-catalog failed', error, { action })

    return jsonResponse(missingConfig ? 503 : 500, {
      error: missingConfig ? 'server_misconfigured' : 'catalog_failed',
    }, cors.headers)
  }
})
