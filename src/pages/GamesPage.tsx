import { lazy, Suspense } from 'react'
import { CatalogGameCard } from '../features/catalog/components/CatalogGameCard'
import { CatalogPaginationControls } from '../features/catalog/components/CatalogPaginationControls'
import {
  CATALOG_SORT_OPTIONS,
  useGamesCatalogController,
} from '../features/catalog/hooks/useGamesCatalogController'
import type { CatalogSortOption } from '../features/catalog/domain/catalogTypes'
import { useI18n } from '../i18n/I18nContext'
import './GamesPage.css'

const CatalogFiltersModal = lazy(() =>
  import('../features/catalog/components/CatalogFiltersModal').then(module => ({
    default: module.CatalogFiltersModal,
  }))
)
const CatalogGenresModal = lazy(() =>
  import('../features/catalog/components/CatalogGenresModal').then(module => ({
    default: module.CatalogGenresModal,
  }))
)

function GamesPage() {
  const { t } = useI18n()
  const { results, filters, layout, actions } = useGamesCatalogController()

  if (results.loading) {
    return (
      <div className="page-container">
        <div className="page-content games-page">
          <section className="gp-loading" role="status" aria-live="polite">
            <div className="gp-loading-copy">
              <span className="gp-badge">
                {t('common.catalog')}
              </span>
              <h1>{t('catalog.loadingTitle')}</h1>
              <p className="gp-muted">{t('catalog.loadingText')}</p>
            </div>

            <div className="gp-grid gp-skeleton-grid" style={layout.gridStyle} aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <article key={index} className="gp-game gp-game-skeleton">
                  <span className="gp-skeleton gp-skeleton-cover" />
                  <span className="gp-skeleton gp-skeleton-title" />
                  <span className="gp-skeleton gp-skeleton-line" />
                  <span className="gp-skeleton gp-skeleton-line is-short" />
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content games-page">
        <section className="gp-panel" aria-labelledby="games-catalog-title">
          <div className="gp-panel-head">
            <div className="gp-panel-copy">
              <span className="gp-badge">
                {t('common.catalog')}
              </span>
              <h1 id="games-catalog-title">{t('common.games')}</h1>
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
                aria-haspopup="dialog"
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
              <p className="gp-panel-footnote is-warning" role="alert">
                {results.catalogError}
              </p>
            ) : null}
          </div>
        </section>

        {results.games.length === 0 ? (
          <article className={`gp-empty${results.catalogError ? ' is-error' : ''}`}>
            <span
              className={`gp-empty-icon${results.catalogError ? ' is-error' : ''}`}
              aria-hidden="true"
            />
            <span className="gp-badge">{t('common.noResults')}</span>
            <h3>{t('catalog.emptyTitle')}</h3>
            <p className="gp-muted">{t('catalog.emptyText')}</p>
            <button
              type="button"
              className="game-button gp-btn--secondary"
              onClick={actions.openFiltersModal}
              aria-haspopup="dialog"
            >
              {t('catalog.allFilters')}
            </button>
          </article>
        ) : (
          <>
            <div
              className="gp-grid"
              style={layout.gridStyle}
              aria-label={t('common.games')}
            >
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

        <Suspense
          fallback={<span className="sr-only" role="status">{t('common.loading')}</span>}
        >
          {layout.showFiltersModal ? (
            <CatalogFiltersModal
              open
              searchValue={filters.modalSearch}
              activeFilters={filters.activeFilters}
              groups={filters.modalGroups}
              onClose={actions.closeFiltersModal}
              onSearchChange={actions.updateFiltersModalSearch}
              onClearAll={actions.clearAllFilters}
              onToggleFacet={actions.toggleFacetFilter}
              isFacetActive={actions.isFacetFilterActive}
            />
          ) : null}

          {layout.showGenresModal ? (
            <CatalogGenresModal
              open
              genres={layout.selectedGameGenres}
              onClose={actions.closeGenresModal}
            />
          ) : null}
        </Suspense>
      </div>
    </div>
  )
}

export default GamesPage
