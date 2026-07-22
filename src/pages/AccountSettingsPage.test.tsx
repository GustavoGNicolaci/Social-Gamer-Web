import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountSettingsPage from './AccountSettingsPage'

const mocks = vi.hoisted(() => ({
  setLocale: vi.fn().mockResolvedValue(undefined),
  updateOwnProfile: vi.fn().mockResolvedValue({ error: null }),
  requestAuthenticatedPasswordReset: vi.fn().mockResolvedValue({ error: null }),
  deleteOwnAccount: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({
    locale: 'pt-BR',
    setLocale: mocks.setLocale,
    t: (key: string) => key,
  }),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'gamer@example.com' },
    profile: {
      id: 'user-1',
      username: 'gamer',
      configuracoes_privacidade: null,
    },
    loading: false,
    updateOwnProfile: mocks.updateOwnProfile,
    requestAuthenticatedPasswordReset: mocks.requestAuthenticatedPasswordReset,
    deleteOwnAccount: mocks.deleteOwnAccount,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountSettingsPage presentation contracts', () => {
  it('keeps settings in a two-column-ready layout and danger zone full-width class', () => {
    const { container } = render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )

    expect(container.querySelector('.account-settings-layout')).toBeInTheDocument()
    expect(container.querySelector('.account-settings-card.is-danger-zone')).toBeInTheDocument()
    expect(container.querySelector('main.account-settings-page')).not.toBeInTheDocument()
  })

  it('opens an accessible deletion dialog, focuses its first field and closes on Escape', async () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'settings.delete.submit' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const usernameInput = screen.getByLabelText('common.username')
    await waitFor(() => expect(usernameInput).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
