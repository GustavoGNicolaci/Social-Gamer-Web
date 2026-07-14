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

export interface IgdbGame {
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
  themes?: IgdbNamedEntity[]
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

export interface NamedEntityInput {
  name: string
  provider: string
  externalId?: string | null
}

export const provider = 'igdb'
export const igdbBaseUrl = 'https://api.igdb.com/v4'
export const twitchTokenUrl = 'https://id.twitch.tv/oauth2/token'
export const allowedIgdbGameCategories = [0, 1, 2, 4, 8, 9] as const
export const blockedIgdbThemeIds = [42] as const
const allowedIgdbGameCategorySet = new Set<number>(allowedIgdbGameCategories)
const blockedIgdbThemeIdSet = new Set<number>(blockedIgdbThemeIds)
export const allowedIgdbGameTypeClause = `game_type = (${allowedIgdbGameCategories.join(',')})`
export const excludedIgdbThemeClause = `themes != (${blockedIgdbThemeIds.join(',')})`

export function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function slugify(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'game'
}

export function uniqueValues(values: string[]) {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeNamedEntities(entities: IgdbNamedEntity[] | undefined): NamedEntityInput[] {
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

export function unixDateToIsoDate(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString().slice(0, 10)
}

export function unixDateToIso(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

export function getIgdbImageUrl(imageId: string | undefined, size: 'cover_big' | 'screenshot_big') {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg` : null
}

export function escapeIgdbSearch(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function getIgdbGameType(game: IgdbGame) {
  if (typeof game.game_type === 'number') return game.game_type
  if (typeof game.category === 'number') return game.category
  return null
}

export function hasBlockedIgdbTheme(game: IgdbGame) {
  return (game.themes || []).some(theme =>
    typeof theme.id === 'number' && blockedIgdbThemeIdSet.has(theme.id)
  )
}

function isAllowedIgdbGame(game: IgdbGame) {
  const gameType = getIgdbGameType(game)
  return typeof gameType === 'number' &&
    allowedIgdbGameCategorySet.has(gameType) &&
    !hasBlockedIgdbTheme(game)
}

export function filterAllowedIgdbGames(games: IgdbGame[]) {
  const gamesById = new Map<number, IgdbGame>()

  games.forEach(game => {
    if (!isAllowedIgdbGame(game) || gamesById.has(game.id)) return
    gamesById.set(game.id, game)
  })

  return Array.from(gamesById.values())
}
