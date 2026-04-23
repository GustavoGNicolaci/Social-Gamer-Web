import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  PROFILE_REPORT_REASON_LABELS,
  PROFILE_REPORT_REASON_OPTIONS,
  PROFILE_REPORT_STATUS_LABELS,
  type CurrentUserProfileReportSummary,
  type ProfileReportReason,
} from '../../services/profileReportService'
import '../reviews/ContentReportModal.css'

type FeedbackTone = 'success' | 'error' | 'info'

interface ModalFeedback {
  tone: FeedbackTone
  message: string
}

interface ProfileReportModalProps {
  currentReport: CurrentUserProfileReportSummary | null
  feedback: ModalFeedback | null
  isSubmitting: boolean
  isRemoving: boolean
  reportedUserLabel: string
  onClose: () => void
  onSubmit: (payload: { reason: ProfileReportReason; description: string }) => void | Promise<void>
  onRemove: () => void | Promise<void>
}

const DEFAULT_PROFILE_REPORT_REASON: ProfileReportReason = 'foto_ofensiva'

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

export function ProfileReportModal({
  currentReport,
  feedback,
  isSubmitting,
  isRemoving,
  reportedUserLabel,
  onClose,
  onSubmit,
  onRemove,
}: ProfileReportModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const [reason, setReason] = useState<ProfileReportReason>(() =>
    currentReport?.reason || DEFAULT_PROFILE_REPORT_REASON
  )
  const [description, setDescription] = useState(() => currentReport?.description || '')
  const isBusy = isSubmitting || isRemoving

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
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
  }, [isBusy, onClose])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit({
      reason,
      description,
    })
  }

  const titleText = currentReport ? 'Denuncia registrada' : 'Denunciar perfil'
  const descriptionText = currentReport
    ? `Voce ja denunciou ${reportedUserLabel}. Aqui esta o status atual da sua denuncia.`
    : `Explique rapidamente o motivo da denuncia de ${reportedUserLabel}.`

  return (
    <div
      className="content-report-modal-backdrop"
      onClick={() => {
        if (!isBusy) {
          onClose()
        }
      }}
    >
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
              <span className="content-report-modal-kicker">Perfil</span>
              <h2 id={titleId}>{titleText}</h2>
              <p id={descriptionId}>{descriptionText}</p>
            </div>

            <button
              type="button"
              className="content-report-modal-close-button"
              onClick={onClose}
              disabled={isBusy}
              aria-label="Fechar modal de denuncia de perfil"
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
                  Motivo: {PROFILE_REPORT_REASON_LABELS[currentReport.reason]}
                </span>
                <span className="content-report-modal-pill">
                  Status: {PROFILE_REPORT_STATUS_LABELS[currentReport.status]}
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
                  <p>Voce enviou apenas o motivo principal da denuncia deste perfil.</p>
                </div>
              )}

              <div className="content-report-modal-actions">
                <button
                  type="button"
                  className="game-button content-report-modal-danger-action"
                  onClick={onRemove}
                  disabled={isRemoving}
                >
                  {isRemoving ? 'Removendo...' : 'Remover denuncia'}
                </button>
                <button
                  type="button"
                  className="game-button content-report-modal-primary-action"
                  onClick={onClose}
                  disabled={isRemoving}
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
                  onChange={event => setReason(event.target.value as ProfileReportReason)}
                  disabled={isSubmitting}
                >
                  {PROFILE_REPORT_REASON_OPTIONS.map(option => (
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
                  disabled={isBusy}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="game-button content-report-modal-primary-action"
                  disabled={isBusy}
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
