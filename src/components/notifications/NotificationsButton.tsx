import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nContext'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type UserNotification,
} from '../../services/notificationService'
import { NotificationsDropdown } from './NotificationsDropdown'
import './NotificationsButton.css'

interface NotificationsButtonProps {
  userId: string
}

function getIsMobileNotificationsSheet() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 640px)').matches
}

export function NotificationsButton({ userId }: NotificationsButtonProps) {
  const { t, formatNumber } = useI18n()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [isMobileSheet, setIsMobileSheet] = useState(getIsMobileNotificationsSheet)

  const refreshUnreadCount = useCallback(async () => {
    const result = await fetchUnreadNotificationCount(userId)
    if (!result.error) setUnreadCount(result.data)
  }, [userId])

  const refreshNotifications = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const [notificationsResult, unreadCountResult] = await Promise.all([
      fetchNotifications(userId),
      fetchUnreadNotificationCount(userId),
    ])

    setNotifications(currentNotifications =>
      notificationsResult.error ? currentNotifications : notificationsResult.data
    )
    if (!unreadCountResult.error) setUnreadCount(unreadCountResult.data)
    setErrorMessage(notificationsResult.error?.message || unreadCountResult.error?.message || null)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const initTimeoutId = window.setTimeout(() => {
      setNotifications([])
      setUnreadCount(0)
      setErrorMessage(null)
      if (userId) void refreshNotifications()
    }, 0)

    if (!userId) {
      return () => window.clearTimeout(initTimeoutId)
    }

    const unsubscribe = subscribeToNotifications(userId, () => {
      void refreshNotifications()
    })

    return () => {
      window.clearTimeout(initTimeoutId)
      unsubscribe()
    }
  }, [refreshNotifications, userId])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const syncSheetMode = () => setIsMobileSheet(mediaQuery.matches)

    syncSheetMode()
    mediaQuery.addEventListener('change', syncSheetMode)
    return () => mediaQuery.removeEventListener('change', syncSheetMode)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const triggerElement = triggerRef.current
    const focusFrame = window.requestAnimationFrame(() => panelRef.current?.focus())

    if (isMobileSheet) document.body.style.overflow = 'hidden'

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target)) {
        shouldRestoreFocusRef.current = false
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        shouldRestoreFocusRef.current = true
        setIsOpen(false)
        return
      }

      if (!isMobileSheet || event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      )

      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      if (isMobileSheet) document.body.style.overflow = previousOverflow
      if (shouldRestoreFocusRef.current) triggerElement?.focus({ preventScroll: true })
      shouldRestoreFocusRef.current = false
    }
  }, [isMobileSheet, isOpen])

  const closePanel = (restoreFocus = true) => {
    shouldRestoreFocusRef.current = restoreFocus
    setIsOpen(false)
  }

  const handleToggle = () => {
    setIsOpen(currentValue => {
      const nextValue = !currentValue
      shouldRestoreFocusRef.current = currentValue
      if (nextValue) void refreshNotifications()
      return nextValue
    })
  }

  const handleNotificationClick = async (notification: UserNotification) => {
    closePanel(!notification.link)

    if (!notification.is_read) {
      setNotifications(currentNotifications =>
        currentNotifications.map(currentNotification =>
          currentNotification.id === notification.id
            ? { ...currentNotification, is_read: true, read_at: new Date().toISOString() }
            : currentNotification
        )
      )
      setUnreadCount(currentCount => Math.max(currentCount - 1, 0))
      const result = await markNotificationRead(notification.id)
      if (result.error) void refreshUnreadCount()
    }

    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAllRead) return

    setMarkingAllRead(true)
    setNotifications(currentNotifications =>
      currentNotifications.map(notification => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at || new Date().toISOString(),
      }))
    )
    setUnreadCount(0)

    const result = await markAllNotificationsRead()
    if (result.error) {
      setErrorMessage(result.error.message)
      await refreshNotifications()
    }

    setMarkingAllRead(false)
  }

  const badgeLabel = unreadCount > 99 ? '99+' : formatNumber(unreadCount)

  return (
    <div ref={rootRef} className={`notifications-root${isOpen ? ' is-open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="notifications-trigger"
        aria-label={
          unreadCount > 0
            ? t('notifications.openWithCount', { count: formatNumber(unreadCount) })
            : t('notifications.open')
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="notifications-panel"
        onClick={handleToggle}
      >
        <Bell />
        {unreadCount > 0 ? (
          <span className="notifications-badge" aria-hidden="true">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          {isMobileSheet ? (
            <button
              type="button"
              className="notifications-sheet-backdrop"
              onClick={() => closePanel()}
              aria-label={t('common.close')}
            />
          ) : null}
          <NotificationsDropdown
            containerRef={panelRef}
            notifications={notifications}
            unreadCount={unreadCount}
            loading={loading}
            errorMessage={errorMessage}
            markingAllRead={markingAllRead}
            isModal={isMobileSheet}
            onNotificationClick={notification => void handleNotificationClick(notification)}
            onMarkAllRead={() => void handleMarkAllRead()}
            onClose={() => closePanel()}
          />
        </>
      ) : null}
    </div>
  )
}
