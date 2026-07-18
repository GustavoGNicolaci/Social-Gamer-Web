import { GameCoverImage } from '../GameCoverImage'
import type { ProfileTopFiveController } from '../../features/profile/hooks/useProfileTopFiveController'
import { useI18n } from '../../i18n/I18nContext'

interface ProfileTopFiveEditorProps {
  controller: ProfileTopFiveController
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

export function ProfileTopFiveEditor({
  controller,
}: ProfileTopFiveEditorProps) {
  const { t } = useI18n()
  const {
    activeSlot,
    activeSlotPosition,
    handleSearchChange,
    handleSelectGame,
    isSavingTopFive,
    pickerResultsId,
    resetPicker,
    searchError,
    searchInputRef,
    searchLoading,
    searchQuery,
    shouldShowSearchEmptyState,
    shouldShowSearchFeedback,
    topFiveSearchResults,
    trimmedSearchQuery,
  } = controller

  if (!activeSlotPosition) return null

  return (
    <div className="profile-top-five-picker">
      <div className="profile-top-five-picker-head">
        <div className="profile-top-five-picker-copy">
          <span className="profile-section-label">
            {t('profileTopFive.pickerLabel')}
          </span>
          <h3>
            {t('profileTopFive.pickerTitle', {
              position: activeSlotPosition,
            })}
          </h3>
          <p>{t('profileTopFive.pickerText')}</p>
        </div>

        <button
          type="button"
          className="profile-secondary-button"
          onClick={resetPicker}
          disabled={isSavingTopFive}
        >
          {t('common.cancel')}
        </button>
      </div>

      {activeSlot?.gameId !== null ? (
        <div className="profile-top-five-picker-current">
          <span>{t('profileTopFive.current')}</span>
          <strong>
            {activeSlot?.game?.titulo || t('profileTopFive.previousGame')}
          </strong>
        </div>
      ) : null}

      <label
        className="profile-top-five-search-field"
        htmlFor="profile-top-five-search-input"
      >
        <span>{t('profileTopFive.searchLabel')}</span>
        <input
          ref={searchInputRef}
          id="profile-top-five-search-input"
          type="text"
          value={searchQuery}
          onChange={event => handleSearchChange(event.target.value)}
          className="profile-input"
          placeholder={t('profileTopFive.searchPlaceholder')}
          autoComplete="off"
          disabled={isSavingTopFive}
          aria-expanded={
            shouldShowSearchFeedback || shouldShowSearchEmptyState
          }
          aria-controls={pickerResultsId}
        />
      </label>

      {trimmedSearchQuery.length === 1 && !searchLoading ? (
        <p className="profile-top-five-search-helper">
          {t('profileTopFive.keepTyping')}
        </p>
      ) : null}

      {shouldShowSearchFeedback || shouldShowSearchEmptyState ? (
        <div
          className="profile-top-five-search-results"
          id={pickerResultsId}
        >
          {searchLoading ? (
            <p className="profile-top-five-search-state">
              {t('profileTopFive.searching')}
            </p>
          ) : searchError ? (
            <p className="profile-top-five-search-state is-error">
              {searchError}
            </p>
          ) : shouldShowSearchEmptyState ? (
            <p className="profile-top-five-search-state">
              {t('profileTopFive.emptySearch')}
            </p>
          ) : (
            topFiveSearchResults.map(result => {
              const {
                game,
                occupiedPosition,
                isDisabled,
                isCurrentSlot,
              } = result
              const helperText = isDisabled
                ? t('profileTopFive.alreadyInNumber', {
                    position: occupiedPosition || 0,
                  })
                : isCurrentSlot
                  ? t('profileTopFive.alreadyCurrent', {
                      position: activeSlotPosition,
                    })
                  : t('profileTopFive.selectForNumber', {
                      position: activeSlotPosition,
                    })

              if (isDisabled) {
                return (
                  <div
                    key={`top-five-search-result-${game.id}`}
                    className="profile-top-five-search-result is-disabled"
                    aria-label={t('profileTopFive.alreadyOccupiesAria', {
                      title: game.titulo,
                      position: occupiedPosition || 0,
                    })}
                  >
                    <div className="profile-top-five-search-result-cover">
                      {game.capa_url ? (
                        <GameCoverImage
                          src={game.capa_url}
                          alt={t('catalog.coverAlt', {
                            title: game.titulo,
                          })}
                          width={60}
                          height={60}
                          sizes="60px"
                        />
                      ) : (
                        <div className="profile-top-five-search-result-fallback">
                          {getInitial(game.titulo)}
                        </div>
                      )}
                    </div>

                    <div className="profile-top-five-search-result-copy">
                      <strong>{game.titulo}</strong>
                      <span>{helperText}</span>
                    </div>
                  </div>
                )
              }

              return (
                <button
                  key={`top-five-search-result-${game.id}`}
                  type="button"
                  className="profile-top-five-search-result"
                  onClick={() => void handleSelectGame(game)}
                  disabled={isSavingTopFive}
                >
                  <div className="profile-top-five-search-result-cover">
                    {game.capa_url ? (
                      <GameCoverImage
                        src={game.capa_url}
                        alt={t('catalog.coverAlt', {
                          title: game.titulo,
                        })}
                        width={60}
                        height={60}
                        sizes="60px"
                      />
                    ) : (
                      <div className="profile-top-five-search-result-fallback">
                        {getInitial(game.titulo)}
                      </div>
                    )}
                  </div>

                  <div className="profile-top-five-search-result-copy">
                    <strong>{game.titulo}</strong>
                    <span>{helperText}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
