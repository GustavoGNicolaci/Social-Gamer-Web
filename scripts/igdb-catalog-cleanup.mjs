import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const IGDB_API_BASE = 'https://api.igdb.com/v4'
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const PROVIDER = 'igdb'
const PAGE_SIZE = 500
const IGDB_BATCH_SIZE = 100
const DELETE_BATCH_SIZE = 100
const APPLY_CONFIRMATION = 'CLEAN-IGDB-CATALOG'
const ALLOWED_GAME_TYPES = new Set([0, 1, 2, 4, 8, 9])
const BLOCKED_THEME_IDS = new Set([42])

const USAGE_TABLES = [
  'avaliacoes',
  'lista_desejos',
  'status_jogo',
  'comunidades',
  'steam_owned_games',
  'steam_app_achievements',
]

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }

  return ''
}

function parseArgs() {
  const values = new Map()

  process.argv.slice(2).forEach(argument => {
    if (argument === '--apply') {
      values.set('apply', true)
      return
    }

    if (argument.startsWith('--confirm=')) {
      values.set('confirm', argument.slice('--confirm='.length))
    }
  })

  return {
    apply: values.get('apply') === true,
    confirmation: values.get('confirm') || '',
  }
}

function chunks(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function normalizeIgdbId(value) {
  const normalized = String(value ?? '').trim()
  return /^\d+$/.test(normalized) ? normalized : null
}

function getMetadataIgdbId(metadata) {
  return normalizeIgdbId(metadata?.igdb?.id)
}

function getIgdbGameType(game) {
  return typeof game?.game_type === 'number' ? game.game_type : game?.category
}

function hasBlockedTheme(game) {
  return (game?.themes || []).some(theme => BLOCKED_THEME_IDS.has(theme.id))
}

function getTopFiveGameIds(settings) {
  if (!Array.isArray(settings?.top5_jogos)) return []

  return settings.top5_jogos
    .map(entry => Number(entry?.jogo_id))
    .filter(Number.isInteger)
}

function getNotificationGameId(notification) {
  const metadataGameId = Number(notification?.metadata?.game_id)
  if (Number.isInteger(metadataGameId)) return metadataGameId

  if (['game', 'jogo'].includes(String(notification?.entity_type || '').toLowerCase())) {
    const entityGameId = Number(notification.entity_id)
    if (Number.isInteger(entityGameId)) return entityGameId
  }

  const linkMatch = String(notification?.link || '').match(/\/games\/(\d+)/)
  return linkMatch ? Number(linkMatch[1]) : null
}

async function loadPaged(createQuery) {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await createQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error

    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

async function getIgdbToken(clientId, clientSecret) {
  const tokenUrl = new URL(TWITCH_TOKEN_URL)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('grant_type', 'client_credentials')

  const response = await fetch(tokenUrl, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Twitch token request failed with status ${response.status}`)
  }

  const payload = await response.json()
  if (!payload.access_token) throw new Error('Twitch did not return an access token')
  return payload.access_token
}

async function fetchIgdbBatch(clientId, token, ids) {
  const response = await fetch(`${IGDB_API_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body: `
      fields id,category,game_type,name,slug,themes.id,themes.name,themes.slug;
      where id = (${ids.join(',')});
      limit ${ids.length};
    `,
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`IGDB fetch failed with status ${response.status}: ${responseText.slice(0, 300)}`)
  }

  return await response.json()
}

async function fetchIgdbGames(clientId, token, ids) {
  const games = []

  for (const batch of chunks(ids, IGDB_BATCH_SIZE)) {
    games.push(...await fetchIgdbBatch(clientId, token, batch))
  }

  return games
}

function groupCatalogGames(games, externalIdByGameId) {
  const groups = new Map()
  const withoutIgdbIdentity = []

  games.forEach(game => {
    const igdbId = getMetadataIgdbId(game.metadados) || externalIdByGameId.get(Number(game.id))
    if (!igdbId) {
      withoutIgdbIdentity.push(game)
      return
    }

    const group = groups.get(igdbId) || []
    group.push(game)
    groups.set(igdbId, group)
  })

  return { groups, withoutIgdbIdentity }
}

function chooseCanonicalGame(igdbId, games, externalIdByGameId) {
  const mappedGame = games.find(game => externalIdByGameId.get(Number(game.id)) === igdbId)
  if (mappedGame) return mappedGame

  return [...games].sort((left, right) => Number(left.id) - Number(right.id))[0]
}

async function loadUsageByGameId(supabase, candidateIds) {
  const usageByGameId = new Map()

  for (const table of USAGE_TABLES) {
    for (const batch of chunks(candidateIds, DELETE_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from(table)
        .select('jogo_id')
        .in('jogo_id', batch)

      if (error) throw error

      ;(data || []).forEach(row => {
        const gameId = Number(row.jogo_id)
        const usage = usageByGameId.get(gameId) || new Set()
        usage.add(table)
        usageByGameId.set(gameId, usage)
      })
    }
  }

  const users = await loadPaged(() => supabase
    .from('usuarios')
    .select('id, configuracoes_privacidade')
    .order('id', { ascending: true }))

  const candidateIdSet = new Set(candidateIds)
  users.forEach(user => {
    getTopFiveGameIds(user.configuracoes_privacidade).forEach(gameId => {
      if (!candidateIdSet.has(gameId)) return
      const usage = usageByGameId.get(gameId) || new Set()
      usage.add('usuarios.configuracoes_privacidade.top5_jogos')
      usageByGameId.set(gameId, usage)
    })
  })

  return usageByGameId
}

async function findNotificationsToDelete(supabase, candidateIds) {
  const candidateIdSet = new Set(candidateIds)
  const notifications = await loadPaged(() => supabase
    .from('notifications')
    .select('id, entity_type, entity_id, link, metadata')
    .order('created_at', { ascending: true }))

  return notifications.filter(notification => candidateIdSet.has(getNotificationGameId(notification)))
}

async function applyCleanup(supabase, candidateIds) {
  const { data, error } = await supabase.rpc('admin_cleanup_unused_catalog_games', {
    p_game_ids: candidateIds,
  })

  if (error) throw error
  return Number(data || 0)
}

function summarizeGroups(groups, igdbGamesById, externalIdByGameId) {
  const duplicateGroups = []
  const duplicateRows = []
  const blockedGroups = []
  const disallowedTypeGroups = []
  const missingIgdbGroups = []

  groups.forEach((games, igdbId) => {
    const canonical = chooseCanonicalGame(igdbId, games, externalIdByGameId)
    const duplicates = games.filter(game => Number(game.id) !== Number(canonical.id))

    if (duplicates.length > 0) {
      duplicateGroups.push({
        igdbId,
        canonicalId: Number(canonical.id),
        canonicalTitle: canonical.titulo,
        duplicateIds: duplicates.map(game => Number(game.id)),
      })
      duplicateRows.push(...duplicates)
    }

    const igdbGame = igdbGamesById.get(igdbId)
    if (!igdbGame) {
      missingIgdbGroups.push({ igdbId, localIds: games.map(game => Number(game.id)) })
      return
    }

    if (hasBlockedTheme(igdbGame)) {
      blockedGroups.push({
        igdbId,
        igdbTitle: igdbGame.name,
        localIds: games.map(game => Number(game.id)),
        localTitles: games.map(game => game.titulo),
      })
    }

    const gameType = getIgdbGameType(igdbGame)
    if (!ALLOWED_GAME_TYPES.has(gameType)) {
      disallowedTypeGroups.push({
        igdbId,
        igdbTitle: igdbGame.name,
        gameType: gameType ?? null,
        localIds: games.map(game => Number(game.id)),
      })
    }
  })

  return {
    duplicateGroups,
    duplicateRows,
    blockedGroups,
    disallowedTypeGroups,
    missingIgdbGroups,
  }
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

  if (options.apply && options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Refusing to delete data. Use --apply --confirm=${APPLY_CONFIRMATION} after reviewing the dry-run.`)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const [games, externalIds] = await Promise.all([
    loadPaged(() => supabase
      .from('jogos')
      .select('id, titulo, source_primary, status_importacao, metadados')
      .order('id', { ascending: true })),
    loadPaged(() => supabase
      .from('game_external_ids')
      .select('jogo_id, external_id')
      .eq('provider', PROVIDER)
      .order('jogo_id', { ascending: true })),
  ])

  const externalIdByGameId = new Map(
    externalIds.map(row => [Number(row.jogo_id), normalizeIgdbId(row.external_id)])
  )
  const { groups, withoutIgdbIdentity } = groupCatalogGames(games, externalIdByGameId)
  const igdbIds = Array.from(groups.keys())
  const token = await getIgdbToken(clientId, clientSecret)
  const igdbGames = await fetchIgdbGames(clientId, token, igdbIds)
  const igdbGamesById = new Map(igdbGames.map(game => [String(game.id), game]))
  const summary = summarizeGroups(groups, igdbGamesById, externalIdByGameId)

  const candidateIdSet = new Set(summary.duplicateRows.map(game => Number(game.id)))
  summary.blockedGroups.forEach(group => group.localIds.forEach(id => candidateIdSet.add(id)))
  const candidateIds = Array.from(candidateIdSet).sort((left, right) => left - right)
  const usageByGameId = await loadUsageByGameId(supabase, candidateIds)
  const notifications = await findNotificationsToDelete(supabase, candidateIds)
  const protectedCandidates = candidateIds
    .filter(id => usageByGameId.has(id))
    .map(id => ({ id, usage: Array.from(usageByGameId.get(id)).sort() }))

  console.log(JSON.stringify({
    mode: options.apply ? 'apply' : 'dry-run',
    catalogRows: games.length,
    igdbIdentityGroups: groups.size,
    rowsWithoutIgdbIdentity: withoutIgdbIdentity.length,
    duplicateGroups: summary.duplicateGroups.length,
    duplicateRowsToDelete: summary.duplicateRows.length,
    blockedThemeGroups: summary.blockedGroups.length,
    disallowedTypeGroupsReportedOnly: summary.disallowedTypeGroups.length,
    missingIgdbGroupsReportedOnly: summary.missingIgdbGroups.length,
    totalRowsToDelete: candidateIds.length,
    relatedNotificationsToDelete: notifications.length,
    protectedCandidates,
  }, null, 2))

  if (summary.duplicateGroups.length > 0) console.table(summary.duplicateGroups)
  if (summary.blockedGroups.length > 0) console.table(summary.blockedGroups)

  if (!options.apply) {
    console.log(`Dry-run only. After review, use --apply --confirm=${APPLY_CONFIRMATION}.`)
    return
  }

  if (protectedCandidates.length > 0) {
    throw new Error('Cleanup aborted because one or more candidate games have user or community references.')
  }

  const deletedCount = await applyCleanup(supabase, candidateIds)
  if (deletedCount !== candidateIds.length) {
    throw new Error(`Cleanup deleted ${deletedCount} rows, but the reviewed plan contained ${candidateIds.length}.`)
  }

  console.log(`Cleanup complete: deleted ${deletedCount} catalog rows and their stale notifications.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
