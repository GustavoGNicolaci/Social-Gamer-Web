import { Link } from 'react-router-dom'
import { UserAvatar } from '../../../components/UserAvatar'
import { useI18n } from '../../../i18n/I18nContext'
import { getOptionalPublicProfilePath } from '../../../utils/profileRoutes'
import type { ReviewComment } from '../domain/reviewModels'
import type { ReportTargetType } from '../domain/reviewInteractions'
import {
  formatReviewDate,
  getReviewUserName,
} from './gameReviewFormatters'
import {
  ReviewFlagIcon,
  ReviewHeartIcon,
  ReviewThumbDownIcon,
} from './gameReviewPresentation'

interface GameReviewCommentCardProps {
  reviewId: string
  comment: ReviewComment
  currentUserId: string | null
  reactionPending: boolean
  onToggleLike: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onToggleDislike: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onDelete: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onOpenReport: (
    targetType: ReportTargetType,
    targetId: string,
    reviewId: string
  ) => void
}

export function GameReviewCommentCard({
  reviewId,
  comment,
  currentUserId,
  reactionPending,
  onToggleLike,
  onToggleDislike,
  onDelete,
  onOpenReport,
}: GameReviewCommentCardProps) {
  const { t, formatNumber } = useI18n()
  const authorName = getReviewUserName(comment.usuario, t('common.username'))
  const authorProfilePath = getOptionalPublicProfilePath(comment.usuario?.username)
  const isOwner = comment.usuario_id === currentUserId
  const canReport = Boolean(currentUserId && !isOwner)
  const likeButtonLabel = !currentUserId
    ? t('game.details.loginToLike')
    : comment.canLike
      ? comment.likedByCurrentUser
        ? t('game.details.unlikeComment')
        : t('game.details.likeComment')
      : t('game.details.ownComment')
  const dislikeButtonLabel = !currentUserId
    ? t('game.details.loginToDislike')
    : comment.canDislike
      ? comment.dislikedByCurrentUser
        ? t('game.details.removeDislikeComment')
        : t('game.details.dislikeComment')
      : t('game.details.ownComment')
  const reportButtonLabel = comment.currentUserReport
    ? t('game.details.viewReportComment')
    : t('game.details.reportComment')

  return (
    <div id={`comment-${comment.id}`} className="game-review-comment-card">
      <div className="game-review-comment-header">
        {authorProfilePath ? (
          <Link
            to={authorProfilePath}
            className="game-review-comment-author-link"
            aria-label={t('game.details.openProfileAria', { name: authorName })}
          >
            <UserAvatar
              name={authorName}
              avatarPath={comment.usuario?.avatar_path}
              imageClassName="game-review-comment-avatar"
              fallbackClassName="game-review-comment-avatar-fallback"
            />

            <strong>{authorName}</strong>
          </Link>
        ) : (
          <div className="game-review-comment-author">
            <UserAvatar
              name={authorName}
              avatarPath={comment.usuario?.avatar_path}
              imageClassName="game-review-comment-avatar"
              fallbackClassName="game-review-comment-avatar-fallback"
            />

            <strong>{authorName}</strong>
          </div>
        )}

        <div className="game-review-comment-meta">
          <span className="game-review-comment-date">
            {formatReviewDate(comment.data_comentario)}
          </span>

          <div className="game-review-comment-meta-actions">
            <button
              type="button"
              className={`game-review-comment-reaction-button is-like${comment.likedByCurrentUser ? ' is-liked' : ''}`}
              onClick={() => void onToggleLike(reviewId, comment)}
              disabled={!currentUserId || !comment.canLike || reactionPending}
              aria-label={likeButtonLabel}
              title={likeButtonLabel}
              aria-pressed={comment.likedByCurrentUser}
            >
              <span className="game-review-reaction-icon">
                <ReviewHeartIcon filled={comment.likedByCurrentUser} />
              </span>
              <span>
                {reactionPending
                  ? t('common.updating')
                  : t('game.details.likeWithCount', {
                      count: formatNumber(comment.curtidas),
                    })}
              </span>
            </button>

            <button
              type="button"
              className={`game-review-comment-reaction-button${comment.dislikedByCurrentUser ? ' is-disliked' : ''}`}
              onClick={() => void onToggleDislike(reviewId, comment)}
              disabled={!currentUserId || !comment.canDislike || reactionPending}
              aria-label={dislikeButtonLabel}
              title={dislikeButtonLabel}
              aria-pressed={comment.dislikedByCurrentUser}
            >
              <span className="game-review-reaction-icon">
                <ReviewThumbDownIcon filled={comment.dislikedByCurrentUser} />
              </span>
              <span>
                {reactionPending
                  ? t('common.updating')
                  : t('game.details.dislikeWithCount', {
                      count: formatNumber(comment.dislikes),
                    })}
              </span>
            </button>

            {canReport ? (
              <button
                type="button"
                className={`game-review-report-button is-comment${comment.currentUserReport ? ' is-reported' : ''}`}
                onClick={() => onOpenReport('comment', comment.id, reviewId)}
                aria-label={reportButtonLabel}
                title={reportButtonLabel}
                aria-pressed={Boolean(comment.currentUserReport)}
              >
                <ReviewFlagIcon filled={Boolean(comment.currentUserReport)} />
              </button>
            ) : null}

            {isOwner ? (
              <button
                type="button"
                className="game-review-comment-delete-button"
                onClick={() => void onDelete(reviewId, comment)}
              >
                {t('game.details.deleteComment')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p className="game-review-comment-body">{comment.texto}</p>
    </div>
  )
}
