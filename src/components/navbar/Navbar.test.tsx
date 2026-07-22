import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../contexts/ThemeContext'
import Navbar from './Navbar'

const closeSearch = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false, logout: vi.fn() }),
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../notifications/NotificationsButton', () => ({
  NotificationsButton: () => <button type="button">Notifications</button>,
}))

vi.mock('../../features/navigation/global-search/useNavbarGlobalSearch', () => ({
  getNavbarGameMetaLine: () => '',
  getNavbarSearchResultInitial: () => 'G',
  useNavbarGlobalSearch: () => ({
    activeResultId: undefined,
    activeResultIndex: -1,
    closeSearch,
    followPendingIds: [],
    gameResults: [],
    gameSearchError: null,
    handleMobileSearchToggle: vi.fn(),
    handleSearchChange: vi.fn(),
    handleSearchFocus: vi.fn(),
    handleSearchKeyDown: vi.fn(),
    handleSelectGame: vi.fn(),
    handleSelectUser: vi.fn(),
    handleToggleFollowFromSearch: vi.fn(),
    isCompactSearch: false,
    searchInputRef: { current: null },
    searchLoading: false,
    searchQuery: '',
    searchRef: { current: null },
    searchResultsId: 'search-results',
    setActiveResultIndex: vi.fn(),
    shouldShowEmptyState: false,
    shouldShowSearchDropdown: false,
    showMobileSearch: false,
    showSearchDropdown: false,
    trimmedSearchQuery: '',
    userActionError: null,
    userResults: [],
    userSearchError: null,
  }),
}))

beforeEach(() => {
  closeSearch.mockClear()
  window.localStorage.clear()
  document.body.className = ''
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  })
})

afterEach(cleanup)

function renderNavbar() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Navbar', () => {
  it('offers theme switching to visitors while preserving the storage key', () => {
    renderNavbar()

    fireEvent.click(screen.getByRole('button', { name: 'navbar.theme.light' }))
    expect(document.body).toHaveClass('light')
    expect(window.localStorage.getItem('social-gamer-theme')).toBe('light')
  })

  it('exposes an accessible mobile drawer with Escape and focus restoration', async () => {
    renderNavbar()
    await waitFor(() => expect(closeSearch).toHaveBeenCalled())
    const trigger = screen.getByRole('button', { name: 'navbar.mobile.open' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: 'navbar.mobile.menuLabel' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    const dialog = screen.getByRole('dialog', { name: 'navbar.mobile.menuLabel' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'navbar.mobile.close' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })
})
