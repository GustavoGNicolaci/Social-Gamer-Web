import { CheckCheck, Loader2 } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import type { UserNotification } from '../../services/notificationService'
import { NotificationItem } from './NotificationItem'

interface NotificationsDropdownProps {
  notifications: UserNotification[]
  unreadCount: number
  loading: boolean
  errorMessage: string | null
  markingAllRead: boolean
  onNotificationClick: (notification: UserNotification) => void
  onMarkAllRead: () => void
}

export function NotificationsDropdown({
  notifications,
  unreadCount,
  loading,
  errorMessage,
  markingAllRead,
  onNotificationClick,
  onMarkAllRead,
}: NotificationsDropdownProps) {
  const { t, formatNumber } = useI18n()

  return (
    <div className="notifications-dropdown" role="dialog" aria-label={t('notifications.panelLabel')}>
      <header className="notifications-dropdown-header">
        <div>
          <span>{t('notifications.eyebrow')}</span>
          <strong>{t('notifications.title')}</strong>
        </div>
        <button
          type="button"
          className="notifications-mark-all"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0 || markingAllRead}
        >
          {markingAllRead ? <Loader2 className="notifications-spin" /> : <CheckCheck />}
          <span>{t('notifications.markAllRead')}</span>
        </button>
      </header>

      <div className="notifications-summary" aria-live="polite">
        {unreadCount > 0
          ? t('notifications.unreadCount', { count: formatNumber(unreadCount) })
          : t('notifications.noUnread')}
      </div>

      <div className="notifications-list">
        {loading ? (
          <div className="notifications-state" role="status">
            <Loader2 className="notifications-spin" />
            <span>{t('notifications.loading')}</span>
          </div>
        ) : errorMessage ? (
          <div className="notifications-state is-error">{errorMessage}</div>
        ) : notifications.length === 0 ? (
          <div className="notifications-state">
            <strong>{t('notifications.emptyTitle')}</strong>
            <span>{t('notifications.emptyText')}</span>
          </div>
        ) : (
          notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={onNotificationClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
