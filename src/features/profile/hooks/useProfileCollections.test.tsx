import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../../../contexts/AuthContext'
import type { GameStatusItem } from '../../../services/gameStatusService'

const mocks = vi.hoisted(() => ({
  deleteGameStatus: vi.fn(),
  deleteReview: vi.fn(),
  deleteWishlistEntry: vi.fn(),
  getGameStatusesPageByUserId: vi.fn(),
  getReviewsPageByUserId: vi.fn(),
  getWishlistGamesByUserId: vi.fn(),
  getWishlistGamesPageByUserId: vi.fn(),
  saveGameStatus: vi.fn(),
}))

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../services/gameStatusService', () => ({
  deleteGameStatus: mocks.deleteGameStatus,
  getGameStatusesPageByUserId: mocks.getGameStatusesPageByUserId,
  saveGameStatus: mocks.saveGameStatus,
}))

vi.mock('../../../services/reviewService', () => ({
  deleteReview: mocks.deleteReview,
  getReviewsPageByUserId: mocks.getReviewsPageByUserId,
}))

vi.mock('../../../services/wishlistService', () => ({
  deleteWishlistEntry: mocks.deleteWishlistEntry,
  getWishlistGamesByUserId: mocks.getWishlistGamesByUserId,
  getWishlistGamesPageByUserId: mocks.getWishlistGamesPageByUserId,
}))

vi.mock('../../../utils/performanceDiagnostics', () => ({
  getPerformanceNow: () => 0,
  logPerformanceTiming: vi.fn(),
}))

import {
  mergeProfileCollectionsById,
  useProfileCollections,
  type ProfileTab,
} from './useProfileCollections'

interface TestPageResult<T> {
  data: T[]
  error: null
  totalCount: number
  hasMore: boolean
  nextPage: null
  timings: {
    totalMs: number
    queryMs: number
    normalizeMs: number
    requestCount: number
  }
}

const createPageResult = <T,>(data: T[] = []): TestPageResult<T> => ({
  data,
  error: null,
  totalCount: data.length,
  hasMore: false,
  nextPage: null,
  timings: {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 1,
  },
})

const createProfile = (id: string) => ({ id }) as UserProfile

const createStatusItem = (id: string, profileId: string): GameStatusItem => ({
  id,
  usuario_id: profileId,
  jogo_id: Number(id.replace(/\D/g, '')) || 1,
  status: 'jogando',
  created_at: '2026-01-01T00:00:00.000Z',
  favorito: false,
  jogo: null,
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getGameStatusesPageByUserId.mockResolvedValue(createPageResult())
  mocks.getReviewsPageByUserId.mockResolvedValue(createPageResult())
  mocks.getWishlistGamesByUserId.mockResolvedValue({ data: [], error: null })
  mocks.getWishlistGamesPageByUserId.mockResolvedValue(createPageResult())
})

afterEach(cleanup)

