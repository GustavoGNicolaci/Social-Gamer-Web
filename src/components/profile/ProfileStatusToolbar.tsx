import { GameCoverImage } from '../GameCoverImage'
import type { ProfileStatusSectionController } from '../../features/profile/hooks/useProfileStatusSectionController'
import { useI18n } from '../../i18n/I18nContext'
import { getProfileGameTitleInitial } from './profileGameStatusView'

interface ProfileStatusToolbarProps {
  isOwnerView: boolean
  controller: ProfileStatusSectionController
}

export function ProfileStatusToolbar({
  isOwnerView,
  controller,
}: ProfileStatusToolbarProps) {
  const { t } = useI18n()
  const {
    activeStatusFilterSet,
    handleClearStatusFilters,
    handleSearchChange,
    handleSelectGame,
    handleSelectSort,
    handleToggleStatusFilter,
    hasActiveStatusFilters,
    isCreatingStatus,
    searchError,
    searchLoading,
    searchResultItems,
    searchResultsId,
    setShowSortMenu,
    shouldShowAutosuggest,
    shouldShowEmptyAutosuggest,
    showSortMenu,
    sortLabel,
    sortMenuRef,
    sortValue,
    statusFilterSummary,
    statusOptions,
    statusSortOptions,
    trimmedSearchQuery,
  } = controller

  return (
    <div className="profile-status-toolbar">
      {isOwnerView ? (
        <div className="profile-status-toolbar-control profile-status-search-shell">
          <label
            className="profile-status-search-field"
            htmlFor="profile-status-search-input"
          >
            <span>{t('profileStatus.searchLabel')}</span>
            <input
              id="profile-status-search-input"
              type="text"
              value={controller.searchQuery}
              onChange={event => handleSearchChange(event.target.value)}
              className="profile-input"
              placeholder={t('profileStatus.searchPlaceholder')}
              autoComplete="off"
              disabled={isCreatingStatus}
              aria-expanded={shouldShowAutosuggest || shouldShowEmptyAutosuggest}
              aria-controls={searchResultsId}
            />
          </label>

          {trimmedSearchQuery.length === 1 && !searchLoading ? (
            <p className="profile-status-search-helper">
              {t('profileStatus.keepTyping')}
            </p>
          ) : null}

          {shouldShowAutosuggest || shouldShowEmptyAutosuggest ? (
            <div className="profile-status-autosuggest" id={searchResultsId}>
              {searchLoading ? (
                <p className="profile-status-autosuggest-state">
                  {t('profileStatus.searching')}
                </p>
              ) : searchError ? (
                <p className="profile-status-autosuggest-state is-error">
                  {searchError}
                </p>
              ) : shouldShowEmptyAutosuggest ? (
                <p className="profile-status-autosuggest-state">
                  {t('profileStatus.emptySearch')}
                </p>
              ) : (
                searchResultItems.map(result => {
                  const {
                    game,
                    existingItem,
                    isTracked,
                    statusLabel,
                    isFavorite,
                  } = result
                  const autosuggestContent = (
                    <>
                      <div className="profile-status-autosuggest-cover">
                        {game.capa_url ? (
                          <GameCoverImage
                            src={game.capa_url}
                            alt={t('catalog.coverAlt', { title: game.titulo })}
                            width={64}
                            height={64}
                            sizes="64px"
                          />
                        ) : (
                          <div className="profile-status-autosuggest-fallback">
                            {getProfileGameTitleInitial(game.titulo)}
                          </div>
                        )}
                      </div>

                      <div className="profile-status-autosuggest-copy">
                        <div className="profile-status-autosuggest-heading">
                          <strong>{game.titulo}</strong>
                        </div>

                        <div className="profile-status-autosuggest-meta">
                          <span
                            className={`profile-status-autosuggest-hint${isTracked ? ' is-tracked' : ''}`}
                          >
                            {isTracked
                              ? t('profileStatus.alreadyTracked')
                              : t('profileStatus.addToProfile')}
                          </span>

                          {isTracked && existingItem ? (
                            <span
                              className={`profile-status-search-badge is-${existingItem.status}`}
                            >
                              {statusLabel}
                            </span>
                          ) : null}

                          {isFavorite ? (
                            <span className="profile-status-search-badge is-favorite">
                              {t('profileStatus.favoriteBadge')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )

                  if (isTracked) {
                    return (
                      <div
                        key={game.id}
                        className="profile-status-autosuggest-item is-tracked"
                        aria-label={`${game.titulo} ${t('profileStatus.alreadyTracked')} ${statusLabel || t('common.status')}${isFavorite ? `, ${t('profileStatus.favoriteBadge')}` : ''}.`}
                      >
                        {autosuggestContent}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={game.id}
                      type="button"
                      className="profile-status-autosuggest-item is-actionable"
                      onClick={() => handleSelectGame(game)}
                    >
                      {autosuggestContent}
                    </button>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="profile-status-toolbar-control profile-status-toolbar-placeholder"></div>
      )}

      <div className="profile-status-toolbar-control">
        <div className="profile-status-sort-field">
          <span className="profile-status-toolbar-label">
            {t('profileStatus.sortAndStatus')}
          </span>

          <div className="profile-status-sort" ref={sortMenuRef}>
            <button
              type="button"
              className={`profile-status-sort-trigger${showSortMenu ? ' is-open' : ''}`}
              onClick={() => setShowSortMenu(currentValue => !currentValue)}
              aria-haspopup="menu"
              aria-expanded={showSortMenu}
              aria-label={t('profileStatus.sortAria', {
                sort: sortLabel,
                status: statusFilterSummary,
              })}
            >
              <span className="profile-status-sort-trigger-copy">
                <strong>{sortLabel}</strong>
                <span className="profile-status-sort-trigger-meta">
                  {statusFilterSummary}
                </span>
              </span>
            </button>

            {showSortMenu ? (
              <div
                className="profile-status-sort-menu"
                role="menu"
                aria-label={t('profileStatus.sortAndStatus')}
              >
                <div className="profile-status-sort-section">
                  <span className="profile-status-sort-section-label">
                    {t('profileStatus.sortSection')}
                  </span>

                  {statusSortOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`profile-status-sort-option${sortValue === option.value ? ' is-active' : ''}`}
                      onClick={() => handleSelectSort(option.value)}
                      role="menuitemradio"
                      aria-checked={sortValue === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="profile-status-sort-section">
                  <div className="profile-status-sort-section-head">
                    <span className="profile-status-sort-section-label">
                      {t('common.status')}
                    </span>

                    {hasActiveStatusFilters ? (
                      <button
                        type="button"
                        className="profile-status-sort-clear"
                        onClick={handleClearStatusFilters}
                      >
                        {t('common.clear')}
                      </button>
                    ) : null}
                  </div>

                  <div className="profile-status-sort-filter-list">
                    {statusOptions.map(option => {
                      const isActive = activeStatusFilterSet.has(option.value)

                      return (
                        <button
                          key={`sort-filter-${option.value}`}
                          type="button"
                          className={`profile-status-sort-filter-option is-${option.value}${isActive ? ' is-active' : ''}`}
                          onClick={() => handleToggleStatusFilter(option.value)}
                          role="menuitemcheckbox"
                          aria-checked={isActive}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
