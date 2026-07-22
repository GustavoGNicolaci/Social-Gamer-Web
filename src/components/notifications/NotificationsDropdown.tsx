import type { RefObject } from 'react'
import { CheckCheck, Loader2 } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import type { UserNotification } from '../../services/notificationService'
import { NotificationItem } from './NotificationItem'

interface NotificationsDropdownProps {
  containerRef: RefObject<HTMLDivElement | null>
  notifications: UserNotification[]
  unreadCount: number
  loading: boolean
  errorMessage: string | null
  markingAllRead: boolean
  isModal?: boolean
  onNotificationClick: (notification: UserNotification) => void
  onMarkAllRead: () => void
  onClose?: () => void
}

export function NotificationsDropdown({
  containerRef,
  notifications,
  unreadCount,
  loading,
  errorMessage,
  markingAllRead,
  isModal = false,
  onNotificationClick,
  onMarkAllRead,
  onClose,
}: NotificationsDropdownProps) {
  const { t, formatNumber } = useI18n()

  return (
    <div
      id="notifications-panel"
      ref={containerRef}
      className="notifications-dropdown"
      role="dialog"
      aria-modal={isModal || undefined}
      aria-label={t('notifications.panelLabel')}
      aria-busy={loading}
      tabIndex={-1}
    >
      <header className="notifications-dropdown-header">
        <div>
          <span>{t('notifications.eyebrow')}</span>
          <strong>{t('notifications.title')}</strong>
        </div>
        <div className="notifications-header-actions">
          <button
            type="button"
            className="notifications-mark-all"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0 || markingAllRead}
          >
            {markingAllRead ? <Loader2 className="notifications-spin" /> : <CheckCheck />}
            <span>{t('notifications.markAllRead')}</span>
          </button>
          {isModal && onClose ? (
            <button
              type="button"
              className="notifications-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="notifications-summary" aria-live="polite">
        {unreadCount > 0
          ? t('notifications.unreadCount', { count: formatNumber(unreadCount) })
          : t('notifications.noUnread')}
      </div>

      <div className="notifications-list">
        {loading && notifications.length === 0 ? (
          <div className="notifications-state" role="status">
            <Loader2 className="notifications-spin" />
            <span>{t('notifications.loading')}</span>
          </div>
        ) : errorMessage && notifications.length === 0 ? (
          <div className="notifications-state is-error">{errorMessage}</div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state">
            <strong>{t('notifications.emptyTitle')}</strong>
            <span>{t('notifications.emptyText')}</span>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={onNotificationClick}
            />
          ))
        ) : null}

        {loading && notifications.length > 0 ? (
          <div className="notifications-refresh-status" role="status">
            <Loader2 className="notifications-spin" />
            <span>{t('notifications.loading')}</span>
          </div>
        ) : null}

        {errorMessage && notifications.length > 0 ? (
          <div className="notifications-refresh-status is-error" role="status">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  )
}
