import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogFiltersModal } from './CatalogFiltersModal'

vi.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    formatNumber: (value: number) => String(value),
    t: (key: string) => key,
  }),
}))

afterEach(cleanup)

describe('CatalogFiltersModal accessibility', () => {
  it('exposes dialog semantics, traps focus, closes with Escape, and restores focus', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'open'
    document.body.appendChild(opener)
    opener.focus()
    const onClose = vi.fn()

    const view = render(
      <CatalogFiltersModal
        open
        searchValue=""
        activeFilters={[]}
        groups={[
          {
            key: 'genres',
            category: 'genre',
            title: 'Genres',
            options: ['Action'],
          },
        ]}
        onClose={onClose}
        onSearchChange={vi.fn()}
        onClearAll={vi.fn()}
        onToggleFacet={vi.fn()}
        isFacetActive={() => false}
      />
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    const closeButton = screen.getByRole('button', { name: 'catalog.closeFilters' })
    await waitFor(() => expect(closeButton).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'common.applyFilters' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
