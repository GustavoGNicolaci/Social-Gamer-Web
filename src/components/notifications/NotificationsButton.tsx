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

export function NotificationsButton({ userId }: NotificationsButtonProps) {
  const { t, formatNumber } = useI18n()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const refreshUnreadCount = useCallback(async () => {
    const result = await fetchUnreadNotificationCount()
    if (!result.error) setUnreadCount(result.data)
  }, [])

  const refreshNotifications = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const [notificationsResult, unreadCountResult] = await Promise.all([
      fetchNotifications(),
      fetchUnreadNotificationCount(),
    ])

    setNotifications(notificationsResult.data)
    setUnreadCount(unreadCountResult.data)
    setErrorMessage(notificationsResult.error?.message || unreadCountResult.error?.message || null)
    setLoading(false)
  }, [])

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
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target)) setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(currentValue => {
      const nextValue = !currentValue
      if (nextValue) void refreshNotifications()
      return nextValue
    })
  }

  const handleNotificationClick = async (notification: UserNotification) => {
    setIsOpen(false)

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
        type="button"
        className="notifications-trigger"
        aria-label={
          unreadCount > 0
            ? t('notifications.openWithCount', { count: formatNumber(unreadCount) })
            : t('notifications.open')
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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
        <NotificationsDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          errorMessage={errorMessage}
          markingAllRead={markingAllRead}
          onNotificationClick={notification => void handleNotificationClick(notification)}
          onMarkAllRead={() => void handleMarkAllRead()}
        />
      ) : null}
    </div>
  )
}
