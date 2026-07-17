import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserProfileReportSummary } from '../../../services/profileReportService'
import type { PublicUserProfile } from '../../../services/userService'

const serviceMocks = vi.hoisted(() => ({
  deleteProfileReport: vi.fn(),
  followUser: vi.fn(),
  getCurrentUserProfileReport: vi.fn(),
  getFollowState: vi.fn(),
  submitProfileReport: vi.fn(),
  unfollowUser: vi.fn(),
}))

vi.mock('../../../services/userService', () => ({
  followUser: serviceMocks.followUser,
  getFollowState: serviceMocks.getFollowState,
  unfollowUser: serviceMocks.unfollowUser,
}))

vi.mock('../../../services/profileReportService', () => ({
  deleteProfileReport: serviceMocks.deleteProfileReport,
  getCurrentUserProfileReport: serviceMocks.getCurrentUserProfileReport,
  submitProfileReport: serviceMocks.submitProfileReport,
}))

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

import { useProfileFollow } from './useProfileFollow'
import { useProfileReport } from './useProfileReport'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: resolvePromise,
  }
}

function createProfile(id: string): PublicUserProfile {
  return {
    id,
    username: id,
    nome_completo: id,
    avatar_path: null,
    bio: null,
    data_cadastro: '2026-01-01T00:00:00.000Z',
    topFiveEntries: [],
    followersCount: 0,
    followingCount: 0,
    isPrivate: false,
    privacyMode: 'public',
    canViewRestrictedContent: true,
    restrictedContentMessage: null,
  }
}

