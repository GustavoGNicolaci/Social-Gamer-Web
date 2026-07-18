import type { CurrentUserReportSummary } from './reviewInteractions'
import type { ReviewError } from './reviewError'

export interface ReviewAuthor {
  id?: string
  username: string
  avatar_path: string | null
}

export interface ReviewGamePreview {
  id: number
  titulo: string
  capa_url: string | null
}

export interface ReviewComment {
  id: string
  usuario_id: string
  review_id: string
  texto: string
  data_comentario: string
  editado_em: string | null
  usuario: ReviewAuthor | null
  curtidas: number
  likedByCurrentUser: boolean
  canLike: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
  canDislike: boolean
  currentUserReport: CurrentUserReportSummary | null
}

export interface ReviewItem {
  id: string
  usuario_id: string
  jogo_id: number
  nota: number
  texto_review: string | null
  curtidas: number
  data_publicacao: string
  editado_em: string | null
  usuario: ReviewAuthor | null
  comentarios: ReviewComment[]
  likedByCurrentUser: boolean
  canLike: boolean
  dislikes: number
  dislikedByCurrentUser: boolean
  canDislike: boolean
  currentUserReport: CurrentUserReportSummary | null
}

export interface ProfileReviewItem extends ReviewItem {
  jogo: ReviewGamePreview | null
}

export interface RecentReviewActivity {
  id: string
  authorName: string
  authorAvatar: string | null
  gameTitle: string
  summary: string
  score: number | null
  publishedAt: string
}

export interface GameRatingSummary {
  gameId: number
  averageRating: number | null
  reviewCount: number
}

export interface GameReviewOverview extends GameRatingSummary {
  commentCount: number
}

export interface GameReviewOverviewResult
  extends ReviewServiceResult<GameReviewOverview | null> {
  fallbackUsed?: boolean
}

export interface ReviewServiceResult<T> {
  data: T
  error: ReviewError | null
}

export interface GameReviewsPageOptions {
  currentUserId?: string | null
  limit?: number
  offset?: number
  initialCommentsLimit?: number
}

export interface ReviewCommentsPageOptions {
  currentUserId?: string | null
  limit?: number
  offset?: number
}

export interface GameReviewsPageResult extends ReviewServiceResult<ReviewItem[]> {
  totalCount: number | null
  hasMore: boolean
  nextOffset: number | null
  commentTotals: Record<string, number>
  fallbackUsed?: boolean
}

export interface ReviewCommentsPageResult extends ReviewServiceResult<ReviewComment[]> {
  totalCount: number | null
  hasMore: boolean
  nextOffset: number | null
  fallbackUsed?: boolean
}

export interface GameReviewAnchor {
  targetType: 'review' | 'comment'
  reviewId: string
  commentId: string | null
  reviewOffset: number
  commentOffset: number | null
}

export interface GameReviewAnchorResult extends ReviewServiceResult<GameReviewAnchor | null> {
  fallbackUsed?: boolean
}
