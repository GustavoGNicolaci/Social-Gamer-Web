import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import { useI18n } from '../../i18n/I18nContext'
import {
  type CommunityPost,
  type CommunityPostComment,
  type CommunityReactionType,
  type CommunityReportTargetType,
  type CommunityRole,
} from '../../services/communityService'
import { resolvePublicFileUrl } from '../../services/storageService'
import { getOptionalPublicProfilePath } from '../../utils/profileRoutes'

interface CommunityReportTarget {
  type: CommunityReportTargetType
  id: string
  label: string
}

interface CommunityPostCardProps {
  post: CommunityPost
  currentUserId?: string | null
  currentUserRole?: CommunityRole | null
  onToggleReaction: (post: CommunityPost, reaction: CommunityReactionType) => Promise<void>
  onToggleSave: (post: CommunityPost) => Promise<void>
  onCreateComment: (post: CommunityPost, text: string) => Promise<void>
  onDeletePost: (post: CommunityPost) => void
  onDeleteComment: (post: CommunityPost, commentId: string) => void
  onReport: (target: CommunityReportTarget) => void
  onOpenImage: (imageUrl: string, alt: string) => void
  activeAnchorId?: string
}

const INITIAL_VISIBLE_COMMENTS = 3
const COMMENT_BATCH_SIZE = 3

