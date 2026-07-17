export type {
  NotificationActor,
  NotificationServiceError,
  UserNotification,
} from '../features/notifications/domain/types'

export {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../features/notifications/data/notificationRepository'
