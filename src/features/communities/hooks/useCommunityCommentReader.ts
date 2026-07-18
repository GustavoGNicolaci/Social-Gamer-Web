import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
import {
  getCommunityCommentAnchor,
  getCommunityCommentTarget,
  getCommunityPostById,
  getCommunityPostCommentsPage,
  mergeCommunityComments,
  type CommunityPost,
  type CommunityRole,
} from '../../../services/communityService'
import type {
  FeedbackState,
} from '../domain/communityDetailsTypes'
import type {
  CommunityPostsUpdater,
} from './useCommunityFeedController'

const COMMENT_PAGE_SIZE = 3

interface UseCommunityCommentReaderOptions {
  activeAnchorId: string
  routeCommunityId: string
  communityId: string | null
  currentUserId: string | null
  currentUserRole: CommunityRole | null
  canViewContent: boolean
  postsLoading: boolean
  postsPage: number
  posts: CommunityPost[]
  updatePosts: (updater: CommunityPostsUpdater) => void
  showPostsTab: () => void
  publishFeedback: (feedback: FeedbackState) => void
}

export function useCommunityCommentReader({
  activeAnchorId,
  routeCommunityId,
  communityId,
  currentUserId,
  currentUserRole,
  canViewContent,
  postsLoading,
  postsPage,
  posts,
  updatePosts,
  showPostsTab,
  publishFeedback,
}: UseCommunityCommentReaderOptions) {
  const scopeKey = [
    routeCommunityId || 'route-none',
    communityId || 'none',
    currentUserId || 'anonymous',
    currentUserRole || 'no-role',
    canViewContent ? 'visible' : 'restricted',
    postsPage,
  ].join(':')
  const postsRef = useRef(posts)
  const scopeKeyRef = useRef(scopeKey)
  const pageRequestsRef = useRef(new Map<string, symbol>())
  const anchorRequestVersionRef = useRef(0)

  useLayoutEffect(() => {
    postsRef.current = posts
    scopeKeyRef.current = scopeKey
  }, [posts, scopeKey])

  useEffect(() => {
    pageRequestsRef.current.clear()
    anchorRequestVersionRef.current += 1
  }, [scopeKey])

  const loadMoreComments = useCallback(async (post: CommunityPost) => {
    const expectedScopeKey = scopeKey
    const currentPost = postsRef.current.find(
      (candidate) => candidate.id === post.id,
    )
    if (!currentPost) return false

    const offset =
      currentPost.commentsNextOffset ?? currentPost.comentarios.length
    if (offset >= currentPost.comentarios_count) return false
    if (pageRequestsRef.current.has(post.id)) return false

    const requestToken = Symbol(post.id)
    pageRequestsRef.current.set(post.id, requestToken)

    try {
      const result = await getCommunityPostCommentsPage(post.id, {
        limit: COMMENT_PAGE_SIZE,
        offset,
      })

      if (
        scopeKeyRef.current !== expectedScopeKey
        || pageRequestsRef.current.get(post.id) !== requestToken
      ) {
        return false
      }

      if (result.error) {
        publishFeedback({
          tone: 'error',
          message: result.error.message,
        })
        return false
      }

      let applied = false
      updatePosts((currentPosts) => {
        const nextPosts = currentPosts.map((candidate) => {
          if (candidate.id !== post.id) return candidate

          const currentOffset =
            candidate.commentsNextOffset ?? candidate.comentarios.length
          if (currentOffset !== offset) return candidate

          const totalCount =
            result.data.totalCount ?? candidate.comentarios_count
          const nextOffset = result.data.comments.length > 0
            ? Math.max(currentOffset, result.data.nextOffset)
            : totalCount
          applied = result.data.comments.length > 0

          return {
            ...candidate,
            comentarios: mergeCommunityComments(
              candidate.comentarios,
              result.data.comments,
            ),
            comentarios_count: totalCount,
            commentsNextOffset: nextOffset,
          }
        })
        postsRef.current = nextPosts
        return nextPosts
      })

      return applied
    } finally {
      if (pageRequestsRef.current.get(post.id) === requestToken) {
        pageRequestsRef.current.delete(post.id)
      }
    }
  }, [publishFeedback, scopeKey, updatePosts])

  useEffect(() => {
    const commentPrefix = 'community-comment-'
    if (
      !activeAnchorId.startsWith(commentPrefix)
      || !communityId
      || communityId !== routeCommunityId
      || !canViewContent
      || postsLoading
    ) {
      return
    }

    const commentId = activeAnchorId.slice(commentPrefix.length)
    if (!commentId) return

    const expectedScopeKey = scopeKey
    const requestVersion = ++anchorRequestVersionRef.current
    let cancelled = false
    const isRequestActive = () => (
      !cancelled
      && scopeKeyRef.current === expectedScopeKey
      && anchorRequestVersionRef.current === requestVersion
    )

    const resolveAnchor = async () => {
      const targetResult = await getCommunityCommentTarget(commentId)
      if (!isRequestActive()) return
      if (targetResult.error) {
        publishFeedback({
          tone: 'error',
          message: targetResult.error.message,
        })
        return
      }

      const target = targetResult.data
      if (!target || target.communityId !== communityId) return

      let targetPost =
        postsRef.current.find((post) => post.id === target.postId) || null
      if (!targetPost) {
        const postResult = await getCommunityPostById(
          target.postId,
          currentUserId || undefined,
          currentUserRole,
        )
        if (!isRequestActive()) return
        if (postResult.error) {
          publishFeedback({
            tone: 'error',
            message: postResult.error.message,
          })
          return
        }
        if (
          !postResult.data
          || postResult.data.comunidade_id !== communityId
        ) {
          return
        }

        targetPost = postResult.data
        updatePosts((currentPosts) => {
          if (
            currentPosts.some((post) => post.id === targetPost?.id)
          ) {
            return currentPosts
          }
          const nextPosts = [targetPost as CommunityPost, ...currentPosts]
          postsRef.current = nextPosts
          return nextPosts
        })
      }

      const anchorResult = await getCommunityCommentAnchor(
        target.postId,
        commentId,
        COMMENT_PAGE_SIZE,
      )
      if (!isRequestActive()) return
      if (anchorResult.error) {
        publishFeedback({
          tone: 'error',
          message: anchorResult.error.message,
        })
        return
      }
      if (
        !anchorResult.data.found
        || anchorResult.data.pageOffset === null
      ) {
        return
      }

      const pageResult = await getCommunityPostCommentsPage(target.postId, {
        limit: COMMENT_PAGE_SIZE,
        offset: anchorResult.data.pageOffset,
      })
      if (!isRequestActive()) return
      if (pageResult.error) {
        publishFeedback({
          tone: 'error',
          message: pageResult.error.message,
        })
        return
      }

      updatePosts((currentPosts) => {
        const nextPosts = currentPosts.map((post) => {
          if (post.id !== target.postId) return post

          const currentOffset =
            post.commentsNextOffset ?? post.comentarios.length
          const commentsNextOffset =
            currentOffset === anchorResult.data.pageOffset
              ? Math.max(currentOffset, pageResult.data.nextOffset)
              : currentOffset
          return {
            ...post,
            comentarios: mergeCommunityComments(
              post.comentarios,
              pageResult.data.comments,
            ),
            comentarios_count:
              pageResult.data.totalCount
              ?? anchorResult.data.totalCount
              ?? post.comentarios_count,
            commentsNextOffset,
          }
        })
        postsRef.current = nextPosts
        return nextPosts
      })
      showPostsTab()
    }

    void resolveAnchor()
    return () => {
      cancelled = true
    }
  }, [
    activeAnchorId,
    canViewContent,
    communityId,
    currentUserId,
    currentUserRole,
    postsLoading,
    publishFeedback,
    routeCommunityId,
    scopeKey,
    showPostsTab,
    updatePosts,
  ])

  return {
    loadMoreComments,
  }
}
