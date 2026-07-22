import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import {
  useProfileWishlistReorderController,
  type WishlistOrderStatusState,
} from '../../features/profile/hooks/useProfileWishlistReorderController'
import { useI18n } from '../../i18n/I18nContext'
import type { WishlistGameItem } from '../../services/wishlistService'
import { ProfileWishlistGrid } from './ProfileWishlistGrid'
import './ProfileWishlistSection.css'

interface ProfileWishlistSectionProps {
  userId: string
  items: WishlistGameItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  totalCount: number | null
  hasMore: boolean
  isLoadingMore: boolean
  isPreparingReorder: boolean
  isFullyLoaded: boolean
  isOwnerView: boolean
  onDeleteWishlistItem: (itemId: string) => Promise<{
    ok: boolean
    message?: string
  }>
  onLoadMore: () => Promise<void>
  onLoadFullWishlistForReorder: () => Promise<{
    ok: boolean
    message?: string
  }>
}

const HORIZONTAL_LAYOUT_THRESHOLD = 6

function getItemsPerPage(viewportWidth: number) {
  if (viewportWidth <= 480) return 1
  if (viewportWidth <= 768) return 2
  if (viewportWidth <= 992) return 3
  if (viewportWidth <= 1200) return 4
  return 6
}

function chunkWishlistItems(items: WishlistGameItem[], chunkSize: number) {
  const itemGroups: WishlistGameItem[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    itemGroups.push(items.slice(index, index + chunkSize))
  }

  return itemGroups
}

