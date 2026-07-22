import './CommunityConfirmModal.css'
import { DialogShell } from '../ui/DialogShell'

interface CommunityConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  submittingLabel?: string
  tone?: 'danger' | 'default'
  isSubmitting?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function CommunityConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  submittingLabel = 'Processando...',
  tone = 'default',
  isSubmitting = false,
  onConfirm,
  onClose,
}: CommunityConfirmModalProps) {
  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <DialogShell
      open
      className="community-confirm-modal"
      titleId="community-confirm-title"
      descriptionId="community-confirm-description"
      onClose={handleClose}
    >
        <div className="community-confirm-copy">
          <h2 id="community-confirm-title">{title}</h2>
          <p id="community-confirm-description">{description}</p>
        </div>

        <div className="community-confirm-actions">
          <button
            type="button"
            className="community-confirm-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`community-confirm-primary is-${tone}`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? submittingLabel : confirmLabel}
          </button>
        </div>
    </DialogShell>
  )
}
