import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CommunityAboutCard } from '../components/communities/CommunityAboutCard'
import { CommunityConfirmModal } from '../components/communities/CommunityConfirmModal'
import { CommunityReportModal } from '../components/communities/CommunityReportModal'
import { useAuth } from '../contexts/AuthContext'
import {
  CommunityFeedSection,
  type CommunityFeedReportTarget,
} from '../features/communities/components/CommunityFeedSection'
import { CommunityMembersSection } from '../features/communities/components/CommunityMembersSection'
import { CommunityModerationSection } from '../features/communities/components/CommunityModerationSection'
import { CommunityParticipationSection } from '../features/communities/components/CommunityParticipationSection'
import { CommunitySettingsSection } from '../features/communities/components/CommunitySettingsSection'
import type {
  ConfirmState,
  FeedbackState,
} from '../features/communities/domain/communityDetailsTypes'
import { useCommunityFeedController } from '../features/communities/hooks/useCommunityFeedController'
import { useCommunityMembershipActions } from '../features/communities/hooks/useCommunityMembershipActions'
import { useCommunityMembersController } from '../features/communities/hooks/useCommunityMembersController'
import { useCommunityModerationController } from '../features/communities/hooks/useCommunityModerationController'
import { useCommunitySettingsController } from '../features/communities/hooks/useCommunitySettingsController'
import { useCommunitySummaryController } from '../features/communities/hooks/useCommunitySummaryController'
import { useI18n } from '../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  createCommunityComment,
  createCommunityPost,
  deleteCommunity,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityCommentAnchor,
  getCommunityCommentTarget,
  getCommunityPostById,
  getCommunityPostCommentsPage,
  mergeCommunityComments,
  submitCommunityReport,
  toggleCommunityPostPinned,
  toggleCommunityPostReaction,
  toggleCommunityPostSave,
  updateCommunityPostingPermission,
  updateCommunityReportStatus,
  type CommunityCategoryValue,
  type CommunityMember,
  type CommunityPost,
  type CommunityPostingPermission,
  type CommunityReactionType,
  type CommunityReport,
  type CommunityReportReason,
  type CommunityReportStatus,
  type CommunitySummary,
} from '../services/communityService'
import {
  resolvePublicFileUrl,
  uploadCommunityPostImage,
} from '../services/storageService'
import './CommunitiesPage.css'

type CommunityTab = 'posts' | 'members' | 'about' | 'moderation' | 'settings' | 'memberSettings'
type RequestFilter = 'pendente' | 'all'
type ReportFilter = CommunityReportStatus | 'all'

interface LightboxState {
  url: string
  alt: string
}

const POST_PAGE_SIZE = 8
const COMMENT_PAGE_SIZE = 3

function getMemberName(member: CommunityMember) {
  return member.usuario?.username || member.usuario?.nome_completo || 'usuario'
}

