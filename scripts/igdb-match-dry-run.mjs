import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const IGDB_API_BASE = 'https://api.igdb.com/v4'
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }

  return ''
}

function parseLimit() {
  const arg = process.argv.find(value => value.startsWith('--limit='))
  if (!arg) return 30

  const parsedValue = Number(arg.split('=')[1])
  return Number.isFinite(parsedValue) ? Math.max(1, Math.trunc(parsedValue)) : 30
}

function normalizeText(value) {
  const normalizedRomanNumerals = String(value || '')
    .replace(/\bVIII\b/gi, '8')
    .replace(/\bVII\b/gi, '7')
    .replace(/\bVI\b/gi, '6')
    .replace(/\bV\b/gi, '5')
    .replace(/\bIV\b/gi, '4')
    .replace(/\bIII\b/gi, '3')
    .replace(/\bII\b/gi, '2')
    .replace(/\bI\b/gi, '1')

  return normalizedRomanNumerals
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function unixDateToYear(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).getUTCFullYear()
}

function getReleaseYear(value) {
  if (!value) return null
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getUTCFullYear()
}

function getCompaniesByRole(game, role) {
  return (game.involved_companies || [])
    .filter(link => Boolean(link[role]))
    .map(link => link.company?.name)
    .filter(Boolean)
}

