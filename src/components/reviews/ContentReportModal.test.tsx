import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentReportModal } from './ContentReportModal'

vi.mock('../../services/reviewInteractionsService', () => ({
  REPORT_REASON_OPTIONS: [{ value: 'spam' }],
}))

vi.mock('../../i18n/I18nContext', () => ({
  useI18n: () => ({
    formatDate: (value: string) => value,
    t: (key: string) => key,
  }),
}))

afterEach(cleanup)

describe('ContentReportModal accessibility', () => {
  it('keeps keyboard focus inside the dialog and returns it to the trigger', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'report'
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()

    const view = render(
      <ContentReportModal
        currentReport={null}
        feedback={null}
        isSubmitting={false}
        isRemoving={false}
        targetLabel="Review"
        targetType="review"
        onClose={onClose}
        onSubmit={vi.fn()}
        onRemove={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const closeButton = screen.getByRole('button', { name: 'report.content.close' })
    await waitFor(() => expect(closeButton).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'report.content.submit' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('keeps focus trapped when controls become disabled during submission', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const props = {
      currentReport: null,
      feedback: null,
      isRemoving: false,
      targetLabel: 'Review',
      targetType: 'review' as const,
      onClose,
      onSubmit: vi.fn(),
      onRemove: vi.fn(),
    }
    const view = render(<ContentReportModal {...props} isSubmitting={false} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'report.content.close' })).toHaveFocus())
    view.rerender(<ContentReportModal {...props} isSubmitting />)
    expect(trigger).not.toHaveFocus()

    trigger.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('dialog')).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    view.unmount()
    trigger.remove()
  })
})
