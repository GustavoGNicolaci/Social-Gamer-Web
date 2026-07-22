import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null }),
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

vi.mock('../services/homeService', () => ({
  getHomeFollowingActivities: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomeFeaturedRecentReviewedGames: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomeActiveCommunities: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomeNewReleases: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomeTrendingReviews: vi.fn().mockResolvedValue({ data: [], error: null }),
  getHomeSiteStats: vi.fn().mockResolvedValue({ data: { games: 120, reviews: 45 }, error: null }),
}))

afterEach(cleanup)

describe('HomePage', () => {
  it('keeps visitor navigation and resolves loading into consistent content states', async () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'home.heroTitle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'common.exploreGames' })).toHaveAttribute('href', '/games')
    expect(screen.getByRole('link', { name: 'common.register' })).toHaveAttribute('href', '/register')

    await waitFor(() => expect(container.querySelector('.home-page')).toHaveAttribute('aria-busy', 'false'))
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
  })
})
