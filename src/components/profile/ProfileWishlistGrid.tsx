import type {
  CSSProperties,
  DragEvent,
  MouseEvent,
} from 'react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GameCoverImage } from '../GameCoverImage'
import { useI18n } from '../../i18n/I18nContext'
import type { WishlistGameItem } from '../../services/wishlistService'

interface ProfileWishlistGridProps {
  items: WishlistGameItem[]
  isPaginatedLayout: boolean
  currentPage: number
  canGoPreviousPage: boolean
  canGoNextPage: boolean
  columnsStyle: CSSProperties
  isOwnerView: boolean
  canReorder: boolean
  canKeyboardReorder: boolean
  firstOrderedItemId: string | null
  lastOrderedItemId: string | null
  focusItemId: string | null
  draggedItemId: string | null
  dropTargetId: string | null
  isSavingOrder: boolean
  removingItemIds: string[]
  onRegisterItem: (itemId: string, node: HTMLElement | null) => void
  onDragOverItem: (itemId: string, event: DragEvent<HTMLElement>) => void
  onDropItem: (itemId: string, event: DragEvent<HTMLElement>) => void
  onDragStart: (itemId: string, event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragHandlePointerDown: (event: MouseEvent<HTMLButtonElement>) => void
  onDragHandleClick: (event: MouseEvent<HTMLButtonElement>) => void
  onMoveItem: (itemId: string, direction: 'earlier' | 'later') => Promise<void>
  onViewportDragOver: (event: DragEvent<HTMLDivElement>) => void
  onViewportDragLeave: (event: DragEvent<HTMLDivElement>) => void
  onViewportDrop: () => void
  onPreviousPage: () => void
  onNextPage: () => void
  onDeleteItem: (itemId: string) => Promise<void>
}

function getWishlistGameInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

export function ProfileWishlistGrid({
  items,
  isPaginatedLayout,
  currentPage,
  canGoPreviousPage,
  canGoNextPage,
  columnsStyle,
  isOwnerView,
  canReorder,
  canKeyboardReorder,
  firstOrderedItemId,
  lastOrderedItemId,
  focusItemId,
  draggedItemId,
  dropTargetId,
  isSavingOrder,
  removingItemIds,
  onRegisterItem,
  onDragOverItem,
  onDropItem,
  onDragStart,
  onDragEnd,
  onDragHandlePointerDown,
  onDragHandleClick,
  onMoveItem,
  onViewportDragOver,
  onViewportDragLeave,
  onViewportDrop,
  onPreviousPage,
  onNextPage,
  onDeleteItem,
}: ProfileWishlistGridProps) {
  const { t, formatDate } = useI18n()
  const itemNodesRef = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (!focusItemId) return

    const frameId = window.requestAnimationFrame(() => {
      const card = itemNodesRef.current.get(focusItemId)
      const focusTarget =
        card?.querySelector<HTMLButtonElement>('.profile-wishlist-move-button:not(:disabled)')
        ?? card?.querySelector<HTMLAnchorElement>('.profile-wishlist-card-link')
      focusTarget?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [focusItemId, items])
  const formatWishlistDate = (value: string | null | undefined) =>
    formatDate(value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      fallback: t('profile.dateFallback'),
    })

  const cards = items.map(item => {
    const game = item.jogo
    const visibleTitle = game?.titulo || t('common.gameUnavailable')
    const isDraggedItem = draggedItemId === item.id
    const isDropTarget = dropTargetId === item.id && draggedItemId !== item.id
    const isRemovingItem = removingItemIds.includes(item.id)

    return (
      <article
        key={item.id}
        ref={node => {
          onRegisterItem(item.id, node)
          if (node) itemNodesRef.current.set(item.id, node)
          else itemNodesRef.current.delete(item.id)
        }}
        className={`profile-wishlist-card${isDraggedItem ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}${isSavingOrder ? ' is-saving-order' : ''}${isRemovingItem ? ' is-removing' : ''}`}
        onDragOver={event => onDragOverItem(item.id, event)}
        onDrop={event => {
          void onDropItem(item.id, event)
        }}
      >
        <Link to={`/games/${item.jogo_id}`} className="profile-wishlist-card-link">
          <div className="profile-wishlist-card-meta">
            <span className="profile-wishlist-date">
              {t('profileWishlist.addedAt', {
                date: formatWishlistDate(item.adicionado_em),
              })}
            </span>
          </div>

          <div className="profile-wishlist-cover">
            {game?.capa_url ? (
              <GameCoverImage
                src={game.capa_url}
                alt={t('catalog.coverAlt', { title: visibleTitle })}
                width={520}
                height={200}
                sizes={isPaginatedLayout
                  ? '(max-width: 768px) 100vw, 17vw'
                  : '(max-width: 768px) 100vw, 20vw'}
              />
            ) : (
              <div className="profile-wishlist-fallback">
                {getWishlistGameInitial(visibleTitle)}
              </div>
            )}
          </div>

          <div className="profile-wishlist-body">
            <h3>{visibleTitle}</h3>
            <span className="profile-wishlist-cta">{t('common.viewDetails')}</span>
          </div>
        </Link>

        {canKeyboardReorder ? (
          <div
            className="profile-wishlist-order-controls"
            role="group"
            aria-label={t('profileWishlist.reorderAria', { title: visibleTitle })}
          >
            <button
              type="button"
              className="profile-wishlist-move-button"
              onClick={() => void onMoveItem(item.id, 'earlier')}
              aria-label={t('profileWishlist.moveEarlier', { title: visibleTitle })}
              disabled={
                isSavingOrder ||
                isRemovingItem ||
                firstOrderedItemId === item.id
              }
            >
              <span aria-hidden="true">&larr;</span>
            </button>
            <button
              type="button"
              className="profile-wishlist-move-button"
              onClick={() => void onMoveItem(item.id, 'later')}
              aria-label={t('profileWishlist.moveLater', { title: visibleTitle })}
              disabled={
                isSavingOrder ||
                isRemovingItem ||
                lastOrderedItemId === item.id
              }
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        ) : null}

        {isOwnerView ? (
          <div className="profile-wishlist-card-actions">
            <button
              type="button"
              className="profile-secondary-button profile-item-remove-button"
              onClick={() => void onDeleteItem(item.id)}
              disabled={isSavingOrder || isRemovingItem}
            >
              {t('common.remove')}
            </button>
          </div>
        ) : null}

        {canReorder ? (
          <button
            type="button"
            className="profile-wishlist-drag-handle"
            draggable
            onMouseDown={onDragHandlePointerDown}
            onClick={onDragHandleClick}
            onDragStart={event => onDragStart(item.id, event)}
            onDragEnd={onDragEnd}
            aria-label={t('profileWishlist.reorderAria', { title: visibleTitle })}
            title={t('profileWishlist.dragTitle')}
            disabled={isSavingOrder || isRemovingItem}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="5" cy="4" r="1.1"></circle>
              <circle cx="11" cy="4" r="1.1"></circle>
              <circle cx="5" cy="8" r="1.1"></circle>
              <circle cx="11" cy="8" r="1.1"></circle>
              <circle cx="5" cy="12" r="1.1"></circle>
              <circle cx="11" cy="12" r="1.1"></circle>
            </svg>
          </button>
        ) : null}
      </article>
    )
  })

  return (
    <div
      className={`profile-wishlist-shell${isPaginatedLayout ? ' is-horizontal' : ''}`}
      style={columnsStyle}
    >
      {isPaginatedLayout && canGoPreviousPage ? (
        <button
          type="button"
          className="profile-wishlist-arrow profile-wishlist-arrow--prev"
          onClick={onPreviousPage}
          aria-label={t('profileWishlist.previousGroup')}
        >
          <span aria-hidden="true">&lsaquo;</span>
        </button>
      ) : null}

      {isPaginatedLayout ? (
        <div
          className="profile-wishlist-viewport"
          onDragOver={onViewportDragOver}
          onDragLeave={onViewportDragLeave}
          onDrop={onViewportDrop}
        >
          <div className="profile-wishlist-track">
            <div key={`wishlist-page-${currentPage}`} className="profile-wishlist-page">
              {cards}
            </div>
          </div>
        </div>
      ) : (
        <div className="profile-wishlist-grid">{cards}</div>
      )}

      {isPaginatedLayout && canGoNextPage ? (
        <button
          type="button"
          className="profile-wishlist-arrow profile-wishlist-arrow--next"
          onClick={onNextPage}
          aria-label={t('profileWishlist.nextGroup')}
        >
          <span aria-hidden="true">&rsaquo;</span>
        </button>
      ) : null}
    </div>
  )
}
