import { useI18n } from '../../../i18n/I18nContext'

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

  if (!open) return null

  return (
    <div className="gp-modal" onClick={onClose}>
      <div className="gp-modal-card" onClick={event => event.stopPropagation()}>
        <div className="gp-modal-head">
          <div>
            <span className="gp-badge">{t('catalog.categories')}</span>
            <h3>{t('catalog.allGameGenres')}</h3>
            <p className="gp-muted">{t('catalog.allGameGenresText')}</p>
          </div>

          <button
            type="button"
            className="gp-modal-close"
            aria-label={t('catalog.closeGenres')}
            onClick={onClose}
          >
            x
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
      </div>
    </div>
  )
}
