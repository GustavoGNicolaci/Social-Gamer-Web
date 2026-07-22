import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  createCommunityComment,
  submitCommunityReport,
  toggleCommunityPostPinned,
  toggleCommunityPostReaction,
  toggleCommunityPostSave,
  updateCommunityReportStatus,
  type CommunityPost,
  type CommunityReactionType,
  type CommunityReport,
  type CommunityReportReason,
  type CommunityReportStatus,
} from '../../../services/communityService'
import type {
  CommunityFeedReportTarget,
  FeedbackState,
  Translate,
} from '../domain/communityDetailsTypes'
import type {
  CommunityPostsUpdater,
} from './useCommunityFeedController'

interface LightboxState {
  url: string
  alt: string
}

interface UseCommunityFeedActionsOptions {
  communityId: string | null
  postsPage: number
  setPostsPage: Dispatch<SetStateAction<number>>
  reloadPosts: () => Promise<void>
  reloadModeration: () => Promise<void>
  updatePosts: (updater: CommunityPostsUpdater) => void
  publishFeedback: (feedback: FeedbackState) => void
  t: Translate
}

export function useCommunityFeedActions({
  communityId,
  postsPage,
  setPostsPage,
  reloadPosts,
  reloadModeration,
  updatePosts,
  publishFeedback,
  t,
}: UseCommunityFeedActionsOptions) {
  const [reportTarget, setReportTarget] =
    useState<CommunityFeedReportTarget | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const toggleReaction = useCallback(async (
    post: CommunityPost,
    reaction: CommunityReactionType,
  ) => {
    const result = await toggleCommunityPostReaction(post.id, reaction)
    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    if (result.data) {
      updatePosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                curtidas_count:
                  result.data?.curtidas_count
                  ?? currentPost.curtidas_count,
                dislikes_count:
                  result.data?.dislikes_count
                  ?? currentPost.dislikes_count,
                currentUserReaction: result.data?.reacao_atual ?? null,
              }
            : currentPost,
        ),
      )
    }
  }, [publishFeedback, updatePosts])

  const toggleSave = useCallback(async (post: CommunityPost) => {
    const result = await toggleCommunityPostSave(post.id)
    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    updatePosts((currentPosts) =>
      currentPosts.map((currentPost) =>
        currentPost.id === post.id
          ? { ...currentPost, savedByCurrentUser: result.data }
          : currentPost,
      ),
    )
  }, [publishFeedback, updatePosts])

  const togglePinned = useCallback(async (post: CommunityPost) => {
    const nextPinned = !post.fixado
    const result = await toggleCommunityPostPinned(post.id, nextPinned)
    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    publishFeedback({
      tone: 'success',
      message: nextPinned
        ? t('communities.post.pinned')
        : t('communities.post.unpinned'),
    })

    if (postsPage !== 1) {
      setPostsPage(1)
      return
    }

    await reloadPosts()
  }, [
    postsPage,
    publishFeedback,
    reloadPosts,
    setPostsPage,
    t,
  ])

  const createComment = useCallback(async (
    post: CommunityPost,
    text: string,
  ) => {
    const result = await createCommunityComment(post.id, text)
    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    await reloadPosts()
  }, [publishFeedback, reloadPosts])

  const submitReport = useCallback(async (payload: {
    reason: CommunityReportReason
    description: string
  }) => {
    if (!communityId || !reportTarget) return

    setReportSubmitting(true)
    const result = await submitCommunityReport({
      communityId,
      targetType: reportTarget.type,
      targetId: reportTarget.id,
      reason: payload.reason,
      description: payload.description,
    })
    setReportSubmitting(false)

    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setReportTarget(null)
    publishFeedback({
      tone: 'success',
      message: t('communities.report.sent'),
    })
    await reloadModeration()
  }, [
    communityId,
    publishFeedback,
    reloadModeration,
    reportTarget,
    t,
  ])

  const changeReportStatus = useCallback(async (
    report: CommunityReport,
    status: CommunityReportStatus,
  ) => {
    const result = await updateCommunityReportStatus(report.id, status)
    if (result.error) {
      publishFeedback({ tone: 'error', message: result.error.message })
      return
    }

    publishFeedback({
      tone: 'success',
      message: t('communities.moderation.reportUpdated'),
    })
    await reloadModeration()
  }, [publishFeedback, reloadModeration, t])

  const openImage = useCallback((url: string, alt: string) => {
    setLightbox({ url, alt })
  }, [])

  const closeImage = useCallback(() => {
    setLightbox(null)
  }, [])

  return {
    toggleReaction,
    toggleSave,
    togglePinned,
    createComment,
    report: {
      target: reportTarget,
      submitting: reportSubmitting,
      open: setReportTarget,
      close: () => setReportTarget(null),
      submit: submitReport,
      changeStatus: changeReportStatus,
    },
    lightbox: {
      state: lightbox,
      open: openImage,
      close: closeImage,
    },
  }
}
