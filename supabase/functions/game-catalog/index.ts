import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface IgdbNamedEntity {
  id?: number
  name?: string
  slug?: string
}

interface IgdbImage {
  id?: number
  image_id?: string
  width?: number
  height?: number
}

interface IgdbCompanyLink {
  developer?: boolean
  publisher?: boolean
  company?: IgdbNamedEntity
}

interface IgdbWebsite {
  category?: number
  url?: string
}

interface IgdbExternalGame {
  category?: number
  uid?: string
  url?: string
}

interface IgdbGame {
  id: number
  category?: number
  game_type?: number
  name?: string
  slug?: string
  summary?: string
  storyline?: string
  cover?: IgdbImage
  screenshots?: IgdbImage[]
  first_release_date?: number
  platforms?: IgdbNamedEntity[]
  genres?: IgdbNamedEntity[]
  game_modes?: IgdbNamedEntity[]
  involved_companies?: IgdbCompanyLink[]
  rating?: number
  rating_count?: number
  aggregated_rating?: number
  aggregated_rating_count?: number
  total_rating?: number
  total_rating_count?: number
  websites?: IgdbWebsite[]
  external_games?: IgdbExternalGame[]
  updated_at?: number
}

interface NamedEntityInput {
  name: string
  provider: string
  externalId?: string | null
}

interface CatalogFilters {
  genres: string[]
  platforms: string[]
  developers: string[]
}

