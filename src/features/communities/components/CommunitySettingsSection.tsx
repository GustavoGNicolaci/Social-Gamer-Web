import { CommunityFilePicker } from '../../../components/communities/CommunityFilePicker'
import { useI18n } from '../../../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  type CommunityCategoryValue,
  type CommunityPostingPermission,
  type CommunityVisibility,
} from '../../../services/communityService'
import type { CommunitySettingsController } from '../hooks/useCommunitySettingsController'

const POSTING_PERMISSION_OPTIONS: CommunityPostingPermission[] = [
  'todos_membros',
  'somente_admins',
  'somente_lider',
]

export interface CommunitySettingsSectionProps {
  isLeader: boolean
  currentPostingPermission: CommunityPostingPermission
  postingPermissionDraft: CommunityPostingPermission
  settings: CommunitySettingsController
  onPostingPermissionDraftChange: (permission: CommunityPostingPermission) => void
  onConfirmPostingPermission: (permission: CommunityPostingPermission) => void
  onDeleteCommunity: () => void
}

export function CommunitySettingsSection({
  isLeader,
  currentPostingPermission,
  postingPermissionDraft,
  settings,
  onPostingPermissionDraftChange,
  onConfirmPostingPermission,
  onDeleteCommunity,
}: CommunitySettingsSectionProps) {
  const { t } = useI18n()
  const { draft, saving, update, submit } = settings.form
  const { file: bannerFile, previewUrl: bannerPreviewUrl, select: selectBannerFile } =
    settings.banner

  return (
    <div className="community-settings-layout">
      <section className="community-settings-card">
        <h2>{t('communities.tabs.settings')}</h2>
        <form className="community-settings-form" onSubmit={submit}>
          <label className="communities-field">
            <span>{t('communities.field.name')}</span>
            <input
              value={draft.nome}
              onChange={event => update('nome', event.target.value)}
              maxLength={80}
              required
              disabled={!isLeader}
            />
          </label>
          <label className="communities-field">
            <span>{t('communities.field.description')}</span>
            <textarea
              value={draft.descricao}
              onChange={event => update('descricao', event.target.value)}
              maxLength={600}
            />
          </label>
          <div className="communities-form-grid">
            <label className="communities-field">
              <span>{t('communities.field.theme')}</span>
              <input
                value={draft.tipo}
                onChange={event => update('tipo', event.target.value)}
                disabled={!isLeader}
              />
            </label>
            <label className="communities-field">
              <span>{t('communities.field.category')}</span>
              <select
                value={draft.categoria}
                onChange={event => (
                  update('categoria', event.target.value as CommunityCategoryValue | '')
                )}
                disabled={!isLeader}
              >
                <option value="">{t('communities.field.categoryPlaceholder')}</option>
                {COMMUNITY_CATEGORY_VALUES.map(option => (
                  <option key={option} value={option}>
                    {t(`communities.category.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="communities-field">
            <span>{t('communities.field.rules')}</span>
            <textarea
              value={draft.regras}
              onChange={event => update('regras', event.target.value)}
              maxLength={3000}
            />
          </label>
          <div className="communities-form-grid">
            <label className="communities-field">
              <span>{t('communities.field.visibility')}</span>
              <select
                value={draft.visibilidade}
                onChange={event => (
                  update('visibilidade', event.target.value as CommunityVisibility)
                )}
                disabled={!isLeader}
              >
                <option value="publica">{t('communities.visibility.publica')}</option>
                <option value="privada">{t('communities.visibility.privada')}</option>
              </select>
            </label>
          </div>
          <CommunityFilePicker
            label={t('communities.field.banner')}
            buttonLabel={t('communities.upload.chooseBanner')}
            removeLabel={t('communities.upload.removeImage')}
            uploadingLabel={t('communities.upload.uploading')}
            previewAlt={t('communities.settings.bannerPreview')}
            helperText={t('communities.upload.bannerHelper')}
            file={bannerFile}
            previewUrl={bannerPreviewUrl}
            disabled={saving}
            isUploading={saving && Boolean(bannerFile)}
            onChange={selectBannerFile}
          />
          <button type="submit" className="community-settings-button" disabled={saving}>
            {saving ? t('common.saving') : t('communities.settings.saveInfo')}
          </button>
        </form>
      </section>

      <section className="community-settings-card community-posting-settings-card">
        <div className="community-settings-card-head">
          <div>
            <h2>{t('communities.settings.postingTitle')}</h2>
            <p>{t('communities.settings.postingCompactHelp')}</p>
          </div>
        </div>

        <div
          className="community-posting-option-group"
          role="radiogroup"
          aria-label={t('communities.settings.postingRule')}
        >
          {POSTING_PERMISSION_OPTIONS.map(option => (
            <label
              key={option}
              className={`community-posting-option${postingPermissionDraft === option ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="community-posting-permission"
                value={option}
                checked={postingPermissionDraft === option}
                onChange={() => onPostingPermissionDraftChange(option)}
              />
              <span>
                <strong>{t(`communities.permission.${option}`)}</strong>
                <small>{t(`communities.permissionDescription.${option}`)}</small>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="community-settings-button"
          disabled={postingPermissionDraft === currentPostingPermission}
          onClick={() => onConfirmPostingPermission(postingPermissionDraft)}
        >
          {t('communities.settings.changePosting')}
        </button>
      </section>

      {isLeader ? (
        <section className="community-settings-card is-danger-zone">
          <h2>{t('common.dangerZone')}</h2>
          <p>{t('communities.settings.dangerText')}</p>
          <button
            type="button"
            className="community-danger-button"
            onClick={onDeleteCommunity}
          >
            {t('communities.settings.deleteCommunity')}
          </button>
        </section>
      ) : null}
    </div>
  )
}
