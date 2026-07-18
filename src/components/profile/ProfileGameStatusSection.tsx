import { memo, type CSSProperties } from 'react'
import { useProfileStatusSectionController } from '../../features/profile/hooks/useProfileStatusSectionController'
import { useI18n } from '../../i18n/I18nContext'
import type {
  GameStatusItem,
  GameStatusSortValue,
  GameStatusValue,
} from '../../services/gameStatusService'
import { ProfileGameStatusGrid } from './ProfileGameStatusGrid'
import { ProfileStatusComposer } from './ProfileStatusComposer'
import { ProfileStatusToolbar } from './ProfileStatusToolbar'
import './ProfileGameStatusSection.css'

type StatusSortValue = GameStatusSortValue

interface SaveStatusResult {
  ok: boolean
  message?: string
}

interface DeleteStatusResult {
  ok: boolean
  message?: string
}

interface ProfileGameStatusSectionProps {
  userId: string
  items: GameStatusItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  totalCount: number | null
  hasMore: boolean
  isLoadingMore: boolean
  isOwnerView: boolean
  onSaveStatus: (params: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => Promise<SaveStatusResult>
  onDeleteStatus: (itemId: string) => Promise<DeleteStatusResult>
  onRefresh: () => Promise<void>
  onLoadMore: () => Promise<void>
  onControlsChange: (controls: {
    sortValue: StatusSortValue
    statuses: GameStatusValue[]
  }) => void
}

export const ProfileGameStatusSection = memo(function ProfileGameStatusSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  totalCount,
  hasMore,
  isLoadingMore,
  isOwnerView,
  onSaveStatus,
  onDeleteStatus,
  onRefresh,
  onLoadMore,
  onControlsChange,
}: ProfileGameStatusSectionProps) {
  const { t } = useI18n()
  const controller = useProfileStatusSectionController({
    userId,
    items,
    isOwnerView,
    onSaveStatus,
    onDeleteStatus,
    onControlsChange,
  })
  const {
    actionError,
    gridColumns,
    handleClearStatusFilters,
    handleDeleteItem,
    handleUpdateExistingItem,
    hasActiveStatusFilters,
    hasSavedStatusItems,
    hasVisibleStatusItems,
    removingItemIds,
    safeCurrentPage,
    savingItemIds,
    setCurrentPage,
    sortedItems,
    statusOptions,
    totalPages,
    visibleItems,
  } = controller
  const statusGridStyle = {
    '--status-columns': String(gridColumns),
  } as CSSProperties

  return (
    <section className="profile-card profile-status-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-status-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">{t('profile.tab.status')}</span>
            <h2>
              {isOwnerView
                ? t('profileStatus.ownerTitle')
                : t('profileStatus.publicTitle')}
            </h2>
            <p>
              {isOwnerView
                ? t('profileStatus.ownerText')
                : t('profileStatus.publicText')}
            </p>
          </div>

          <div className="profile-meta-item profile-status-summary">
            <span>{t('profileStatus.totalSaved')}</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        <ProfileStatusToolbar
          isOwnerView={isOwnerView}
          controller={controller}
        />

        <ProfileStatusComposer controller={controller} />

        {actionError ? (
          <p className="profile-feedback is-error">{actionError}</p>
        ) : null}

        {isLoading ? (
          <div className="profile-status-empty">
            <h3>
              {isOwnerView
                ? t('profileStatus.loadingOwner')
                : t('profileStatus.loadingPublic')}
            </h3>
            <p>
              {isOwnerView
                ? t('profileStatus.loadingOwnerText')
                : t('profileStatus.loadingPublicText')}
            </p>
            <div
              className="profile-status-skeleton-grid"
              style={statusGridStyle}
              aria-hidden="true"
            >
              {Array.from(
                { length: Math.min(gridColumns * 2, 12) },
                (_, index) => (
                  <span
                    key={`status-skeleton-${index}`}
                    className="profile-status-skeleton-card"
                  />
                )
              )}
            </div>
          </div>
        ) : errorMessage ? (
          <div className="profile-status-empty">
            <h3>{t('profileStatus.errorTitle')}</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={() => void onRefresh()}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : !hasSavedStatusItems ? (
          <div className="profile-status-empty">
            <h3>
              {isOwnerView
                ? t('profileStatus.emptyOwner')
                : t('profileStatus.emptyPublic')}
            </h3>
            <p>
              {isOwnerView
                ? t('profileStatus.emptyOwnerText')
                : t('profileStatus.emptyPublicText')}
            </p>
          </div>
        ) : !hasVisibleStatusItems ? (
          <div className="profile-status-empty">
            <h3>{t('profileStatus.emptyFilterTitle')}</h3>
            <p>{t('profileStatus.emptyFilterText')}</p>
            <button
              type="button"
              className="profile-secondary-button"
              onClick={handleClearStatusFilters}
            >
              {t('profileStatus.clearFilters')}
            </button>
          </div>
        ) : (
          <ProfileGameStatusGrid
            items={visibleItems}
            loadedItemCount={sortedItems.length}
            hasActiveStatusFilters={hasActiveStatusFilters}
            totalCount={totalCount}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            gridStyle={statusGridStyle}
            isOwnerView={isOwnerView}
            statusOptions={statusOptions}
            savingItemIds={savingItemIds}
            removingItemIds={removingItemIds}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onChangePage={setCurrentPage}
            onUpdateItem={handleUpdateExistingItem}
            onDeleteItem={handleDeleteItem}
            onLoadMore={onLoadMore}
          />
        )}
      </div>
    </section>
  )
})
