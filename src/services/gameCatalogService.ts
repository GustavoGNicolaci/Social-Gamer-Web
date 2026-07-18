export {
  getCatalogFacetOptions,
  getCatalogGameDetailsById,
  getCatalogGamesByIds,
  getCatalogGamesPage,
  searchCatalogGamesByTitle,
} from '../features/catalog/services/gameCatalogOrchestration'

export type {
  CatalogFacetOptions,
  CatalogGameDetails,
  CatalogGamePreview,
  CatalogGamesPage,
  CatalogGamesPageOptions,
  CatalogSortOption,
  GameCatalogError,
} from '../features/catalog/domain/catalogTypes'
