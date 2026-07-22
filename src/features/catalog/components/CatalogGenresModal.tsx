import { useId } from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import { CatalogDialog } from './CatalogDialog'

interface CatalogGenresModalProps {
  open: boolean
  genres: string[]
  onClose: () => void
}

export function CatalogGenresModal({
  open,
  genres,
  onClose,
}: CatalogGenresModalProps) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()

  return (
    <CatalogDialog
      open={open}
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={onClose}
    >
        <div className="gp-modal-head">
          <div>
            <span className="gp-badge">{t('catalog.categories')}</span>
            <h3 id={titleId}>{t('catalog.allGameGenres')}</h3>
            <p id={descriptionId} className="gp-muted">
              {t('catalog.allGameGenresText')}
            </p>
          </div>

          <button
            type="button"
            className="gp-modal-close"
            aria-label={t('catalog.closeGenres')}
            onClick={onClose}
            data-dialog-autofocus
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="gp-modal-list">
          {genres.map((genre, index) => (
            <span key={`${genre}-${index}`} className="genre-chip gp-tag">
              {genre}
            </span>
          ))}
        </div>

        <div className="gp-modal-actions">
          <button type="button" className="game-button gp-btn--secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
    </CatalogDialog>
  )
}
