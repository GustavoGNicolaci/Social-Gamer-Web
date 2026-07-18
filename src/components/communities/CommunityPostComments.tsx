import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import type {
  CommunityFeedReportTarget,
} from '../../features/communities/domain/communityDetailsTypes'
import { useI18n } from '../../i18n/I18nContext'
import type {
  CommunityPost,
  CommunityPostComment,
} from '../../services/communityService'
import { getOptionalPublicProfilePath } from '../../utils/profileRoutes'
import { UserAvatar } from '../UserAvatar'

interface CommunityPostCommentsProps {
  post: CommunityPost
  currentUserId?: string | null
  isModerator: boolean
  activeAnchorId?: string
  onCreateComment: (post: CommunityPost, text: string) => Promise<void>
  onLoadMoreComments: (post: CommunityPost) => Promise<boolean>
  onDeleteComment: (post: CommunityPost, commentId: string) => void
  onReport: (target: CommunityFeedReportTarget) => void
}

const INITIAL_VISIBLE_COMMENTS = 3
const COMMENT_BATCH_SIZE = 3

function getAuthorName(
  author: {
    username?: string | null
    nome_completo?: string | null
  } | null,
) {
  return author?.username || author?.nome_completo || 'usuario'
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

export function CommunityPostComments({
  post,
  currentUserId,
  isModerator,
  activeAnchorId,
  onCreateComment,
  onLoadMoreComments,
  onDeleteComment,
  onReport,
}: CommunityPostCommentsProps) {
  const { t, formatDate, formatNumber } = useI18n()
  const [visibleCommentCount, setVisibleCommentCount] = useState(
    INITIAL_VISIBLE_COMMENTS,
  )
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false)
  const commentLoadInFlightRef = useRef(false)

  const activeCommentIndex = useMemo(() => {
    if (!activeAnchorId?.startsWith('community-comment-')) return -1

    const commentId = activeAnchorId.replace('community-comment-', '')
    return post.comentarios.findIndex((comment) => comment.id === commentId)
  }, [activeAnchorId, post.comentarios])
  const effectiveVisibleCommentCount =
    activeCommentIndex >= 0
      ? Math.max(visibleCommentCount, activeCommentIndex + 1)
      : visibleCommentCount
  const visibleComments = useMemo(
    () => post.comentarios.slice(0, effectiveVisibleCommentCount),
    [effectiveVisibleCommentCount, post.comentarios],
  )
  const hiddenCommentsCount = Math.max(
    post.comentarios_count - visibleComments.length,
    0,
  )
  const nextCommentOffset =
    post.commentsNextOffset ?? post.comentarios.length
  const hasMoreCommentsToLoad =
    nextCommentOffset < post.comentarios_count

  useEffect(() => {
    if (
      !activeAnchorId?.startsWith('community-comment-')
      || activeCommentIndex < 0
    ) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(activeAnchorId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeAnchorId, activeCommentIndex])

  const handleSubmitComment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    const normalizedText = commentText.trim()
    if (!normalizedText) return

    setIsSubmittingComment(true)
    try {
      await onCreateComment(post, normalizedText)
      setCommentText('')
      setVisibleCommentCount((currentCount) =>
        Math.max(currentCount, INITIAL_VISIBLE_COMMENTS),
      )
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleShowMoreComments = async () => {
    if (commentLoadInFlightRef.current) return

    if (!hasMoreCommentsToLoad) {
      setVisibleCommentCount((currentCount) =>
        Math.min(
          currentCount + COMMENT_BATCH_SIZE,
          post.comentarios.length,
        ),
      )
      return
    }

    commentLoadInFlightRef.current = true
    setIsLoadingMoreComments(true)
    try {
      const loaded = await onLoadMoreComments(post)
      if (loaded) {
        setVisibleCommentCount(
          (currentCount) => currentCount + COMMENT_BATCH_SIZE,
        )
      }
    } finally {
      commentLoadInFlightRef.current = false
      setIsLoadingMoreComments(false)
    }
  }

  const renderComment = (comment: CommunityPostComment) => {
    const commentAuthorName = getAuthorName(comment.autor)
    const commentAuthorPath = getOptionalPublicProfilePath(
      comment.autor?.username,
    )
    const canDeleteComment =
      Boolean(currentUserId && comment.autor_id === currentUserId)
      || isModerator
    const canReportComment = Boolean(
      post.canInteract
      && currentUserId
      && comment.autor_id !== currentUserId,
    )
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
      <div
        key={comment.id}
        id={`community-comment-${comment.id}`}
        className="community-comment-card"
      >
        <div className="community-comment-header">
          {commentAuthorPath ? (
            <Link
              to={commentAuthorPath}
              className="community-comment-author"
            >
              {authorContent}
            </Link>
          ) : (
            <div className="community-comment-author">
              {authorContent}
            </div>
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
                    label: t('communities.report.commentTarget', {
                      author: `@${commentAuthorName}`,
                    }),
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
    <section
      className="community-comments"
      aria-label={t('common.comments')}
    >
      {visibleComments.length > 0 ? (
        <div className="community-comment-list">
          {visibleComments.map(renderComment)}
        </div>
      ) : null}

      {hiddenCommentsCount > 0 ? (
        <button
          type="button"
          className="community-expand-button"
          onClick={() => void handleShowMoreComments()}
          disabled={isLoadingMoreComments}
        >
          {t('communities.post.moreComments', {
            count: formatNumber(hiddenCommentsCount),
          })}
        </button>
      ) : null}

      {post.canInteract ? (
        <form
          className="community-comment-form"
          onSubmit={handleSubmitComment}
        >
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder={t('communities.post.commentPlaceholder')}
            maxLength={1200}
            disabled={isSubmittingComment}
          />
          <button
            type="submit"
            disabled={isSubmittingComment || !commentText.trim()}
          >
            {isSubmittingComment
              ? t('common.sending')
              : t('common.comment')}
          </button>
        </form>
      ) : null}
    </section>
  )
}
