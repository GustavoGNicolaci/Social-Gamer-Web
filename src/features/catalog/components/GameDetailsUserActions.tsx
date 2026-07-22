import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, LogIn, Star } from 'lucide-react'
import { useI18n } from '../../../i18n/I18nContext'
import {
  SELECTABLE_STATUS_VALUES,
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

const QUICK_PROFILE_STATUS_OPTIONS = SELECTABLE_STATUS_VALUES.map(value => ({
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
  const isLegacyStatus = status.current === 'planejando'
  const currentStatusLabel = isLegacyStatus
    ? t('profileStatus.legacyStatus')
    : status.current
      ? t(`game.status.${status.current}`)
      : ''
  const profileStatusSubtitle = status.loading
    ? t('game.details.profilePanelChecking')
    : status.current
      ? t('game.details.profilePanelCurrent', { status: currentStatusLabel })
      : t('game.details.quickStatusText')

  return (
    <>
      <div className="game-details-actions">
        {authenticated ? (
          <a href="#game-community" className="game-button game-details-primary-button">
            <Star size={18} aria-hidden="true" />
            {t('game.details.rateNow')}
          </a>
        ) : (
          <Link to="/login" className="game-button game-details-primary-button">
            <LogIn size={18} aria-hidden="true" />
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
            aria-pressed={wishlist.saved}
          >
            <Heart size={18} fill={wishlist.saved ? 'currentColor' : 'none'} aria-hidden="true" />
            {wishlistButtonLabel}
          </button>
        ) : (
          <Link
            to="/login"
            className="game-button game-details-secondary-button game-details-wishlist-button"
          >
            <Heart size={18} aria-hidden="true" />
            {t('game.details.loginToSave')}
          </Link>
        )}

        <Link to="/games" className="game-button game-details-secondary-button">
          <ArrowLeft size={18} aria-hidden="true" />
          {t('common.goBackToCatalog')}
        </Link>
      </div>

      {authenticated ? (
        <div className="game-details-profile-status-card">
          <div className="game-details-profile-status-copy">
            <span className="game-details-panel-kicker">{t('common.profile')}</span>
            <strong>{profileStatusTitle}</strong>
            <p>{profileStatusSubtitle}</p>
            {isLegacyStatus ? (
              <button
                type="button"
                className="game-button game-details-legacy-status-button"
                onClick={() => void status.select('planejando')}
                disabled={status.loading || status.saving}
              >
                {status.saving && status.pending === 'planejando'
                  ? t('common.removing')
                  : t('profileStatus.removeLegacyStatus')}
              </button>
            ) : null}
          </div>

          <div
            className="game-details-profile-status-actions"
            role="group"
            aria-label={profileStatusTitle}
          >
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
                  aria-pressed={isSelected}
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
        <p
          className={`game-details-feedback is-${wishlist.feedback.tone}`}
          role={wishlist.feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {wishlist.feedback.message}
        </p>
      ) : null}

      {status.feedback ? (
        <p
          className={`game-details-feedback is-${status.feedback.tone}`}
          role={status.feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {status.feedback.message}
        </p>
      ) : null}
    </>
  )
}
