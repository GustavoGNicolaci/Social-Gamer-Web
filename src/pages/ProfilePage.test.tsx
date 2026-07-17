import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteGameStatus: vi.fn(),
  deleteProfileReport: vi.fn(),
  deleteReview: vi.fn(),
  deleteWishlistEntry: vi.fn(),
  followUser: vi.fn(),
  getCurrentUserProfileReport: vi.fn(),
  getFollowState: vi.fn(),
  getGameStatusesPageByUserId: vi.fn(),
  getPublicProfileByUsername: vi.fn(),
  getReviewsPageByUserId: vi.fn(),
  getWishlistGamesByUserId: vi.fn(),
  getWishlistGamesPageByUserId: vi.fn(),
  saveGameStatus: vi.fn(),
  submitProfileReport: vi.fn(),
  unfollowUser: vi.fn(),
  updateOwnProfile: vi.fn(),
  uploadAvatarImage: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    formatDate: () => 'formatted-date',
    t: (key: string) => key,
  }),
}))

vi.mock('../components/UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <div data-testid="profile-avatar">{name}</div>,
}))

vi.mock('../components/profile/ProfileConnectionsModal', () => ({
  ProfileConnectionsModal: () => <div data-testid="profile-connections-modal" />,
}))

vi.mock('../components/profile/ProfileCommunitiesSection', () => ({
  ProfileCommunitiesSection: ({ kind }: { kind: string }) => (
    <div data-testid={`profile-communities-${kind}`} />
  ),
}))

vi.mock('../components/profile/ProfileGameStatusSection', () => ({
  ProfileGameStatusSection: ({
    errorMessage,
    isLoading,
    isOwnerView,
    userId,
  }: {
    errorMessage: string | null
    isLoading: boolean
    isOwnerView: boolean
    userId: string
  }) => (
    <div
      data-testid="profile-status-section"
      data-error={errorMessage || ''}
      data-loading={String(isLoading)}
      data-owner={String(isOwnerView)}
      data-user-id={userId}
    />
  ),
}))

vi.mock('../components/profile/ProfileReportModal', () => ({
  ProfileReportModal: () => <div data-testid="profile-report-modal" />,
}))

vi.mock('../components/profile/ProfileReviewsSection', () => ({
  ProfileReviewsSection: () => <div data-testid="profile-reviews-section" />,
}))

vi.mock('../components/profile/ProfileTopFiveSection', () => ({
  ProfileTopFiveSection: ({ isOwnerView }: { isOwnerView: boolean }) => (
    <div data-testid="profile-top-five" data-owner={String(isOwnerView)} />
  ),
}))

vi.mock('../components/profile/ProfileWishlistSection', () => ({
  ProfileWishlistSection: () => <div data-testid="profile-wishlist-section" />,
}))

vi.mock('../services/gameStatusService', () => ({
  deleteGameStatus: mocks.deleteGameStatus,
  getGameStatusesPageByUserId: mocks.getGameStatusesPageByUserId,
  saveGameStatus: mocks.saveGameStatus,
}))

vi.mock('../services/profileReportService', () => ({
  deleteProfileReport: mocks.deleteProfileReport,
  getCurrentUserProfileReport: mocks.getCurrentUserProfileReport,
  submitProfileReport: mocks.submitProfileReport,
}))

vi.mock('../services/reviewService', () => ({
  deleteReview: mocks.deleteReview,
  getReviewsPageByUserId: mocks.getReviewsPageByUserId,
}))

vi.mock('../services/storageService', () => ({
  uploadAvatarImage: mocks.uploadAvatarImage,
}))

vi.mock('../services/userService', () => ({
  followUser: mocks.followUser,
  getFollowState: mocks.getFollowState,
  getPublicProfileByUsername: mocks.getPublicProfileByUsername,
  unfollowUser: mocks.unfollowUser,
}))

vi.mock('../services/wishlistService', () => ({
  deleteWishlistEntry: mocks.deleteWishlistEntry,
  getWishlistGamesByUserId: mocks.getWishlistGamesByUserId,
  getWishlistGamesPageByUserId: mocks.getWishlistGamesPageByUserId,
}))

vi.mock('../utils/performanceDiagnostics', () => ({
  getPerformanceNow: () => 0,
  logPerformanceTiming: vi.fn(),
}))

import type { UserProfile } from '../contexts/AuthContext'
import type { PublicUserProfile } from '../services/userService'
import { ProfilePage } from './ProfilePage'

const ownerUser = {
  id: 'owner-id',
  email: 'owner@example.com',
  user_metadata: {},
} as User

const ownerProfile: UserProfile = {
  id: ownerUser.id,
  username: 'owner',
  nome_completo: 'Owner Player',
  avatar_path: null,
  avatar_url: null,
  bio: 'Owner bio',
  data_cadastro: '2026-01-01T00:00:00.000Z',
  configuracoes_privacidade: {},
}

const publicProfile: PublicUserProfile = {
  id: 'public-id',
  username: 'public-player',
  nome_completo: 'Public Player',
  avatar_path: null,
  bio: 'Public bio',
  data_cadastro: '2026-02-01T00:00:00.000Z',
  topFiveEntries: [],
  followersCount: 2,
  followingCount: 3,
  isPrivate: false,
  privacyMode: 'public',
  canViewRestrictedContent: true,
  restrictedContentMessage: null,
}

const emptyPageResult = {
  data: [],
  error: null,
  totalCount: 0,
  hasMore: false,
  nextPage: null,
  timings: {
    totalMs: 0,
    queryMs: 0,
    normalizeMs: 0,
    requestCount: 1,
  },
}

