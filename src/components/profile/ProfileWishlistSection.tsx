import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MutableRefObject,
  type MouseEvent,
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
  onDeleteWishlistItem: (itemId: string) => Promise<{ ok: boolean; message?: string }>
}

const HORIZONTAL_LAYOUT_THRESHOLD = 6
const DRAG_EDGE_THRESHOLD = 72
const DRAG_PAGE_ADVANCE_DELAY = 220

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

function getWishlistOrderErrorMessage(error: WishlistError | null) {
  if (!error) {
    return 'Nao foi possivel salvar a nova ordem dos jogos que voce quer jogar agora.'
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

  return 'Nao foi possivel salvar a nova ordem dos jogos que voce quer jogar agora.'
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
  onDeleteWishlistItem,
}: ProfileWishlistSectionProps) {
  const [orderedItemIds, setOrderedItemIds] = useState<string[] | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatusState | null>(null)
  const [hasFinePointer, setHasFinePointer] = useState(false)
  const [removingItemIds, setRemovingItemIds] = useState<string[]>([])
  const [itemsPerPage, setItemsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : getItemsPerPage(window.innerWidth)
  )
  const [currentPage, setCurrentPage] = useState(0)

  const itemRefs = useRef(new Map<string, HTMLElement>())
  const layoutSnapshotRef = useRef(new Map<string, DOMRect>())
  const shouldAnimateLayoutRef = useRef(false)
  const dragAutoPageTimeoutRef = useRef<number | null>(null)
  const dragAutoPageDirectionRef = useRef<'previous' | 'next' | null>(null)

  const orderedItems = useMemo(() => {
    if (!orderedItemIds) return items

    const itemsById = new Map(items.map(item => [item.id, item]))
    const orderedFromState = orderedItemIds.flatMap(itemId => {
      const item = itemsById.get(itemId)
      return item ? [item] : []
    })
    const orderedIdSet = new Set(orderedItemIds)
    const missingItems = items.filter(item => !orderedIdSet.has(item.id))

    return [...orderedFromState, ...missingItems]
  }, [items, orderedItemIds])

  const hasWishlistItems = orderedItems.length > 0
  const isPaginatedLayout = orderedItems.length > HORIZONTAL_LAYOUT_THRESHOLD
  const hasPendingRemoval = removingItemIds.length > 0
  const canReorder =
    isOwnerView && orderedItems.length > 1 && hasFinePointer && !isSavingOrder && !hasPendingRemoval
  const pagedItems = isPaginatedLayout ? chunkWishlistItems(orderedItems, itemsPerPage) : []
  const totalPages = isPaginatedLayout ? pagedItems.length : 1
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages - 1, 0))
  const visiblePageItems = isPaginatedLayout ? pagedItems[safeCurrentPage] || [] : orderedItems
  const visibleItemIds = new Set(visiblePageItems.map(item => item.id))
  const canGoPrevPage = isPaginatedLayout && safeCurrentPage > 0
  const canGoNextPage = isPaginatedLayout && safeCurrentPage < totalPages - 1

  const wishlistColumnsStyle = {
    '--wishlist-columns': String(itemsPerPage),
  } as CSSProperties

  const paginatedTrackStyle = {
    transform: `translateX(-${safeCurrentPage * 100}%)`,
  }

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

  useEffect(() => {
    return () => {
      if (dragAutoPageTimeoutRef.current !== null) {
        window.clearTimeout(dragAutoPageTimeoutRef.current)
      }
    }
  }, [])

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

  const clearAutoPageSchedule = () => {
    if (dragAutoPageTimeoutRef.current !== null) {
      window.clearTimeout(dragAutoPageTimeoutRef.current)
      dragAutoPageTimeoutRef.current = null
    }

    dragAutoPageDirectionRef.current = null
  }

  const scheduleAutoPageAdvance = (direction: 'previous' | 'next') => {
    if (dragAutoPageDirectionRef.current === direction) return

    clearAutoPageSchedule()
    dragAutoPageDirectionRef.current = direction
    dragAutoPageTimeoutRef.current = window.setTimeout(() => {
      setCurrentPage(previousPage => {
        if (direction === 'previous') {
          return Math.max(previousPage - 1, 0)
        }

        return Math.min(previousPage + 1, totalPages - 1)
      })

      dragAutoPageTimeoutRef.current = null
      dragAutoPageDirectionRef.current = null
    }, DRAG_PAGE_ADVANCE_DELAY)
  }

  const handleDragStart = (itemId: string, event: DragEvent<HTMLButtonElement>) => {
    if (!canReorder) return
    if (!visibleItemIds.has(itemId)) return

    const cardNode = itemRefs.current.get(itemId)

    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)

    if (cardNode) {
      event.dataTransfer.setDragImage(cardNode, Math.min(cardNode.clientWidth / 2, 72), 28)
    }

    setOrderStatus(null)
    setDraggedItemId(itemId)
    setDropTargetId(null)
  }

  const handleDragHandlePointerDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const handleDragHandleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragOver = (targetItemId: string, event: DragEvent<HTMLElement>) => {
    if (!draggedItemId || draggedItemId === targetItemId || isSavingOrder) return
    if (!visibleItemIds.has(targetItemId)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (dropTargetId !== targetItemId) {
      setDropTargetId(targetItemId)
    }
  }

  const handleDragEnd = () => {
    clearAutoPageSchedule()
    setDraggedItemId(null)
    setDropTargetId(null)
  }

  const handleViewportDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isPaginatedLayout || !draggedItemId || isSavingOrder) return

    event.preventDefault()

    const viewportBounds = event.currentTarget.getBoundingClientRect()
    const leftDistance = event.clientX - viewportBounds.left
    const rightDistance = viewportBounds.right - event.clientX
    const threshold = Math.min(DRAG_EDGE_THRESHOLD, viewportBounds.width * 0.18)

    if (leftDistance <= threshold && canGoPrevPage) {
      scheduleAutoPageAdvance('previous')
      return
    }

    if (rightDistance <= threshold && canGoNextPage) {
      scheduleAutoPageAdvance('next')
      return
    }

    clearAutoPageSchedule()
  }

  const handleViewportDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return
    }

    clearAutoPageSchedule()
  }

  const handleDrop = async (targetItemId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault()

    if (!draggedItemId || draggedItemId === targetItemId || isSavingOrder) {
      clearAutoPageSchedule()
      setDraggedItemId(null)
      setDropTargetId(null)
      return
    }

    if (!visibleItemIds.has(targetItemId)) {
      clearAutoPageSchedule()
      setDraggedItemId(null)
      setDropTargetId(null)
      return
    }

    const sourceIndex = orderedItems.findIndex(item => item.id === draggedItemId)
    const targetIndex = orderedItems.findIndex(item => item.id === targetItemId)

    if (sourceIndex < 0 || targetIndex < 0) {
      clearAutoPageSchedule()
      setDraggedItemId(null)
      setDropTargetId(null)
      return
    }

    const previousItems = orderedItems
    const reorderedItems = assignSequentialPriorities(
      moveWishlistItem(orderedItems, sourceIndex, targetIndex)
    )

    snapshotItemRects()
    setOrderedItemIds(reorderedItems.map(item => item.id))
    clearAutoPageSchedule()
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
      setOrderedItemIds(previousItems.map(item => item.id))
      setOrderStatus({
        tone: 'error',
        message: getWishlistOrderErrorMessage(error),
      })
    } else {
      setOrderStatus(null)
    }

    setIsSavingOrder(false)
  }

  const handleDeleteItem = async (itemId: string) => {
    setOrderStatus(null)
    setDraggedItemId(null)
    setDropTargetId(null)
    clearAutoPageSchedule()
    setRemovingItemIds(currentIds =>
      currentIds.includes(itemId) ? currentIds : [...currentIds, itemId]
    )

    const result = await onDeleteWishlistItem(itemId)

    setRemovingItemIds(currentIds => currentIds.filter(currentId => currentId !== itemId))

    if (!result.ok) {
      setOrderStatus({
        tone: 'error',
        message: result.message || 'Nao foi possivel remover este jogo da lista agora.',
      })
    }
  }

  return (
    <section className="profile-card profile-wishlist-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-wishlist-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">Jogos que quero jogar</span>
            <h2>Jogos que quero jogar</h2>
            <p>
              {isOwnerView
                ? 'Guarde aqui os titulos que voce quer explorar nas proximas jogatinas.'
                : 'Veja quais titulos este perfil salvou para jogar em outro momento.'}
            </p>
          </div>

          <div className="profile-meta-item profile-wishlist-summary">
            <span>Total salvo</span>
            <strong>{isLoading ? '...' : countLabel}</strong>
          </div>
        </div>

        {isLoading ? (
          <div className="profile-wishlist-empty">
            <h3>
              {isOwnerView
                ? 'Carregando seus jogos para jogar'
                : 'Carregando jogos para jogar deste perfil'}
            </h3>
            <p>
              {isOwnerView
                ? 'Estamos buscando os jogos que voce salvou para jogar depois.'
                : 'Estamos buscando os jogos que este perfil salvou para jogar depois.'}
            </p>
          </div>
        ) : errorMessage ? (
          <p className="profile-feedback is-error">{errorMessage}</p>
        ) : !hasWishlistItems ? (
          <div className="profile-wishlist-empty">
            <h3>
              {isOwnerView
                ? 'Voce ainda nao salvou jogos para jogar'
                : 'Este perfil ainda nao salvou jogos para jogar'}
            </h3>
            <p>
              {isOwnerView
                ? 'Quando voce salvar um jogo, ele vai aparecer aqui com acesso rapido ao catalogo.'
                : 'Quando este usuario salvar jogos para jogar, eles vao aparecer aqui.'}
            </p>
            {isOwnerView ? (
              <Link to="/games" className="profile-secondary-button profile-wishlist-link">
                Explorar jogos
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div
              className={`profile-wishlist-shell${isPaginatedLayout ? ' is-horizontal' : ''}`}
              style={wishlistColumnsStyle}
            >
              {isPaginatedLayout && canGoPrevPage ? (
                <button
                  type="button"
                  className="profile-wishlist-arrow profile-wishlist-arrow--prev"
                  onClick={() => setCurrentPage(previousPage => Math.max(previousPage - 1, 0))}
                  aria-label="Mostrar grupo anterior da lista de jogos para jogar"
                >
                  <span aria-hidden="true">&lsaquo;</span>
                </button>
              ) : null}

              {isPaginatedLayout ? (
                <div
                  className="profile-wishlist-viewport"
                  onDragOver={handleViewportDragOver}
                  onDragLeave={handleViewportDragLeave}
                  onDrop={() => {
                    clearAutoPageSchedule()
                  }}
                >
                  <div className="profile-wishlist-track" style={paginatedTrackStyle}>
                    {pagedItems.map((pageItems, pageIndex) => (
                      <div key={`wishlist-page-${pageIndex}`} className="profile-wishlist-page">
                        {pageItems.map(item => {
                          const game = item.jogo
                          const visibleTitle = game?.titulo || 'Jogo indisponivel'
                          const isDraggedItem = draggedItemId === item.id
                          const isDropTarget = dropTargetId === item.id && draggedItemId !== item.id
                          const isRemovingItem = removingItemIds.includes(item.id)
                          const canShowDragHandle = canReorder && visibleItemIds.has(item.id)

                          return (
                            <article
                              key={item.id}
                              ref={node => {
                                registerItemRef(itemRefs, item.id, node)
                              }}
                              className={`profile-wishlist-card${isDraggedItem ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}${isSavingOrder ? ' is-saving-order' : ''}${isRemovingItem ? ' is-removing' : ''}`}
                              onDragOver={event => handleDragOver(item.id, event)}
                              onDrop={event => {
                                void handleDrop(item.id, event)
                              }}
                            >
                              <Link to={`/games/${item.jogo_id}`} className="profile-wishlist-card-link">
                                <div className="profile-wishlist-card-meta">
                                  <span className="profile-wishlist-date">
                                    Adicionado em {formatCompactDate(item.adicionado_em)}
                                  </span>
                                </div>

                                <div className="profile-wishlist-cover">
                                  {game?.capa_url ? (
                                    <img src={game.capa_url} alt={`Capa do jogo ${visibleTitle}`} />
                                  ) : (
                                    <div className="profile-wishlist-fallback">
                                      {getInitial(visibleTitle)}
                                    </div>
                                  )}
                                </div>

                                <div className="profile-wishlist-body">
                                  <h3>{visibleTitle}</h3>
                                  <span className="profile-wishlist-cta">Ver detalhes</span>
                                </div>
                              </Link>

                              {isOwnerView ? (
                                <div className="profile-wishlist-card-actions">
                                  <button
                                    type="button"
                                    className="profile-secondary-button profile-item-remove-button"
                                    onClick={() => void handleDeleteItem(item.id)}
                                    disabled={isSavingOrder || isRemovingItem}
                                  >
                                    Remover
                                  </button>
                                </div>
                              ) : null}

                              {canShowDragHandle ? (
                                <button
                                  type="button"
                                  className="profile-wishlist-drag-handle"
                                  draggable
                                  onMouseDown={handleDragHandlePointerDown}
                                  onClick={handleDragHandleClick}
                                  onDragStart={event => handleDragStart(item.id, event)}
                                  onDragEnd={handleDragEnd}
                                  aria-label={`Reordenar ${visibleTitle}`}
                                  title="Arraste para reorganizar"
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
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="profile-wishlist-grid">
                  {orderedItems.map(item => {
                    const game = item.jogo
                    const visibleTitle = game?.titulo || 'Jogo indisponivel'
                    const isDraggedItem = draggedItemId === item.id
                    const isDropTarget = dropTargetId === item.id && draggedItemId !== item.id
                    const isRemovingItem = removingItemIds.includes(item.id)

                    return (
                      <article
                        key={item.id}
                        ref={node => {
                          registerItemRef(itemRefs, item.id, node)
                        }}
                        className={`profile-wishlist-card${isDraggedItem ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}${isSavingOrder ? ' is-saving-order' : ''}${isRemovingItem ? ' is-removing' : ''}`}
                        onDragOver={event => handleDragOver(item.id, event)}
                        onDrop={event => {
                          void handleDrop(item.id, event)
                        }}
                      >
                        <Link to={`/games/${item.jogo_id}`} className="profile-wishlist-card-link">
                          <div className="profile-wishlist-card-meta">
                            <span className="profile-wishlist-date">
                              Adicionado em {formatCompactDate(item.adicionado_em)}
                            </span>
                          </div>

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

                      {isOwnerView ? (
                        <div className="profile-wishlist-card-actions">
                          <button
                            type="button"
                            className="profile-secondary-button profile-item-remove-button"
                            onClick={() => void handleDeleteItem(item.id)}
                            disabled={isSavingOrder || isRemovingItem}
                          >
                            Remover
                          </button>
                        </div>
                      ) : null}

                      {canReorder ? (
                        <button
                          type="button"
                          className="profile-wishlist-drag-handle"
                            draggable
                            onMouseDown={handleDragHandlePointerDown}
                          onClick={handleDragHandleClick}
                          onDragStart={event => handleDragStart(item.id, event)}
                          onDragEnd={handleDragEnd}
                          aria-label={`Reordenar ${visibleTitle}`}
                          title="Arraste para reorganizar"
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
                  })}
                </div>
              )}

              {isPaginatedLayout && canGoNextPage ? (
                <button
                  type="button"
                  className="profile-wishlist-arrow profile-wishlist-arrow--next"
                  onClick={() =>
                    setCurrentPage(previousPage => Math.min(previousPage + 1, totalPages - 1))
                  }
                  aria-label="Mostrar proximo grupo da lista de jogos para jogar"
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
