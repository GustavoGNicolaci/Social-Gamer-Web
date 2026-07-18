import { CatalogFiltersModal } from '../features/catalog/components/CatalogFiltersModal'
import { CatalogGameCard } from '../features/catalog/components/CatalogGameCard'
import { CatalogGenresModal } from '../features/catalog/components/CatalogGenresModal'
import { CatalogPaginationControls } from '../features/catalog/components/CatalogPaginationControls'
import {
  CATALOG_SORT_OPTIONS,
  useGamesCatalogController,
} from '../features/catalog/hooks/useGamesCatalogController'
import type { CatalogSortOption } from '../features/catalog/domain/catalogTypes'
import { useI18n } from '../i18n/I18nContext'
import './GamesPage.css'

function GamesPage() {
  const { t } = useI18n()
  const { results, filters, layout, actions } = useGamesCatalogController()

  if (results.loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-card">
            <span className="gp-badge">{t('common.catalog')}</span>
            <h1>{t('catalog.loadingTitle')}</h1>
            <p className="gp-muted">{t('catalog.loadingText')}</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content games-page">
        <section className="gp-panel">
          <div className="gp-panel-head">
            <div className="gp-panel-copy">
              <span className="gp-badge">{t('common.catalog')}</span>
              <h1>{t('common.games')}</h1>
              <p className="gp-muted">{t('catalog.pageText')}</p>
            </div>

            <div className="gp-panel-summary">
              <label className="gp-sort-control">
                <span>{t('catalog.sortBy')}</span>
                <select
                  value={filters.catalogSort}
                  onChange={event =>
                    actions.updateCatalogSort(event.target.value as CatalogSortOption)
                  }
                  aria-label={t('catalog.sortAria')}
                >
                  {CATALOG_SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="game-button gp-btn--secondary"
                onClick={actions.openFiltersModal}
              >
                {t('catalog.allFilters')}
              </button>
            </div>
          </div>

          <div className="gp-panel-footer">
            {filters.activeFilters.length > 0 ? (
              <div className="gp-chips">
                {filters.activeFilters.map(filter => (
                  <span key={`summary-${filter.key}`} className="gp-chip gp-chip--static">
                    {filter.label}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="gp-panel-footnote">
              {filters.navbarQuery
                ? t('catalog.globalSearchActive', {
                    query: filters.navbarQuery,
                    range: results.rangeLabel,
                  })
                : results.rangeLabel}
            </p>

            {results.catalogError ? (
              <p className="gp-panel-footnote is-warning">{results.catalogError}</p>
            ) : null}
          </div>
        </section>

        {results.games.length === 0 ? (
          <article className="gp-empty">
            <span className="gp-badge">{t('common.noResults')}</span>
            <h3>{t('catalog.emptyTitle')}</h3>
            <p className="gp-muted">{t('catalog.emptyText')}</p>
            <button
              type="button"
              className="game-button gp-btn--secondary"
              onClick={actions.openFiltersModal}
            >
              {t('catalog.allFilters')}
            </button>
          </article>
        ) : (
          <>
            <div className="gp-grid" style={layout.gridStyle}>
              {results.games.map(game => (
                <CatalogGameCard
                  key={game.id}
                  game={game}
                  onShowGenres={actions.showGenres}
                />
              ))}
            </div>

            <div className="gp-results-footer">
              <p className="gp-panel-footnote">{results.rangeLabel}</p>
              <CatalogPaginationControls
                currentPage={results.safeCurrentPage}
                totalPages={results.totalPages}
                onChangePage={actions.changePage}
              />
            </div>
          </>
        )}

        <CatalogFiltersModal
          open={layout.showFiltersModal}
          searchValue={filters.modalSearch}
          activeFilters={filters.activeFilters}
          groups={filters.modalGroups}
          onClose={actions.closeFiltersModal}
          onSearchChange={actions.updateFiltersModalSearch}
          onClearAll={actions.clearAllFilters}
          onToggleFacet={actions.toggleFacetFilter}
          isFacetActive={actions.isFacetFilterActive}
        />

        <CatalogGenresModal
          open={layout.showGenresModal}
          genres={layout.selectedGameGenres}
          onClose={actions.closeGenresModal}
        />
      </div>
    </div>
  )
}

export default GamesPage
