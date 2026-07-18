import { useI18n } from '../../../i18n/I18nContext'
import { getCatalogPaginationPages } from '../domain/catalogPagination'

interface CatalogPaginationControlsProps {
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
}

export function CatalogPaginationControls({
  currentPage,
  totalPages,
  onChangePage,
}: CatalogPaginationControlsProps) {
  const { t } = useI18n()
  const visiblePages = getCatalogPaginationPages(currentPage, totalPages)

  if (totalPages <= 1) return null

  return (
    <nav className="gp-pagination" aria-label={t('catalog.pagination')}>
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        {t('catalog.previous')}
      </button>

      {visiblePages.map(page => (
        <button
          key={page}
          type="button"
          onClick={() => onChangePage(page)}
          className={page === currentPage ? 'is-active' : ''}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChangePage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        {t('catalog.next')}
      </button>
    </nav>
  )
}