function createReport(id: string, profileId: string): CurrentUserProfileReportSummary {
  return {
    id,
    reportedUserId: profileId,
    reportedUserDisplayName: profileId,
    reason: 'spam',
    description: null,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const viewer = {
  id: 'viewer-id',
  email: 'viewer@example.com',
  user_metadata: {},
} as User

const firstProfile = createProfile('profile-a')
const secondProfile = createProfile('profile-b')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('useProfileFollow mutation guards', () => {
  it('oculta imediatamente o feedback pertencente ao perfil anterior', async () => {
    const secondProfileLoad = createDeferred<{
      data: { isFollowing: boolean; followersCount: number; followingCount: number }
      error: null
    }>()

    serviceMocks.getFollowState.mockImplementation((_: string | undefined, profileId: string) => {
      if (profileId === firstProfile.id) {
        return Promise.resolve({
          data: { isFollowing: false, followersCount: 0, followingCount: 0 },
          error: { message: 'first profile failed' },
        })
      }

      return secondProfileLoad.promise
    })

    const onFollowChanged = vi.fn()
    const { result, rerender } = renderHook(
      ({ activeProfile }) =>
        useProfileFollow({
          activeProfile,
          isRestrictedPublicView: false,
          onFollowChanged,
          user: viewer,
        }),
      { initialProps: { activeProfile: firstProfile } }
    )

    await waitFor(() => {
      expect(result.current.followFeedback?.message).toBe('first profile failed')
    })

    rerender({ activeProfile: secondProfile })

    expect(result.current.followFeedback).toBeNull()
  })

  it('descarta o resultado de follow quando o perfil muda durante a mutacao', async () => {
    serviceMocks.getFollowState.mockImplementation((_: string | undefined, profileId: string) =>
      Promise.resolve({
        data:
          profileId === firstProfile.id
            ? { isFollowing: false, followersCount: 1, followingCount: 2 }
            : { isFollowing: false, followersCount: 7, followingCount: 8 },
        error: null,
      })
    )
    const pendingFollow = createDeferred<{
      data: { isFollowing: boolean; followersCount: number; followingCount: number }
      error: null
    }>()
    serviceMocks.followUser.mockReturnValue(pendingFollow.promise)

    const onFollowChanged = vi.fn()
    const { result, rerender } = renderHook(
      ({ activeProfile }) =>
        useProfileFollow({
          activeProfile,
          isRestrictedPublicView: false,
          onFollowChanged,
          user: viewer,
        }),
      { initialProps: { activeProfile: firstProfile } }
    )

    await waitFor(() => {
      expect(result.current.followState.followersCount).toBe(1)
    })

    let mutationPromise!: Promise<void>
    act(() => {
      mutationPromise = result.current.handleToggleFollow()
    })
    expect(result.current.followSubmitting).toBe(true)

    rerender({ activeProfile: secondProfile })

    await waitFor(() => {
      expect(result.current.followState.followersCount).toBe(7)
      expect(result.current.followSubmitting).toBe(false)
    })

    await act(async () => {
      pendingFollow.resolve({
        data: { isFollowing: true, followersCount: 99, followingCount: 99 },
        error: null,
      })
      await mutationPromise
    })

    expect(result.current.followState).toEqual({
      isFollowing: false,
      followersCount: 7,
      followingCount: 8,
    })
    expect(result.current.followFeedback).toBeNull()
    expect(result.current.followSubmitting).toBe(false)
    expect(result.current.followersRefreshKey).toBe(0)
    expect(onFollowChanged).not.toHaveBeenCalled()
  })
})

describe('useProfileReport mutation guards', () => {
  it('descarta a criacao de denuncia concluida para o perfil anterior', async () => {
    const secondReport = createReport('report-b', secondProfile.id)
    serviceMocks.getCurrentUserProfileReport.mockImplementation(
      (_: string, profileId: string) =>
        Promise.resolve({
          data: profileId === secondProfile.id ? secondReport : null,
          error: null,
        })
    )
    const pendingSubmit = createDeferred<{
      status: 'created'
      data: CurrentUserProfileReportSummary
      error: null
    }>()
    serviceMocks.submitProfileReport.mockReturnValue(pendingSubmit.promise)

    const { result, rerender } = renderHook(
      ({ activeProfile }) =>
        useProfileReport({
          activeProfile,
          isOwnerView: false,
          user: viewer,
        }),
      { initialProps: { activeProfile: firstProfile } }
    )

    await waitFor(() => {
      expect(serviceMocks.getCurrentUserProfileReport).toHaveBeenCalledWith(
        viewer.id,
        firstProfile.id
      )
    })

    let mutationPromise!: Promise<void>
    act(() => {
      mutationPromise = result.current.handleSubmitProfileReport({
        reason: 'spam',
        description: '',
      })
    })
    expect(result.current.profileReportSubmitting).toBe(true)

    rerender({ activeProfile: secondProfile })

    await waitFor(() => {
      expect(result.current.currentProfileReport).toEqual(secondReport)
      expect(result.current.profileReportSubmitting).toBe(false)
    })

    await act(async () => {
      pendingSubmit.resolve({
        status: 'created',
        data: createReport('report-a', firstProfile.id),
        error: null,
      })
      await mutationPromise
    })

    expect(result.current.currentProfileReport).toEqual(secondReport)
    expect(result.current.profileReportFeedback).toBeNull()
    expect(result.current.profileReportSubmitting).toBe(false)
  })

  it('descarta a remocao de denuncia concluida para o perfil anterior', async () => {
    const firstReport = createReport('report-a', firstProfile.id)
    const secondReport = createReport('report-b', secondProfile.id)
    serviceMocks.getCurrentUserProfileReport.mockImplementation(
      (_: string, profileId: string) =>
        Promise.resolve({
          data: profileId === firstProfile.id ? firstReport : secondReport,
          error: null,
        })
    )
    const pendingDelete = createDeferred<{ error: null }>()
    serviceMocks.deleteProfileReport.mockReturnValue(pendingDelete.promise)

    const { result, rerender } = renderHook(
      ({ activeProfile }) =>
        useProfileReport({
          activeProfile,
          isOwnerView: false,
          user: viewer,
        }),
      { initialProps: { activeProfile: firstProfile } }
    )

    await waitFor(() => {
      expect(result.current.currentProfileReport).toEqual(firstReport)
    })

    let mutationPromise!: Promise<void>
    act(() => {
      mutationPromise = result.current.handleRemoveProfileReport()
    })
    expect(result.current.profileReportRemoving).toBe(true)

    rerender({ activeProfile: secondProfile })

    await waitFor(() => {
      expect(result.current.currentProfileReport).toEqual(secondReport)
      expect(result.current.profileReportRemoving).toBe(false)
    })

    await act(async () => {
      pendingDelete.resolve({ error: null })
      await mutationPromise
    })

    expect(result.current.currentProfileReport).toEqual(secondReport)
    expect(result.current.profileReportFeedback).toBeNull()
    expect(result.current.profileReportRemoving).toBe(false)
  })
})