function escapeIgdbSearch(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildIgdbQuery(query, limit) {
  return `
    search "${escapeIgdbSearch(query)}";
    fields
      id,
      category,
      name,
      slug,
      first_release_date,
      cover.image_id,
      genres.name,
      platforms.name,
      involved_companies.developer,
      involved_companies.publisher,
      involved_companies.company.name,
      total_rating,
      total_rating_count,
      updated_at;
    where version_parent = null;
    limit ${limit};
  `
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
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

async function searchIgdbGame(clientId, token, title) {
  const response = await fetch(`${IGDB_API_BASE}/games`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body: buildIgdbQuery(title, 10),
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`IGDB search failed with status ${response.status}: ${responseText.slice(0, 200)}`)
  }

  return await response.json()
}

function getSearchQueries(title) {
  const queries = [title]
  const withoutEditionSuffix = title
    .replace(/\b(remake|remastered|remaster|definitive edition|complete edition)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (withoutEditionSuffix && withoutEditionSuffix.toLowerCase() !== title.toLowerCase()) {
    queries.push(withoutEditionSuffix)
  }

  return queries
}

async function searchIgdbCandidates(clientId, token, title) {
  const candidatesById = new Map()

  for (const query of getSearchQueries(title)) {
    const candidates = await searchIgdbGame(clientId, token, query)
    candidates.forEach(candidate => {
      candidatesById.set(candidate.id, candidate)
    })
  }

  return Array.from(candidatesById.values())
}

async function fetchCountsByGameId(supabase, tableName) {
  const { data, error } = await supabase.from(tableName).select('jogo_id')
  const counts = new Map()

  if (error) {
    console.warn(`Could not load ${tableName} counts: ${error.message}`)
    return counts
  }

  ;(data || []).forEach(row => {
    const gameId = Number(row.jogo_id)
    if (Number.isInteger(gameId) && gameId > 0) {
      counts.set(gameId, (counts.get(gameId) || 0) + 1)
    }
  })

  return counts
}

function scoreCandidate(localGame, candidate) {
  const localTitle = normalizeText(localGame.titulo)
  const strippedLocalTitle = normalizeText(
    String(localGame.titulo || '').replace(/\b(remake|remastered|remaster|definitive edition|complete edition)\b/gi, '')
  )
  const candidateTitle = normalizeText(candidate.name)
  const localYear = getReleaseYear(localGame.data_lancamento)
  const candidateYear = unixDateToYear(candidate.first_release_date)
  const localDevelopers = normalizeList(localGame.desenvolvedora).map(normalizeText)
  const candidateDevelopers = getCompaniesByRole(candidate, 'developer').map(normalizeText)
  let score = 0

  if (localTitle && candidateTitle && localTitle === candidateTitle) {
    score += 70
  } else if (strippedLocalTitle && candidateTitle && strippedLocalTitle === candidateTitle) {
    score += 64
  } else if (candidateTitle.includes(localTitle) || localTitle.includes(candidateTitle)) {
    score += 42
  }

  if (localYear && candidateYear && localYear === candidateYear) {
    score += 12
  }

  if (
    localDevelopers.length > 0 &&
    candidateDevelopers.some(candidateDeveloper => localDevelopers.includes(candidateDeveloper))
  ) {
    score += 10
  }

  if (candidate.total_rating_count >= 100) {
    score += 4
  }

  const confidence = score >= 70 ? 'high' : score >= 55 ? 'medium' : score > 0 ? 'low' : 'none'

  return {
    score,
    confidence,
    localYear,
    candidateYear,
  }
}

function pickBestCandidate(localGame, candidates) {
  const bestCandidate = candidates
    .map(candidate => ({
      candidate,
      match: scoreCandidate(localGame, candidate),
    }))
    .sort((left, right) => right.match.score - left.match.score)[0] || null

  return bestCandidate && bestCandidate.match.score > 0 ? bestCandidate : null
}

async function main() {
  const supabaseUrl = readEnv(['VITE_SUPABASE_URL', 'SUPABASE_URL'])
  const supabaseAnonKey = readEnv(['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'])
  const supabaseServiceRoleKey = readEnv(['SUPABASE_SERVICE_ROLE_KEY'])
  const igdbClientId = readEnv(['IGDB_CLIENT_ID'])
  const igdbClientSecret = readEnv(['IGDB_CLIENT_SECRET'])
  const limit = parseLimit()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env')
  }

  if (!igdbClientId || !igdbClientSecret) {
    throw new Error('Missing IGDB_CLIENT_ID/IGDB_CLIENT_SECRET in .env')
  }

  if (!supabaseServiceRoleKey) {
    console.warn(
      'SUPABASE_SERVICE_ROLE_KEY is not set; private RLS-protected counts may be incomplete.'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data: games, error: gamesError } = await supabase
    .from('jogos')
    .select('id, titulo, capa_url, desenvolvedora, generos, data_lancamento, plataformas, source_primary, slug')
    .eq('source_primary', 'manual')
    .order('id', { ascending: true })
    .limit(limit)

  if (gamesError) {
    throw new Error(`Could not load manual games: ${gamesError.message}`)
  }

  const gameIds = (games || []).map(game => game.id)
  const { data: existingIds, error: existingIdsError } = await supabase
    .from('game_external_ids')
    .select('jogo_id, external_id')
    .eq('provider', 'igdb')
    .in('jogo_id', gameIds)

  if (existingIdsError) {
    throw new Error(`Could not load existing IGDB ids: ${existingIdsError.message}`)
  }

  const existingIgdbIdsByGameId = new Map(
    (existingIds || []).map(row => [Number(row.jogo_id), String(row.external_id)])
  )

  const [reviewsCount, statusCount, wishlistCount, communitiesCount] = await Promise.all([
    fetchCountsByGameId(supabase, 'avaliacoes'),
    fetchCountsByGameId(supabase, 'status_jogo'),
    fetchCountsByGameId(supabase, 'lista_desejos'),
    fetchCountsByGameId(supabase, 'comunidades'),
  ])
  const token = await getIgdbToken(igdbClientId, igdbClientSecret)
  const results = []

  const gamesToMatch = games || []

  for (let index = 0; index < gamesToMatch.length; index += 1) {
    const game = gamesToMatch[index]

    if (existingIgdbIdsByGameId.has(game.id)) {
      results.push({
        gameId: game.id,
        title: game.titulo,
        existingIgdbId: existingIgdbIdsByGameId.get(game.id),
        confidence: 'already-linked',
      })
      continue
    }

    const candidates = await searchIgdbCandidates(igdbClientId, token, game.titulo)
    const bestCandidate = pickBestCandidate(game, candidates)

    results.push({
      gameId: game.id,
      title: game.titulo,
      reviewCount: reviewsCount.get(game.id) || 0,
      statusCount: statusCount.get(game.id) || 0,
      wishlistCount: wishlistCount.get(game.id) || 0,
      communityCount: communitiesCount.get(game.id) || 0,
      suggestedIgdbId: bestCandidate?.candidate.id || null,
      suggestedTitle: bestCandidate?.candidate.name || null,
      suggestedSlug: bestCandidate?.candidate.slug || null,
      localYear: bestCandidate?.match.localYear || getReleaseYear(game.data_lancamento),
      suggestedYear: bestCandidate?.match.candidateYear || null,
      score: bestCandidate?.match.score || 0,
      confidence: bestCandidate?.match.confidence || 'none',
      candidatesFound: candidates.length,
    })

    if (index < gamesToMatch.length - 1) {
      await sleep(300)
    }
  }

  console.table(results.map(result => ({
    id: result.gameId,
    title: result.title,
    igdb: result.suggestedIgdbId || result.existingIgdbId || null,
    candidate: result.suggestedTitle || null,
    score: result.score ?? null,
    confidence: result.confidence,
    reviews: result.reviewCount ?? null,
    status: result.statusCount ?? null,
    wishlist: result.wishlistCount ?? null,
    communities: result.communityCount ?? null,
  })))

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2))
  }

  console.log('\nDry-run only. No rows were inserted or updated.')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
