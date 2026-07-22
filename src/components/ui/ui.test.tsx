import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { DialogShell } from './DialogShell'
import { StatePanel } from './StatePanel'
import { Tabs } from './Tabs'

afterEach(cleanup)

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <DialogShell open={open} onClose={() => setOpen(false)} titleId="dialog-title">
        <h2 id="dialog-title">Accessible dialog</h2>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </DialogShell>
    </>
  )
}

describe('UI primitives', () => {
  it('keeps native button attributes and exposes loading state', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('supports keyboard navigation with disabled tabs skipped', () => {
    const onChange = vi.fn()
    render(
      <Tabs
        ariaLabel="Profile sections"
        value="overview"
        onChange={onChange}
        items={[
          { id: 'overview', label: 'Overview', panelId: 'overview-panel' },
          { id: 'private', label: 'Private', panelId: 'private-panel', disabled: true },
          { id: 'reviews', label: 'Reviews', panelId: 'reviews-panel' },
        ]}
      />,
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('reviews')
  })

  it('traps focus, closes with Escape and restores focus to its trigger', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Accessible dialog' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    await waitFor(() => expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('announces loading and error states with distinct semantics', () => {
    const { rerender } = render(<StatePanel title="Loading games" tone="loading" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    rerender(<StatePanel title="Could not load" tone="error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
