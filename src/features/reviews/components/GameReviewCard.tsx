import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../../../components/UserAvatar'
import { formatLocalizedDate, formatLocalizedNumber, translate } from '../../../i18n'
import { useI18n } from '../../../i18n/I18nContext'
import type { ReviewComment, ReviewItem } from '../../../services/reviewService'
import type { ReportTargetType } from '../../../services/reviewInteractionsService'
import { getOptionalPublicProfilePath } from '../../../utils/profileRoutes'

const REVIEW_SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface GameReviewCardProps {
  review: ReviewItem
  currentUserId: string | null
  visibleCommentCount: number
  commentText: string
  isSubmittingComment: boolean
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
  onExpandComments: (reviewId: string, totalComments: number) => void
  onSubmitComment: (reviewId: string, event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCommentTextChange: (reviewId: string, value: string) => void
}

function formatDate(value: string | null | undefined, fallback?: string) {
  return formatLocalizedDate(value, { fallback })
}

function formatReviewScore(score: number) {
  return formatLocalizedNumber(score, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

function getUserName(usuario: { username?: string | null } | null | undefined) {
  const username = usuario?.username?.trim()
  return username || translate('common.username')
}

function iconHeart(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4L10.55 19.08C5.4 14.36 2 11.27 2 7.5C2 4.41 4.42 2 7.5 2C9.24 2 10.91 2.81 12 4.09C13.09 2.81 14.76 2 16.5 2C19.58 2 22 4.41 22 7.5C22 11.27 18.6 14.36 13.45 19.09L12 20.4Z"
        fill={isFilled ? '⚑' : '⚐'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconThumbDown(isFilled: boolean) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 4H6.5C5.67 4 4.95 4.5 4.64 5.22L2.08 11.18C2.03 11.31 2 11.45 2 11.6V13.5C2 14.33 2.67 15 3.5 15H8.24L7.52 18.46C7.5 18.56 7.49 18.66 7.49 18.76C7.49 19.17 7.66 19.56 7.93 19.84L8.72 20.62L13.64 15.71C13.88 15.47 14 15.15 14 14.81V4ZM18 4H22V14H18V4Z"
        fill={isFilled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function iconFlag(isFilled: boolean) {
  return (
    <span className={`game-review-report-emoji${isFilled ? ' is-filled' : ''}`} aria-hidden="true">
      {isFilled ? '⚑' : '⚐'}
    </span>
  )
}

export function GameReviewCard({
  review,
  currentUserId,
  visibleCommentCount,
  commentText,
  isSubmittingComment,
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
  const { t, formatNumber } = useI18n()
  const avaliadorNome = getUserName(review.usuario)
  const avaliadorProfilePath = getOptionalPublicProfilePath(review.usuario?.username)
  const isOwnerReview = review.usuario_id === currentUserId
  const visibleComments = review.comentarios.slice(0, visibleCommentCount)
  const hiddenCommentsCount = review.comentarios.length - visibleComments.length
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
              <span>{formatDate(review.data_publicacao)}</span>
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
              <span>{formatDate(review.data_publicacao)}</span>
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
            >
              {iconFlag(Boolean(review.currentUserReport))}
            </button>
          ) : null}

          <div className="game-review-score">
            <div className="game-review-score-grid">
              {REVIEW_SCORE_OPTIONS.map(score => (
                <span
                  key={score}
                  className={`game-review-score-pill${score <= review.nota ? ' is-filled' : ''}`}
                >
                  {score}
                </span>
              ))}
            </div>
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
          >
            <span className="game-review-reaction-icon">
              {iconHeart(review.likedByCurrentUser)}
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
          >
            <span className="game-review-reaction-icon">
              {iconThumbDown(review.dislikedByCurrentUser)}
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
          {review.comentarios.length === 1
            ? t('game.details.comments.one')
            : t('game.details.comments.many', { count: formatNumber(review.comentarios.length) })}
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

      <div className="game-review-comments">
        {review.comentarios.length > 0 ? (
          <div className="game-review-comments-list">
            {visibleComments.map(comentario => {
              const autorComentario = getUserName(comentario.usuario)
              const autorComentarioProfilePath = getOptionalPublicProfilePath(
                comentario.usuario?.username
              )
              const isOwnerComment = comentario.usuario_id === currentUserId
              const isCommentReactionPending = pendingCommentReactionIds.includes(comentario.id)
              const canReportComment = Boolean(currentUserId && !isOwnerComment)
              const commentLikeButtonLabel = !currentUserId
                ? t('game.details.loginToLike')
                : comentario.canLike
                  ? comentario.likedByCurrentUser
                    ? t('game.details.unlikeComment')
                    : t('game.details.likeComment')
                  : t('game.details.ownComment')
              const commentDislikeButtonLabel = !currentUserId
                ? t('game.details.loginToDislike')
                : comentario.canDislike
                  ? comentario.dislikedByCurrentUser
                    ? t('game.details.removeDislikeComment')
                    : t('game.details.dislikeComment')
                  : t('game.details.ownComment')
              const commentReportButtonLabel = comentario.currentUserReport
                ? t('game.details.viewReportComment')
                : t('game.details.reportComment')

              return (
                <div key={comentario.id} id={`comment-${comentario.id}`} className="game-review-comment-card">
                  <div className="game-review-comment-header">
                    {autorComentarioProfilePath ? (
                      <Link
                        to={autorComentarioProfilePath}
                        className="game-review-comment-author-link"
                        aria-label={t('game.details.openProfileAria', { name: autorComentario })}
                      >
                        <UserAvatar
                          name={autorComentario}
                          avatarPath={comentario.usuario?.avatar_path}
                          imageClassName="game-review-comment-avatar"
                          fallbackClassName="game-review-comment-avatar-fallback"
                        />

                        <strong>{autorComentario}</strong>
                      </Link>
                    ) : (
                      <div className="game-review-comment-author">
                        <UserAvatar
                          name={autorComentario}
                          avatarPath={comentario.usuario?.avatar_path}
                          imageClassName="game-review-comment-avatar"
                          fallbackClassName="game-review-comment-avatar-fallback"
                        />

                        <strong>{autorComentario}</strong>
                      </div>
                    )}

                    <div className="game-review-comment-meta">
                      <span className="game-review-comment-date">
                        {formatDate(comentario.data_comentario)}
                      </span>

                      <div className="game-review-comment-meta-actions">
                        <button
                          type="button"
                          className={`game-review-comment-reaction-button is-like${comentario.likedByCurrentUser ? ' is-liked' : ''}`}
                          onClick={() => void onToggleCommentLike(review.id, comentario)}
                          disabled={
                            !currentUserId ||
                            !comentario.canLike ||
                            isCommentReactionPending
                          }
                          aria-label={commentLikeButtonLabel}
                          title={commentLikeButtonLabel}
                        >
                          <span className="game-review-reaction-icon">
                            {iconHeart(comentario.likedByCurrentUser)}
                          </span>
                          <span>
                            {isCommentReactionPending
                              ? t('common.updating')
                              : t('game.details.likeWithCount', { count: formatNumber(comentario.curtidas) })}
                          </span>
                        </button>

                        <button
                          type="button"
                          className={`game-review-comment-reaction-button${comentario.dislikedByCurrentUser ? ' is-disliked' : ''}`}
                          onClick={() => void onToggleCommentDislike(review.id, comentario)}
                          disabled={
                            !currentUserId ||
                            !comentario.canDislike ||
                            isCommentReactionPending
                          }
                          aria-label={commentDislikeButtonLabel}
                          title={commentDislikeButtonLabel}
                        >
                          <span className="game-review-reaction-icon">
                            {iconThumbDown(comentario.dislikedByCurrentUser)}
                          </span>
                          <span>
                            {isCommentReactionPending
                              ? t('common.updating')
                              : comentario.dislikedByCurrentUser
                                ? t('game.details.dislikeWithCount', { count: formatNumber(comentario.dislikes) })
                                : t('game.details.dislikeWithCount', { count: formatNumber(comentario.dislikes) })}
                          </span>
                        </button>

                        {canReportComment ? (
                          <button
                            type="button"
                            className={`game-review-report-button is-comment${comentario.currentUserReport ? ' is-reported' : ''}`}
                            onClick={() =>
                              onOpenReportModal('comment', comentario.id, review.id)
                            }
                            aria-label={commentReportButtonLabel}
                            title={commentReportButtonLabel}
                          >
                            {iconFlag(Boolean(comentario.currentUserReport))}
                          </button>
                        ) : null}

                        {isOwnerComment ? (
                          <button
                            type="button"
                            className="game-review-comment-delete-button"
                            onClick={() => void onDeleteComment(review.id, comentario)}
                          >
                            {t('game.details.deleteComment')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="game-review-comment-body">{comentario.texto}</p>
                </div>
              )
            })}
          </div>
        ) : null}

        {hiddenCommentsCount > 0 ? (
          <button
            type="button"
            className="game-review-comments-expand-button"
            onClick={() => onExpandComments(review.id, review.comentarios.length)}
            aria-label={t('game.details.moreCommentsAria', { count: formatNumber(hiddenCommentsCount) })}
          >
            {t('game.details.moreComments')}
          </button>
        ) : null}

        {currentUserId ? (
          <form
            onSubmit={event => onSubmitComment(review.id, event)}
            className="game-review-comment-form"
          >
            <textarea
              className="game-review-comment-input"
              value={commentText}
              onChange={event => onCommentTextChange(review.id, event.target.value)}
              placeholder={t('game.details.commentPlaceholder')}
              required
            />

            <button
              type="submit"
              disabled={isSubmittingComment}
              className="game-review-comment-button"
            >
              {isSubmittingComment ? t('common.sending') : t('game.details.commentSubmit')}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  )
}
