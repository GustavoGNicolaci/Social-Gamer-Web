import { translate } from '../i18n'
import type {
  CatalogGameDetails,
  CatalogGamePreview,
  GameListField,
  GameMedia,
} from '../features/catalog/domain/catalogTypes'

export type {
  GameListField,
  GameMedia,
  GameSourceProvider,
} from '../features/catalog/domain/catalogTypes'

export type GamePreview = CatalogGamePreview
export type GameDetails = CatalogGameDetails

export interface GamePreviewSourceRow {
  id: number
  title?: string | null
  titulo?: string | null
  coverUrl?: string | null
  capa_url?: string | null
  developer?: GameListField
  desenvolvedora?: GameListField
  genres?: GameListField
  generos?: GameListField
  releaseDate?: string | null
  data_lancamento?: string | null
  platforms?: GameListField
  plataformas?: GameListField
  igdb_id?: string | number | null
  igdbId?: string | number | null
  sourcePrimary?: string | null
  source_primary?: string | null
  importStatus?: string | null
  status_importacao?: string | null
  averageRating?: number | string | null
  reviewCount?: number | string | null
  average_rating?: number | string | null
  review_count?: number | string | null
}

export interface GameDetailsSourceRow extends GamePreviewSourceRow {
  slug?: string | null
  description?: string | null
  descricao?: string | null
  sourceDescription?: string | null
  source_description?: string | null
  shortDescription?: string | null
  descricao_curta?: string | null
  externalRating?: number | string | null
  nota_media_externa?: number | string | null
  externalRatingCount?: number | string | null
  nota_media_externa_count?: number | string | null
  externalUpdatedAt?: string | null
  external_updated_at?: string | null
  metadata?: unknown
  metadados?: unknown
  media?: GameMedia[]
  screenshots?: GameMedia[]
  coverMedia?: GameMedia | null
  descriptionLocale?: string | null
  description_locale?: string | null
  descriptionFallback?: boolean | null
  description_fallback?: boolean | null
  translationStatus?: string | null
  translation_status?: string | null
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

export function normalizeGameListField(value: GameListField | undefined): string[] {
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
  const title = row.title?.trim() || row.titulo?.trim() || translate('common.unknownGame')
  const coverUrl = row.coverUrl ?? row.capa_url ?? null
  const developer = normalizeGameListField(row.developer ?? row.desenvolvedora)
  const genres = normalizeGameListField(row.genres ?? row.generos)
  const releaseDate = row.releaseDate ?? row.data_lancamento ?? null
  const platforms = normalizeGameListField(row.platforms ?? row.plataformas)
  const igdbId = options.igdbId ?? row.igdbId ?? row.igdb_id ?? null
  const averageRating = row.averageRating ?? row.average_rating
  const reviewCount = row.reviewCount ?? row.review_count
  const sourcePrimary = row.sourcePrimary ?? row.source_primary ?? null
  const importStatus = row.importStatus ?? row.status_importacao ?? null

  return {
    id: row.id,
    igdbId: igdbId === null || typeof igdbId === 'undefined' ? null : String(igdbId),
    title,
    titulo: title,
    coverUrl,
    capa_url: coverUrl,
    developer,
    desenvolvedora: developer.length > 0 ? developer : null,
    genres,
    generos: genres.length > 0 ? genres : null,
    releaseDate,
    data_lancamento: releaseDate,
    platforms,
    plataformas: platforms.length > 0 ? platforms : null,
    sourcePrimary,
    importStatus,
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
  const media = options.media || row.media || []
  const coverMedia = row.coverMedia || media.find(item => item.type === 'cover' && item.isPrimary) ||
    media.find(item => item.type === 'cover') ||
    null
  const description = row.description ?? row.descricao ?? null
  const sourceDescription = row.sourceDescription ?? row.source_description ?? description
  const shortDescription = row.shortDescription ?? row.descricao_curta ?? null
  const externalRating = row.externalRating ?? row.nota_media_externa
  const externalRatingCount = row.externalRatingCount ?? row.nota_media_externa_count
  const externalUpdatedAt = row.externalUpdatedAt ?? row.external_updated_at ?? null
  const metadata = row.metadata ?? row.metadados
  const descriptionLocale = row.descriptionLocale ?? row.description_locale ?? null
  const descriptionFallback = row.descriptionFallback ?? row.description_fallback ?? false
  const translationStatus = row.translationStatus ?? row.translation_status ?? null

  return {
    ...preview,
    slug: row.slug || null,
    description,
    descricao: description,
    sourceDescription,
    shortDescription,
    externalRating: normalizeNumber(externalRating),
    externalRatingCount: normalizeInteger(externalRatingCount),
    externalUpdatedAt,
    metadata: normalizeMetadata(metadata),
    media,
    screenshots: row.screenshots || media.filter(item => item.type === 'screenshot'),
    coverMedia,
    descriptionLocale,
    descriptionFallback: Boolean(descriptionFallback),
    translationStatus,
  }
}
