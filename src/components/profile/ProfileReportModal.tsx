import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  PROFILE_REPORT_REASON_OPTIONS,
  type CurrentUserProfileReportSummary,
  type ProfileReportReason,
} from '../../services/profileReportService'
import { useI18n } from '../../i18n/I18nContext'
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
  const { t, formatDate } = useI18n()
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

  const titleText = currentReport ? t('report.content.titleExisting') : t('report.profile.titleNew')
  const descriptionText = currentReport
    ? t('report.profile.descriptionExisting', { target: reportedUserLabel })
    : t('report.profile.descriptionNew', { target: reportedUserLabel })

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
              <span className="content-report-modal-kicker">{t('common.profile')}</span>
              <h2 id={titleId}>{titleText}</h2>
              <p id={descriptionId}>{descriptionText}</p>
            </div>

            <button
              type="button"
              className="content-report-modal-close-button"
              onClick={onClose}
              disabled={isBusy}
              aria-label={t('report.profile.close')}
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
                  {t('report.content.reasonLabel', { reason: t(`report.reason.${currentReport.reason}`) })}
                </span>
                <span className="content-report-modal-pill">
                  {t('report.content.statusLabel', { status: t(`report.status.${currentReport.status}`) })}
                </span>
                <span className="content-report-modal-pill">
                  {t('report.content.sentAt', {
                    date: formatDate(currentReport.createdAt, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      fallback: t('common.unavailableDate'),
                    }),
                  })}
                </span>
              </div>

              {currentReport.description ? (
                <div className="content-report-modal-note">
                  <strong>{t('report.content.detailsSent')}</strong>
                  <p>{currentReport.description}</p>
                </div>
              ) : (
                <div className="content-report-modal-note">
                  <strong>{t('report.content.noDetails')}</strong>
                  <p>{t('report.profile.noDetailsText')}</p>
                </div>
              )}

              <div className="content-report-modal-actions">
                <button
                  type="button"
                  className="game-button content-report-modal-danger-action"
                  onClick={onRemove}
                  disabled={isRemoving}
                >
                  {isRemoving ? t('common.removing') : t('report.content.remove')}
                </button>
                <button
                  type="button"
                  className="game-button content-report-modal-primary-action"
                  onClick={onClose}
                  disabled={isRemoving}
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          ) : (
            <form className="content-report-modal-form" onSubmit={handleSubmit}>
              <label className="content-report-modal-field">
                <span>{t('report.content.reason')}</span>
                <select
                  className="content-report-modal-select"
                  value={reason}
                  onChange={event => setReason(event.target.value as ProfileReportReason)}
                  disabled={isSubmitting}
                >
                  {PROFILE_REPORT_REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {t(`report.reason.${option.value}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="content-report-modal-field">
                <span>{t('report.content.detailsOptional')}</span>
                <textarea
                  className="content-report-modal-textarea"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder={t('report.content.placeholder')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="game-button content-report-modal-primary-action"
                  disabled={isBusy}
                >
                  {isSubmitting ? t('common.sending') : t('report.content.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
