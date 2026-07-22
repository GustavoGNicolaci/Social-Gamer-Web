import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage'

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, user: null }),
}))

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  loginMock.mockReset()
  loginMock.mockResolvedValue({ error: null })
})

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('preserves autocomplete, normalizes credentials and keeps password reveal visual-only', async () => {
    renderPage()
    const email = screen.getByLabelText('common.email')
    const password = screen.getByLabelText('common.password')

    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toHaveAttribute('type', 'password')

    fireEvent.change(email, { target: { value: ' User@Example.COM ' } })
    fireEvent.change(password, { target: { value: 'secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.showPassword' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('secret-password')

    fireEvent.click(screen.getByRole('button', { name: 'auth.login.submit' }))
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('user@example.com', 'secret-password'))
  })

  it('keeps required validation in place before calling authentication', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'auth.login.submit' }))

    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(loginMock).not.toHaveBeenCalled()
  })
})
