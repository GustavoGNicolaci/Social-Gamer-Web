import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type MutableRefObject,
} from 'react'
import { Link } from 'react-router-dom'
import {
  type WishlistError,
  type WishlistGameItem,
  updateWishlistPriorities,
} from '../../services/wishlistService'
import './ProfileWishlistSection.css'

type OrderStatusTone = 'saving' | 'error'

interface OrderStatusState {
  tone: OrderStatusTone
  message: string
}

interface ProfileWishlistSectionProps {
  userId: string
  items: WishlistGameItem[]
  isLoading: boolean
  errorMessage: string | null
  countLabel: string
  isOwnerView: boolean
}

const HORIZONTAL_LAYOUT_THRESHOLD = 7

function formatCompactDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'J'
}

function getWishlistOrderErrorMessage(error: WishlistError | null) {
  if (!error) {
    return 'Nao foi possivel salvar a nova ordem da sua lista agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel salvar a nova ordem por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return 'Nao foi possivel salvar a ordem porque a estrutura da tabela lista_desejos nao corresponde ao frontend.'
  }

  return 'Nao foi possivel salvar a nova ordem da sua lista agora.'
}

function moveWishlistItem(items: WishlistGameItem[], sourceIndex: number, targetIndex: number) {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(sourceIndex, 1)

  nextItems.splice(targetIndex, 0, movedItem)
  return nextItems
}

function assignSequentialPriorities(items: WishlistGameItem[]) {
  return items.map((item, index) => ({
    ...item,
    prioridade: index + 1,
  }))
}

function registerItemRef(
  itemRefs: MutableRefObject<Map<string, HTMLElement>>,
  itemId: string,
  node: HTMLElement | null
) {
  if (node) {
    itemRefs.current.set(itemId, node)
    return
  }

  itemRefs.current.delete(itemId)
}

