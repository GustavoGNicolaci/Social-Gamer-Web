import type { CatalogFacetValues } from './catalogLocal'

export type GameListField = string[] | string | null
export type GameSourceProvider =
  | 'manual'
  | 'igdb'
  | 'rawg'
  | 'steam'
  | 'mobygames'
  | string

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

export interface GameCatalogError {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
}

export interface CatalogResult<T> {
  data: T
  error: GameCatalogError | null
}

export interface CatalogGamePreview {
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

export interface CatalogGameDetails extends CatalogGamePreview {
  slug: string | null
  description: string | null
  descricao: string | null
  sourceDescription: string | null
  shortDescription: string | null
  externalRating: number | null
  externalRatingCount: number
  externalUpdatedAt: string | null
  metadata: Record<string, unknown> | null
  media: GameMedia[]
  screenshots: GameMedia[]
  coverMedia: GameMedia | null
  descriptionLocale: string | null
  descriptionFallback: boolean
  translationStatus: string | null
}
export type CatalogSortOption =
  | 'release-desc'
  | 'release-asc'
  | 'rating-desc'
  | 'rating-asc'

export interface SearchCatalogGamesOptions {
  limit?: number
  importIfMissing?: boolean
}

export interface CatalogGamesPageOptions {
  page?: number
  pageSize?: number
  query?: string
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  sort?: CatalogSortOption
}

export interface CatalogGamesPage {
  items: CatalogGamePreview[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}

export type CatalogFacetOptions = CatalogFacetValues
