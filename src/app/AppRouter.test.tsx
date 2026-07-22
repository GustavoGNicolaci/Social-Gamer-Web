import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from './AppRouter'

vi.mock('../components/navbar/Navbar', () => ({ default: () => <nav>Navigation</nav> }))
vi.mock('../components/footer/SiteFooter', () => ({ default: () => <footer>Footer</footer> }))
vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../pages/HomePage', () => ({
  default: () => {
    throw new Error('home render failed')
  },
}))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

describe('AppRouter system routes', () => {
  it('keeps the shell available and renders the wildcard 404 route', async () => {
    window.history.pushState({}, '', '/missing-level')
    render(<AppRouter />)

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('link', { name: 'app.skipToContent' })).toHaveAttribute('href', '#main-content')
    expect(await screen.findByRole('heading', { name: 'app.notFoundTitle' })).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('contains route rendering errors without removing navigation or footer', async () => {
    window.history.pushState({}, '', '/')
    render(<AppRouter />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'app.errorTitle' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})
