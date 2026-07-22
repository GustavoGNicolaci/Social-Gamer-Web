import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

interface DialogShellProps {
  open: boolean
  onClose: () => void
  titleId: string
  descriptionId?: string
  children: ReactNode
  className?: string
  backdropClassName?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  closeOnBackdrop?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function DialogShell({
  open,
  onClose,
  titleId,
  descriptionId,
  children,
  className = '',
  backdropClassName = '',
  initialFocusRef,
  closeOnBackdrop = true,
}: DialogShellProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      const focusTarget = initialFocusRef?.current
        || dialogRef.current?.querySelector<HTMLElement>('[data-dialog-autofocus]:not([disabled])')
        || dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        || dialogRef.current
      focusTarget?.focus()
    })

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (
        !dialogRef.current.contains(document.activeElement) ||
        !focusable.includes(document.activeElement as HTMLElement)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [initialFocusRef, open])

  if (!open) return null

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current()
  }

  return createPortal(
    <div
      className={`ui-dialog-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`}
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        className={`ui-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
