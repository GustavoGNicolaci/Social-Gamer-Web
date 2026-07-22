import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from './ForgotPasswordPage'
import RegisterPage from './RegisterPage'
import ResetPasswordPage from './ResetPasswordPage'

const authMocks = vi.hoisted(() => ({
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  logout: vi.fn(),
  user: null as { id: string } | null,
  loading: false,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authMocks,
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  authMocks.user = null
  authMocks.loading = false
  authMocks.register.mockReset()
  authMocks.requestPasswordReset.mockReset()
  authMocks.requestPasswordReset.mockResolvedValue({ error: null })
  authMocks.updatePassword.mockReset()
  authMocks.logout.mockReset()
})

afterEach(cleanup)

function renderRoute(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('authentication pages', () => {
  it('preserves registration fields and password autocomplete contracts', () => {
    renderRoute(<RegisterPage />)

    expect(screen.getByLabelText('common.username')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('common.email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('common.password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('auth.confirmPassword')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('keeps recovery normalization and the existing Auth operation', async () => {
    renderRoute(<ForgotPasswordPage />)
    const email = screen.getByLabelText('common.email')
    expect(email).toHaveAttribute('autocomplete', 'email')

    fireEvent.change(email, { target: { value: ' User@Example.COM ' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.submit' }))
    await waitFor(() => expect(authMocks.requestPasswordReset).toHaveBeenCalledWith('user@example.com'))
  })

  it('preserves reset link gating and new-password autocomplete', () => {
    authMocks.user = { id: 'user-id' }
    renderRoute(<ResetPasswordPage />)

    expect(screen.getByLabelText('auth.reset.newPassword')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('auth.reset.confirmNewPassword')).toHaveAttribute('autocomplete', 'new-password')
  })
})