function iconThumbsUp(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M7.5 21H5.2C4.54 21 4 20.46 4 19.8V10.7C4 10.04 4.54 9.5 5.2 9.5H7.5M7.5 21V9.5M7.5 21H17.2C18.15 21 18.96 20.33 19.14 19.39L20.46 12.39C20.69 11.19 19.77 10.08 18.55 10.08H14.8L15.42 6.98C15.59 6.13 15.33 5.25 14.73 4.62L14.3 4.17C13.83 3.68 13.03 3.77 12.68 4.35L9.15 10.15C8.8 10.73 8.17 11.08 7.5 11.08"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconThumbsDown(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M16.5 3H18.8C19.46 3 20 3.54 20 4.2V13.3C20 13.96 19.46 14.5 18.8 14.5H16.5M16.5 3V14.5M16.5 3H6.8C5.85 3 5.04 3.67 4.86 4.61L3.54 11.61C3.31 12.81 4.23 13.92 5.45 13.92H9.2L8.58 17.02C8.41 17.87 8.67 18.75 9.27 19.38L9.7 19.83C10.17 20.32 10.97 20.23 11.32 19.65L14.85 13.85C15.2 13.27 15.83 12.92 16.5 12.92"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconBookmark(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M6.5 4.8C6.5 3.81 7.31 3 8.3 3H15.7C16.69 3 17.5 3.81 17.5 4.8V20L12 16.7L6.5 20V4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 21V4.7M6 4.7C8.8 2.9 11.2 5.9 14 4.2C15.5 3.3 17 3.4 18.5 4.2V13.2C17 12.4 15.5 12.3 14 13.2C11.2 14.9 8.8 11.9 6 13.7V4.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getAuthorName(author: { username?: string | null; nome_completo?: string | null } | null) {
  return author?.username || author?.nome_completo || 'usuario'
}

export function CommunityPostCard({
  post,
  currentUserId,
  currentUserRole,
  onToggleReaction,
  onToggleSave,
  onCreateComment,
  onDeletePost,
  onDeleteComment,
  onReport,
  onOpenImage,
  activeAnchorId,
}: CommunityPostCardProps) {
  const { t, formatDate, formatNumber } = useI18n()
  const [visibleCommentCount, setVisibleCommentCount] = useState(INITIAL_VISIBLE_COMMENTS)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const authorName = getAuthorName(post.autor)
  const authorProfilePath = getOptionalPublicProfilePath(post.autor?.username)
  const postImageUrl = resolvePublicFileUrl(post.imagem_path)
  const visibleComments = useMemo(
    () => post.comentarios.slice(0, visibleCommentCount),
    [post.comentarios, visibleCommentCount]
  )
  const hiddenCommentsCount = post.comentarios.length - visibleComments.length
  const isModerator = currentUserRole === 'lider' || currentUserRole === 'admin'
  const canReport = Boolean(post.canInteract && currentUserId && post.autor_id !== currentUserId)

  useEffect(() => {
    if (!activeAnchorId) return

    if (activeAnchorId === `post-${post.id}`) {
      const frameId = window.requestAnimationFrame(() => {
        document.getElementById(activeAnchorId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    if (!activeAnchorId.startsWith('community-comment-')) return

    const commentId = activeAnchorId.replace('community-comment-', '')
    const commentIndex = post.comentarios.findIndex(comment => comment.id === commentId)

    if (commentIndex < 0) return

    if (commentIndex >= visibleCommentCount) {
      setVisibleCommentCount(commentIndex + 1)
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(activeAnchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeAnchorId, post.comentarios, post.id, visibleCommentCount])

  const handleReaction = async (reaction: CommunityReactionType) => {
    setPendingAction(reaction)
    try {
      await onToggleReaction(post, reaction)
    } finally {
      setPendingAction(null)
    }
  }

  const handleSave = async () => {
    setPendingAction('save')
    try {
      await onToggleSave(post)
    } finally {
      setPendingAction(null)
    }
  }

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedText = commentText.trim()
    if (!normalizedText) return

    setIsSubmittingComment(true)
    try {
      await onCreateComment(post, normalizedText)
      setCommentText('')
      setVisibleCommentCount(currentCount => Math.max(currentCount, INITIAL_VISIBLE_COMMENTS))
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const formattedPostDate = formatDate(post.created_at, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    fallback: t('common.noDate'),
  })

  const renderAuthor = () => {
    const content = (
      <>
        <UserAvatar
          name={authorName}
          avatarPath={post.autor?.avatar_path}
          imageClassName="community-post-avatar"
          fallbackClassName="community-post-avatar-fallback"
        />
        <span>
          <strong>@{authorName}</strong>
          <small>{formattedPostDate}</small>
        </span>
      </>
    )

    return authorProfilePath ? (
      <Link to={authorProfilePath} className="community-post-author">
        {content}
      </Link>
    ) : (
      <div className="community-post-author">{content}</div>
    )
  }

  const renderComment = (comment: CommunityPostComment) => {
    const commentAuthorName = getAuthorName(comment.autor)
    const commentAuthorPath = getOptionalPublicProfilePath(comment.autor?.username)
    const canDeleteComment =
      Boolean(currentUserId && comment.autor_id === currentUserId) || isModerator
    const canReportComment = Boolean(post.canInteract && currentUserId && comment.autor_id !== currentUserId)
    const formattedCommentDate = formatDate(comment.created_at, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      fallback: t('common.noDate'),
    })
    const authorContent = (
      <>
        <UserAvatar
          name={commentAuthorName}
          avatarPath={comment.autor?.avatar_path}
          imageClassName="community-comment-avatar"
          fallbackClassName="community-comment-avatar-fallback"
        />
        <strong>@{commentAuthorName}</strong>
      </>
    )

    return (
      <div key={comment.id} id={`community-comment-${comment.id}`} className="community-comment-card">
        <div className="community-comment-header">
          {commentAuthorPath ? (
            <Link to={commentAuthorPath} className="community-comment-author">
              {authorContent}
            </Link>
          ) : (
            <div className="community-comment-author">{authorContent}</div>
          )}

          <div className="community-comment-meta">
            <span>{formattedCommentDate}</span>
            {canReportComment ? (
              <button
                type="button"
                className="community-icon-action"
                aria-label={t('communities.post.reportComment')}
                title={t('communities.post.reportComment')}
                onClick={() =>
                  onReport({
                    type: 'comentario',
                    id: comment.id,
                    label: t('communities.report.commentTarget', { author: `@${commentAuthorName}` }),
                  })
                }
              >
                {iconFlag()}
              </button>
            ) : null}
            {canDeleteComment ? (
              <button
                type="button"
                className="community-danger-link is-compact"
                onClick={() => onDeleteComment(post, comment.id)}
              >
                {t('common.delete')}
              </button>
            ) : null}
          </div>
        </div>

        <p>{comment.texto}</p>
      </div>
    )
  }

  return (
    <article id={`post-${post.id}`} className="community-post-card">
      <header className="community-post-header">
        {renderAuthor()}

        <div className="community-post-header-actions">
          {canReport ? (
            <button
              type="button"
              className="community-icon-action"
              aria-label={t('communities.post.reportPost')}
              title={t('communities.post.reportPost')}
              onClick={() =>
                onReport({
                  type: 'post',
                  id: post.id,
                  label: t('communities.report.postTarget', { author: `@${authorName}` }),
                })
              }
            >
              {iconFlag()}
            </button>
          ) : null}

          {post.canDelete ? (
            <button type="button" className="community-danger-link" onClick={() => onDeletePost(post)}>
              {t('communities.post.deletePost')}
            </button>
          ) : null}
        </div>
      </header>

      {post.texto ? <p className="community-post-text">{post.texto}</p> : null}

      {postImageUrl ? (
        <button
          type="button"
          className="community-post-image-button"
          onClick={() => onOpenImage(postImageUrl, t('communities.post.imageAlt'))}
        >
          <img className="community-media-backdrop" src={postImageUrl} alt="" aria-hidden="true" />
          <img className="community-post-image" src={postImageUrl} alt={t('communities.post.imageAlt')} />
        </button>
      ) : null}

      <div className="community-post-actions" aria-label={t('communities.post.actionsLabel')}>
        <button
          type="button"
          className={`community-action-button${post.currentUserReaction === 'curtida' ? ' is-active' : ''}`}
          onClick={() => void handleReaction('curtida')}
          disabled={!post.canInteract || pendingAction !== null}
        >
          {iconThumbsUp(post.currentUserReaction === 'curtida')}
          <span>{t('communities.post.like')}</span>
          <strong>{formatNumber(post.curtidas_count)}</strong>
        </button>

        <button
          type="button"
          className={`community-action-button${post.currentUserReaction === 'dislike' ? ' is-active is-dislike' : ''}`}
          onClick={() => void handleReaction('dislike')}
          disabled={!post.canInteract || pendingAction !== null}
        >
          {iconThumbsDown(post.currentUserReaction === 'dislike')}
          <span>{t('communities.post.dislike')}</span>
          <strong>{formatNumber(post.dislikes_count)}</strong>
        </button>

        <button
          type="button"
          className={`community-action-button${post.savedByCurrentUser ? ' is-saved' : ''}`}
          onClick={() => void handleSave()}
          disabled={!post.canInteract || pendingAction !== null}
        >
          {iconBookmark(post.savedByCurrentUser)}
          <span>{post.savedByCurrentUser ? t('communities.post.saved') : t('communities.post.save')}</span>
        </button>

        <span className="community-post-count">
          {t('communities.post.commentsCount', { count: formatNumber(post.comentarios_count) })}
        </span>
      </div>

      <section className="community-comments" aria-label={t('common.comments')}>
        {visibleComments.length > 0 ? (
          <div className="community-comment-list">
            {visibleComments.map(renderComment)}
          </div>
        ) : null}

        {hiddenCommentsCount > 0 ? (
          <button
            type="button"
            className="community-expand-button"
            onClick={() =>
              setVisibleCommentCount(currentCount =>
                Math.min(currentCount + COMMENT_BATCH_SIZE, post.comentarios.length)
              )
            }
          >
            {t('communities.post.moreComments', { count: formatNumber(hiddenCommentsCount) })}
          </button>
        ) : null}

        {post.canInteract ? (
          <form className="community-comment-form" onSubmit={handleSubmitComment}>
            <textarea
              value={commentText}
              onChange={event => setCommentText(event.target.value)}
              placeholder={t('communities.post.commentPlaceholder')}
              maxLength={1200}
              disabled={isSubmittingComment}
            />
            <button type="submit" disabled={isSubmittingComment || !commentText.trim()}>
              {isSubmittingComment ? t('common.sending') : t('common.comment')}
            </button>
          </form>
        ) : null}
      </section>
    </article>
  )
}
