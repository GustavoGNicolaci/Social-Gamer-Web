import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '../../services/notificationService'
import { NotificationsButton } from './NotificationsButton'

const mocks = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(() => vi.fn()),
}))

vi.mock('../../services/notificationService', () => mocks)

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

function createNotification(): UserNotification {
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
  }
}

function renderButton() {
  return render(
    <MemoryRouter>
      <NotificationsButton userId="user-1" />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mocks.fetchNotifications.mockResolvedValue({ data: [createNotification()], error: null })
  mocks.fetchUnreadNotificationCount.mockResolvedValue({ data: 1, error: null })
  mocks.markNotificationRead.mockResolvedValue({ data: null, error: null })
  mocks.markAllNotificationsRead.mockResolvedValue({ data: null, error: null })
  mocks.subscribeToNotifications.mockReturnValue(vi.fn())
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('NotificationsButton', () => {
  it('preserves the last unread count when only its refresh fails', async () => {
    mocks.fetchUnreadNotificationCount
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValue({ data: 0, error: { message: 'count error' } })

    renderButton()
    const trigger = await screen.findByRole('button', {
      name: 'notifications.openWithCount:3',
    })
    fireEvent.click(trigger)

    expect(await screen.findByText('Notification title')).toBeInTheDocument()
    expect(trigger).toHaveAccessibleName('notifications.openWithCount:3')
  })

  it('exposes the mobile sheet as modal and restores focus when it closes', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 640px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    renderButton()
    const trigger = await screen.findByRole('button', {
      name: 'notifications.openWithCount:1',
    })
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const closeButton = document.querySelector<HTMLButtonElement>('.notifications-close')
    expect(closeButton).not.toBeNull()
    fireEvent.click(closeButton!)

    await waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus after selecting a notification without a destination', async () => {
    renderButton()
    const trigger = await screen.findByRole('button', {
      name: 'notifications.openWithCount:1',
    })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByText('Notification title'))

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