describe('useProfileCollections', () => {
  it('carrega somente a aba ativa e reutiliza o cache ao retornar para uma aba carregada', async () => {
    const profile = createProfile('profile-a')
    const { result, rerender } = renderHook(
      ({ activeTab }: { activeTab: ProfileTab }) =>
        useProfileCollections({
          activeProfile: profile,
          activeTab,
          editableProfile: null,
          isOwnerView: false,
          isRestrictedPublicView: false,
          userId: 'viewer-id',
        }),
      { initialProps: { activeTab: 'status' as ProfileTab } }
    )

    await waitFor(() => expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledTimes(1))
    expect(mocks.getWishlistGamesPageByUserId).not.toHaveBeenCalled()
    expect(mocks.getReviewsPageByUserId).not.toHaveBeenCalled()

    rerender({ activeTab: 'wishlist' })
    await waitFor(() => expect(mocks.getWishlistGamesPageByUserId).toHaveBeenCalledTimes(1))

    rerender({ activeTab: 'reviews' })
    await waitFor(() => expect(mocks.getReviewsPageByUserId).toHaveBeenCalledTimes(1))

    rerender({ activeTab: 'status' })
    await waitFor(() => expect(result.current.loadedProfileTabs.status).toBe(true))
    expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledTimes(1)
  })

  it('ignora uma resposta de status obsoleta depois da troca de perfil', async () => {
    const staleResult = createDeferred<TestPageResult<GameStatusItem>>()
    const currentStatus = createStatusItem('status-2', 'profile-b')

    mocks.getGameStatusesPageByUserId.mockImplementation((profileId: string) => {
      if (profileId === 'profile-a') return staleResult.promise

      return Promise.resolve(createPageResult([currentStatus]))
    })

    const { result, rerender } = renderHook(
      ({ profile }: { profile: UserProfile }) =>
        useProfileCollections({
          activeProfile: profile,
          activeTab: 'status',
          editableProfile: null,
          isOwnerView: false,
          isRestrictedPublicView: false,
          userId: 'viewer-id',
        }),
      { initialProps: { profile: createProfile('profile-a') } }
    )

    await waitFor(() =>
      expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledWith(
        'profile-a',
        expect.any(Object)
      )
    )

    rerender({ profile: createProfile('profile-b') })
    await waitFor(() => expect(result.current.statusItemsForView).toEqual([currentStatus]))

    await act(async () => {
      staleResult.resolve(createPageResult([createStatusItem('status-1', 'profile-a')]))
      await staleResult.promise
    })

    expect(result.current.statusItemsForView).toEqual([currentStatus])
  })

  it('invalida uma resposta pendente quando a colecao fica restrita', async () => {
    const staleResult = createDeferred<TestPageResult<GameStatusItem>>()
    const staleStatus = createStatusItem('status-1', 'profile-a')
    const freshStatus = createStatusItem('status-2', 'profile-a')

    mocks.getGameStatusesPageByUserId
      .mockReturnValueOnce(staleResult.promise)
      .mockResolvedValueOnce(createPageResult([freshStatus]))

    const profile = createProfile('profile-a')
    const { result, rerender } = renderHook(
      ({ restricted }: { restricted: boolean }) =>
        useProfileCollections({
          activeProfile: profile,
          activeTab: 'status',
          editableProfile: null,
          isOwnerView: false,
          isRestrictedPublicView: restricted,
          userId: 'viewer-id',
        }),
      { initialProps: { restricted: false } }
    )

    await waitFor(() => expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledTimes(1))
    rerender({ restricted: true })
    await act(async () => new Promise(resolve => window.setTimeout(resolve, 0)))

    await act(async () => {
      staleResult.resolve(createPageResult([staleStatus]))
      await staleResult.promise
    })

    expect(result.current.statusItemsForView).toEqual([])

    rerender({ restricted: false })
    await waitFor(() => expect(result.current.statusItemsForView).toEqual([freshStatus]))
    expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledTimes(2)
  })

  it('aguarda a estabilizacao da aba ao trocar a chave das colecoes', async () => {
    const { rerender } = renderHook(
      ({ activeTab, profile }: { activeTab: ProfileTab; profile: UserProfile }) =>
        useProfileCollections({
          activeProfile: profile,
          activeTab,
          editableProfile: null,
          isOwnerView: false,
          isRestrictedPublicView: false,
          userId: 'viewer-id',
        }),
      {
        initialProps: {
          activeTab: 'wishlist' as ProfileTab,
          profile: createProfile('profile-a'),
        },
      }
    )

    await waitFor(() =>
      expect(mocks.getWishlistGamesPageByUserId).toHaveBeenCalledWith(
        'profile-a',
        expect.any(Object)
      )
    )

    rerender({ activeTab: 'wishlist', profile: createProfile('profile-b') })
    await act(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 0))
      rerender({ activeTab: 'status', profile: createProfile('profile-b') })
    })

    await waitFor(() =>
      expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledWith(
        'profile-b',
        expect.any(Object)
      )
    )
    expect(
      mocks.getWishlistGamesPageByUserId.mock.calls.filter(([profileId]) =>
        Object.is(profileId, 'profile-b')
      )
    ).toHaveLength(0)
  })
})

describe('mergeProfileCollectionsById', () => {
  it('mantem a ordem existente, atualiza duplicados e adiciona itens novos', () => {
    expect(
      mergeProfileCollectionsById(
        [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
        ],
        [
          { id: 'b', value: 3 },
          { id: 'c', value: 4 },
        ]
      )
    ).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 3 },
      { id: 'c', value: 4 },
    ])
  })
})
