import type { ReviewError } from './reviewError'

export type ReportTargetType = 'review' | 'comment'
export type ReportReason =
  | 'spam'
  | 'assedio_ou_ofensa'
  | 'conteudo_improprio'
  | 'informacao_enganosa'
  | 'discurso_de_odio'
  | 'outro'
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed'

export interface ReviewReactionState {
  curtidas: number
  likedByCurrentUser: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
}

export type CommentReactionState = ReviewReactionState

export interface CurrentUserReportSummary {
  id: string
  targetType: ReportTargetType
  reason: ReportReason
  description: string | null
  status: ReportStatus
  createdAt: string
}

export interface ReactionSummaryMaps {
  reviews: Map<string, ReviewReactionState>
  comments: Map<string, CommentReactionState>
}

export type ReactionToggleStatus = 'liked' | 'unliked' | 'disliked' | 'undisliked'

export interface AtomicReactionToggleResult {
  status: ReactionToggleStatus | 'error'
  data: ReviewReactionState | null
  error: ReviewError | null
}

export const REPORT_REASONS: readonly ReportReason[] = [
  'spam',
  'assedio_ou_ofensa',
  'conteudo_improprio',
  'informacao_enganosa',
  'discurso_de_odio',
  'outro',
]
