import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import {
  deleteCommunity,
  deleteCommunityComment,
  deleteCommunityPost,
  updateCommunityPostingPermission,
  type CommunityMember,
} from '../../../services/communityService'
import type {
  ConfirmState,
  FeedbackState,
  Translate,
} from '../domain/communityDetailsTypes'

type MembershipConfirmationExecutor = (
  state: ConfirmState,
) => Promise<boolean>

interface UseCommunityConfirmationControllerOptions {
  communityId: string | null
  reloadAll: () => Promise<void>
  navigateToCommunities: () => void
  publishFeedback: (feedback: FeedbackState) => void
  t: Translate
}

function getMemberName(member: CommunityMember) {
  return (
    member.usuario?.username
    || member.usuario?.nome_completo
    || 'usuario'
  )
}

export function useCommunityConfirmationController({
  communityId,
  reloadAll,
  navigateToCommunities,
  publishFeedback,
  t,
}: UseCommunityConfirmationControllerOptions) {
  const [state, setState] = useState<ConfirmState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const open = useCallback((nextState: ConfirmState) => {
    setState(nextState)
  }, [])

  const close = useCallback(() => {
    setState(null)
  }, [])

  const copy = useMemo(() => {
    if (!state) return null

    if (state.kind === 'delete-community') {
      return {
        title: t('communities.confirm.deleteCommunity.title'),
        description: t('communities.confirm.deleteCommunity.description'),
        confirmLabel: t('communities.confirm.deleteCommunity.confirm'),
        tone: 'danger' as const,
      }
    }

    if (state.kind === 'leave-community') {
      return {
        title: t('communities.confirm.leave.title'),
        description: t('communities.confirm.leave.description'),
        confirmLabel: t('communities.confirm.leave.confirm'),
        tone: 'default' as const,
      }
    }

    if (state.kind === 'delete-post') {
      return {
        title: t('communities.confirm.deletePost.title'),
        description: t('communities.confirm.deletePost.description'),
        confirmLabel: t('communities.confirm.deletePost.confirm'),
        tone: 'danger' as const,
      }
    }

    if (state.kind === 'delete-comment') {
      return {
        title: t('communities.confirm.deleteComment.title'),
        description: t('communities.confirm.deleteComment.description'),
        confirmLabel: t('communities.confirm.deleteComment.confirm'),
        tone: 'danger' as const,
      }
    }

    if (state.kind === 'kick-member') {
      return {
        title: t('communities.confirm.kick.title'),
        description: t('communities.confirm.kick.description', {
          user: `@${getMemberName(state.member)}`,
        }),
        confirmLabel: t('communities.confirm.kick.confirm'),
        tone: 'danger' as const,
      }
    }

    if (state.kind === 'transfer-leadership') {
      return {
        title: t('communities.confirm.transfer.title'),
        description: t('communities.confirm.transfer.description', {
          user: `@${getMemberName(state.member)}`,
        }),
        confirmLabel: t('communities.confirm.transfer.confirm'),
        tone: 'danger' as const,
      }
    }

    if (state.kind === 'posting-permission') {
      return {
        title: t('communities.confirm.posting.title'),
        description: t('communities.confirm.posting.description', {
          permission: t(
            `communities.permission.${state.permission}`,
          ),
        }),
        confirmLabel: t('communities.confirm.posting.confirm'),
        tone: 'default' as const,
      }
    }

    if (state.kind === 'promote-member') {
      return {
        title: t('communities.confirm.promote.title'),
        description: t('communities.confirm.promote.description', {
          user: `@${getMemberName(state.member)}`,
        }),
        confirmLabel: t('communities.confirm.promote.confirm'),
        tone: 'default' as const,
      }
    }

    return {
      title: t('communities.confirm.demote.title'),
      description: t('communities.confirm.demote.description', {
        user: `@${getMemberName(state.member)}`,
      }),
      confirmLabel: t('communities.confirm.demote.confirm'),
      tone: 'danger' as const,
    }
  }, [state, t])

  const execute = useCallback(async (
    executeMembershipConfirmation: MembershipConfirmationExecutor,
  ) => {
    if (!state || !communityId) return

    setSubmitting(true)

    try {
      if (await executeMembershipConfirmation(state)) {
        return
      }

      if (state.kind === 'delete-community') {
        const result = await deleteCommunity(communityId)
        if (result.error) throw result.error
        navigateToCommunities()
        return
      }

      if (state.kind === 'delete-post') {
        const result = await deleteCommunityPost(state.post.id)
        if (result.error) throw result.error
        publishFeedback({
          tone: result.data.failedPaths.length > 0 ? 'info' : 'success',
          message:
            result.data.failedPaths.length > 0
              ? t('communities.post.deletedWithCleanupWarnings')
              : t('communities.post.deleted'),
        })
      }

      if (state.kind === 'delete-comment') {
        const result = await deleteCommunityComment(state.commentId)
        if (result.error) throw result.error
        publishFeedback({
          tone: 'success',
          message: t('communities.comment.deleted'),
        })
      }

      if (state.kind === 'posting-permission') {
        const result = await updateCommunityPostingPermission(
          communityId,
          state.permission,
        )
        if (result.error) throw result.error
        publishFeedback({
          tone: 'success',
          message: t('communities.settings.postingSaved'),
        })
      }

      close()
      await reloadAll()
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : t('communities.actionError')
      publishFeedback({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }, [
    close,
    communityId,
    navigateToCommunities,
    publishFeedback,
    reloadAll,
    state,
    t,
  ])

  return {
    state,
    submitting,
    copy,
    open,
    close,
    execute,
  }
}
