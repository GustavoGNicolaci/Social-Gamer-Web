import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  from: vi.fn(),
  removeChannel: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../../../supabase-client', () => ({
  supabase: mocks,
}))

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from './notificationRepository'

function createQuery(result: Record<string, unknown>) {
  const query = {
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: <TResult1 = Record<string, unknown>, TResult2 = never>(
      onFulfilled?: ((value: Record<string, unknown>) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }

  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.select.mockReturnValue(query)

  return query
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({ data: null, error: null })
})

describe('notificationRepository', () => {
  it('does not query notifications without an authenticated user id', async () => {
    await expect(fetchNotifications('')).resolves.toEqual({ data: [], error: null })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('loads notification actors without changing the public result shape', async () => {
    const notificationQuery = createQuery({
      data: [{
        id: 'notification-1',
        user_id: 'user-1',
        actor_id: 'actor-1',
        type: 'follow',
        title: 'Follow',
        message: null,
        entity_type: null,
        entity_id: null,
        link: null,
        metadata: null,
        is_read: false,
        read_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }],
      error: null,
    })
    const actorQuery = createQuery({
      data: [{
        id: 'actor-1',
        username: 'player',
        nome_completo: 'Player One',
        avatar_path: null,
      }],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => (
      table === 'notifications' ? notificationQuery : actorQuery
    ))

    const result = await fetchNotifications('user-1', 100)

    expect(notificationQuery.limit).toHaveBeenCalledWith(50)
    expect(actorQuery.in).toHaveBeenCalledWith('id', ['actor-1'])
    expect(result.error).toBeNull()
    expect(result.data[0]).toMatchObject({
      metadata: {},
      actor: { id: 'actor-1', username: 'player' },
    })
  })

  it('keeps the notification RPC contracts behind the existing facade', async () => {
    await markNotificationRead('notification-1')
    await markAllNotificationsRead()

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'mark_notification_read', {
      p_notification_id: 'notification-1',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'mark_all_notifications_read')
  })

  it('removes the realtime channel returned by the subscription', () => {
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    }
    channel.on.mockReturnValue(channel)
    channel.subscribe.mockReturnValue(channel)
    mocks.channel.mockReturnValue(channel)

    const unsubscribe = subscribeToNotifications('user-1', vi.fn())
    unsubscribe()

    expect(mocks.channel).toHaveBeenCalledWith('notifications:user-1')
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel)
  })
})