export function ProfileWishlistSection({
  userId,
  items,
  isLoading,
  errorMessage,
  countLabel,
  isOwnerView,
}: ProfileWishlistSectionProps) {
  const [orderedItems, setOrderedItems] = useState<WishlistGameItem[]>(items)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatusState | null>(null)
  const [hasFinePointer, setHasFinePointer] = useState(false)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const railRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const layoutSnapshotRef = useRef(new Map<string, DOMRect>())
  const shouldAnimateLayoutRef = useRef(false)

  const hasWishlistItems = orderedItems.length > 0
  const isHorizontalLayout = orderedItems.length > HORIZONTAL_LAYOUT_THRESHOLD
  const canReorder = isOwnerView && orderedItems.length > 1 && hasFinePointer && !isSavingOrder

  useEffect(() => {
    setOrderedItems(items)
    setDraggedItemId(null)
    setDropTargetId(null)
    setIsSavingOrder(false)
    setOrderStatus(null)
  }, [items])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const pointerMedia = window.matchMedia('(pointer: fine)')
    const syncPointerType = () => {
      setHasFinePointer(pointerMedia.matches)
    }

    syncPointerType()
    pointerMedia.addEventListener('change', syncPointerType)

    return () => {
      pointerMedia.removeEventListener('change', syncPointerType)
    }
  }, [])

  useEffect(() => {
    if (!isHorizontalLayout) {
      setCanScrollPrev(false)
      setCanScrollNext(false)
      return
    }

    const rail = railRef.current
    if (!rail) return

    const syncRailNavigation = () => {
      const maxScrollLeft = Math.max(rail.scrollWidth - rail.clientWidth, 0)
      const tolerance = 6

      setCanScrollPrev(rail.scrollLeft > tolerance)
      setCanScrollNext(rail.scrollLeft < maxScrollLeft - tolerance)
    }

    syncRailNavigation()

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncRailNavigation)

    resizeObserver?.observe(rail)
    rail.addEventListener('scroll', syncRailNavigation, { passive: true })
    window.addEventListener('resize', syncRailNavigation)

    return () => {
      resizeObserver?.disconnect()
      rail.removeEventListener('scroll', syncRailNavigation)
      window.removeEventListener('resize', syncRailNavigation)
    }
  }, [isHorizontalLayout, orderedItems])

  useLayoutEffect(() => {
    if (!shouldAnimateLayoutRef.current) return

    const previousRects = layoutSnapshotRef.current

    orderedItems.forEach(item => {
      const node = itemRefs.current.get(item.id)
      const previousRect = previousRects.get(item.id)

      if (!node || !previousRect) return

      const nextRect = node.getBoundingClientRect()
      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return
      if (typeof node.animate !== 'function') return

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 220,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      )
    })

    shouldAnimateLayoutRef.current = false
    layoutSnapshotRef.current = new Map()
  }, [orderedItems])

  const snapshotItemRects = () => {
    const nextSnapshot = new Map<string, DOMRect>()

    itemRefs.current.forEach((node, itemId) => {
      nextSnapshot.set(itemId, node.getBoundingClientRect())
    })

    layoutSnapshotRef.current = nextSnapshot
    shouldAnimateLayoutRef.current = true
  }

  const handleScrollRail = (direction: 'previous' | 'next') => {
    const rail = railRef.current
    if (!rail) return

    const scrollOffset = rail.clientWidth * 0.85

    rail.scrollBy({
      left: direction === 'next' ? scrollOffset : -scrollOffset,
      behavior: 'smooth',
    })
  }

  const handleDragStart = (itemId: string, event: DragEvent<HTMLButtonElement>) => {
    if (!canReorder) return

    const cardNode = itemRefs.current.get(itemId)

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)

    if (cardNode) {
      event.dataTransfer.setDragImage(cardNode, Math.min(cardNode.clientWidth / 2, 72), 28)
    }

    setOrderStatus(null)
    setDraggedItemId(itemId)
    setDropTargetId(null)
  }

  const handleDragOver = (targetItemId: string, event: DragEvent<HTMLElement>) => {
    if (!draggedItemId || draggedItemId === targetItemId || isSavingOrder) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dropTargetId !== targetItemId) {
      setDropTargetId(targetItemId)
    }
  }

  const handleDragEnd = () => {
    setDraggedItemId(null)
    setDropTargetId(null)
  }

  const handleDrop = async (targetItemId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault()

    if (!draggedItemId || draggedItemId === targetItemId || isSavingOrder) {
      setDraggedItemId(null)
      setDropTargetId(null)
      return
    }

    const sourceIndex = orderedItems.findIndex(item => item.id === draggedItemId)
    const targetIndex = orderedItems.findIndex(item => item.id === targetItemId)

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedItemId(null)
      setDropTargetId(null)
      return
    }

    const previousItems = orderedItems
    const reorderedItems = assignSequentialPriorities(
      moveWishlistItem(orderedItems, sourceIndex, targetIndex)
    )

    snapshotItemRects()
    setOrderedItems(reorderedItems)
    setDraggedItemId(null)
    setDropTargetId(null)
    setIsSavingOrder(true)
    setOrderStatus({
      tone: 'saving',
      message: 'Salvando nova ordem...',
    })

    const { error } = await updateWishlistPriorities(userId, reorderedItems)

    if (error) {
      snapshotItemRects()
      setOrderedItems(previousItems)
      setOrderStatus({
        tone: 'error',
        message: getWishlistOrderErrorMessage(error),
      })
    } else {
      setOrderStatus(null)
    }

    setIsSavingOrder(false)
  }

  return (
    <section className="profile-card profile-wishlist-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-wishlist-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">Wishlist</span>
            <h2>Jogos que quero jogar futuramente</h2>
            <p>Guarde aqui os titulos que voce quer explorar nas proximas jogatinas.</p>
          </div>

          <div className="profile-meta-item profile-wishlist-summary">
            <span>Total salvo</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        {isLoading ? (
          <div className="profile-wishlist-empty">
            <h3>Carregando sua lista</h3>
            <p>Estamos buscando os jogos que voce marcou para jogar futuramente.</p>
          </div>
        ) : errorMessage ? (
          <p className="profile-feedback is-error">{errorMessage}</p>
        ) : !hasWishlistItems ? (
          <div className="profile-wishlist-empty">
            <h3>Sua lista de desejos ainda esta vazia</h3>
            <p>Quando voce salvar um jogo, ele vai aparecer aqui com acesso rapido ao catalogo.</p>
            <Link to="/games" className="profile-secondary-button profile-wishlist-link">
              Explorar jogos
            </Link>
          </div>
        ) : (
          <>
            <div className={`profile-wishlist-shell${isHorizontalLayout ? ' is-horizontal' : ''}`}>
              {isHorizontalLayout && canScrollPrev ? (
                <button
                  type="button"
                  className="profile-wishlist-arrow profile-wishlist-arrow--prev"
                  onClick={() => handleScrollRail('previous')}
                  aria-label="Rolar wishlist para a esquerda"
                >
                  <span aria-hidden="true">&lsaquo;</span>
                </button>
              ) : null}

              <div
                ref={railRef}
                className={isHorizontalLayout ? 'profile-wishlist-rail is-horizontal' : 'profile-wishlist-grid'}
              >
                {orderedItems.map(item => {
                  const game = item.jogo
                  const visibleTitle = game?.titulo || 'Jogo indisponivel'
                  const isDraggedItem = draggedItemId === item.id
                  const isDropTarget = dropTargetId === item.id && draggedItemId !== item.id

                  return (
                    <article
                      key={item.id}
                      ref={node => {
                        registerItemRef(itemRefs, item.id, node)
                      }}
                      className={`profile-wishlist-card${isDraggedItem ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}${isSavingOrder ? ' is-saving-order' : ''}`}
                      onDragOver={event => handleDragOver(item.id, event)}
                      onDrop={event => {
                        void handleDrop(item.id, event)
                      }}
                    >
                      <div className="profile-wishlist-card-meta">
                        <span className="profile-wishlist-date">
                          Adicionado em {formatCompactDate(item.adicionado_em)}
                        </span>

                        {canReorder ? (
                          <button
                            type="button"
                            className="profile-wishlist-drag-handle"
                            draggable
                            onDragStart={event => handleDragStart(item.id, event)}
                            onDragEnd={handleDragEnd}
                            aria-label={`Reordenar ${visibleTitle}`}
                            title="Arraste para reorganizar"
                            disabled={isSavingOrder}
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
                      </div>

                      <Link to={`/games/${item.jogo_id}`} className="profile-wishlist-card-link">
                        <div className="profile-wishlist-cover">
                          {game?.capa_url ? (
                            <img src={game.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
                          ) : (
                            <div className="profile-wishlist-fallback">{getInitial(visibleTitle)}</div>
                          )}
                        </div>

                        <div className="profile-wishlist-body">
                          <h3>{visibleTitle}</h3>
                          <span className="profile-wishlist-cta">Ver detalhes</span>
                        </div>
                      </Link>
                    </article>
                  )
                })}
              </div>

              {isHorizontalLayout && canScrollNext ? (
                <button
                  type="button"
                  className="profile-wishlist-arrow profile-wishlist-arrow--next"
                  onClick={() => handleScrollRail('next')}
                  aria-label="Rolar wishlist para a direita"
                >
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              ) : null}
            </div>

            {orderStatus ? (
              <p className={`profile-wishlist-order-status is-${orderStatus.tone}`}>
                {orderStatus.message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
