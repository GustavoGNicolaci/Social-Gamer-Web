import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/I18nContext'
import {
  STATUS_VALUES,
  type GameStatusValue,
} from '../../../services/gameStatusService'

type GameDetailsFeedbackTone = 'success' | 'error' | 'info'

export interface GameDetailsActionFeedback {
  tone: GameDetailsFeedbackTone
  message: string
}

export interface GameDetailsUserActionsProps {
  authenticated: boolean
  wishlist: {
    loading: boolean
    saving: boolean
    saved: boolean
    feedback: GameDetailsActionFeedback | null
    toggle: () => void | Promise<void>
  }
  status: {
    loading: boolean
    saving: boolean
    pending: GameStatusValue | null
    current: GameStatusValue | null
    feedback: GameDetailsActionFeedback | null
    select: (status: GameStatusValue) => void | Promise<void>
  }
}

const QUICK_PROFILE_STATUS_OPTIONS = STATUS_VALUES.map(value => ({
  value,
  labelKey: `game.status.${value}`,
}))

export function GameDetailsUserActions({
  authenticated,
  wishlist,
  status,
}: GameDetailsUserActionsProps) {
  const { t } = useI18n()
  const wishlistButtonLabel = wishlist.loading
    ? t('game.details.checking')
    : wishlist.saving
      ? wishlist.saved
        ? t('common.removing')
        : t('common.saving')
      : wishlist.saved
        ? t('game.details.inWishlist')
        : t('game.details.addWishlist')
  const profileStatusTitle = status.current
    ? t('game.details.profilePanelTitleUpdate')
    : t('game.details.profilePanelTitleAdd')
  const profileStatusSubtitle = status.loading
    ? t('game.details.profilePanelChecking')
    : status.current
      ? t('game.details.profilePanelCurrent', { status: t(`game.status.${status.current}`) })
      : t('game.details.quickStatusText')

  return (
    <>
      <div className="game-details-actions">
        {authenticated ? (
          <a href="#game-community" className="game-button game-details-primary-button">
            {t('game.details.rateNow')}
          </a>
        ) : (
          <Link to="/login" className="game-button game-details-primary-button">
            {t('game.details.loginToRate')}
          </Link>
        )}

        {authenticated ? (
          <button
            type="button"
            className={`game-button game-details-secondary-button game-details-wishlist-button${wishlist.saved ? ' is-saved' : ''}`}
            onClick={wishlist.toggle}
            disabled={wishlist.loading || wishlist.saving}
            aria-live="polite"
          >
            {wishlistButtonLabel}
          </button>
        ) : (
          <Link
            to="/login"
            className="game-button game-details-secondary-button game-details-wishlist-button"
          >
            {t('game.details.loginToSave')}
          </Link>
        )}

        <Link to="/games" className="game-button game-details-secondary-button">
          {t('common.goBackToCatalog')}
        </Link>
      </div>

      {authenticated ? (
        <div className="game-details-profile-status-card">
          <div className="game-details-profile-status-copy">
            <span className="game-details-panel-kicker">{t('common.profile')}</span>
            <strong>{profileStatusTitle}</strong>
            <p>{profileStatusSubtitle}</p>
          </div>

          <div className="game-details-profile-status-actions">
            {QUICK_PROFILE_STATUS_OPTIONS.map(option => {
              const isSelected = status.current === option.value
              const isPendingThisStatus = status.pending === option.value
              const isRemovingThisStatus = isPendingThisStatus && status.current === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`game-button game-details-profile-status-button is-${option.value}${isSelected ? ' is-selected' : ''}`}
                  onClick={() => void status.select(option.value)}
                  disabled={status.loading || status.saving}
                >
                  <span className="game-details-profile-status-button-label">
                    {status.saving && isPendingThisStatus
                      ? isRemovingThisStatus
                        ? t('common.removing')
                        : t('common.saving')
                      : t(option.labelKey)}
                  </span>
                  <small className="game-details-profile-status-button-hint">
                    {isSelected
                      ? t('game.details.profilePanelRemoveHint')
                      : t('game.details.profilePanelHint')}
                  </small>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {wishlist.feedback ? (
        <p className={`game-details-feedback is-${wishlist.feedback.tone}`}>
          {wishlist.feedback.message}
        </p>
      ) : null}

      {status.feedback ? (
        <p className={`game-details-feedback is-${status.feedback.tone}`}>
          {status.feedback.message}
        </p>
      ) : null}
    </>
  )
}
