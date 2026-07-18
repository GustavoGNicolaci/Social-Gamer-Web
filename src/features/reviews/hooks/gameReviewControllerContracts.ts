import type {
  Dispatch,
  FormEvent,
  SetStateAction,
} from 'react'
import type { TranslationParams } from '../../../i18n'
import type {
  GameRatingSummary,
  ReviewComment,
  ReviewItem,
} from '../domain/reviewModels'
import type {
  CurrentUserReportSummary,
  ReportReason,
  ReportTargetType,
} from '../domain/reviewInteractions'

type FeedbackTone = 'success' | 'error' | 'info'

export interface ReviewFeedbackState {
  tone: FeedbackTone
  message: string
}

export interface GameReviewsOverviewController {
  reviews: ReviewItem[]
  ratingSummary: GameRatingSummary | null
  totalComments: number
  loading: boolean
}

export interface GameReviewsFormController {
  authenticated: boolean
  score: number
  setScore: (score: number) => void
  text: string
  setText: (text: string) => void
  submitting: boolean
  feedback: ReviewFeedbackState | null
  editing: boolean
  submit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
}

export interface GameReviewsListController {
  userId: string | null
  total: number
  visible: ReviewItem[]
  error: string | null
  commentCounts: Record<string, number>
  commentTotals: Record<string, number>
  commentText: Record<string, string>
  submittingComments: Record<string, boolean>
  pendingReviews: readonly string[]
  pendingComments: readonly string[]
  deletingReviews: readonly string[]
  loadingMoreReviews: boolean
  loadingComments: Record<string, boolean>
  hidden: number
}

export interface GameReviewReportTarget {
  targetType: ReportTargetType
  targetId: string
  authorName: string
  currentReport: CurrentUserReportSummary | null
}

export interface GameReviewsReportController {
  target: GameReviewReportTarget | null
  feedback: ReviewFeedbackState | null
  submitting: boolean
  removing: boolean
}

export interface GameReviewsActionsController {
  refreshReviews: () => Promise<unknown>
  reviewLike: (review: ReviewItem) => Promise<void>
  reviewDislike: (review: ReviewItem) => Promise<void>
  reviewDelete: (review: ReviewItem) => Promise<void>
  commentLike: (reviewId: string, comment: ReviewComment) => Promise<void>
  commentDislike: (reviewId: string, comment: ReviewComment) => Promise<void>
  commentDelete: (reviewId: string, comment: ReviewComment) => Promise<void>
  openReport: (targetType: ReportTargetType, targetId: string, reviewId: string) => void
  expandComments: (reviewId: string, totalComments: number) => Promise<void>
  submitComment: (
    reviewId: string,
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  expandReviews: () => Promise<void>
  closeReport: () => void
  submitReport: (payload: { reason: ReportReason; description: string }) => Promise<void>
  removeReport: () => Promise<void>
}

export interface GameReviewsSectionController {
  form: GameReviewsFormController
  list: GameReviewsListController
  report: GameReviewsReportController
  actions: GameReviewsActionsController
}

export interface GameReviewsController {
  overview: GameReviewsOverviewController
  section: GameReviewsSectionController
}

export interface ReportModalTargetState {
  targetType: ReportTargetType
  targetId: string
  reviewId: string
}

export interface UseGameReviewsControllerOptions {
  gameId: number | null
  currentUserId: string | null
  locationHash: string
  t: (key: string, params?: TranslationParams) => string
}

export const INITIAL_VISIBLE_REVIEW_COUNT = 3
export const VISIBLE_REVIEW_BATCH_SIZE = 4
export const INITIAL_VISIBLE_COMMENT_COUNT = 2
export const VISIBLE_COMMENT_BATCH_SIZE = 4

export function getInitialVisibleCommentCount(totalComments: number) {
  return Math.min(Math.max(totalComments, 0), INITIAL_VISIBLE_COMMENT_COUNT)
}
