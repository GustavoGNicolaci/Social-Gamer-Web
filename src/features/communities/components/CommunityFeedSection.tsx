import type {
  FormEventHandler,
  SetStateAction,
} from 'react'
import { CommunityFilePicker } from '../../../components/communities/CommunityFilePicker'
import { CommunityPostCard } from '../../../components/communities/CommunityPostCard'
import type { TranslationParams } from '../../../i18n'
import type {
  CommunityPost,
  CommunityReactionType,
  CommunityReportTargetType,
  CommunityRole,
} from '../../../services/communityService'

export interface CommunityFeedReportTarget {
  type: CommunityReportTargetType
  id: string
  label: string
}

export interface CommunityFeedComposerProps {
  canPost: boolean
  isAuthenticated: boolean
  unavailableMessage: string
  text: string
  imageFile: File | null
  imagePreviewUrl: string | null
  submitting: boolean
}

export interface CommunityFeedListProps {
  posts: CommunityPost[]
  loading: boolean
  currentUserId?: string | null
  currentUserRole: CommunityRole | null
  activeAnchorId: string
  page: number
  totalPages: number
}

export interface CommunityFeedActionsProps {
  onCreatePost: FormEventHandler<HTMLFormElement>
  onPostTextChange: (value: string) => void
  onPostImageFileChange: (file: File | null) => void
  onToggleReaction: (post: CommunityPost, reaction: CommunityReactionType) => Promise<void>
  onToggleSave: (post: CommunityPost) => Promise<void>
  onTogglePin: (post: CommunityPost) => Promise<void>
  onCreateComment: (post: CommunityPost, text: string) => Promise<void>
  onLoadMoreComments: (post: CommunityPost) => Promise<boolean>
  onDeletePost: (post: CommunityPost) => void
  onDeleteComment: (post: CommunityPost, commentId: string) => void
  onReport: (target: CommunityFeedReportTarget) => void
  onOpenImage: (url: string, alt: string) => void
  onPageChange: (update: SetStateAction<number>) => void
}

export interface CommunityFeedSectionProps {
  t: (key: string, params?: TranslationParams) => string
  composer: CommunityFeedComposerProps
  list: CommunityFeedListProps
  actions: CommunityFeedActionsProps
}

export function CommunityFeedSection({
  t,
  composer,
  list,
  actions,
}: CommunityFeedSectionProps) {
  return (
    <div className="community-feed">
      <section className="community-section">
        <h2>{t('communities.post.createTitle')}</h2>
        {composer.canPost ? (
          <form className="community-post-form" onSubmit={actions.onCreatePost}>
            <textarea
              value={composer.text}
              onChange={event => actions.onPostTextChange(event.target.value)}
              placeholder={t('communities.post.placeholder')}
              maxLength={4000}
              disabled={composer.submitting}
            />
            <CommunityFilePicker
              label={t('communities.post.optionalImage')}
              buttonLabel={t('communities.upload.addImage')}
              removeLabel={t('communities.upload.removeImage')}
              uploadingLabel={t('communities.upload.uploading')}
              previewAlt={t('communities.post.imageAlt')}
              helperText={t('communities.upload.postImageHelper')}
              file={composer.imageFile}
              previewUrl={composer.imagePreviewUrl}
              disabled={composer.submitting}
              isUploading={composer.submitting && Boolean(composer.imageFile)}
              onChange={actions.onPostImageFileChange}
            />
            <button type="submit" disabled={composer.submitting}>
              {composer.submitting
                ? t('communities.post.publishing')
                : t('communities.post.publish')}
            </button>
          </form>
        ) : (
          <p>
            {composer.isAuthenticated
              ? composer.unavailableMessage
              : t('communities.post.loginToInteract')}
          </p>
        )}
      </section>

      {list.loading ? (
        <div className="communities-state-card">{t('communities.post.loading')}</div>
      ) : list.posts.length === 0 ? (
        <div className="communities-state-card">{t('communities.post.empty')}</div>
      ) : (
        <>
          {list.posts.map(post => (
            <CommunityPostCard
              key={post.id}
              post={post}
              currentUserId={list.currentUserId}
              currentUserRole={list.currentUserRole}
              onToggleReaction={actions.onToggleReaction}
              onToggleSave={actions.onToggleSave}
              onTogglePin={actions.onTogglePin}
              onCreateComment={actions.onCreateComment}
              onLoadMoreComments={actions.onLoadMoreComments}
              onDeletePost={actions.onDeletePost}
              onDeleteComment={actions.onDeleteComment}
              onReport={actions.onReport}
              onOpenImage={actions.onOpenImage}
              activeAnchorId={list.activeAnchorId}
            />
          ))}

          <nav className="community-pagination" aria-label={t('communities.post.pagination')}>
            <button
              type="button"
              className="community-secondary-button"
              disabled={list.page <= 1}
              onClick={() => actions.onPageChange(currentPage => Math.max(1, currentPage - 1))}
            >
              {t('communities.post.previousPage')}
            </button>
            <span>
              {t('communities.post.pageLabel', {
                page: list.page,
                total: list.totalPages,
              })}
            </span>
            <button
              type="button"
              className="community-secondary-button"
              disabled={list.page >= list.totalPages}
              onClick={() => actions.onPageChange(currentPage => currentPage + 1)}
            >
              {t('communities.post.nextPage')}
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