export const ProfileWishlistSection = memo(function ProfileWishlistSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  totalCount,
  hasMore,
  isLoadingMore,
  isPreparingReorder,
  isFullyLoaded,
  isOwnerView,
  onDeleteWishlistItem,
  onLoadMore,
  onLoadFullWishlistForReorder,
}: ProfileWishlistSectionProps) {
  const { t } = useI18n()
  const [orderStatus, setOrderStatus] =
    useState<WishlistOrderStatusState | null>(null)
  const [removingItemIds, setRemovingItemIds] = useState<string[]>([])
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : getItemsPerPage(window.innerWidth)
  )
  const [currentPage, setCurrentPage] = useState(0)
  const [reorderFocusItemId, setReorderFocusItemId] = useState<string | null>(null)
  const hasPendingRemoval = removingItemIds.length > 0
  const reorderController = useProfileWishlistReorderController({
    userId,
    items,
    isOwnerView,
    isFullyLoaded,
    isPreparingReorder,
    hasPendingRemoval,
    onLoadFullWishlistForReorder,
    onOrderStatusChange: setOrderStatus,
  })
  const {
    canPrepareReorder,
    canKeyboardReorder,
    canReorder,
    clearAutoPageSchedule,
    draggedItemId,
    dropTargetId,
    handleDragEnd,
    handleDragHandleClick,
    handleDragHandlePointerDown,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handleMoveItem,
    handlePrepareReorder,
    handleViewportDragLeave,
    handleViewportDragOver,
    isSavingOrder,
    orderedItems,
    registerItem,
    resetInteraction,
  } = reorderController
  const hasWishlistItems = orderedItems.length > 0
  const isPaginatedLayout =
    orderedItems.length > HORIZONTAL_LAYOUT_THRESHOLD
  const pagedItems = useMemo(
    () =>
      isPaginatedLayout
        ? chunkWishlistItems(orderedItems, itemsPerPage)
        : [],
    [isPaginatedLayout, itemsPerPage, orderedItems]
  )
  const totalPages = isPaginatedLayout ? pagedItems.length : 1
  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(totalPages - 1, 0)
  )
  const visiblePageItems = useMemo(
    () =>
      isPaginatedLayout
        ? pagedItems[safeCurrentPage] || []
        : orderedItems,
    [isPaginatedLayout, orderedItems, pagedItems, safeCurrentPage]
  )
  const visibleItemIds = useMemo(
    () => new Set(visiblePageItems.map(item => item.id)),
    [visiblePageItems]
  )
  const canGoPrevPage = isPaginatedLayout && safeCurrentPage > 0
  const canGoNextPage =
    isPaginatedLayout && safeCurrentPage < totalPages - 1
  const wishlistColumnsStyle = {
    '--wishlist-columns': String(itemsPerPage),
  } as CSSProperties

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncItemsPerPage = () => {
      setItemsPerPage(getItemsPerPage(window.innerWidth))
    }

    syncItemsPerPage()
    window.addEventListener('resize', syncItemsPerPage)

    return () => {
      window.removeEventListener('resize', syncItemsPerPage)
    }
  }, [])

  const handleDeleteItem = async (itemId: string) => {
    setOrderStatus(null)
    resetInteraction()
    setRemovingItemIds(currentIds =>
      currentIds.includes(itemId) ? currentIds : [...currentIds, itemId]
    )

    const result = await onDeleteWishlistItem(itemId)

    setRemovingItemIds(currentIds =>
      currentIds.filter(currentId => currentId !== itemId)
    )

    if (!result.ok) {
      setOrderStatus({
        tone: 'error',
        message: result.message || t('profileWishlist.removeError'),
      })
    }
  }

  const handleAccessibleMove = async (
    itemId: string,
    direction: 'earlier' | 'later'
  ) => {
    const sourceIndex = orderedItems.findIndex(item => item.id === itemId)
    const targetIndex = direction === 'earlier' ? sourceIndex - 1 : sourceIndex + 1
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= orderedItems.length) return

    setReorderFocusItemId(itemId)
    if (isPaginatedLayout) setCurrentPage(Math.floor(targetIndex / itemsPerPage))

    const didSave = await handleMoveItem(itemId, direction)
    if (!didSave && isPaginatedLayout) {
      setCurrentPage(Math.floor(sourceIndex / itemsPerPage))
    }
  }

  return (
    <section className="profile-card profile-wishlist-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-wishlist-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">
              {t('profileWishlist.title')}
            </span>
            <h2>{t('profileWishlist.title')}</h2>
            <p>
              {isOwnerView
                ? t('profileWishlist.ownerText')
                : t('profileWishlist.publicText')}
            </p>
          </div>

          <div className="profile-meta-item profile-wishlist-summary">
            <span>{t('profileWishlist.totalSaved')}</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        {isLoading ? (
          <div className="profile-wishlist-empty">
            <h3>
              {isOwnerView
                ? t('profileWishlist.loadingOwner')
                : t('profileWishlist.loadingPublic')}
            </h3>
            <p>
              {isOwnerView
                ? t('profileWishlist.loadingOwnerText')
                : t('profileWishlist.loadingPublicText')}
            </p>
            <div
              className="profile-wishlist-skeleton-grid"
              style={wishlistColumnsStyle}
              aria-hidden="true"
            >
              {Array.from(
                { length: Math.min(itemsPerPage, 6) },
                (_, index) => (
                  <span
                    key={`wishlist-skeleton-${index}`}
                    className="profile-wishlist-skeleton-card"
                  />
                )
              )}
            </div>
          </div>
        ) : errorMessage ? (
          <p className="profile-feedback is-error">{errorMessage}</p>
        ) : !hasWishlistItems ? (
          <div className="profile-wishlist-empty">
            <h3>
              {isOwnerView
                ? t('profileWishlist.emptyOwner')
                : t('profileWishlist.emptyPublic')}
            </h3>
            <p>
              {isOwnerView
                ? t('profileWishlist.emptyOwnerText')
                : t('profileWishlist.emptyPublicText')}
            </p>
            {isOwnerView ? (
              <Link
                to="/games"
                className="profile-secondary-button profile-wishlist-link"
              >
                {t('common.exploreGames')}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="profile-wishlist-list-head">
              <p>
                {totalCount !== null && totalCount > orderedItems.length
                  ? t('profileWishlist.loadedPartial', {
                      loaded: orderedItems.length,
                      total: totalCount,
                    })
                  : t('profileWishlist.loadedCount', {
                      count: orderedItems.length,
                    })}
              </p>

              {canPrepareReorder ? (
                <button
                  type="button"
                  className="profile-secondary-button profile-wishlist-reorder-button"
                  onClick={() => void handlePrepareReorder()}
                  disabled={isPreparingReorder}
                >
                  {isPreparingReorder
                    ? t('profileWishlist.preparing')
                    : t('profileWishlist.prepareReorder')}
                </button>
              ) : null}
            </div>

            <ProfileWishlistGrid
              items={isPaginatedLayout ? visiblePageItems : orderedItems}
              isPaginatedLayout={isPaginatedLayout}
              currentPage={safeCurrentPage}
              canGoPreviousPage={canGoPrevPage}
              canGoNextPage={canGoNextPage}
              columnsStyle={wishlistColumnsStyle}
              isOwnerView={isOwnerView}
              canReorder={canReorder}
              canKeyboardReorder={canKeyboardReorder}
              firstOrderedItemId={orderedItems[0]?.id ?? null}
              lastOrderedItemId={orderedItems[orderedItems.length - 1]?.id ?? null}
              focusItemId={reorderFocusItemId}
              draggedItemId={draggedItemId}
              dropTargetId={dropTargetId}
              isSavingOrder={isSavingOrder}
              removingItemIds={removingItemIds}
              onRegisterItem={registerItem}
              onDragOverItem={(itemId, event) =>
                handleDragOver(itemId, event, visibleItemIds)
              }
              onDropItem={(itemId, event) =>
                handleDrop(itemId, event, visibleItemIds)
              }
              onDragStart={(itemId, event) =>
                handleDragStart(itemId, event, visibleItemIds)
              }
              onDragEnd={handleDragEnd}
              onDragHandlePointerDown={handleDragHandlePointerDown}
              onDragHandleClick={handleDragHandleClick}
              onMoveItem={handleAccessibleMove}
              onViewportDragOver={event =>
                handleViewportDragOver(event, {
                  isPaginatedLayout,
                  canGoPreviousPage: canGoPrevPage,
                  canGoNextPage,
                  totalPages,
                  setCurrentPage,
                })
              }
              onViewportDragLeave={handleViewportDragLeave}
              onViewportDrop={clearAutoPageSchedule}
              onPreviousPage={() =>
                setCurrentPage(previousPage =>
                  Math.max(previousPage - 1, 0)
                )
              }
              onNextPage={() =>
                setCurrentPage(previousPage =>
                  Math.min(previousPage + 1, totalPages - 1)
                )
              }
              onDeleteItem={handleDeleteItem}
            />

            {orderStatus ? (
              <p
                className={`profile-wishlist-order-status is-${orderStatus.tone}`}
                role="status"
                aria-live="polite"
              >
                {orderStatus.message}
              </p>
            ) : null}

            {hasMore ? (
              <button
                type="button"
                className="profile-secondary-button profile-wishlist-load-more"
                onClick={() => void onLoadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t('common.loading')
                  : t('profileStatus.moreGames')}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
})
