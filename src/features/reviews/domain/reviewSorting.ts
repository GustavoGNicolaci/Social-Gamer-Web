import type { ReviewComment, ReviewItem } from './reviewModels'

function getTimestamp(value: string | null | undefined) {
  if (!value) return 0

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime()
}

function compareByLikesAndTimestamp(
  leftLikes: number,
  rightLikes: number,
  leftTimestamp: string,
  rightTimestamp: string
) {
  if (rightLikes !== leftLikes) {
    return rightLikes - leftLikes
  }

  return getTimestamp(rightTimestamp) - getTimestamp(leftTimestamp)
}

export function sortCommentsByRelevance(comments: ReviewComment[]) {
  return [...comments].sort((leftComment, rightComment) =>
    compareByLikesAndTimestamp(
      leftComment.curtidas,
      rightComment.curtidas,
      leftComment.data_comentario,
      rightComment.data_comentario
    )
  )
}

export function sortReviewsByRelevance(reviews: ReviewItem[]) {
  return [...reviews].sort((leftReview, rightReview) =>
    compareByLikesAndTimestamp(
      leftReview.curtidas,
      rightReview.curtidas,
      leftReview.data_publicacao,
      rightReview.data_publicacao
    )
  )
}