function getCommunityBanner(community: CommunitySummary | null) {
  if (!community) return null
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function decodeCommunityAnchor(hash: string) {
  const encodedAnchor = hash.startsWith('#') ? hash.slice(1) : hash
  if (!encodedAnchor) return ''

  try {
    return decodeURIComponent(encodedAnchor)
  } catch {
    return encodedAnchor
  }
}

function CommunityDetailsPage() {
  const { id } = useParams()
  const communityId = id || ''
  const location = useLocation()
  const { user } = useAuth()
  const { t, formatDate, formatNumber } = useI18n()
  const navigate = useNavigate()

  const {
    summary: community,
    loading,
    error: communityError,
    reload: reloadCommunity,
  } = useCommunitySummaryController({
    communityId: communityId || null,
    currentUserId: user?.id ?? null,
  })
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts')
  const [postText, setPostText] = useState('')
  const [postImageFile, setPostImageFile] = useState<File | null>(null)
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState<string | null>(null)
  const postImagePreviewUrlRef = useRef<string | null>(null)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [postingPermissionDraft, setPostingPermissionDraft] =
    useState<CommunityPostingPermission>('todos_membros')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('')
  const [postsPage, setPostsPage] = useState(1)
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('pendente')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [reportTarget, setReportTarget] = useState<CommunityFeedReportTarget | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const currentUserRole = community?.currentUserRole ?? null
  const isLeader = currentUserRole === 'lider'
  const isModerator = currentUserRole === 'lider' || currentUserRole === 'admin'
  const canPost = Boolean(user && community?.canPost)
  const bannerUrl = getCommunityBanner(community)
  const canViewContent = Boolean(community?.canViewContent)
  const settings = useCommunitySettingsController({
    community,
    currentUserId: user?.id ?? null,
    isLeader,
    isModerator,
    reloadCommunity,
    publishFeedback: setFeedback,
    t,
  })
  const {
    posts,
    totalCount: postsTotalCount,
    loading: postsLoading,
    error: postsError,
    reload: reloadPosts,
    updatePosts,
  } = useCommunityFeedController({
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    currentUserRole,
    canViewContent,
    page: postsPage,
    pageSize: POST_PAGE_SIZE,
  })
  const {
    joinRequests,
    reports,
    loading: moderationLoading,
    error: moderationError,
    reload: reloadModeration,
  } = useCommunityModerationController({
    communityId: community?.id ?? null,
    isModerator,
    requestFilter,
    reportFilter,
  })
  const {
    members,
    totalCount: membersTotalCount,
    error: membersError,
    loading: membersLoading,
    loadingMore: membersLoadingMore,
    hasMore: membersHasMore,
    loadMore: loadMoreMembers,
    reload: reloadMembers,
    retry: retryMembers,
  } = useCommunityMembersController({
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    canViewContent,
    search: debouncedMemberSearch,
  })
  const totalPostPages = postsTotalCount ? Math.max(1, Math.ceil(postsTotalCount / POST_PAGE_SIZE)) : 1
  const activeAnchorId = decodeCommunityAnchor(location.hash)
  const commentReadScopeKey = [
    communityId || 'route-none',
    community?.id || 'none',
    user?.id || 'anonymous',
    currentUserRole || 'no-role',
    canViewContent ? 'visible' : 'restricted',
    postsPage,
  ].join(':')
  const postsRef = useRef(posts)
  const commentReadScopeKeyRef = useRef(commentReadScopeKey)
  const commentPageRequestsRef = useRef(new Map<string, symbol>())
  const anchorRequestVersionRef = useRef(0)

  useLayoutEffect(() => {
    postsRef.current = posts
    commentReadScopeKeyRef.current = commentReadScopeKey
  }, [commentReadScopeKey, posts])

  const visibleTabs = useMemo<CommunityTab[]>(() => {
    if (!canViewContent) return ['about', 'memberSettings']

    const baseTabs: CommunityTab[] = ['posts', 'members', 'about']
    if (isModerator) return [...baseTabs, 'moderation', 'settings']

    return [
      ...baseTabs,
      'memberSettings',
    ]
  }, [canViewContent, isModerator])

  const sortedMembers = useMemo(() => {
    const roleOrder: Record<string, number> = { lider: 0, admin: 1, membro: 2 }
    return [...members].sort((left, right) => {
      const roleDelta = (roleOrder[left.cargo] ?? 3) - (roleOrder[right.cargo] ?? 3)
      if (roleDelta !== 0) return roleDelta
      return getMemberName(left).localeCompare(getMemberName(right))
    })
  }, [members])

  const handlePostImageFileChange = useCallback((file: File | null) => {
    if (postImagePreviewUrlRef.current) {
      URL.revokeObjectURL(postImagePreviewUrlRef.current)
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : null
    postImagePreviewUrlRef.current = nextPreviewUrl
    setPostImageFile(file)
    setPostImagePreviewUrl(nextPreviewUrl)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedMemberSearch(memberSearch), 220)
    return () => window.clearTimeout(timeoutId)
  }, [memberSearch])

  useEffect(() => () => {
    if (postImagePreviewUrlRef.current) {
      URL.revokeObjectURL(postImagePreviewUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lightbox])

  useEffect(() => {
    commentPageRequestsRef.current.clear()
    anchorRequestVersionRef.current += 1
  }, [commentReadScopeKey])

  const visibleActiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0]

  useEffect(() => {
    if (visibleTabs.includes(activeTab)) return

    const timeoutId = window.setTimeout(() => setActiveTab(visibleTabs[0]), 0)
    return () => window.clearTimeout(timeoutId)
  }, [activeTab, visibleTabs])

  const getRoleLabel = useCallback(
    (role: string | null | undefined) => {
      if (role === 'lider') return t('communities.role.lider')
      if (role === 'admin') return t('communities.role.admin')
      return t('communities.role.membro')
    },
    [t]
  )

  const getNoPostPermissionMessage = useCallback(
    (permission: CommunityPostingPermission) => {
      if (permission === 'somente_admins') return t('communities.post.noPermissionAdmins')
      if (permission === 'somente_lider') return t('communities.post.noPermissionLeader')
      return t('communities.post.joinToPost')
    },
    [t]
  )

  const getConfirmCopy = useCallback(
    (state: ConfirmState | null) => {
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
          description: t('communities.confirm.kick.description', { user: `@${getMemberName(state.member)}` }),
          confirmLabel: t('communities.confirm.kick.confirm'),
          tone: 'danger' as const,
        }
      }

      if (state.kind === 'transfer-leadership') {
        return {
          title: t('communities.confirm.transfer.title'),
          description: t('communities.confirm.transfer.description', { user: `@${getMemberName(state.member)}` }),
          confirmLabel: t('communities.confirm.transfer.confirm'),
          tone: 'danger' as const,
        }
      }

      if (state.kind === 'posting-permission') {
        return {
          title: t('communities.confirm.posting.title'),
          description: t('communities.confirm.posting.description', {
            permission: t(`communities.permission.${state.permission}`),
          }),
          confirmLabel: t('communities.confirm.posting.confirm'),
          tone: 'default' as const,
        }
      }

      if (state.kind === 'promote-member') {
        return {
          title: t('communities.confirm.promote.title'),
          description: t('communities.confirm.promote.description', { user: `@${getMemberName(state.member)}` }),
          confirmLabel: t('communities.confirm.promote.confirm'),
          tone: 'default' as const,
        }
      }

      return {
        title: t('communities.confirm.demote.title'),
        description: t('communities.confirm.demote.description', { user: `@${getMemberName(state.member)}` }),
        confirmLabel: t('communities.confirm.demote.confirm'),
        tone: 'danger' as const,
      }
    },
    [t]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPostingPermissionDraft(community?.permissao_postagem || 'todos_membros')
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [community])

  useEffect(() => {
    if (loading) return

    const timeoutId = window.setTimeout(() => {
      setFeedback(
        communityError
          ? {
              tone: 'error',
              message: communityError.message || t('communities.details.loadError'),
            }
          : null
      )
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [communityError, loading, t])

  useEffect(() => {
    if (!membersError) return
    const timeoutId = window.setTimeout(() => {
      setFeedback({ tone: 'error', message: membersError.message })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [membersError])

  useEffect(() => {
    if (!postsError) return
    const timeoutId = window.setTimeout(() => {
      setFeedback({ tone: 'error', message: postsError.message })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [postsError])

  useEffect(() => {
    if (!moderationError) return
    const timeoutId = window.setTimeout(() => {
      setFeedback({
        tone: 'error',
        message: moderationError.message || t('communities.moderation.loadError'),
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [moderationError, t])

  const reloadAll = useCallback(async () => {
    await reloadCommunity()
    await reloadMembers()
    await reloadPosts()
    await reloadModeration()
  }, [reloadCommunity, reloadMembers, reloadModeration, reloadPosts])

  const membershipActions = useCommunityMembershipActions({
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    reloadAll,
    reloadModeration,
    publishFeedback: setFeedback,
    closeConfirmation: () => setConfirmState(null),
    t,
  })

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !community || postSubmitting) return

    const normalizedText = postText.trim()
    if (!normalizedText && !postImageFile) {
      setFeedback({ tone: 'error', message: t('communities.post.emptyError') })
      return
    }

    setPostSubmitting(true)
    setFeedback(null)

    try {
      let imagePath: string | null = null
      if (postImageFile) {
        const uploadResult = await uploadCommunityPostImage(postImageFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: t('communities.post.imageUploadError') })
          return
        }
        imagePath = uploadResult.path
      }

      const result = await createCommunityPost(community.id, normalizedText, imagePath)
      if (result.error) {
        setFeedback({ tone: 'error', message: result.error.message })
        return
      }

      setPostText('')
      handlePostImageFileChange(null)
      setPostsPage(1)
      setFeedback({ tone: 'success', message: t('communities.post.published') })
      await reloadAll()
    } finally {
      setPostSubmitting(false)
    }
  }

  const handleToggleReaction = async (post: CommunityPost, reaction: CommunityReactionType) => {
    const result = await toggleCommunityPostReaction(post.id, reaction)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    if (result.data) {
      updatePosts(currentPosts =>
        currentPosts.map(currentPost =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                curtidas_count: result.data?.curtidas_count ?? currentPost.curtidas_count,
                dislikes_count: result.data?.dislikes_count ?? currentPost.dislikes_count,
                currentUserReaction: result.data?.reacao_atual ?? null,
              }
            : currentPost
        )
      )
    }
  }

  const handleToggleSave = async (post: CommunityPost) => {
    const result = await toggleCommunityPostSave(post.id)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    updatePosts(currentPosts =>
      currentPosts.map(currentPost =>
        currentPost.id === post.id
          ? { ...currentPost, savedByCurrentUser: result.data }
          : currentPost
      )
    )
  }

  const handleTogglePinned = async (post: CommunityPost) => {
    const nextPinned = !post.fixado
    const result = await toggleCommunityPostPinned(post.id, nextPinned)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setFeedback({
      tone: 'success',
      message: nextPinned ? t('communities.post.pinned') : t('communities.post.unpinned'),
    })

    if (postsPage !== 1) {
      setPostsPage(1)
      return
    }

    await reloadPosts()
  }

  const handleCreateComment = async (post: CommunityPost, text: string) => {
    const result = await createCommunityComment(post.id, text)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    await reloadPosts()
  }

  const handleLoadMoreComments = useCallback(async (post: CommunityPost) => {
    const expectedScopeKey = commentReadScopeKey
    const currentPost = postsRef.current.find(candidate => candidate.id === post.id)
    if (!currentPost) return false

    const offset = currentPost.commentsNextOffset ?? currentPost.comentarios.length
    if (offset >= currentPost.comentarios_count) return false
    if (commentPageRequestsRef.current.has(post.id)) return false

    const requestToken = Symbol(post.id)
    commentPageRequestsRef.current.set(post.id, requestToken)

    try {
      const result = await getCommunityPostCommentsPage(post.id, {
        limit: COMMENT_PAGE_SIZE,
        offset,
      })

      if (
        commentReadScopeKeyRef.current !== expectedScopeKey ||
        commentPageRequestsRef.current.get(post.id) !== requestToken
      ) {
        return false
      }

      if (result.error) {
        setFeedback({ tone: 'error', message: result.error.message })
        return false
      }

      let applied = false
      updatePosts(currentPosts => {
        const nextPosts = currentPosts.map(candidate => {
          if (candidate.id !== post.id) return candidate

          const currentOffset = candidate.commentsNextOffset ?? candidate.comentarios.length
          if (currentOffset !== offset) return candidate

          const totalCount = result.data.totalCount ?? candidate.comentarios_count
          const nextOffset = result.data.comments.length > 0
            ? Math.max(currentOffset, result.data.nextOffset)
            : totalCount
          applied = result.data.comments.length > 0

          return {
            ...candidate,
            comentarios: mergeCommunityComments(
              candidate.comentarios,
              result.data.comments
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
      if (commentPageRequestsRef.current.get(post.id) === requestToken) {
        commentPageRequestsRef.current.delete(post.id)
      }
    }
  }, [commentReadScopeKey, updatePosts])

  useEffect(() => {
    const commentPrefix = 'community-comment-'
    if (
      !activeAnchorId.startsWith(commentPrefix) ||
      !community?.id ||
      community.id !== communityId ||
      !canViewContent ||
      postsLoading
    ) {
      return
    }

    const commentId = activeAnchorId.slice(commentPrefix.length)
    if (!commentId) return

    const expectedScopeKey = commentReadScopeKey
    const requestVersion = ++anchorRequestVersionRef.current
    let cancelled = false
    const isRequestActive = () => (
      !cancelled &&
      commentReadScopeKeyRef.current === expectedScopeKey &&
      anchorRequestVersionRef.current === requestVersion
    )

    const resolveAnchor = async () => {
      const targetResult = await getCommunityCommentTarget(commentId)
      if (!isRequestActive()) return
      if (targetResult.error) {
        setFeedback({ tone: 'error', message: targetResult.error.message })
        return
      }

      const target = targetResult.data
      if (!target || target.communityId !== community.id) return

      let targetPost = postsRef.current.find(post => post.id === target.postId) || null
      if (!targetPost) {
        const postResult = await getCommunityPostById(
          target.postId,
          user?.id,
          currentUserRole
        )
        if (!isRequestActive()) return
        if (postResult.error) {
          setFeedback({ tone: 'error', message: postResult.error.message })
          return
        }
        if (!postResult.data || postResult.data.comunidade_id !== community.id) return

        targetPost = postResult.data
        updatePosts(currentPosts => {
          if (currentPosts.some(post => post.id === targetPost?.id)) return currentPosts
          const nextPosts = [targetPost as CommunityPost, ...currentPosts]
          postsRef.current = nextPosts
          return nextPosts
        })
      }

      const anchorResult = await getCommunityCommentAnchor(
        target.postId,
        commentId,
        COMMENT_PAGE_SIZE
      )
      if (!isRequestActive()) return
      if (anchorResult.error) {
        setFeedback({ tone: 'error', message: anchorResult.error.message })
        return
      }
      if (!anchorResult.data.found || anchorResult.data.pageOffset === null) return

      const pageResult = await getCommunityPostCommentsPage(target.postId, {
        limit: COMMENT_PAGE_SIZE,
        offset: anchorResult.data.pageOffset,
      })
      if (!isRequestActive()) return
      if (pageResult.error) {
        setFeedback({ tone: 'error', message: pageResult.error.message })
        return
      }

      updatePosts(currentPosts => {
        const nextPosts = currentPosts.map(post => {
          if (post.id !== target.postId) return post
          const currentOffset = post.commentsNextOffset ?? post.comentarios.length
          const commentsNextOffset = currentOffset === anchorResult.data.pageOffset
            ? Math.max(currentOffset, pageResult.data.nextOffset)
            : currentOffset
          return {
            ...post,
            comentarios: mergeCommunityComments(post.comentarios, pageResult.data.comments),
            comentarios_count: pageResult.data.totalCount
              ?? anchorResult.data.totalCount
              ?? post.comentarios_count,
            commentsNextOffset,
          }
        })
        postsRef.current = nextPosts
        return nextPosts
      })
      setActiveTab('posts')
    }

    void resolveAnchor()
    return () => {
      cancelled = true
    }
  }, [
    activeAnchorId,
    canViewContent,
    commentReadScopeKey,
    community?.id,
    communityId,
    currentUserRole,
    postsLoading,
    updatePosts,
    user?.id,
  ])

  const executeConfirmAction = async () => {
    if (!confirmState || !community) return

    setConfirmSubmitting(true)

    try {
      if (await membershipActions.executeConfirmation(confirmState)) {
        return
      }

      if (confirmState.kind === 'delete-community') {
        const result = await deleteCommunity(community.id)
        if (result.error) throw result.error
        navigate('/comunidades')
        return
      }

      if (confirmState.kind === 'delete-post') {
        const result = await deleteCommunityPost(confirmState.post.id)
        if (result.error) throw result.error
        setFeedback({
          tone: result.data.failedPaths.length > 0 ? 'info' : 'success',
          message:
            result.data.failedPaths.length > 0
              ? t('communities.post.deletedWithCleanupWarnings')
              : t('communities.post.deleted'),
        })
      }

      if (confirmState.kind === 'delete-comment') {
        const result = await deleteCommunityComment(confirmState.commentId)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.comment.deleted') })
      }

      if (confirmState.kind === 'posting-permission') {
        const result = await updateCommunityPostingPermission(community.id, confirmState.permission)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.settings.postingSaved') })
      }

      setConfirmState(null)
      await reloadAll()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : t('communities.actionError')
      setFeedback({ tone: 'error', message })
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const handleReportSubmit = async (payload: { reason: CommunityReportReason; description: string }) => {
    if (!community || !reportTarget) return
    setReportSubmitting(true)
    const result = await submitCommunityReport({
      communityId: community.id,
      targetType: reportTarget.type,
      targetId: reportTarget.id,
      reason: payload.reason,
      description: payload.description,
    })
    setReportSubmitting(false)

    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setReportTarget(null)
    setFeedback({ tone: 'success', message: t('communities.report.sent') })
    await reloadModeration()
  }

  const handleReportStatusChange = async (report: CommunityReport, status: CommunityReportStatus) => {
    const result = await updateCommunityReportStatus(report.id, status)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }
    setFeedback({ tone: 'success', message: t('communities.moderation.reportUpdated') })
    await reloadModeration()
  }

  const confirmCopy = getConfirmCopy(confirmState)

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="communities-state-card">{t('communities.details.loading')}</div>
        </div>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="communities-state-card">
            {t('communities.details.notFound')}
            <div className="community-details-actions">
              <Link to="/comunidades" className="communities-primary-link">
                {t('communities.details.back')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const communityCategoryLabel = community.categoria
    ? COMMUNITY_CATEGORY_VALUES.includes(community.categoria as CommunityCategoryValue)
      ? t(`communities.category.${community.categoria}`)
      : community.categoria
    : null
  const communityHeroMeta = [community.tipo, communityCategoryLabel, community.jogo?.titulo]
    .filter(Boolean)
    .join(' / ')

  const renderAboutTab = () => (
    <CommunityAboutCard
      community={community}
      categoryLabel={communityCategoryLabel}
      t={t}
      formatDate={formatDate}
      formatNumber={formatNumber}
    />
  )

  const renderSettingsTab = () => (
    <CommunitySettingsSection
      isLeader={isLeader}
      currentPostingPermission={community.permissao_postagem}
      postingPermissionDraft={postingPermissionDraft}
      settings={settings}
      onPostingPermissionDraftChange={setPostingPermissionDraft}
      onConfirmPostingPermission={permission =>
        setConfirmState({ kind: 'posting-permission', permission })
      }
      onDeleteCommunity={() => setConfirmState({ kind: 'delete-community' })}
    />
  )
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="community-details-page">
          <section className="community-details-hero">
            <div className="community-details-banner-shell">
              {bannerUrl ? (
                <>
                  <img className="community-media-backdrop" src={bannerUrl} alt="" aria-hidden="true" />
                  <img className="community-media-foreground" src={bannerUrl} alt="" />
                </>
              ) : (
                <div className="community-details-banner-fallback">
                  {community.nome.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="community-details-copy">
              <span className="communities-kicker">{t('communities.kicker')}</span>
              <h1>{community.nome}</h1>
              {communityHeroMeta ? (
                <p className="community-details-meta">{communityHeroMeta}</p>
              ) : null}
              <p>{community.descricao || t('communities.noDescription')}</p>

              <div className="community-details-actions">
                <span className="community-role-badge">
                  {community.currentUserRole ? getRoleLabel(community.currentUserRole) : t('communities.role.visitor')}
                </span>
                <span className="community-permission-badge">
                  {t(`communities.permission.${community.permissao_postagem}`)}
                </span>
                <span className="community-permission-badge">
                  {t(`communities.visibility.${community.visibilidade}`)}
                </span>
              </div>

              <div className="community-details-stats">
                <span>
                  <strong>{formatNumber(community.membros_count)}</strong>
                  {t('communities.members')}
                </span>
                <span>
                  <strong>{formatNumber(community.posts_count)}</strong>
                  {t('communities.posts')}
                </span>
              </div>
            </div>
          </section>

          {feedback ? (
            <p className={`communities-feedback is-${feedback.tone}`}>{feedback.message}</p>
          ) : null}

          {visibleTabs.length === 0 ? (
            <section className="community-section">
              <h2>{t('communities.private.title')}</h2>
              <p>{t('communities.private.text')}</p>
            </section>
          ) : (
            <>
              <nav className="community-tabs" aria-label={t('communities.tabs.label')}>
                {visibleTabs.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    className={visibleActiveTab === tab ? 'is-active' : ''}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`communities.tabs.${tab}`)}
                  </button>
                ))}
              </nav>

              <section className="community-tab-panel">
                {visibleActiveTab === 'posts' ? (
                  <CommunityFeedSection
                    t={t}
                    composer={{
                      canPost,
                      isAuthenticated: Boolean(user),
                      unavailableMessage:
                        user && !canPost
                          ? getNoPostPermissionMessage(community.permissao_postagem)
                          : '',
                      text: postText,
                      imageFile: postImageFile,
                      imagePreviewUrl: postImagePreviewUrl,
                      submitting: postSubmitting,
                    }}
                    list={{
                      posts,
                      loading: postsLoading,
                      currentUserId: user?.id,
                      currentUserRole: community.currentUserRole,
                      activeAnchorId,
                      page: postsPage,
                      totalPages: totalPostPages,
                    }}
                    actions={{
                      onCreatePost: handleCreatePost,
                      onPostTextChange: setPostText,
                      onPostImageFileChange: handlePostImageFileChange,
                      onToggleReaction: handleToggleReaction,
                      onToggleSave: handleToggleSave,
                      onTogglePin: handleTogglePinned,
                      onCreateComment: handleCreateComment,
                      onLoadMoreComments: handleLoadMoreComments,
                      onDeletePost: post =>
                        setConfirmState({ kind: 'delete-post', post }),
                      onDeleteComment: (post, commentId) =>
                        setConfirmState({ kind: 'delete-comment', post, commentId }),
                      onReport: setReportTarget,
                      onOpenImage: (url, alt) => setLightbox({ url, alt }),
                      onPageChange: setPostsPage,
                    }}
                  />
                ) : null}
                {visibleActiveTab === 'members' ? (
                  <CommunityMembersSection
                    data={{
                      members: sortedMembers,
                      totalCount: membersTotalCount,
                    }}
                    search={{
                      value: memberSearch,
                      onChange: setMemberSearch,
                    }}
                    state={{
                      loading: membersLoading,
                      error: membersError,
                    }}
                    pagination={{
                      hasMore: membersHasMore,
                      loadingMore: membersLoadingMore,
                      loadMore: loadMoreMembers,
                      retry: retryMembers,
                    }}
                    permissions={{
                      currentUserId: user?.id ?? null,
                      isModerator,
                      isLeader,
                    }}
                    actions={{
                      onRequestPromote: member =>
                        setConfirmState({ kind: 'promote-member', member }),
                      onRequestDemote: member =>
                        setConfirmState({ kind: 'demote-admin', member }),
                      onRequestTransferLeadership: member =>
                        setConfirmState({ kind: 'transfer-leadership', member }),
                      onRequestKick: member =>
                        setConfirmState({ kind: 'kick-member', member }),
                    }}
                  />
                ) : null}
                {visibleActiveTab === 'about' ? renderAboutTab() : null}
                {visibleActiveTab === 'moderation' && isModerator ? (
                  <CommunityModerationSection
                    loading={moderationLoading}
                    requests={{
                      items: joinRequests,
                      filter: requestFilter,
                      onFilterChange: setRequestFilter,
                      onApprove: membershipActions.approveRequest,
                      onReject: membershipActions.rejectRequest,
                    }}
                    reports={{
                      items: reports,
                      filter: reportFilter,
                      onFilterChange: setReportFilter,
                      onStatusChange: handleReportStatusChange,
                    }}
                  />
                ) : null}
                {visibleActiveTab === 'settings' && isModerator ? renderSettingsTab() : null}
                {visibleActiveTab === 'memberSettings' && !isModerator ? (
                  <CommunityParticipationSection
                    community={community}
                    isAuthenticated={Boolean(user)}
                    onJoin={membershipActions.join}
                    onRequestLeave={() => setConfirmState({ kind: 'leave-community' })}
                  />
                ) : null}
              </section>
            </>
          )}

          {confirmCopy && confirmState ? (
            <CommunityConfirmModal
              title={confirmCopy.title}
              description={confirmCopy.description}
              confirmLabel={confirmCopy.confirmLabel}
              cancelLabel={t('common.cancel')}
              submittingLabel={t('common.updating')}
              tone={confirmCopy.tone}
              isSubmitting={confirmSubmitting}
              onClose={() => setConfirmState(null)}
              onConfirm={() => void executeConfirmAction()}
            />
          ) : null}

          {reportTarget ? (
            <CommunityReportModal
              targetType={reportTarget.type}
              targetLabel={reportTarget.label}
              isSubmitting={reportSubmitting}
              onClose={() => setReportTarget(null)}
              onSubmit={handleReportSubmit}
            />
          ) : null}

          {lightbox ? (
            <div className="community-lightbox" role="presentation" onMouseDown={() => setLightbox(null)}>
              <div className="community-lightbox-content" onMouseDown={event => event.stopPropagation()}>
                <button
                  type="button"
                  className="community-lightbox-close"
                  onClick={() => setLightbox(null)}
                  aria-label={t('common.close')}
                >
                  X
                </button>
                <img src={lightbox.url} alt={lightbox.alt} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CommunityDetailsPage
