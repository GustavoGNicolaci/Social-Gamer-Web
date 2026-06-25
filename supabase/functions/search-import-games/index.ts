import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

interface CatalogGamePreview {
  id: number
  titulo: string
  capa_url: string | null
  desenvolvedora: string | null
  generos: string[] | null
  data_lancamento: string | null
  plataformas: string[] | null
}

interface NamedEntityInput {
  name: string
  provider: string
  externalId?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const provider = 'igdb'
const maxLimit = 20
const defaultLimit = 10
const igdbBaseUrl = 'https://api.igdb.com/v4'
const twitchTokenUrl = 'https://id.twitch.tv/oauth2/token'

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
  return Deno.env.get('SUPABASE_ANON_KEY')?.trim() || getJsonSecret('SUPABASE_PUBLISHABLE_KEYS')
}

function getSupabaseServiceRoleKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || getJsonSecret('SUPABASE_SECRET_KEYS')
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLimit(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultLimit
  return Math.max(1, Math.min(Math.trunc(value), maxLimit))
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

function buildIgdbGameQuery(query: string, limit: number) {
  return `
    search "${escapeIgdbSearch(query)}";
    fields
      name,
      category,
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
      updated_at;
    where version_parent = null;
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

  return await response.json() as IgdbGame[]
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

  if (mediaRows.length === 0) return

  const { error: insertError } = await adminClient.from('jogo_midias').insert(mediaRows)
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
  const slug = await ensureUniqueSlug(adminClient, existingGameId ? baseSlug : `${baseSlug}-${provider}-${game.id}`, existingGameId)
  const payload = buildGamePayload(game, slug)

  const response = existingGameId
    ? await adminClient
      .from('jogos')
      .update(payload)
      .eq('id', existingGameId)
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .single()
    : await adminClient
      .from('jogos')
      .insert(payload)
      .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas')
      .single()

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

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
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
    return jsonResponse(500, { error: 'server_misconfigured' })
  }

  const user = await getAuthenticatedUser(supabaseUrl, anonKey, request.headers.get('Authorization'))
  if (!user) {
    return jsonResponse(401, { error: 'not_authenticated' })
  }

  const body = await readBody(request)
  const query = normalizeText(body.query)
  const limit = normalizeLimit(body.limit)

  if (query.length < 2) {
    return jsonResponse(400, { error: 'query_too_short' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const igdbGames = await searchIgdbGames(query, limit)
    const existingGameIds = await getExistingIgdbGameIds(
      adminClient,
      igdbGames.map(game => String(game.id))
    )

    const savedGames: CatalogGamePreview[] = []

    for (const game of igdbGames) {
      const savedGame = await upsertGame(adminClient, game, existingGameIds.get(String(game.id)))
      if (savedGame) savedGames.push(savedGame)
    }

    return jsonResponse(200, {
      provider,
      importedCount: savedGames.length,
      games: savedGames,
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

    return jsonResponse(missingIgdbConfig ? 503 : 500, {
      error: missingIgdbConfig ? 'igdb_not_configured' : 'import_failed',
    })
  }
})
