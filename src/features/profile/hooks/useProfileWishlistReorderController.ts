import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type SetStateAction,
} from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import {
  type WishlistError,
  type WishlistGameItem,
  updateWishlistPriorities,
} from '../../../services/wishlistService'

export type WishlistOrderStatusState = {
  tone: 'saving' | 'error'
  message: string
}

interface UseProfileWishlistReorderControllerParams {
  userId: string
  items: WishlistGameItem[]
  isOwnerView: boolean
  isFullyLoaded: boolean
  isPreparingReorder: boolean
  hasPendingRemoval: boolean
  onLoadFullWishlistForReorder: () => Promise<{
    ok: boolean
    message?: string
  }>
  onOrderStatusChange: (status: WishlistOrderStatusState | null) => void
}

interface WishlistPageDragContext {
  isPaginatedLayout: boolean
  canGoPreviousPage: boolean
  canGoNextPage: boolean
  totalPages: number
  setCurrentPage: Dispatch<SetStateAction<number>>
}

const DRAG_EDGE_THRESHOLD = 72
const DRAG_PAGE_ADVANCE_DELAY = 220

function getWishlistOrderErrorMessage(
  error: WishlistError | null,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!error) {
    return t('profileWishlist.orderSaveError')
  }

  const fullMessage = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return t('profileWishlist.orderPermissionError')
  }

  if (fullMessage.includes('column')) {
    return t('profileWishlist.orderStructureError')
  }

  return t('profileWishlist.orderSaveError')
}

function moveWishlistItem(
  items: WishlistGameItem[],
  sourceIndex: number,
  targetIndex: number
) {
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

export function useProfileWishlistReorderController({
  userId,
  items,
  isOwnerView,
  isFullyLoaded,
  isPreparingReorder,
  hasPendingRemoval,
  onLoadFullWishlistForReorder,
  onOrderStatusChange,
}: UseProfileWishlistReorderControllerParams) {
  const { t } = useI18n()
  const [orderedItemIds, setOrderedItemIds] = useState<string[] | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [hasFinePointer, setHasFinePointer] = useState(false)
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
  const canReorder =
    isOwnerView &&
    isFullyLoaded &&
    orderedItems.length > 1 &&
    hasFinePointer &&
    !isSavingOrder &&
    !hasPendingRemoval
  const canPrepareReorder =
    isOwnerView &&
    !isFullyLoaded &&
    hasFinePointer &&
    orderedItems.length > 1 &&
    !isPreparingReorder

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

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

  const registerItem = (itemId: string, node: HTMLElement | null) => {
    if (node) {
      itemRefs.current.set(itemId, node)
      return
    }

    itemRefs.current.delete(itemId)
  }

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

  const scheduleAutoPageAdvance = (
    direction: 'previous' | 'next',
    totalPages: number,
    setCurrentPage: Dispatch<SetStateAction<number>>
  ) => {
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

  const handleDragStart = (
    itemId: string,
    event: DragEvent<HTMLButtonElement>,
    visibleItemIds: Set<string>
  ) => {
    if (!canReorder) return
    if (!visibleItemIds.has(itemId)) return

    const cardNode = itemRefs.current.get(itemId)

    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)

    if (cardNode) {
      event.dataTransfer.setDragImage(
        cardNode,
        Math.min(cardNode.clientWidth / 2, 72),
        28
      )
    }

    onOrderStatusChange(null)
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

  const handleDragOver = (
    targetItemId: string,
    event: DragEvent<HTMLElement>,
    visibleItemIds: Set<string>
  ) => {
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

  const handleViewportDragOver = (
    event: DragEvent<HTMLDivElement>,
    {
      isPaginatedLayout,
      canGoPreviousPage,
      canGoNextPage,
      totalPages,
      setCurrentPage,
    }: WishlistPageDragContext
  ) => {
    if (!isPaginatedLayout || !draggedItemId || isSavingOrder) return

    event.preventDefault()

    const viewportBounds = event.currentTarget.getBoundingClientRect()
    const leftDistance = event.clientX - viewportBounds.left
    const rightDistance = viewportBounds.right - event.clientX
    const threshold = Math.min(
      DRAG_EDGE_THRESHOLD,
      viewportBounds.width * 0.18
    )

    if (leftDistance <= threshold && canGoPreviousPage) {
      scheduleAutoPageAdvance('previous', totalPages, setCurrentPage)
      return
    }

    if (rightDistance <= threshold && canGoNextPage) {
      scheduleAutoPageAdvance('next', totalPages, setCurrentPage)
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

  const handleDrop = async (
    targetItemId: string,
    event: DragEvent<HTMLElement>,
    visibleItemIds: Set<string>
  ) => {
    event.preventDefault()

    if (!draggedItemId || draggedItemId === targetItemId || isSavingOrder) {
      handleDragEnd()
      return
    }

    if (!visibleItemIds.has(targetItemId)) {
      handleDragEnd()
      return
    }

    const sourceIndex = orderedItems.findIndex(
      item => item.id === draggedItemId
    )
    const targetIndex = orderedItems.findIndex(item => item.id === targetItemId)

    if (sourceIndex < 0 || targetIndex < 0) {
      handleDragEnd()
      return
    }

    const previousItems = orderedItems
    const reorderedItems = assignSequentialPriorities(
      moveWishlistItem(orderedItems, sourceIndex, targetIndex)
    )

    snapshotItemRects()
    setOrderedItemIds(reorderedItems.map(item => item.id))
    handleDragEnd()
    setIsSavingOrder(true)
    onOrderStatusChange({
      tone: 'saving',
      message: t('profileWishlist.savingOrder'),
    })

    const { error } = await updateWishlistPriorities(userId, reorderedItems)

    if (error) {
      snapshotItemRects()
      setOrderedItemIds(previousItems.map(item => item.id))
      onOrderStatusChange({
        tone: 'error',
        message: getWishlistOrderErrorMessage(error, t),
      })
    } else {
      onOrderStatusChange(null)
    }

    setIsSavingOrder(false)
  }

  const handlePrepareReorder = async () => {
    onOrderStatusChange({
      tone: 'saving',
      message: t('profileWishlist.loadingFull'),
    })

    const result = await onLoadFullWishlistForReorder()

    if (result.ok) {
      onOrderStatusChange(null)
      return
    }

    onOrderStatusChange({
      tone: 'error',
      message: result.message || t('profileWishlist.prepareError'),
    })
  }

  const resetInteraction = () => {
    handleDragEnd()
  }

  return {
    canPrepareReorder,
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
    handlePrepareReorder,
    handleViewportDragLeave,
    handleViewportDragOver,
    isSavingOrder,
    orderedItems,
    registerItem,
    resetInteraction,
  }
}