interface LocalGameRow {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  descricao?: string | null
  descricao_curta?: string | null
  plataformas: string[] | null
  slug?: string | null
  source_primary?: string | null
  status_importacao?: string | null
  nota_media_externa?: number | string | null
  nota_media_externa_count?: number | string | null
  external_updated_at?: string | null
  metadados?: JsonRecord | null
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

interface ExternalIdRow {
  jogo_id: number | string | null
  external_id: string | null
  last_synced_at?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const provider = 'igdb'
const defaultPageSize = 20
const maxPageSize = 100
const igdbBaseUrl = 'https://api.igdb.com/v4'
const twitchTokenUrl = 'https://id.twitch.tv/oauth2/token'
const catalogCacheTtlSeconds = 60 * 60 * 6
const searchCacheTtlSeconds = 60 * 60
const allowedIgdbGameCategories = [0, 1, 2, 4, 8, 9] as const
const allowedIgdbGameCategorySet = new Set<number>(allowedIgdbGameCategories)
const allowedIgdbGameTypeClause = `game_type = (${allowedIgdbGameCategories.join(',')})`
const igdbCategoryPolicyVersion = 'igdb-game-type-policy-v2'

let cachedIgdbToken: { token: string; expiresAt: number } | null = null

function jsonResponse(status: number, body: Record<string, unknown>) {
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
  if (
    value === 'release-asc' ||
    value === 'rating-desc' ||
    value === 'rating-asc'
  ) {
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

function hasFilters(filters: CatalogFilters) {
  return filters.genres.length > 0 || filters.platforms.length > 0 || filters.developers.length > 0
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

function getSupabaseServiceRoleKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || getJsonSecret('SUPABASE_SECRET_KEYS')
}

function getSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const serviceRoleKey = getSupabaseServiceRoleKey()

  if (!serviceRoleKey) {
    throw new Error('Missing Supabase service role key')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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

function slugify(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'game'
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeNamedEntities(entities: IgdbNamedEntity[] | undefined): NamedEntityInput[] {
  return uniqueValues((entities || []).map(entity => normalizeText(entity.name)).filter(Boolean))
    .map(name => {
      const match = (entities || []).find(entity => normalizeText(entity.name) === name)

      return {
        name,
        provider,
        externalId: typeof match?.id === 'number' ? String(match.id) : null,
      }
    })
}

function unixDateToIsoDate(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString().slice(0, 10)
}

function unixDateToIso(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function getIgdbImageUrl(imageId: string | undefined, size: 'cover_big' | 'screenshot_big') {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null
}

function escapeIgdbSearch(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getIgdbGameType(game: IgdbGame) {
  if (typeof game.game_type === 'number') return game.game_type
  if (typeof game.category === 'number') return game.category
  return null
}

function isAllowedIgdbGame(game: IgdbGame) {
  const gameType = getIgdbGameType(game)
  return typeof gameType === 'number' && allowedIgdbGameCategorySet.has(gameType)
}

function filterAllowedIgdbGames(games: IgdbGame[]) {
  const gamesById = new Map<number, IgdbGame>()

  games.forEach(game => {
    if (!isAllowedIgdbGame(game) || gamesById.has(game.id)) return
    gamesById.set(game.id, game)
  })

  return Array.from(gamesById.values())
}

const igdbGameFields = `
  id,
  category,
  game_type,
  name,
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
  updated_at
`

function buildIgdbSearchQuery(query: string, limit: number, offset: number) {
  return `
    search "${escapeIgdbSearch(query)}";
    fields ${igdbGameFields};
    where version_parent = null
      & ${allowedIgdbGameTypeClause};
    limit ${limit};
    offset ${offset};
  `
}

function getCatalogSortClause(sort: CatalogSortOption) {
  if (sort === 'release-asc') return 'first_release_date asc'
  if (sort === 'rating-desc') return 'total_rating desc'
  if (sort === 'rating-asc') return 'total_rating asc'
  return 'first_release_date desc'
}

function buildIgdbCatalogQuery(sort: CatalogSortOption, limit: number, offset: number) {
  const nowUnix = Math.floor(Date.now() / 1000)
  const ratingFilter = sort === 'rating-asc' || sort === 'rating-desc' ? ' & total_rating != null' : ''

  return `
    fields ${igdbGameFields};
    where version_parent = null
      & ${allowedIgdbGameTypeClause}
      & cover != null
      & first_release_date != null
      & first_release_date <= ${nowUnix}${ratingFilter};
    sort ${getCatalogSortClause(sort)};
    limit ${limit};
    offset ${offset};
  `
}

function buildIgdbByIdsQuery(igdbIds: number[]) {
  return `
    fields ${igdbGameFields};
    where id = (${igdbIds.join(',')})
      & ${allowedIgdbGameTypeClause};
    limit ${igdbIds.length};
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

async function fetchIgdbGames(body: string) {
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
    body,
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`IGDB request failed with status ${response.status}: ${responseText.slice(0, 300)}`)
  }

  const games = await response.json() as IgdbGame[]
  return filterAllowedIgdbGames(games)
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

  return `${baseSlug}-${currentGameId || Date.now().toString(36)}`
}

function isUniqueSlugViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const errorRecord = error as Record<string, unknown>
  return errorRecord.code === '23505' &&
    typeof errorRecord.message === 'string' &&
    errorRecord.message.includes('jogos_slug_unique_idx')
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
  const description = normalizeText(game.summary) || normalizeText(game.storyline) || null

  return {
    titulo: title,
    slug,
    capa_url: coverUrl,
    desenvolvedora: developers[0] || publishers[0] || null,
    generos: genres.length > 0 ? genres : null,
    data_lancamento: unixDateToIsoDate(game.first_release_date),
    descricao: description,
    descricao_curta: description ? description.slice(0, 280) : null,
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
): Promise<number | null> {
  const title = normalizeText(game.name)
  if (!title) return null

  const baseSlug = slugify(game.slug || title)
  const providerSlug = `${baseSlug}-${provider}-${game.id}`
  const resolvedGameId = existingGameId ||
    await findExistingIgdbGameIdBySlug(adminClient, providerSlug, game.id) ||
    undefined
  const slug = await ensureUniqueSlug(
    adminClient,
    resolvedGameId ? baseSlug : providerSlug,
    resolvedGameId
  )
  const payload = buildGamePayload(game, slug)

  let response = resolvedGameId
    ? await adminClient
      .from('jogos')
      .update(payload)
      .eq('id', resolvedGameId)
      .select('id')
      .single()
    : await adminClient
      .from('jogos')
      .insert(payload)
      .select('id')
      .single()

  if (response.error && !resolvedGameId && isUniqueSlugViolation(response.error)) {
    const fallbackGameId = await findExistingIgdbGameIdBySlug(adminClient, providerSlug, game.id)

    if (fallbackGameId) {
      const fallbackSlug = await ensureUniqueSlug(adminClient, baseSlug, fallbackGameId)
      response = await adminClient
        .from('jogos')
        .update(buildGamePayload(game, fallbackSlug))
        .eq('id', fallbackGameId)
        .select('id')
        .single()
    }
  }

  if (response.error) throw response.error

  const gameId = Number(response.data.id)
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

  return gameId
}

async function upsertIgdbGames(adminClient: SupabaseClient, igdbGames: IgdbGame[]) {
  const allowedGames = filterAllowedIgdbGames(igdbGames)
  const existingGameIds = await getExistingIgdbGameIds(
    adminClient,
    allowedGames.map(game => String(game.id))
  )
  const gameIds: number[] = []

  for (const game of allowedGames) {
    const gameId = await upsertGame(adminClient, game, existingGameIds.get(String(game.id)))
    if (gameId) {
      existingGameIds.set(String(game.id), gameId)
      gameIds.push(gameId)
    }
  }

  return gameIds
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function buildCacheKey(action: string, request: JsonRecord) {
  return `${provider}:${action}:${stableStringify(request)}`
}

function getCacheExpiry(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString()
}

async function getCachedGameIds(adminClient: SupabaseClient, cacheKey: string) {
  const { data, error } = await adminClient
    .from('game_catalog_cache')
    .select('game_ids, has_next_page')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null

  return {
    gameIds: Array.isArray(data.game_ids)
      ? (data.game_ids as unknown[]).map(id => normalizeInteger(id)).filter(Boolean)
      : [],
    hasNextPage: Boolean(data.has_next_page),
  }
}

async function saveCatalogCache(
  adminClient: SupabaseClient,
  cacheKey: string,
  request: JsonRecord,
  gameIds: number[],
  hasNextPage: boolean,
  ttlSeconds: number
) {
  const { error } = await adminClient
    .from('game_catalog_cache')
    .upsert({
      cache_key: cacheKey,
      provider,
      request,
      game_ids: gameIds,
      has_next_page: hasNextPage,
      expires_at: getCacheExpiry(ttlSeconds),
    }, { onConflict: 'cache_key' })

  if (error) throw error
}

async function fetchStatsByGameId(adminClient: SupabaseClient, gameIds: number[]) {
  if (gameIds.length === 0) return new Map<number, LocalStatsRow>()

  const { data, error } = await adminClient
    .from('jogo_estatisticas')
    .select('jogo_id, media_usuarios, reviews_count')
    .in('jogo_id', gameIds)

  if (error) return new Map<number, LocalStatsRow>()

  return new Map((data || []).map(row => [Number(row.jogo_id), row as LocalStatsRow]))
}

async function fetchExternalIdsByGameId(adminClient: SupabaseClient, gameIds: number[]) {
  if (gameIds.length === 0) return new Map<number, string>()

  const { data, error } = await adminClient
    .from('game_external_ids')
    .select('jogo_id, external_id')
    .eq('provider', provider)
    .in('jogo_id', gameIds)

  if (error) return new Map<number, string>()

  return new Map((data || []).map(row => [Number(row.jogo_id), String(row.external_id)]))
}

function toPreview(row: LocalGameRow, igdbId: string | null, stats?: LocalStatsRow | null) {
  const developer = normalizeList(row.desenvolvedora)
  const genres = normalizeList(row.generos)
  const platforms = normalizeList(row.plataformas)
  const averageRating = normalizeNumber(stats?.media_usuarios)
  const reviewCount = normalizeInteger(stats?.reviews_count)

  return {
    id: Number(row.id),
    igdbId,
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
    sourcePrimary: row.source_primary || null,
    importStatus: row.status_importacao || null,
    averageRating,
    reviewCount,
  }
}

type GamePreviewPayload = ReturnType<typeof toPreview>

async function fetchLocalGamePreviews(adminClient: SupabaseClient, gameIds: number[]): Promise<GamePreviewPayload[]> {
  const normalizedIds = Array.from(new Set(gameIds.filter(gameId => Number.isInteger(gameId) && gameId > 0)))
  if (normalizedIds.length === 0) return []

  const { data, error } = await adminClient
    .from('jogos')
    .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas, source_primary, status_importacao')
    .in('id', normalizedIds)
    .neq('status_importacao', 'stale')

  if (error) throw error

  const rowsById = new Map((data || []).map(row => [Number(row.id), row as LocalGameRow]))
  const statsByGameId = await fetchStatsByGameId(adminClient, normalizedIds)
  const externalIdsByGameId = await fetchExternalIdsByGameId(adminClient, normalizedIds)

  return normalizedIds
    .map(gameId => {
      const row = rowsById.get(gameId)
      if (!row) return null
      return toPreview(row, externalIdsByGameId.get(gameId) || null, statsByGameId.get(gameId))
    })
    .filter((game): game is GamePreviewPayload => Boolean(game))
}

function gameMatchesFilters(game: ReturnType<typeof toPreview>, filters: CatalogFilters) {
  const lowerGenres = game.genres.map(value => value.toLowerCase())
  const lowerPlatforms = game.platforms.map(value => value.toLowerCase())
  const lowerDevelopers = game.developer.map(value => value.toLowerCase())

  return (
    filters.genres.every(genre => lowerGenres.includes(genre.toLowerCase())) &&
    filters.platforms.every(platform => lowerPlatforms.includes(platform.toLowerCase())) &&
    filters.developers.every(developer => lowerDevelopers.includes(developer.toLowerCase()))
  )
}

async function handleCatalog(adminClient: SupabaseClient, body: CatalogBody) {
  const page = normalizePositiveInteger(body.page, 1)
  const pageSize = normalizePositiveInteger(body.pageSize ?? body.limit, defaultPageSize, maxPageSize)
  const query = normalizeText(body.query)
  const sort = normalizeSort(body.sort)
  const filters = normalizeFilters(body)
  const offset = (page - 1) * pageSize
  const request = {
    page,
    pageSize,
    query,
    sort,
    filters,
    categoryPolicy: {
      version: igdbCategoryPolicyVersion,
      allowed: allowedIgdbGameCategories,
    },
  }
  const cacheKey = buildCacheKey(query ? 'search' : 'catalog', request)
  const cached = await getCachedGameIds(adminClient, cacheKey)

  if (cached) {
    return {
      items: await fetchLocalGamePreviews(adminClient, cached.gameIds),
      page,
      pageSize,
      hasNextPage: cached.hasNextPage,
      totalCount: null,
      cache: { hit: true },
    }
  }

  const shouldFilterLocally = hasFilters(filters)
  const igdbOffset = shouldFilterLocally ? 0 : offset
  const igdbLimit = shouldFilterLocally ? Math.min(100, Math.max(pageSize + 1, offset + pageSize + 1)) : pageSize + 1
  const igdbGames = query.length >= 2
    ? await fetchIgdbGames(buildIgdbSearchQuery(query, igdbLimit, igdbOffset))
    : await fetchIgdbGames(buildIgdbCatalogQuery(sort, igdbLimit, igdbOffset))
  const importedGameIds = await upsertIgdbGames(adminClient, igdbGames)
  let previews = await fetchLocalGamePreviews(adminClient, importedGameIds)

  if (shouldFilterLocally) {
    previews = previews.filter(game => gameMatchesFilters(game, filters))
  }

  const pagedPreviews = shouldFilterLocally
    ? previews.slice(offset, offset + pageSize)
    : previews.slice(0, pageSize)
  const hasNextPage = shouldFilterLocally
    ? previews.length > offset + pageSize
    : igdbGames.length > pageSize
  const ttlSeconds = query.length >= 2 ? searchCacheTtlSeconds : catalogCacheTtlSeconds

  await saveCatalogCache(
    adminClient,
    cacheKey,
    request,
    pagedPreviews.map(game => game.id),
    hasNextPage,
    ttlSeconds
  )

  return {
    items: pagedPreviews,
    page,
    pageSize,
    hasNextPage,
    totalCount: null,
    cache: { hit: false },
  }
}

async function handleFacets(adminClient: SupabaseClient, body: CatalogBody) {
  const query = normalizeText(body.query).toLowerCase()
  const { data, error } = await adminClient
    .from('jogos')
    .select('titulo, generos, plataformas, desenvolvedora')
    .eq('source_primary', provider)
    .neq('status_importacao', 'stale')
    .limit(1000)

  if (error) throw error

  const facets = {
    genres: new Set<string>(),
    platforms: new Set<string>(),
    developers: new Set<string>(),
  }

  ;((data || []) as Array<{
    titulo: string | null
    generos: string[] | null
    plataformas: string[] | null
    desenvolvedora: string | null
  }>).forEach(row => {
    if (query && !normalizeText(row.titulo).toLowerCase().includes(query)) return
    normalizeList(row.generos).forEach(value => facets.genres.add(value))
    normalizeList(row.plataformas).forEach(value => facets.platforms.add(value))
    normalizeList(row.desenvolvedora).forEach(value => facets.developers.add(value))
  })

  const sortValues = (values: Set<string>) => Array.from(values).sort((left, right) => left.localeCompare(right))

  return {
    genres: sortValues(facets.genres),
    platforms: sortValues(facets.platforms),
    developers: sortValues(facets.developers),
    cache: { hit: true },
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

function getDeepLApiUrl(apiKey: string) {
  const configuredUrl = Deno.env.get('DEEPL_API_URL')?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')

  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
}

async function translateWithDeepL(sourceText: string, gameTitle: string) {
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
      preserve_formatting: true,
      context: gameTitle,
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

  if (!translatedText) {
    return {
      text: null,
      status: 'deepl_empty',
      errorMessage: 'DeepL response did not include translated text.',
    }
  }

  return {
    text: translatedText,
    status: 'translated',
    errorMessage: null,
  }
}

async function getLocalizedDescription(
  adminClient: SupabaseClient,
  gameId: number,
  gameTitle: string,
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

  const sourceHash = await sha256Hex(sourceText)
  const { data: cachedTranslation } = await adminClient
    .from('game_translations')
    .select('translated_text, status')
    .eq('jogo_id', gameId)
    .eq('field', 'description')
    .eq('target_locale', 'pt-BR')
    .eq('source_hash', sourceHash)
    .eq('status', 'ready')
    .maybeSingle()

  const translatedText = normalizeText(cachedTranslation?.translated_text)
  if (translatedText) {
    return {
      description: translatedText,
      descriptionLocale: 'pt-BR',
      descriptionFallback: false,
      translationStatus: 'cached_pt',
    }
  }

  const translation = await translateWithDeepL(sourceText, gameTitle)

  if (translation.text) {
    const { error } = await adminClient
      .from('game_translations')
      .upsert({
        jogo_id: gameId,
        provider: 'deepl',
        field: 'description',
        source_locale: 'en-US',
        target_locale: 'pt-BR',
        source_hash: sourceHash,
        translated_text: translation.text,
        status: 'ready',
        error_message: null,
      }, { onConflict: 'jogo_id,field,target_locale,source_hash' })

    if (error) throw error

    return {
      description: translation.text,
      descriptionLocale: 'pt-BR',
      descriptionFallback: false,
      translationStatus: 'translated_pt',
    }
  }

  await adminClient
    .from('game_translations')
    .upsert({
      jogo_id: gameId,
      provider: 'deepl',
      field: 'description',
      source_locale: 'en-US',
      target_locale: 'pt-BR',
      source_hash: sourceHash,
      translated_text: null,
      status: 'error',
      error_message: translation.errorMessage,
    }, { onConflict: 'jogo_id,field,target_locale,source_hash' })

  return {
    description: sourceText,
    descriptionLocale: 'en-US',
    descriptionFallback: true,
    translationStatus: translation.status || 'fallback_en',
  }
}

async function fetchLocalGameDetails(adminClient: SupabaseClient, gameId: number, locale: SupportedLocale) {
  const [gameResponse, externalIdResponse, mediaResponse, statsResponse] = await Promise.all([
    adminClient
      .from('jogos')
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, descricao, descricao_curta, plataformas, slug, source_primary, status_importacao, nota_media_externa, nota_media_externa_count, external_updated_at, metadados')
      .eq('id', gameId)
      .single(),
    adminClient
      .from('game_external_ids')
      .select('jogo_id, external_id, last_synced_at')
      .eq('provider', provider)
      .eq('jogo_id', gameId)
      .maybeSingle(),
    adminClient
      .from('jogo_midias')
      .select('id, tipo, url, thumbnail_url, provider, external_media_id, width, height, ordem, is_primary')
      .eq('jogo_id', gameId)
      .order('ordem', { ascending: true }),
    adminClient
      .from('jogo_estatisticas')
      .select('jogo_id, media_usuarios, reviews_count')
      .eq('jogo_id', gameId)
      .maybeSingle(),
  ])

  if (gameResponse.error) throw gameResponse.error

  const game = gameResponse.data as LocalGameRow
  const externalId = externalIdResponse.error
    ? null
    : ((externalIdResponse.data as ExternalIdRow | null)?.external_id || null)
  const stats = statsResponse.error ? null : statsResponse.data as LocalStatsRow | null
  const preview = toPreview(game, externalId, stats || undefined)
  const media = mediaResponse.error
    ? []
    : ((mediaResponse.data || []) as LocalMediaRow[])
      .map(normalizeMedia)
      .filter((item): item is GameMediaPayload => Boolean(item))
  const coverMedia = media.find(item => item?.type === 'cover' && item?.isPrimary) ||
    media.find(item => item?.type === 'cover') ||
    null
  const localizedDescription = await getLocalizedDescription(
    adminClient,
    gameId,
    game.titulo,
    game.descricao || null,
    locale
  )

  return {
    ...preview,
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
    screenshots: media.filter(item => item?.type === 'screenshot'),
    coverMedia,
    descriptionLocale: localizedDescription.descriptionLocale,
    descriptionFallback: localizedDescription.descriptionFallback,
    translationStatus: localizedDescription.translationStatus,
  }
}

async function handleDetails(adminClient: SupabaseClient, body: CatalogBody) {
  const locale = normalizeLocale(body.locale)
  let gameId = normalizeInteger(body.gameId)
  const igdbId = normalizeInteger(body.igdbId)

  if (!gameId && igdbId) {
    const existingIds = await getExistingIgdbGameIds(adminClient, [String(igdbId)])
    gameId = existingIds.get(String(igdbId)) || 0

    if (!gameId) {
      const igdbGames = await fetchIgdbGames(buildIgdbByIdsQuery([igdbId]))
      const importedIds = await upsertIgdbGames(adminClient, igdbGames)
      gameId = importedIds[0] || 0
    }
  }

  if (!gameId) {
    return jsonResponse(400, { error: 'game_not_identified' })
  }

  const game = await fetchLocalGameDetails(adminClient, gameId, locale)
  return jsonResponse(200, {
    game,
    cache: { hit: true },
    provider,
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  const body = await readBody(request)
  const action = normalizeAction(body.action)

  try {
    const adminClient = getSupabaseAdminClient()

    if (action === 'details') {
      return await handleDetails(adminClient, body)
    }

    if (action === 'facets') {
      const facets = await handleFacets(adminClient, body)
      return jsonResponse(200, facets)
    }

    const result = await handleCatalog(adminClient, {
      ...body,
      query: action === 'search' ? body.query : body.query,
    })

    return jsonResponse(200, {
      ...result,
      provider,
    })
  } catch (error) {
    const missingConfig =
      error instanceof Error &&
      (
        error.message.includes('Missing IGDB_CLIENT_ID') ||
        error.message.includes('Missing IGDB_CLIENT_SECRET') ||
        error.message.includes('Missing Supabase service role key')
      )

    logEdgeError('game-catalog failed', error, {
      action,
    })

    return jsonResponse(missingConfig ? 503 : 500, {
      error: missingConfig ? 'server_misconfigured' : 'catalog_failed',
    })
  }
})