function setAuthState({
  loading = false,
  profile = ownerProfile,
  user = ownerUser,
}: {
  loading?: boolean
  profile?: UserProfile | null
  user?: User | null
} = {}) {
  mocks.useAuth.mockReturnValue({
    loading,
    profile,
    updateOwnProfile: mocks.updateOwnProfile,
    user,
  })
}

function renderProfile(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  setAuthState()

  mocks.getCurrentUserProfileReport.mockResolvedValue({ data: null, error: null })
  mocks.getFollowState.mockResolvedValue({
    data: { isFollowing: false, followersCount: 2, followingCount: 3 },
    error: null,
  })
  mocks.getGameStatusesPageByUserId.mockResolvedValue(emptyPageResult)
  mocks.getReviewsPageByUserId.mockResolvedValue(emptyPageResult)
  mocks.getWishlistGamesByUserId.mockResolvedValue({ data: [], error: null })
  mocks.getWishlistGamesPageByUserId.mockResolvedValue(emptyPageResult)
})

afterEach(cleanup)

describe('ProfilePage', () => {
  it('mantem a rota propria editavel e carrega a secao inicial como proprietario', async () => {
    renderProfile('/profile')

    expect(screen.getByRole('heading', { name: '@owner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'profile.editProfile' })).toBeInTheDocument()
    expect(screen.getByTestId('profile-top-five')).toHaveAttribute('data-owner', 'true')

    const statusSection = await screen.findByTestId('profile-status-section')
    expect(statusSection).toHaveAttribute('data-owner', 'true')
    expect(statusSection).toHaveAttribute('data-user-id', ownerUser.id)
    await waitFor(() => {
      expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalledWith(
        ownerUser.id,
        expect.objectContaining({ page: 0, pageSize: 12 })
      )
    })
    expect(mocks.getPublicProfileByUsername).not.toHaveBeenCalled()
  })

  it('mantem um perfil publico anonimo somente leitura e com conteudo visivel', async () => {
    setAuthState({ user: null, profile: null })
    mocks.getPublicProfileByUsername.mockResolvedValue({ data: publicProfile, error: null })

    renderProfile('/profile/public-player')

    expect(await screen.findByRole('heading', { name: '@public-player' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'profile.loginToFollow' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(screen.getByTestId('profile-top-five')).toHaveAttribute('data-owner', 'false')

    const statusSection = await screen.findByTestId('profile-status-section')
    expect(statusSection).toHaveAttribute('data-owner', 'false')
    expect(statusSection).toHaveAttribute('data-user-id', publicProfile.id)
    await waitFor(() => expect(mocks.getGameStatusesPageByUserId).toHaveBeenCalled())
  })

  it('preserva a mascara de privacidade e nao consulta colecoes restritas', async () => {
    setAuthState({ user: null, profile: null })
    const privateProfile: PublicUserProfile = {
      ...publicProfile,
      id: 'private-id',
      username: 'private-player',
      bio: null,
      isPrivate: true,
      privacyMode: 'private',
      canViewRestrictedContent: false,
      restrictedContentMessage: 'Restricted',
    }
    mocks.getPublicProfileByUsername.mockResolvedValue({ data: privateProfile, error: null })

    renderProfile('/profile/private-player')

    expect(await screen.findByRole('heading', { name: '@private-player' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('profile.restrictedPrivateTitle')
    expect(screen.queryByTestId('profile-top-five')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-status-section')).not.toBeInTheDocument()

    await waitFor(() => expect(mocks.getFollowState).toHaveBeenCalled())
    expect(mocks.getGameStatusesPageByUserId).not.toHaveBeenCalled()
    expect(mocks.getWishlistGamesPageByUserId).not.toHaveBeenCalled()
    expect(mocks.getReviewsPageByUserId).not.toHaveBeenCalled()
  })

  it('preserva os estados de carregamento e erro da rota publica', async () => {
    setAuthState({ loading: true, user: null, profile: null })
    const view = renderProfile('/profile/loading-player')

    expect(screen.getByRole('heading', { name: 'profile.loadingTitle' })).toBeInTheDocument()

    setAuthState({ user: null, profile: null })
    mocks.getPublicProfileByUsername.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    })
    view.unmount()
    renderProfile('/profile/error-player')

    expect(await screen.findByRole('heading', { name: 'profile.unavailableTitle' })).toBeInTheDocument()
    expect(screen.getByText('Could not load this profile right now.')).toBeInTheDocument()
  })

  it('ignora a resposta obsoleta depois de uma troca rapida de username', async () => {
    setAuthState({ user: null, profile: null })
    const firstRequest = createDeferred<{
      data: PublicUserProfile
      error: null
    }>()
    const secondProfile: PublicUserProfile = {
      ...publicProfile,
      id: 'second-id',
      username: 'second-player',
      nome_completo: 'Second Player',
    }

    mocks.getPublicProfileByUsername.mockImplementation((username: string) => {
      if (username === 'first-player') return firstRequest.promise
      return Promise.resolve({ data: secondProfile, error: null })
    })

    const router = createMemoryRouter(
      [{ path: '/profile/:username', element: <ProfilePage /> }],
      { initialEntries: ['/profile/first-player'] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(mocks.getPublicProfileByUsername).toHaveBeenCalledWith('first-player', undefined)
    })

    await act(async () => {
      await router.navigate('/profile/second-player')
    })

    expect(await screen.findByRole('heading', { name: '@second-player' })).toBeInTheDocument()

    await act(async () => {
      firstRequest.resolve({ data: publicProfile, error: null })
      await firstRequest.promise
    })

    expect(screen.getByRole('heading', { name: '@second-player' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '@public-player' })).not.toBeInTheDocument()
  })
})
