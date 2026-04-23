import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  REPORT_REASON_LABELS,
  REPORT_REASON_OPTIONS,
  REPORT_STATUS_LABELS,
  type CurrentUserReportSummary,
  type ReportReason,
  type ReportTargetType,
} from '../../services/reviewInteractionsService'
import './ContentReportModal.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface ModalFeedback {
  tone: FeedbackTone
  message: string
}

interface ContentReportModalProps {
  currentReport: CurrentUserReportSummary | null
  feedback: ModalFeedback | null
  isSubmitting: boolean
  targetLabel: string
  targetType: ReportTargetType
  onClose: () => void
  onSubmit: (payload: { reason: ReportReason; description: string }) => void | Promise<void>
}

const DEFAULT_REPORT_REASON: ReportReason = 'spam'

function formatReportDate(value: string | null | undefined) {
  if (!value) return 'Data indisponivel'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Data indisponivel'

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function ContentReportModal({
  currentReport,
  feedback,
  isSubmitting,
  targetLabel,
  targetType,
  onClose,
  onSubmit,
}: ContentReportModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const [reason, setReason] = useState<ReportReason>(currentReport?.reason || DEFAULT_REPORT_REASON)
  const [description, setDescription] = useState(currentReport?.description || '')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit({
      reason,
      description,
    })
  }

  const titleText = currentReport ? 'Denuncia registrada' : 'Denunciar conteudo'
  const descriptionText = currentReport
    ? `Voce ja denunciou ${targetLabel}. Aqui esta o status atual da sua denuncia.`
    : `Explique rapidamente o motivo da denuncia de ${targetLabel}.`

  return (
    <div className="content-report-modal-backdrop" onClick={onClose}>
      <div
        className="content-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={event => event.stopPropagation()}
      >
        <div className="content-report-modal-glow content-report-modal-glow-left"></div>
        <div className="content-report-modal-glow content-report-modal-glow-right"></div>

        <div className="content-report-modal-content">
          <header className="content-report-modal-header">
            <div className="content-report-modal-copy">
              <span className="content-report-modal-kicker">
                {targetType === 'review' ? 'Review' : 'Comentario'}
              </span>
              <h2 id={titleId}>{titleText}</h2>
              <p id={descriptionId}>{descriptionText}</p>
            </div>

            <button
              type="button"
              className="content-report-modal-close-button"
              onClick={onClose}
              aria-label="Fechar modal de denuncia"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </header>

          {feedback ? (
            <p className={`content-report-modal-feedback is-${feedback.tone}`}>{feedback.message}</p>
          ) : null}

          {currentReport ? (
            <div className="content-report-modal-summary">
              <div className="content-report-modal-pill-row">
                <span className="content-report-modal-pill">
                  Motivo: {REPORT_REASON_LABELS[currentReport.reason]}
                </span>
                <span className="content-report-modal-pill">
                  Status: {REPORT_STATUS_LABELS[currentReport.status]}
                </span>
                <span className="content-report-modal-pill">
                  Enviada em {formatReportDate(currentReport.createdAt)}
                </span>
              </div>

              {currentReport.description ? (
                <div className="content-report-modal-note">
                  <strong>Detalhes enviados</strong>
                  <p>{currentReport.description}</p>
                </div>
              ) : (
                <div className="content-report-modal-note">
                  <strong>Sem detalhes extras</strong>
                  <p>Voce enviou apenas o motivo principal da denuncia.</p>
                </div>
              )}

              <div className="content-report-modal-actions">
                <button
                  type="button"
                  className="game-button content-report-modal-primary-action"
                  onClick={onClose}
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <form className="content-report-modal-form" onSubmit={handleSubmit}>
              <label className="content-report-modal-field">
                <span>Motivo da denuncia</span>
                <select
                  className="content-report-modal-select"
                  value={reason}
                  onChange={event => setReason(event.target.value as ReportReason)}
                  disabled={isSubmitting}
                >
                  {REPORT_REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="content-report-modal-field">
                <span>Detalhes adicionais (opcional)</span>
                <textarea
                  className="content-report-modal-textarea"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="Se quiser, descreva o contexto para ajudar na moderacao."
                  disabled={isSubmitting}
                />
              </label>

              <div className="content-report-modal-actions">
                <button
                  type="button"
                  className="game-button content-report-modal-secondary-action"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="game-button content-report-modal-primary-action"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar denuncia'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
