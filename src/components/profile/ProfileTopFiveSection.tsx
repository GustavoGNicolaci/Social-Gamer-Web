import { GameCoverImage } from '../GameCoverImage'
import {
  useProfileTopFiveController,
  type ProfileTopFiveSlot,
  type SaveTopFiveResult,
} from '../../features/profile/hooks/useProfileTopFiveController'
import { useI18n } from '../../i18n/I18nContext'
import type { TopFiveStoredEntry } from '../../utils/profileTopFive'
import { ProfileTopFiveEditor } from './ProfileTopFiveEditor'
import './ProfileTopFiveSection.css'

interface ProfileTopFiveSectionProps {
  isOwnerView: boolean
  entries: TopFiveStoredEntry[]
  onSaveTopFive: (
    entries: TopFiveStoredEntry[]
  ) => Promise<SaveTopFiveResult>
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function getTopFiveHeadingCopy(
  filledSlotsCount: number,
  isOwnerView: boolean,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (filledSlotsCount === 5) {
    return isOwnerView
      ? t('profileTopFive.completeOwner')
      : t('profileTopFive.completePublic')
  }

  if (filledSlotsCount === 0) {
    return isOwnerView
      ? t('profileTopFive.emptyOwner')
      : t('profileTopFive.emptyPublic')
  }

  return isOwnerView
    ? t('profileTopFive.partialOwner', { count: filledSlotsCount })
    : t('profileTopFive.partialPublic', { count: filledSlotsCount })
}

export function ProfileTopFiveSection({
  isOwnerView,
  entries,
  onSaveTopFive,
}: ProfileTopFiveSectionProps) {
  const { t } = useI18n()
  const controller = useProfileTopFiveController({
    isOwnerView,
    entries,
    onSaveTopFive,
  })
  const {
    actionError,
    activeSlotPosition,
    filledSlotsCount,
    handleOpenSlotPicker,
    handleRemoveSlot,
    isSavingTopFive,
    selectedGamesError,
    selectedGamesLoading,
    topFiveSlots,
  } = controller

  const renderSlotBody = (slot: ProfileTopFiveSlot) => {
    const slotLabel = t('profileTopFive.number', {
      position: slot.posicao,
    })
    const isActiveSlot = activeSlotPosition === slot.posicao
    const hasAssignedGame = slot.gameId !== null
    const slotClassName = `profile-top-five-slot is-rank-${slot.posicao}${hasAssignedGame ? ' is-filled' : ' is-empty'}${isActiveSlot ? ' is-active-picker' : ''}`

    if (!hasAssignedGame) {
      return (
        <article
          key={`top-five-slot-${slot.posicao}`}
          className={slotClassName}
        >
          <div className="profile-top-five-slot-number" aria-hidden="true">
            {slot.posicao}
          </div>

          {isOwnerView ? (
            <button
              type="button"
              className="profile-top-five-slot-main profile-top-five-slot-button"
              onClick={() => handleOpenSlotPicker(slot.posicao)}
              disabled={isSavingTopFive}
            >
              <span className="profile-top-five-slot-kicker">
                {slotLabel}
              </span>
              <strong>{t('profileTopFive.chooseGame')}</strong>
              <span>{t('profileTopFive.slotHelp')}</span>
            </button>
          ) : (
            <div className="profile-top-five-slot-main">
              <span className="profile-top-five-slot-kicker">
                {slotLabel}
              </span>
              <strong>{t('profileTopFive.notDefined')}</strong>
              <span>{t('profileTopFive.emptySlot')}</span>
            </div>
          )}
        </article>
      )
    }

    const visibleTitle =
      slot.game?.titulo ||
      (selectedGamesLoading
        ? t('profileTopFive.loadingGame')
        : t('common.gameUnavailable'))

    return (
      <article
        key={`top-five-slot-${slot.posicao}`}
        className={slotClassName}
      >
        <div className="profile-top-five-slot-number" aria-hidden="true">
          {slot.posicao}
        </div>

        {isOwnerView ? (
          <button
            type="button"
            className="profile-top-five-slot-main profile-top-five-slot-button"
            onClick={() => handleOpenSlotPicker(slot.posicao)}
            disabled={isSavingTopFive}
          >
            <div className="profile-top-five-slot-cover">
              {slot.game?.capa_url ? (
                <GameCoverImage
                  src={slot.game.capa_url}
                  alt={t('catalog.coverAlt', { title: visibleTitle })}
                  width={320}
                  height={400}
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
              ) : (
                <div className="profile-top-five-slot-fallback">
                  {getInitial(visibleTitle)}
                </div>
              )}
            </div>

            <div className="profile-top-five-slot-copy">
              <span className="profile-top-five-slot-kicker">
                {slotLabel}
              </span>
              <strong>{visibleTitle}</strong>
            </div>
          </button>
        ) : (
          <div className="profile-top-five-slot-main">
            <div className="profile-top-five-slot-cover">
              {slot.game?.capa_url ? (
                <GameCoverImage
                  src={slot.game.capa_url}
                  alt={t('catalog.coverAlt', { title: visibleTitle })}
                  width={320}
                  height={400}
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
              ) : (
                <div className="profile-top-five-slot-fallback">
                  {getInitial(visibleTitle)}
                </div>
              )}
            </div>

            <div className="profile-top-five-slot-copy">
              <span className="profile-top-five-slot-kicker">
                {slotLabel}
              </span>
              <strong>{visibleTitle}</strong>
            </div>
          </div>
        )}

        {isOwnerView ? (
          <div className="profile-top-five-slot-actions">
            <button
              type="button"
              className="profile-secondary-button"
              onClick={() => handleOpenSlotPicker(slot.posicao)}
              disabled={isSavingTopFive}
            >
              {t('profileTopFive.changeGame')}
            </button>

            <button
              type="button"
              className="profile-secondary-button profile-item-remove-button"
              onClick={() => void handleRemoveSlot(slot.posicao)}
              disabled={isSavingTopFive}
            >
              {t('common.remove')}
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <div className="profile-top-five-section">
      <div className="profile-top-five-header">
        <div className="profile-top-five-copy">
          <span className="profile-section-label">
            {t('profileTopFive.label')}
          </span>
          <h2>
            {isOwnerView
              ? t('profileTopFive.ownerTitle')
              : t('profileTopFive.publicTitle')}
          </h2>
          <p>
            {getTopFiveHeadingCopy(filledSlotsCount, isOwnerView, t)}
          </p>
        </div>
      </div>

      {selectedGamesError ? (
        <p className="profile-feedback is-error">{selectedGamesError}</p>
      ) : null}
      {actionError ? (
        <p className="profile-feedback is-error">{actionError}</p>
      ) : null}

      <div className="profile-top-five-grid">
        {topFiveSlots.map(renderSlotBody)}
      </div>

      {selectedGamesLoading ? (
        <p className="profile-top-five-status">
          {isOwnerView
            ? t('profileTopFive.loadingSelectedOwner')
            : t('profileTopFive.loadingSelectedPublic')}
        </p>
      ) : null}

      <ProfileTopFiveEditor controller={controller} />
    </div>
  )
}
