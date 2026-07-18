import type { FormEvent } from 'react'
import { useI18n } from '../../../i18n/I18nContext'
import type { ReviewComment, ReviewItem } from '../domain/reviewModels'
import type { ReportTargetType } from '../domain/reviewInteractions'
import { GameReviewCommentCard } from './GameReviewCommentCard'

interface GameReviewCommentsProps {
  review: ReviewItem
  currentUserId: string | null
  visibleCommentCount: number
  totalCommentCount: number
  commentText: string
  isSubmittingComment: boolean
  isLoadingComments: boolean
  pendingCommentReactionIds: readonly string[]
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

export function GameReviewComments({
  review,
  currentUserId,
  visibleCommentCount,
  totalCommentCount,
  commentText,
  isSubmittingComment,
  isLoadingComments,
  pendingCommentReactionIds,
  onToggleCommentLike,
  onToggleCommentDislike,
  onDeleteComment,
  onOpenReportModal,
  onExpandComments,
  onSubmitComment,
  onCommentTextChange,
}: GameReviewCommentsProps) {
  const { t, formatNumber } = useI18n()
  const visibleComments = review.comentarios.slice(0, visibleCommentCount)
  const hiddenCommentsCount = Math.max(totalCommentCount - visibleComments.length, 0)

  return (
    <div className="game-review-comments">
      {review.comentarios.length > 0 ? (
        <div className="game-review-comments-list">
          {visibleComments.map(comment => (
            <GameReviewCommentCard
              key={comment.id}
              reviewId={review.id}
              comment={comment}
              currentUserId={currentUserId}
              reactionPending={pendingCommentReactionIds.includes(comment.id)}
              onToggleLike={onToggleCommentLike}
              onToggleDislike={onToggleCommentDislike}
              onDelete={onDeleteComment}
              onOpenReport={onOpenReportModal}
            />
          ))}
        </div>
      ) : null}

      {hiddenCommentsCount > 0 ? (
        <button
          type="button"
          className="game-review-comments-expand-button"
          onClick={() => void onExpandComments(review.id, totalCommentCount)}
          disabled={isLoadingComments}
          aria-label={t('game.details.moreCommentsAria', {
            count: formatNumber(hiddenCommentsCount),
          })}
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
  )
}
