import './CommunityConfirmModal.css'

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
  return (
    <div className="community-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="community-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-confirm-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="community-confirm-copy">
          <h2 id="community-confirm-title">{title}</h2>
          <p>{description}</p>
        </div>

        <div className="community-confirm-actions">
          <button
            type="button"
            className="community-confirm-secondary"
            onClick={onClose}
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
      </div>
    </div>
  )
}
