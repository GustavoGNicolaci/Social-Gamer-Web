import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import { useI18n } from '../../i18n/I18nContext'
import type {
  GameStatusItem,
  GameStatusValue,
} from '../../services/gameStatusService'
import {
  getProfileGameTitleInitial,
  type ProfileGameStatusOption,
} from './profileGameStatusView'

interface ProfileGameStatusGridProps {
  items: GameStatusItem[]
  loadedItemCount: number
  hasActiveStatusFilters: boolean
  totalCount: number | null
  currentPage: number
  totalPages: number
  gridStyle: CSSProperties
  isOwnerView: boolean
  statusOptions: ProfileGameStatusOption[]
  savingItemIds: string[]
  removingItemIds: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onChangePage: (page: number) => void
  onUpdateItem: (
    item: GameStatusItem,
    status: GameStatusValue,
    isFavorite: boolean
  ) => Promise<void>
  onDeleteItem: (item: GameStatusItem) => Promise<void>
  onLoadMore: () => Promise<void>
}

function ProfileGameStatusPagination({
  currentPage,
  totalPages,
  onChangePage,
  label,
  previousLabel,
  nextLabel,
}: {
  currentPage: number
  totalPages: number
  onChangePage: (page: number) => void
  label: string
  previousLabel: string
  nextLabel: string
}) {
  if (totalPages <= 1) return null

  return (
    <nav className="profile-status-pagination" aria-label={label}>
      <button
        type="button"
        onClick={() => onChangePage(Math.max(currentPage - 1, 0))}
        disabled={currentPage === 0}
      >
        {previousLabel}
      </button>

      {Array.from({ length: totalPages }, (_, index) => index).map(page => (
        <button
          key={`status-page-${page}`}
          type="button"
          onClick={() => onChangePage(page)}
          className={page === currentPage ? 'is-active' : ''}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page + 1}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChangePage(Math.min(currentPage + 1, totalPages - 1))}
        disabled={currentPage === totalPages - 1}
      >
        {nextLabel}
      </button>
    </nav>
  )
}

export function ProfileGameStatusGrid({
  items,
  loadedItemCount,
  hasActiveStatusFilters,
  totalCount,
  currentPage,
  totalPages,
  gridStyle,
  isOwnerView,
  statusOptions,
  savingItemIds,
  removingItemIds,
  hasMore,
  isLoadingMore,
  onChangePage,
  onUpdateItem,
  onDeleteItem,
  onLoadMore,
}: ProfileGameStatusGridProps) {
  const { t, formatDate } = useI18n()
  const formatStatusDate = (value: string | null | undefined) =>
    formatDate(value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      fallback: t('profile.dateFallback'),
    })
  const getStatusLabel = (status: GameStatusValue) =>
    statusOptions.find(option => option.value === status)?.label || t('common.status')

  return (
    <>
      <div className="profile-status-list-head">
        <p>
          {loadedItemCount === 1
            ? t('profileStatus.foundOneFiltered', {
                suffix: hasActiveStatusFilters
                  ? t('profileStatus.withFilters')
                  : t('profileStatus.inView'),
              })
            : t('profileStatus.foundManyFiltered', {
                count: loadedItemCount,
                suffix: hasActiveStatusFilters
                  ? t('profileStatus.withFilters')
                  : t('profileStatus.inView'),
              })}
          {totalCount !== null && totalCount > loadedItemCount
            ? t('profileStatus.notLoaded', { count: totalCount - loadedItemCount })
            : ''}
        </p>
        <span>
          {t('profileStatus.page', { page: currentPage + 1, total: totalPages })}
        </span>
      </div>

      <div className="profile-status-grid" style={gridStyle}>
        {items.map(item => {
          const visibleTitle = item.jogo?.titulo || t('common.gameUnavailable')
          const isSavingItem = savingItemIds.includes(item.id)
          const isRemovingItem = removingItemIds.includes(item.id)
          const isBusyItem = isSavingItem || isRemovingItem

          return (
            <article
              key={item.id}
              className={`profile-status-card${item.favorito ? ' is-favorite' : ''}${isBusyItem ? ' is-saving' : ''}`}
            >
              <Link to={`/games/${item.jogo_id}`} className="profile-status-card-link">
                <div className="profile-status-card-meta">
                  <span className={`profile-status-pill is-${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                  {item.favorito ? (
                    <span className="profile-status-favorite-pill">
                      {t('profileStatus.favoriteBadge')}
                    </span>
                  ) : null}
                </div>

                <div className="profile-status-card-cover">
                  {item.jogo?.capa_url ? (
                    <GameCoverImage
                      src={item.jogo.capa_url}
                      alt={t('catalog.coverAlt', { title: visibleTitle })}
                      width={430}
                      height={200}
                      sizes="(max-width: 768px) 100vw, 17vw"
                    />
                  ) : (
                    <div className="profile-status-card-fallback">
                      {getProfileGameTitleInitial(visibleTitle)}
                    </div>
                  )}
                </div>

                <div className="profile-status-card-body">
                  <span className="profile-status-date">
                    {t('profileStatus.updatedAt', {
                      date: formatStatusDate(item.created_at),
                    })}
                  </span>
                  <h3>{visibleTitle}</h3>
                  <span className="profile-status-card-cta">{t('common.viewDetails')}</span>
                </div>
              </Link>

              {isOwnerView ? (
                <div className="profile-status-card-actions">
                  <label className="profile-status-control-field">
                    <span>{t('common.status')}</span>
                    <select
                      value={item.status}
                      className="profile-status-select"
                      disabled={isBusyItem}
                      onChange={event => {
                        void onUpdateItem(
                          item,
                          event.target.value as GameStatusValue,
                          item.favorito
                        )
                      }}
                    >
                      {statusOptions.map(option => (
                        <option key={`${item.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="profile-status-card-action-row">
                    <button
                      type="button"
                      className={`profile-status-favorite-toggle${item.favorito ? ' is-active' : ''}`}
                      aria-pressed={item.favorito}
                      onClick={() => {
                        void onUpdateItem(item, item.status, !item.favorito)
                      }}
                      disabled={isBusyItem}
                    >
                      {item.favorito
                        ? t('profileStatus.favoriteActive')
                        : t('profileStatus.markFavorite')}
                    </button>

                    <button
                      type="button"
                      className="profile-secondary-button profile-item-remove-button"
                      onClick={() => void onDeleteItem(item)}
                      disabled={isBusyItem}
                    >
                      {t('common.remove')}
                    </button>

                    {isBusyItem ? (
                      <span className="profile-status-saving-label">
                        {isRemovingItem ? t('common.removing') : t('common.saving')}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <ProfileGameStatusPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onChangePage={onChangePage}
        label={t('profileStatus.paginationLabel')}
        previousLabel={t('profileStatus.previous')}
        nextLabel={t('profileStatus.next')}
      />

      {hasMore ? (
        <button
          type="button"
          className="profile-secondary-button profile-status-load-more"
          onClick={() => void onLoadMore()}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? t('common.loading') : t('profileStatus.moreGames')}
        </button>
      ) : null}
    </>
  )
}
