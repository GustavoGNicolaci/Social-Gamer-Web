export type GameListField = string[] | string | null
export type GameSourceProvider = 'manual' | 'igdb' | 'rawg' | 'steam' | 'mobygames' | string

export interface GameMedia {
  id: number | string
  type: 'cover' | 'screenshot' | 'artwork' | 'video' | string
  url: string
  thumbnailUrl: string | null
  provider: GameSourceProvider | null
  externalMediaId: string | null
  width: number | null
  height: number | null
  order: number
  isPrimary: boolean
}

export interface GamePreview {
  id: number
  igdbId: string | null
  title: string
  titulo: string
  coverUrl: string | null
  capa_url: string | null
  developer: string[]
  desenvolvedora: GameListField
  genres: string[]
  generos: GameListField
  releaseDate: string | null
  data_lancamento: string | null
  platforms: string[]
  plataformas: GameListField
  sourcePrimary: GameSourceProvider | null
  importStatus: string | null
  averageRating?: number | null
  reviewCount?: number | null
}

export interface GameDetails extends GamePreview {
  slug: string | null
  description: string | null
  descricao: string | null
  shortDescription: string | null
  externalRating: number | null
  externalRatingCount: number
  externalUpdatedAt: string | null
  metadata: Record<string, unknown> | null
  media: GameMedia[]
  screenshots: GameMedia[]
  coverMedia: GameMedia | null
}

export interface GamePreviewSourceRow {
  id: number
  titulo: string | null
  capa_url: string | null
  desenvolvedora: GameListField
  generos: GameListField
  data_lancamento: string | null
  plataformas: GameListField
  igdb_id?: string | number | null
  igdbId?: string | number | null
  source_primary?: string | null
  status_importacao?: string | null
  averageRating?: number | string | null
  reviewCount?: number | string | null
  average_rating?: number | string | null
  review_count?: number | string | null
}

export interface GameDetailsSourceRow extends GamePreviewSourceRow {
  slug?: string | null
  descricao?: string | null
  descricao_curta?: string | null
  nota_media_externa?: number | string | null
  nota_media_externa_count?: number | string | null
  external_updated_at?: string | null
  metadados?: unknown
}

export interface GameMediaSourceRow {
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

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function normalizeInteger(value: unknown) {
  const normalizedValue = normalizeNumber(value)
  return normalizedValue === null ? 0 : Math.max(0, Math.trunc(normalizedValue))
}

export function normalizeGameListField(value: GameListField): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean)
  }

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function normalizeGameMedia(row: GameMediaSourceRow): GameMedia | null {
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

export function normalizeGamePreview(
  row: GamePreviewSourceRow,
  options: { igdbId?: string | number | null } = {}
): GamePreview {
  const title = row.titulo?.trim() || 'Jogo desconhecido'
  const developer = normalizeGameListField(row.desenvolvedora)
  const genres = normalizeGameListField(row.generos)
  const platforms = normalizeGameListField(row.plataformas)
  const igdbId = options.igdbId ?? row.igdbId ?? row.igdb_id ?? null
  const averageRating = row.averageRating ?? row.average_rating
  const reviewCount = row.reviewCount ?? row.review_count

  return {
    id: row.id,
    igdbId: igdbId === null || typeof igdbId === 'undefined' ? null : String(igdbId),
    title,
    titulo: title,
    coverUrl: row.capa_url || null,
    capa_url: row.capa_url || null,
    developer,
    desenvolvedora: developer.length > 0 ? developer : null,
    genres,
    generos: genres.length > 0 ? genres : null,
    releaseDate: row.data_lancamento || null,
    data_lancamento: row.data_lancamento || null,
    platforms,
    plataformas: platforms.length > 0 ? platforms : null,
    sourcePrimary: row.source_primary || null,
    importStatus: row.status_importacao || null,
    averageRating: normalizeNumber(averageRating),
    reviewCount: normalizeInteger(reviewCount),
  }
}

export function normalizeGameDetails(
  row: GameDetailsSourceRow,
  options: {
    igdbId?: string | number | null
    media?: GameMedia[]
  } = {}
): GameDetails {
  const preview = normalizeGamePreview(row, options)
  const media = options.media || []
  const coverMedia = media.find(item => item.type === 'cover' && item.isPrimary) ||
    media.find(item => item.type === 'cover') ||
    null

  return {
    ...preview,
    slug: row.slug || null,
    description: row.descricao || null,
    descricao: row.descricao || null,
    shortDescription: row.descricao_curta || null,
    externalRating: normalizeNumber(row.nota_media_externa),
    externalRatingCount: normalizeInteger(row.nota_media_externa_count),
    externalUpdatedAt: row.external_updated_at || null,
    metadata: normalizeMetadata(row.metadados),
    media,
    screenshots: media.filter(item => item.type === 'screenshot'),
    coverMedia,
  }
}
