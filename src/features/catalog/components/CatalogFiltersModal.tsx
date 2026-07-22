import { useId } from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import { CatalogDialog } from './CatalogDialog'

export type CatalogFacetCategory = 'genre' | 'platform' | 'developer'

export interface CatalogActiveFilter {
  key: string
  label: string
  onRemove: () => void
}

export interface CatalogFilterModalGroup {
  key: string
  category: CatalogFacetCategory
  title: string
  options: string[]
}

interface CatalogFiltersModalProps {
  open: boolean
  searchValue: string
  activeFilters: CatalogActiveFilter[]
  groups: CatalogFilterModalGroup[]
  onClose: () => void
  onSearchChange: (value: string) => void
  onClearAll: () => void
  onToggleFacet: (category: CatalogFacetCategory, value: string) => void
  isFacetActive: (category: CatalogFacetCategory, value: string) => boolean
}

export function CatalogFiltersModal({
  open,
  searchValue,
  activeFilters,
  groups,
  onClose,
  onSearchChange,
  onClearAll,
  onToggleFacet,
  isFacetActive,
}: CatalogFiltersModalProps) {
  const { t, formatNumber } = useI18n()
  const titleId = useId()
  const descriptionId = useId()

  return (
    <CatalogDialog
      open={open}
      className="gp-filters-modal"
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={onClose}
    >
        <div className="gp-modal-head">
          <div>
            <span className="gp-badge">{t('catalog.allFilters')}</span>
            <h3 id={titleId}>{t('catalog.filtersTitle')}</h3>
            <p id={descriptionId} className="gp-muted">
              {t('catalog.filtersText')}
            </p>
          </div>

          <button
            type="button"
            className="gp-modal-close"
            aria-label={t('catalog.closeFilters')}
            onClick={onClose}
            data-dialog-autofocus
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <label className="gp-modal-search">
          <span className="gp-visually-hidden">
            {t('catalog.searchFiltersPlaceholder')}
          </span>
          <span className="gp-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>

          <input
            type="text"
            value={searchValue}
            placeholder={t('catalog.searchFiltersPlaceholder')}
            onChange={event => onSearchChange(event.target.value)}
          />
        </label>

        {activeFilters.length > 0 ? (
          <div className="gp-chips">
            {activeFilters.map(filter => (
              <span key={`modal-${filter.key}`} className="gp-chip">
                <span>{filter.label}</span>
                <button
                  type="button"
                  aria-label={t('catalog.removeFilter', { label: filter.label })}
                  onClick={filter.onRemove}
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="gp-modal-section-grid">
          {groups.map(group => (
            <section key={group.key} className="gp-modal-section">
              <div className="gp-modal-section-head">
                <h4>{group.title}</h4>
                <span>
                  {t('catalog.optionCount', {
                    count: formatNumber(group.options.length),
                  })}
                </span>
              </div>

              {group.options.length > 0 ? (
                <div className="gp-filter-pill-cloud is-modal">
                  {group.options.map(option => (
                    <button
                      key={`${group.category}-${option}-modal`}
                      type="button"
                      className={`gp-filter-pill${
                        isFacetActive(group.category, option) ? ' is-active' : ''
                      }`}
                      onClick={() => onToggleFacet(group.category, option)}
                      aria-pressed={isFacetActive(group.category, option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="gp-filter-empty">{t('catalog.noFilterOption')}</p>
              )}
            </section>
          ))}
        </div>

        <div className="gp-modal-actions">
          <button type="button" className="game-button gp-btn--secondary" onClick={onClearAll}>
            {t('common.clearAll')}
          </button>

          <button type="button" className="game-button gp-btn--primary" onClick={onClose}>
            {t('common.applyFilters')}
          </button>
        </div>
    </CatalogDialog>
  )
}
