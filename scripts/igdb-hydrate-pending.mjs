import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const IGDB_API_BASE = 'https://api.igdb.com/v4'
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const PROVIDER = 'igdb'
const DEFAULT_LIMIT = 50
const ALLOWED_GAME_TYPES = new Set([0, 1, 2, 4, 8, 9])
const BLOCKED_THEME_IDS = new Set([42])

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }

  return ''
}

function parseArgs() {
  const args = new Map()

  process.argv.slice(2).forEach(arg => {
    if (arg === '--apply') {
      args.set('apply', true)
      return
    }

    if (arg.startsWith('--limit=')) {
      args.set('limit', arg.split('=')[1])
      return
    }

    if (arg.startsWith('--game-id=')) {
      args.set('gameId', arg.split('=')[1])
    }
  })

  const parsedLimit = Number(args.get('limit') || DEFAULT_LIMIT)
  const parsedGameId = Number(args.get('gameId') || 0)

  return {
    apply: args.get('apply') === true,
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.trunc(parsedLimit)) : DEFAULT_LIMIT,
    gameId: Number.isInteger(parsedGameId) && parsedGameId > 0 ? parsedGameId : null,
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function slugify(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'game'
}

function uniqueValues(values) {
  const seen = new Set()

  return values.filter(value => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeNamedEntities(entities) {
  return uniqueValues((entities || []).map(entity => normalizeText(entity.name)).filter(Boolean))
    .map(name => {
      const match = (entities || []).find(entity => normalizeText(entity.name) === name)

      return {
        name,
        provider: PROVIDER,
        externalId: typeof match?.id === 'number' ? String(match.id) : null,
      }
    })
}

function unixDateToIsoDate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString().slice(0, 10)
}

function unixDateToIso(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function getIgdbGameType(game) {
  return typeof game.game_type === 'number' ? game.game_type : game.category
}

function isAllowedIgdbGame(game) {
  const gameType = getIgdbGameType(game)

  return (
    ALLOWED_GAME_TYPES.has(gameType) &&
    !(game.themes || []).some(theme => BLOCKED_THEME_IDS.has(theme.id))
  )
}

function getBlockedReason(game) {
  if ((game.themes || []).some(theme => BLOCKED_THEME_IDS.has(theme.id))) {
    return 'igdb_theme_blocked'
  }

  if (!ALLOWED_GAME_TYPES.has(getIgdbGameType(game))) {
    return 'igdb_game_type_not_allowed'
  }

  return null
}

function getIgdbImageUrl(imageId, size) {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null
}

function getCompaniesByRole(game, role) {
  return uniqueValues(
    (game.involved_companies || [])
      .filter(link => Boolean(link[role]))
      .map(link => normalizeText(link.company?.name))
      .filter(Boolean)
  )
}

function getCompanyInputsByRole(game, role) {
  return getCompaniesByRole(game, role).map(name => {
    const match = (game.involved_companies || []).find(
      link => Boolean(link[role]) && normalizeText(link.company?.name) === name
    )

    return {
      name,
      provider: PROVIDER,
      externalId: typeof match?.company?.id === 'number' ? String(match.company.id) : null,
    }
  })
}

async function getIgdbToken(clientId, clientSecret) {
  const tokenUrl = new URL(TWITCH_TOKEN_URL)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')

  const response = await fetch(tokenUrl, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`IGDB auth failed with status ${response.status}`)
  }

  const payload = await response.json()
  if (!payload.access_token) {
    throw new Error('IGDB auth response did not include access_token')
  }

  return payload.access_token
}

function buildIgdbByIdsQuery(igdbIds) {
  return `
    fields
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
    where id = (${igdbIds.join(',')});
    limit ${igdbIds.length};
  `
}

async function fetchIgdbGamesByIds(clientId, token, igdbIds) {
  const response = await fetch(`${IGDB_API_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body: buildIgdbByIdsQuery(igdbIds),
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`IGDB fetch failed with status ${response.status}: ${responseText.slice(0, 300)}`)
  }

  return await response.json()
}

async function loadPendingTargets(supabase, options) {
  let externalIdsQuery = supabase
    .from('game_external_ids')
    .select('jogo_id, external_id')
    .eq('provider', PROVIDER)
    .order('jogo_id', { ascending: true })
    .limit(options.limit)

  if (options.gameId) {
    externalIdsQuery = externalIdsQuery.eq('jogo_id', options.gameId)
  }

  const { data: externalIds, error: externalIdsError } = await externalIdsQuery
  if (externalIdsError) throw externalIdsError

  const externalIdsByGameId = new Map(
    (externalIds || []).map(row => [Number(row.jogo_id), String(row.external_id)])
  )
  const gameIds = Array.from(externalIdsByGameId.keys())
  if (gameIds.length === 0) return []

  const { data: games, error: gamesError } = await supabase
    .from('jogos')
    .select('id, titulo, status_importacao, source_primary, metadados')
    .in('id', gameIds)
    .eq('status_importacao', 'pending')
    .order('id', { ascending: true })

  if (gamesError) throw gamesError

  return (games || []).map(game => ({
    gameId: Number(game.id),
    title: game.titulo,
    igdbId: externalIdsByGameId.get(Number(game.id)),
    status: game.status_importacao,
    source: game.source_primary,
    metadata: game.metadados,
  }))
}

async function ensureUniqueSlug(supabase, baseSlug, currentGameId) {
  const { data, error } = await supabase
    .from('jogos')
    .select('id, slug')
    .eq('slug', baseSlug)
    .maybeSingle()

  if (error) throw error
  if (!data || Number(data.id) === currentGameId) return baseSlug

  return `${baseSlug}-${currentGameId}`
}

async function upsertNamedEntities(supabase, table, entities) {
  if (entities.length === 0) return []

  const uniqueBySlug = new Map()
  entities.forEach(entity => {
    uniqueBySlug.set(slugify(entity.name), entity)
  })

  const payload = Array.from(uniqueBySlug.entries()).map(([slug, entity]) => ({
    nome: entity.name,
    slug,
    provider: entity.provider,
    external_id: entity.externalId || null,
  }))

  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'slug' })
    .select('id, nome, slug')

  if (error) throw error

  return data || []
}

async function replaceSimpleBridge(supabase, table, gameId, foreignKey, ids) {
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('jogo_id', gameId)

  if (deleteError) throw deleteError
  if (ids.length === 0) return

  const { error: insertError } = await supabase
    .from(table)
    .insert(ids.map(id => ({ jogo_id: gameId, [foreignKey]: id })))

  if (insertError) throw insertError
}

async function replaceCompanyBridge(supabase, gameId, developers, publishers) {
  const { error: deleteError } = await supabase
    .from('jogo_empresas')
    .delete()
    .eq('jogo_id', gameId)

  if (deleteError) throw deleteError

  const rows = [
    ...developers.map(company => ({ jogo_id: gameId, empresa_id: company.id, papel: 'developer' })),
    ...publishers.map(company => ({ jogo_id: gameId, empresa_id: company.id, papel: 'publisher' })),
  ]

  if (rows.length === 0) return

  const { error: insertError } = await supabase.from('jogo_empresas').insert(rows)
  if (insertError) throw insertError
}

async function replaceMedia(supabase, gameId, game) {
  const { error: deleteError } = await supabase
    .from('jogo_midias')
    .delete()
    .eq('jogo_id', gameId)
    .eq('provider', PROVIDER)

  if (deleteError) throw deleteError

  const mediaRows = []
  const coverUrl = getIgdbImageUrl(game.cover?.image_id, 'cover_big')

  if (coverUrl) {
    mediaRows.push({
      jogo_id: gameId,
      tipo: 'cover',
      url: coverUrl,
      provider: PROVIDER,
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
      provider: PROVIDER,
      external_media_id: screenshot.image_id || null,
      width: screenshot.width || null,
      height: screenshot.height || null,
      ordem: index + 1,
      is_primary: false,
    })
  })

  if (mediaRows.length === 0) return

  const { error: insertError } = await supabase.from('jogo_midias').insert(mediaRows)
  if (insertError) throw insertError
}

async function upsertGameStats(supabase, gameId) {
  const { error } = await supabase
    .from('jogo_estatisticas')
    .upsert({ jogo_id: gameId }, { onConflict: 'jogo_id' })

  if (error) throw error
}

function buildGamePayload(game, slug) {
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
    source_primary: PROVIDER,
    status_importacao: 'imported',
    nota_media_externa: typeof game.total_rating === 'number' ? Number(game.total_rating.toFixed(2)) : null,
    nota_media_externa_count: typeof game.total_rating_count === 'number' ? game.total_rating_count : 0,
    external_updated_at: unixDateToIso(game.updated_at),
    metadados: {
      provider: PROVIDER,
      igdb: {
        id: game.id,
        slug: game.slug || null,
        category: game.game_type ?? game.category ?? null,
        game_type: game.game_type ?? game.category ?? null,
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

async function hydrateGame(supabase, target, game) {
  const baseSlug = slugify(game.slug || game.name)
  const slug = await ensureUniqueSlug(supabase, baseSlug, target.gameId)
  const genreRows = await upsertNamedEntities(supabase, 'generos', normalizeNamedEntities(game.genres))
  const platformRows = await upsertNamedEntities(supabase, 'plataformas', normalizeNamedEntities(game.platforms))
  const modeRows = await upsertNamedEntities(supabase, 'modos_jogo', normalizeNamedEntities(game.game_modes))
  const developerRows = await upsertNamedEntities(supabase, 'empresas', getCompanyInputsByRole(game, 'developer'))
  const publisherRows = await upsertNamedEntities(supabase, 'empresas', getCompanyInputsByRole(game, 'publisher'))

  await replaceSimpleBridge(supabase, 'jogo_generos', target.gameId, 'genero_id', genreRows.map(row => row.id))
  await replaceSimpleBridge(supabase, 'jogo_plataformas', target.gameId, 'plataforma_id', platformRows.map(row => row.id))
  await replaceSimpleBridge(supabase, 'jogo_modos_jogo', target.gameId, 'modo_jogo_id', modeRows.map(row => row.id))
  await replaceCompanyBridge(supabase, target.gameId, developerRows, publisherRows)
  await replaceMedia(supabase, target.gameId, game)
  await upsertGameStats(supabase, target.gameId)

  const { error: gameUpdateError } = await supabase
    .from('jogos')
    .update(buildGamePayload(game, slug))
    .eq('id', target.gameId)

  if (gameUpdateError) throw gameUpdateError

  const { error: externalIdError } = await supabase
    .from('game_external_ids')
    .upsert({
      jogo_id: target.gameId,
      provider: PROVIDER,
      external_id: String(game.id),
      url: game.slug ? `https://www.igdb.com/games/${game.slug}` : null,
      metadata: {
        slug: game.slug || null,
        external_games: game.external_games || [],
        hydrated_by: 'scripts/igdb-hydrate-pending.mjs',
      },
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'provider,external_id' })

  if (externalIdError) throw externalIdError
}

async function markGameStale(supabase, target, game, reason) {
  const metadata = target.metadata && typeof target.metadata === 'object'
    ? target.metadata
    : {}

  const { error } = await supabase
    .from('jogos')
    .update({
      status_importacao: 'stale',
      updated_at: new Date().toISOString(),
      metadados: {
        ...metadata,
        igdb_catalog_cleanup: {
          reason,
          igdb_id: game.id,
          game_type: getIgdbGameType(game) ?? null,
          themes: game.themes || [],
          marked_stale_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', target.gameId)

  if (error) throw error
}

async function main() {
  const options = parseArgs()
  const supabaseUrl = readEnv(['SUPABASE_URL', 'VITE_SUPABASE_URL'])
  const serviceRoleKey = readEnv(['SUPABASE_SERVICE_ROLE_KEY'])
  const clientId = readEnv(['IGDB_CLIENT_ID'])
  const clientSecret = readEnv(['IGDB_CLIENT_SECRET'])

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IGDB_CLIENT_ID or IGDB_CLIENT_SECRET')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const targets = await loadPendingTargets(supabase, options)
  if (targets.length === 0) {
    console.log('No pending IGDB games found.')
    return
  }

  console.table(targets)

  const token = await getIgdbToken(clientId, clientSecret)
  const games = await fetchIgdbGamesByIds(clientId, token, targets.map(target => Number(target.igdbId)))
  const gamesById = new Map(games.map(game => [String(game.id), game]))
  const classifications = targets.map(target => {
    const game = gamesById.get(String(target.igdbId))

    return {
      gameId: target.gameId,
      title: target.title,
      igdbId: target.igdbId,
      result: !game ? 'missing_from_igdb' : getBlockedReason(game) || 'hydrate',
    }
  })

  console.table(classifications)

  if (!options.apply) {
    console.log('Dry-run only. Re-run with --apply to hydrate allowed games and mark blocked games as stale.')
    return
  }

  let hydratedCount = 0
  let staleCount = 0

  for (const target of targets) {
    const game = gamesById.get(String(target.igdbId))
    if (!game) {
      console.warn(`IGDB game ${target.igdbId} was not returned for local game ${target.gameId}.`)
      continue
    }

    const blockedReason = getBlockedReason(game)
    if (blockedReason || !isAllowedIgdbGame(game)) {
      await markGameStale(supabase, target, game, blockedReason || 'igdb_game_not_allowed')
      staleCount += 1
      console.log(`Marked ${target.gameId} as stale: ${blockedReason || 'igdb_game_not_allowed'}`)
      continue
    }

    await hydrateGame(supabase, target, game)
    hydratedCount += 1
    console.log(`Hydrated ${target.gameId}: ${target.title} -> ${game.name}`)
  }

  console.log(`Hydrated ${hydratedCount}/${targets.length} pending games.`)
  console.log(`Marked ${staleCount}/${targets.length} blocked games as stale.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
