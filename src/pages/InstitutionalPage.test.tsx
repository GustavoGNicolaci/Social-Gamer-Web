import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstitutionalPage from './InstitutionalPage'
import SupportPage from './SupportPage'

vi.mock('../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

describe('InstitutionalPage', () => {
  it.each(['about', 'terms', 'privacy'] as const)('keeps the %s content route connected to support', page => {
    render(
      <MemoryRouter>
        <InstitutionalPage page={page} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: `institutional.${page}.title` })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'institutional.supportLink' })).toHaveAttribute('href', '/suporte')
  })

  it('keeps support contact actionable without changing the configured address', () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'support.title' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'suporte@socialgamer.com' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'suporte@socialgamer.com' })[0]).toHaveAttribute(
      'href',
      'mailto:suporte@socialgamer.com',
    )
  })
})
