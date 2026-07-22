import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '../../services/notificationService'
import { NotificationsDropdown } from './NotificationsDropdown'

vi.mock('../UserAvatar', () => ({
  UserAvatar: () => <span data-testid="notification-avatar" />,
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    locale: 'pt-BR',
    formatNumber: (value: number) => String(value),
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${Object.values(params).join(':')}` : key,
  }),
}))

afterEach(cleanup)

function createNotification(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    actor_id: 'actor-1',
    type: 'generic',
    title: 'Notification title',
    message: 'Notification message',
    entity_type: null,
    entity_id: null,
    link: null,
    metadata: {},
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    actor: null,
    ...overrides,
  }
}

describe('NotificationsDropdown', () => {
  it('keeps existing notifications visible while a refresh is loading', () => {
    render(
      <NotificationsDropdown
        containerRef={createRef<HTMLDivElement>()}
        notifications={[createNotification()]}
        unreadCount={1}
        loading
        errorMessage={null}
        markingAllRead={false}
        onNotificationClick={vi.fn()}
        onMarkAllRead={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Notification title')).toBeInTheDocument()
    expect(screen.getByText('notifications.loading')).toBeInTheDocument()
    expect(document.querySelector('.notification-item.is-unread')).toBeInTheDocument()
    expect(document.querySelector('.notification-unread-dot')).toBeInTheDocument()
  })

  it('exposes a distinct read-state icon without relying only on color', () => {
    render(
      <NotificationsDropdown
        containerRef={createRef<HTMLDivElement>()}
        notifications={[createNotification({ is_read: true, read_at: new Date().toISOString() })]}
        unreadCount={0}
        loading={false}
        errorMessage={null}
        markingAllRead={false}
        onNotificationClick={vi.fn()}
        onMarkAllRead={vi.fn()}
      />
    )

    expect(document.querySelector('.notification-read-icon')).toBeInTheDocument()
    expect(document.querySelector('.notification-item.is-unread')).not.toBeInTheDocument()
  })
})
