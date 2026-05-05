import { Check } from 'lucide-react'
import { UserAvatar } from '../UserAvatar'
import { useI18n } from '../../i18n/I18nContext'
import type { UserNotification } from '../../services/notificationService'

interface NotificationItemProps {
  notification: UserNotification
  onClick: (notification: UserNotification) => void
}

function getMetadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getActorLabel(notification: UserNotification, fallback: string) {
  if (!notification.actor) return fallback
  return notification.actor.username ? `@${notification.actor.username}` : notification.actor.nome_completo || fallback
}

function getNotificationCopy(
  notification: UserNotification,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const actor = getActorLabel(notification, t('notifications.actorFallback'))
  const game = getMetadataText(notification.metadata, 'game_title') || t('notifications.gameFallback')
  const community =
    getMetadataText(notification.metadata, 'community_name') || t('notifications.communityFallback')
  const role = getMetadataText(notification.metadata, 'role')

  switch (notification.type) {
    case 'new_follower':
      return {
        title: t('notifications.newFollower.title'),
        message: t('notifications.newFollower.message', { actor }),
      }
    case 'review_liked':
      return {
        title: t('notifications.reviewLiked.title'),
        message: t('notifications.reviewLiked.message', { actor, game }),
      }
    case 'comment_liked':
      return {
        title: t('notifications.commentLiked.title'),
        message: t('notifications.commentLiked.message', { actor, game }),
      }
    case 'review_commented':
      return {
        title: t('notifications.reviewCommented.title'),
        message: t('notifications.reviewCommented.message', { actor, game }),
      }
    case 'private_community_accepted':
      return {
        title: t('notifications.privateCommunityAccepted.title'),
        message: t('notifications.privateCommunityAccepted.message', { community }),
      }
    case 'community_post_liked':
      return {
        title: t('notifications.communityPostLiked.title'),
        message: t('notifications.communityPostLiked.message', { actor, community }),
      }
    case 'community_post_commented':
      return {
        title: t('notifications.communityPostCommented.title'),
        message: t('notifications.communityPostCommented.message', { actor, community }),
      }
    case 'community_role_changed':
      return {
        title: t('notifications.communityRoleChanged.title'),
        message: t('notifications.communityRoleChanged.message', {
          community,
          role: role || t('notifications.roleFallback'),
        }),
      }
    case 'community_member_removed':
      return {
        title: t('notifications.communityMemberRemoved.title'),
        message: t('notifications.communityMemberRemoved.message', { community }),
      }
    default:
      return {
        title: notification.title,
        message: notification.message || t('notifications.genericMessage'),
      }
  }
}

function formatRelativeTime(value: string, locale: string, nowLabel: string) {
  const createdAt = new Date(value).getTime()

  if (Number.isNaN(createdAt)) return ''

  const diffInSeconds = Math.round((createdAt - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(diffInSeconds)

  if (absoluteSeconds < 45) return nowLabel

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
  ]

  let duration = diffInSeconds

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit)
    }

    duration /= division.amount
  }

  return formatter.format(Math.round(duration), 'year')
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { t, locale } = useI18n()
  const copy = getNotificationCopy(notification, t)
  const actorName =
    notification.actor?.nome_completo?.trim() ||
    notification.actor?.username ||
    t('notifications.actorFallback')
  const relativeTime = formatRelativeTime(notification.created_at, locale, t('notifications.now'))

  return (
    <button
      type="button"
      className={`notification-item${notification.is_read ? '' : ' is-unread'}`}
      onClick={() => onClick(notification)}
    >
      <span className="notification-item-avatar" aria-hidden="true">
        <UserAvatar
          name={actorName}
          avatarPath={notification.actor?.avatar_path}
          imageClassName="notification-avatar-img"
          fallbackClassName="notification-avatar-fallback"
        />
      </span>

      <span className="notification-item-copy">
        <span className="notification-item-title-row">
          <strong>{copy.title}</strong>
          {!notification.is_read ? <span className="notification-unread-dot" /> : null}
        </span>
        <span className="notification-item-message">{copy.message}</span>
        <span className="notification-item-time">{relativeTime}</span>
      </span>

      {notification.is_read ? (
        <span className="notification-read-icon" aria-hidden="true">
          <Check />
        </span>
      ) : null}
    </button>
  )
}
