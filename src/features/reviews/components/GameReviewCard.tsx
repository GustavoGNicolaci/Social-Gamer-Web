import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import RatingCircle from '../../../components/RatingCircle'
import { UserAvatar } from '../../../components/UserAvatar'
import { useI18n } from '../../../i18n/I18nContext'
import { getOptionalPublicProfilePath } from '../../../utils/profileRoutes'
import type { ReviewComment, ReviewItem } from '../domain/reviewModels'
import type { ReportTargetType } from '../domain/reviewInteractions'
import { GameReviewComments } from './GameReviewComments'
import {
  formatReviewDate,
  formatReviewScore,
  getReviewUserName,
} from './gameReviewFormatters'
import {
  ReviewFlagIcon,
  ReviewHeartIcon,
  ReviewThumbDownIcon,
} from './gameReviewPresentation'

interface GameReviewCardProps {
  review: ReviewItem
  currentUserId: string | null
  visibleCommentCount: number
  totalCommentCount: number
  commentText: string
  isSubmittingComment: boolean
  isLoadingComments: boolean
  isReviewReactionPending: boolean
  isReviewDeletePending: boolean
  pendingCommentReactionIds: readonly string[]
  onToggleReviewLike: (review: ReviewItem) => void | Promise<void>
  onToggleReviewDislike: (review: ReviewItem) => void | Promise<void>
  onDeleteReview: (review: ReviewItem) => void | Promise<void>
  onToggleCommentLike: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onToggleCommentDislike: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onDeleteComment: (reviewId: string, comment: ReviewComment) => void | Promise<void>
  onOpenReportModal: (
    targetType: ReportTargetType,
    targetId: string,
    reviewId: string
  ) => void
  onExpandComments: (reviewId: string, totalComments: number) => void | Promise<void>
  onSubmitComment: (reviewId: string, event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCommentTextChange: (reviewId: string, value: string) => void
}

export function GameReviewCard({
  review,
  currentUserId,
  visibleCommentCount,
  totalCommentCount,
  commentText,
  isSubmittingComment,
  isLoadingComments,
  isReviewReactionPending,
  isReviewDeletePending,
  pendingCommentReactionIds,
  onToggleReviewLike,
  onToggleReviewDislike,
  onDeleteReview,
  onToggleCommentLike,
  onToggleCommentDislike,
  onDeleteComment,
  onOpenReportModal,
  onExpandComments,
  onSubmitComment,
  onCommentTextChange,
}: GameReviewCardProps) {
  const { t, formatNumber, locale } = useI18n()
  const avaliadorNome = getReviewUserName(review.usuario, t('common.username'))
  const avaliadorProfilePath = getOptionalPublicProfilePath(review.usuario?.username)
  const isOwnerReview = review.usuario_id === currentUserId
  const likeButtonLabel = !currentUserId
    ? t('game.details.loginToLike')
    : review.canLike
      ? review.likedByCurrentUser
        ? t('game.details.unlikeReview')
        : t('game.details.likeReview')
      : t('game.details.ownReview')
  const dislikeButtonLabel = !currentUserId
    ? t('game.details.loginToDislike')
    : review.canDislike
      ? review.dislikedByCurrentUser
        ? t('game.details.removeDislikeReview')
        : t('game.details.dislikeReview')
      : t('game.details.ownReview')
  const reportButtonLabel = review.currentUserReport
    ? t('game.details.viewReportReview')
    : t('game.details.reportReview')

  return (
    <article id={`review-${review.id}`} className="game-review-card">
      <div className="game-review-card-header">
        {avaliadorProfilePath ? (
          <Link
            to={avaliadorProfilePath}
            className="game-review-user-link"
            aria-label={t('game.details.openProfileAria', { name: avaliadorNome })}
          >
            <UserAvatar
              name={avaliadorNome}
              avatarPath={review.usuario?.avatar_path}
              imageClassName="game-review-avatar"
              fallbackClassName="game-review-avatar-fallback"
            />

            <div className="game-review-user-copy">
              <strong>{avaliadorNome}</strong>
              <span>{formatReviewDate(review.data_publicacao)}</span>
            </div>
          </Link>
        ) : (
          <div className="game-review-user">
            <UserAvatar
              name={avaliadorNome}
              avatarPath={review.usuario?.avatar_path}
              imageClassName="game-review-avatar"
              fallbackClassName="game-review-avatar-fallback"
            />

            <div className="game-review-user-copy">
              <strong>{avaliadorNome}</strong>
              <span>{formatReviewDate(review.data_publicacao)}</span>
            </div>
          </div>
        )}

        <div className="game-review-header-side">
          {currentUserId && !isOwnerReview ? (
            <button
              type="button"
              className={`game-review-report-button${review.currentUserReport ? ' is-reported' : ''}`}
              onClick={() => onOpenReportModal('review', review.id, review.id)}
              aria-label={reportButtonLabel}
              title={reportButtonLabel}
              aria-pressed={Boolean(review.currentUserReport)}
            >
              <ReviewFlagIcon filled={Boolean(review.currentUserReport)} />
            </button>
          ) : null}

          <div className="game-review-score">
            <RatingCircle
              value={review.nota}
              size={54}
              strokeWidth={4}
              ariaLabel={`${t('game.details.averageRating')}: ${formatReviewScore(review.nota)}/10`}
              locale={locale}
            />
            <span className="game-review-score-label">
              {formatReviewScore(review.nota)}/10
            </span>
          </div>
        </div>
      </div>

      {review.texto_review ? (
        <p className="game-review-body">{review.texto_review}</p>
      ) : (
        <p className="game-review-body is-muted">
          {t('game.details.reviewOnlyScore')}
        </p>
      )}

      <div className="game-review-meta">
        <div className="game-review-reactions">
          <button
            type="button"
            className={`game-review-reaction-button is-like${review.likedByCurrentUser ? ' is-active is-liked' : ''}`}
            onClick={() => void onToggleReviewLike(review)}
            disabled={!currentUserId || !review.canLike || isReviewReactionPending}
            aria-label={likeButtonLabel}
            title={likeButtonLabel}
            aria-pressed={review.likedByCurrentUser}
          >
            <span className="game-review-reaction-icon">
              <ReviewHeartIcon filled={review.likedByCurrentUser} />
            </span>
            <span>
              {isReviewReactionPending
                ? t('common.updating')
                : review.likedByCurrentUser
                  ? t('game.details.liked')
                  : t('game.details.like')}
            </span>
          </button>
          <span>
            {review.curtidas === 1
              ? t('game.details.likes.one')
              : t('game.details.likes.many', { count: formatNumber(review.curtidas) })}
          </span>

          <button
            type="button"
            className={`game-review-reaction-button is-dislike${review.dislikedByCurrentUser ? ' is-active is-disliked' : ''}`}
            onClick={() => void onToggleReviewDislike(review)}
            disabled={!currentUserId || !review.canDislike || isReviewReactionPending}
            aria-label={dislikeButtonLabel}
            title={dislikeButtonLabel}
            aria-pressed={review.dislikedByCurrentUser}
          >
            <span className="game-review-reaction-icon">
              <ReviewThumbDownIcon filled={review.dislikedByCurrentUser} />
            </span>
            <span>
              {isReviewReactionPending
                ? t('common.updating')
                : review.dislikedByCurrentUser
                  ? t('game.details.dislike')
                  : t('game.details.dislike')}
            </span>
          </button>
          <span>
            {review.dislikes === 1
              ? t('game.details.dislikes.one')
              : t('game.details.dislikes.many', { count: formatNumber(review.dislikes) })}
          </span>
        </div>

        <span>
          {totalCommentCount === 1
            ? t('game.details.comments.one')
            : t('game.details.comments.many', { count: formatNumber(totalCommentCount) })}
        </span>
        {isOwnerReview ? (
          <button
            type="button"
            className="game-review-delete-button"
            onClick={() => void onDeleteReview(review)}
            disabled={isReviewDeletePending}
          >
            {isReviewDeletePending ? t('common.deleting') : t('game.details.deleteReview')}
          </button>
        ) : null}
      </div>

      <GameReviewComments
        review={review}
        currentUserId={currentUserId}
        visibleCommentCount={visibleCommentCount}
        totalCommentCount={totalCommentCount}
        commentText={commentText}
        isSubmittingComment={isSubmittingComment}
        isLoadingComments={isLoadingComments}
        pendingCommentReactionIds={pendingCommentReactionIds}
        onToggleCommentLike={onToggleCommentLike}
        onToggleCommentDislike={onToggleCommentDislike}
        onDeleteComment={onDeleteComment}
        onOpenReportModal={onOpenReportModal}
        onExpandComments={onExpandComments}
        onSubmitComment={onSubmitComment}
        onCommentTextChange={onCommentTextChange}
      />
    </article>
  )
}
