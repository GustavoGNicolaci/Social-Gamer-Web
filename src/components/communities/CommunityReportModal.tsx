import { useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { DialogShell } from '../ui/DialogShell'
import {
  COMMUNITY_REPORT_REASONS,
  type CommunityReportReason,
  type CommunityReportTargetType,
} from '../../services/communityService'

interface CommunityReportModalProps {
  targetType: CommunityReportTargetType
  targetLabel: string
  isSubmitting: boolean
  onSubmit: (payload: { reason: CommunityReportReason; description: string }) => void | Promise<void>
  onClose: () => void
}

export function CommunityReportModal({
  targetType,
  targetLabel,
  isSubmitting,
  onSubmit,
  onClose,
}: CommunityReportModalProps) {
  const { t } = useI18n()
  const [reason, setReason] = useState<CommunityReportReason>('spam')
  const [description, setDescription] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit({ reason, description })
  }

  return (
    <DialogShell
      open
      className="community-report-modal"
      titleId="community-report-title"
      descriptionId="community-report-description"
      onClose={() => {
        if (!isSubmitting) onClose()
      }}
    >
        <header className="community-report-modal-header">
          <div>
            <span className="communities-kicker">{t('communities.report.kicker')}</span>
            <h2 id="community-report-title">
              {targetType === 'post'
                ? t('communities.report.titlePost')
                : t('communities.report.titleComment')}
            </h2>
            <p id="community-report-description">{t('communities.report.description', { target: targetLabel })}</p>
          </div>
          <button
            type="button"
            className="community-lightbox-close"
            onClick={onClose}
            aria-label={t('common.close')}
            disabled={isSubmitting}
            data-dialog-autofocus
          >
            X
          </button>
        </header>

        <form className="community-report-form" onSubmit={handleSubmit}>
          <label className="communities-field">
            <span>{t('communities.report.reason')}</span>
            <select
              value={reason}
              onChange={event => setReason(event.target.value as CommunityReportReason)}
              disabled={isSubmitting}
            >
              {COMMUNITY_REPORT_REASONS.map(option => (
                <option key={option} value={option}>
                  {t(`report.reason.${option}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="communities-field">
            <span>{t('communities.report.details')}</span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder={t('communities.report.placeholder')}
              maxLength={1000}
              disabled={isSubmitting}
            />
          </label>

          <div className="community-confirm-actions">
            <button
              type="button"
              className="community-confirm-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="community-confirm-primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.sending') : t('communities.report.submit')}
            </button>
          </div>
        </form>
    </DialogShell>
  )
}
