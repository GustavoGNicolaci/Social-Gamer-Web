import { GameCoverImage } from '../GameCoverImage'
import type { ProfileStatusSectionController } from '../../features/profile/hooks/useProfileStatusSectionController'
import { useI18n } from '../../i18n/I18nContext'
import type { GameStatusValue } from '../../services/gameStatusService'
import { getProfileGameTitleInitial } from './profileGameStatusView'

interface ProfileStatusComposerProps {
  controller: ProfileStatusSectionController
}

export function ProfileStatusComposer({
  controller,
}: ProfileStatusComposerProps) {
  const { t } = useI18n()
  const {
    composerFavorito,
    composerStatus,
    handleCancelSelectedGame,
    handleCreateStatus,
    isCreatingStatus,
    setComposerFavorito,
    setComposerStatus,
    statusOptions,
    visibleSelectedGame,
  } = controller

  if (!visibleSelectedGame) return null

  return (
    <form className="profile-status-composer" onSubmit={handleCreateStatus}>
      <div className="profile-status-composer-preview">
        <div className="profile-status-composer-cover">
          {visibleSelectedGame.capa_url ? (
            <GameCoverImage
              src={visibleSelectedGame.capa_url}
              alt={t('catalog.coverAlt', {
                title: visibleSelectedGame.titulo,
              })}
              width={92}
              height={92}
              sizes="92px"
            />
          ) : (
            <div className="profile-status-card-fallback">
              {getProfileGameTitleInitial(visibleSelectedGame.titulo)}
            </div>
          )}
        </div>

        <div className="profile-status-composer-copy">
          <span className="profile-section-label">
            {t('profileStatus.newGame')}
          </span>
          <h3>{visibleSelectedGame.titulo}</h3>
          <p>{t('profileStatus.composerText')}</p>
        </div>
      </div>

      <div className="profile-status-composer-actions">
        <label className="profile-status-control-field">
          <span>{t('profileStatus.initialStatus')}</span>
          <select
            value={composerStatus}
            className="profile-status-select"
            onChange={event =>
              setComposerStatus(event.target.value as GameStatusValue)
            }
            disabled={isCreatingStatus}
          >
            {statusOptions.map(option => (
              <option key={`composer-status-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="profile-status-composer-buttons">
          <button
            type="button"
            className={`profile-status-favorite-toggle${composerFavorito ? ' is-active' : ''}`}
            aria-pressed={composerFavorito}
            onClick={() => setComposerFavorito(!composerFavorito)}
            disabled={isCreatingStatus}
          >
            {composerFavorito
              ? t('profileStatus.favoriteActive')
              : t('profileStatus.markFavorite')}
          </button>

          <button
            type="button"
            className="profile-secondary-button"
            onClick={handleCancelSelectedGame}
            disabled={isCreatingStatus}
          >
            {t('common.cancel')}
          </button>

          <button
            type="submit"
            className="profile-save-button"
            disabled={isCreatingStatus}
          >
            {isCreatingStatus
              ? t('common.saving')
              : t('profileStatus.saveToProfile')}
          </button>
        </div>
      </div>
    </form>
  )
}
