import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CommunityAboutCard } from '../components/communities/CommunityAboutCard'
import { CommunityConfirmModal } from '../components/communities/CommunityConfirmModal'
import { CommunityFilePicker } from '../components/communities/CommunityFilePicker'
import { CommunityPostCard } from '../components/communities/CommunityPostCard'
import { CommunityReportModal } from '../components/communities/CommunityReportModal'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  approveCommunityJoinRequest,
  createCommunityComment,
  createCommunityPost,
  deleteCommunity,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityById,
  getCommunityJoinRequests,
  getCommunityMembers,
  getCommunityPosts,
  getCommunityReports,
  joinCommunity,
  leaveCommunity,
  rejectCommunityJoinRequest,
  removeCommunityMember,
  submitCommunityReport,
  toggleCommunityPostReaction,
  toggleCommunityPostSave,
  transferCommunityLeadership,
  updateCommunity,
  updateCommunityMemberRole,
  updateCommunityModeratedDetails,
  updateCommunityPostingPermission,
  updateCommunityReportStatus,
  type CommunityCategoryValue,
  type CommunityJoinRequest,
  type CommunityMember,
  type CommunityPost,
  type CommunityPostingPermission,
  type CommunityReactionType,
  type CommunityReport,
  type CommunityReportReason,
  type CommunityReportStatus,
  type CommunityReportTargetType,
  type CommunitySummary,
  type CommunityVisibility,
} from '../services/communityService'
import {
  resolvePublicFileUrl,
  uploadCommunityBannerImage,
  uploadCommunityPostImage,
} from '../services/storageService'
import { getOptionalPublicProfilePath } from '../utils/profileRoutes'
import './CommunitiesPage.css'

type FeedbackTone = 'success' | 'error' | 'info'
type CommunityTab = 'posts' | 'members' | 'about' | 'moderation' | 'settings' | 'memberSettings'
type RequestFilter = 'pendente' | 'all'
type ReportFilter = CommunityReportStatus | 'all'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface SettingsDraft {
  nome: string
  descricao: string
  tipo: string
  categoria: CommunityCategoryValue | ''
  regras: string
  visibilidade: CommunityVisibility
}

type ConfirmState =
  | { kind: 'delete-community' }
  | { kind: 'leave-community' }
  | { kind: 'delete-post'; post: CommunityPost }
  | { kind: 'delete-comment'; post: CommunityPost; commentId: string }
  | { kind: 'kick-member'; member: CommunityMember }
  | { kind: 'transfer-leadership'; member: CommunityMember }
  | { kind: 'posting-permission'; permission: CommunityPostingPermission }
  | { kind: 'promote-member'; member: CommunityMember }
  | { kind: 'demote-admin'; member: CommunityMember }

interface ReportTarget {
  type: CommunityReportTargetType
  id: string
  label: string
}

interface LightboxState {
  url: string
  alt: string
}

const POST_PAGE_SIZE = 8
const POSTING_PERMISSION_OPTIONS: CommunityPostingPermission[] = [
  'todos_membros',
  'somente_admins',
  'somente_lider',
]

function createSettingsDraft(community: CommunitySummary | null): SettingsDraft {
  return {
    nome: community?.nome || '',
    descricao: community?.descricao || '',
    tipo: community?.tipo || '',
    categoria: COMMUNITY_CATEGORY_VALUES.includes(community?.categoria as CommunityCategoryValue)
      ? (community?.categoria as CommunityCategoryValue)
      : '',
    regras: community?.regras || '',
    visibilidade: community?.visibilidade || 'publica',
  }
}

function getMemberName(member: CommunityMember) {
  return member.usuario?.username || member.usuario?.nome_completo || 'usuario'
}

function getAuthorName(author: { username?: string | null; nome_completo?: string | null } | null) {
  return author?.username || author?.nome_completo || 'usuario'
}

function getCommunityBanner(community: CommunitySummary | null) {
  if (!community) return null
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function getReportPreview(report: CommunityReport) {
  if (report.targetText) return report.targetText
  if (report.targetImagePath) return 'Imagem'
  return ''
}

function CommunityDetailsPage() {
  const { id } = useParams()
  const communityId = id || ''
  const location = useLocation()
  const { user } = useAuth()
  const { t, formatDate, formatNumber } = useI18n()
  const navigate = useNavigate()

  const [community, setCommunity] = useState<CommunitySummary | null>(null)
  const [members, setMembers] = useState<CommunityMember[]>([])
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [joinRequests, setJoinRequests] = useState<CommunityJoinRequest[]>([])
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(false)
  const [moderationLoading, setModerationLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts')
  const [postText, setPostText] = useState('')
  const [postImageFile, setPostImageFile] = useState<File | null>(null)
  const [postImagePreviewUrl, setPostImagePreviewUrl] = useState<string | null>(null)
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => createSettingsDraft(null))
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [postingPermissionDraft, setPostingPermissionDraft] =
    useState<CommunityPostingPermission>('todos_membros')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('')
  const [postsPage, setPostsPage] = useState(1)
  const [postsTotalCount, setPostsTotalCount] = useState<number | null>(null)
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('pendente')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const isLeader = community?.currentUserRole === 'lider'
  const isModerator = community?.currentUserRole === 'lider' || community?.currentUserRole === 'admin'
  const canPost = Boolean(user && community?.canPost)
  const bannerUrl = getCommunityBanner(community)
  const canViewContent = Boolean(community?.canViewContent)
  const totalPostPages = postsTotalCount ? Math.max(1, Math.ceil(postsTotalCount / POST_PAGE_SIZE)) : 1
  const activeAnchorId = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''

  const visibleTabs = useMemo<CommunityTab[]>(() => {
    if (!canViewContent) return isModerator ? [] : ['memberSettings']

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedMemberSearch(memberSearch), 220)
    return () => window.clearTimeout(timeoutId)
  }, [memberSearch])

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(bannerFile)
    setBannerPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [bannerFile])

  useEffect(() => {
    if (!postImageFile) {
      setPostImagePreviewUrl(null)
      return
    }

    const previewUrl = URL.createObjectURL(postImageFile)
    setPostImagePreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [postImageFile])

  useEffect(() => {
    if (!lightbox) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lightbox])

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
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

  const loadCommunityData = useCallback(async () => {
    if (!communityId) return

    setLoading(true)
    const communityResult = await getCommunityById(communityId, user?.id)
    const nextCommunity = communityResult.data

    setCommunity(nextCommunity)
    setSettingsDraft(createSettingsDraft(nextCommunity))
    setPostingPermissionDraft(nextCommunity?.permissao_postagem || 'todos_membros')
    setFeedback(
      communityResult.error
        ? {
            tone: 'error',
            message: communityResult.error.message || t('communities.details.loadError'),
          }
        : null
    )
    setLoading(false)
  }, [communityId, t, user?.id])

  const loadMembers = useCallback(async () => {
    if (!communityId || !community?.canViewContent) {
      setMembers([])
      return
    }

    setMembersLoading(true)
    const result = await getCommunityMembers(communityId, {
      search: debouncedMemberSearch,
      limit: 250,
    })
    setMembers(result.data)
    if (result.error) setFeedback({ tone: 'error', message: result.error.message })
    setMembersLoading(false)
  }, [community?.canViewContent, communityId, debouncedMemberSearch])

  const loadPosts = useCallback(async () => {
    if (!communityId || !community?.canViewContent) {
      setPosts([])
      setPostsTotalCount(null)
      return
    }

    setPostsLoading(true)
    const result = await getCommunityPosts(communityId, user?.id, community.currentUserRole, {
      page: postsPage,
      pageSize: POST_PAGE_SIZE,
    })
    setPosts(result.data)
    setPostsTotalCount(result.totalCount)
    if (result.error) setFeedback({ tone: 'error', message: result.error.message })
    setPostsLoading(false)
  }, [community?.canViewContent, community?.currentUserRole, communityId, postsPage, user?.id])

  const loadModeration = useCallback(async () => {
    if (!communityId || !isModerator) {
      setJoinRequests([])
      setReports([])
      return
    }

    setModerationLoading(true)
    const [requestsResult, reportsResult] = await Promise.all([
      getCommunityJoinRequests(communityId, requestFilter),
      getCommunityReports(communityId, { status: reportFilter }),
    ])
    setJoinRequests(requestsResult.data)
    setReports(reportsResult.data)
    if (requestsResult.error || reportsResult.error) {
      setFeedback({
        tone: 'error',
        message: requestsResult.error?.message || reportsResult.error?.message || t('communities.moderation.loadError'),
      })
    }
    setModerationLoading(false)
  }, [communityId, isModerator, reportFilter, requestFilter, t])

  useEffect(() => {
    void loadCommunityData()
  }, [loadCommunityData])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  useEffect(() => {
    void loadModeration()
  }, [loadModeration])

  const reloadAll = async () => {
    await loadCommunityData()
    await loadMembers()
    await loadPosts()
    await loadModeration()
  }

  const handleJoin = async () => {
    if (!communityId) return
    const result = await joinCommunity(communityId)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    setFeedback({
      tone: result.data === 'requested' || result.data === 'already_pending' ? 'info' : 'success',
      message:
        result.data === 'requested' || result.data === 'already_pending'
          ? t('communities.private.requestSent')
          : t('communities.joined'),
    })
    await reloadAll()
  }

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
      setPostImageFile(null)
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
      setPosts(currentPosts =>
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

    setPosts(currentPosts =>
      currentPosts.map(currentPost =>
        currentPost.id === post.id
          ? { ...currentPost, savedByCurrentUser: result.data }
          : currentPost
      )
    )
  }

  const handleCreateComment = async (post: CommunityPost, text: string) => {
    const result = await createCommunityComment(post.id, text)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }

    await loadPosts()
  }

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!community || !isModerator || settingsSaving) return

    setSettingsSaving(true)
    setFeedback(null)

    try {
      let bannerPath = community.banner_path
      if (bannerFile && user) {
        const uploadResult = await uploadCommunityBannerImage(bannerFile, user.id)
        if (!uploadResult) {
          setFeedback({ tone: 'error', message: t('communities.settings.bannerUploadError') })
          return
        }
        bannerPath = uploadResult.path
      }

      const result = isLeader
        ? await updateCommunity({
            comunidadeId: community.id,
            nome: settingsDraft.nome,
            descricao: settingsDraft.descricao,
            tipo: settingsDraft.tipo,
            categoria: settingsDraft.categoria || null,
            regras: settingsDraft.regras,
            bannerPath,
            jogoId: community.jogo_id,
            permissaoPostagem: community.permissao_postagem,
            visibilidade: settingsDraft.visibilidade,
          })
        : await updateCommunityModeratedDetails({
            comunidadeId: community.id,
            descricao: settingsDraft.descricao,
            regras: settingsDraft.regras,
            bannerPath,
          })

      if (result.error) {
        setFeedback({ tone: 'error', message: result.error.message })
      } else {
        setBannerFile(null)
        setFeedback({ tone: 'success', message: t('communities.settings.saved') })
        await loadCommunityData()
      }
    } finally {
      setSettingsSaving(false)
    }
  }

  const executeConfirmAction = async () => {
    if (!confirmState || !community) return

    setConfirmSubmitting(true)

    try {
      if (confirmState.kind === 'delete-community') {
        const result = await deleteCommunity(community.id)
        if (result.error) throw result.error
        navigate('/comunidades')
        return
      }

      if (confirmState.kind === 'leave-community') {
        const result = await leaveCommunity(community.id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.left') })
      }

      if (confirmState.kind === 'delete-post') {
        const result = await deleteCommunityPost(confirmState.post.id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.post.deleted') })
      }

      if (confirmState.kind === 'delete-comment') {
        const result = await deleteCommunityComment(confirmState.commentId)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.comment.deleted') })
      }

      if (confirmState.kind === 'kick-member') {
        const result = await removeCommunityMember(community.id, confirmState.member.usuario_id)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.member.removed') })
      }

      if (confirmState.kind === 'transfer-leadership') {
        const result = await transferCommunityLeadership(
          community.id,
          confirmState.member.usuario_id
        )
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.member.transferred') })
      }

      if (confirmState.kind === 'posting-permission') {
        const result = await updateCommunityPostingPermission(community.id, confirmState.permission)
        if (result.error) throw result.error
        setFeedback({ tone: 'success', message: t('communities.settings.postingSaved') })
      }

      if (confirmState.kind === 'promote-member' || confirmState.kind === 'demote-admin') {
        const nextRole = confirmState.kind === 'promote-member' ? 'admin' : 'membro'
        const result = await updateCommunityMemberRole(
          community.id,
          confirmState.member.usuario_id,
          nextRole
        )
        if (result.error) throw result.error
        setFeedback({
          tone: 'success',
          message:
            nextRole === 'admin'
              ? t('communities.member.promoted')
              : t('communities.member.demoted'),
        })
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

  const handleApproveRequest = async (request: CommunityJoinRequest) => {
    const result = await approveCommunityJoinRequest(request.id)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }
    setFeedback({ tone: 'success', message: t('communities.moderation.requestApproved') })
    await reloadAll()
  }

  const handleRejectRequest = async (request: CommunityJoinRequest) => {
    const result = await rejectCommunityJoinRequest(request.id)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }
    setFeedback({ tone: 'success', message: t('communities.moderation.requestRejected') })
    await loadModeration()
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
    await loadModeration()
  }

  const handleReportStatusChange = async (report: CommunityReport, status: CommunityReportStatus) => {
    const result = await updateCommunityReportStatus(report.id, status)
    if (result.error) {
      setFeedback({ tone: 'error', message: result.error.message })
      return
    }
    setFeedback({ tone: 'success', message: t('communities.moderation.reportUpdated') })
    await loadModeration()
  }

  const updateSettingsDraft = <K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => {
    setSettingsDraft(currentDraft => ({ ...currentDraft, [field]: value }))
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

  const renderMemberSettingsTab = () => {
    const roleLabel = community.currentUserRole
      ? getRoleLabel(community.currentUserRole)
      : t('communities.role.visitor')
    const isPending = community.currentUserJoinRequestStatus === 'pendente'
    const memberStatus = community.currentUserRole
      ? t('communities.participation.statusApproved')
      : isPending
        ? t('communities.private.requestSent')
        : t('communities.participation.statusNotMember')
    const participationHelp = community.currentUserRole === 'lider'
      ? t('communities.participation.leaderHelp')
      : community.currentUserRole === 'admin'
        ? t('communities.participation.adminHelp')
        : community.currentUserRole === 'membro'
          ? t('communities.participation.memberHelp')
          : isPending
            ? t('communities.participation.pendingHelp')
            : t('communities.participation.visitorHelp')

    return (
      <section className="community-section community-member-settings-card">
        <div className="community-member-settings-head">
          <div>
            <span className="communities-kicker">{t('communities.participation.kicker')}</span>
            <h2>{t('communities.participation.title')}</h2>
          </div>
          <p>{participationHelp}</p>
        </div>

        <div className="community-participation-status">
          <span>
            <strong>{t('communities.participation.role')}</strong>
            {roleLabel}
          </span>
          <span>
            <strong>{t('communities.participation.status')}</strong>
            {memberStatus}
          </span>
          <span>
            <strong>{t('communities.participation.postingRule')}</strong>
            {t(`communities.permission.${community.permissao_postagem}`)}
          </span>
        </div>

        <div className="community-participation-actions">
          {!user ? (
            <Link to="/login" className="communities-primary-link">
              {t('communities.loginToJoin')}
            </Link>
          ) : community.currentUserRole ? (
            community.currentUserRole !== 'lider' ? (
              <button
                type="button"
                className="community-danger-button"
                onClick={() => setConfirmState({ kind: 'leave-community' })}
              >
                {t('communities.leave')}
              </button>
            ) : null
          ) : isPending ? (
            <button type="button" className="community-secondary-button" disabled>
              {t('communities.private.requestSent')}
            </button>
          ) : (
            <button type="button" className="communities-primary-button" onClick={handleJoin}>
              {community.visibilidade === 'privada'
                ? t('communities.private.requestJoin')
                : t('communities.join')}
            </button>
          )}
        </div>
      </section>
    )
  }

  const renderMemberCard = (member: CommunityMember) => {
    const memberName = getMemberName(member)
    const memberPath = getOptionalPublicProfilePath(member.usuario?.username)
    const canKick = isModerator && member.cargo === 'membro'
    const canManageAdmin = isLeader && member.cargo !== 'lider'
    const canTransfer = isLeader && member.usuario_id !== user?.id
    const authorContent = (
      <>
        <UserAvatar
          name={memberName}
          avatarPath={member.usuario?.avatar_path}
          imageClassName="community-member-avatar"
          fallbackClassName="community-member-avatar-fallback"
        />
        <span>
          <strong>@{memberName}</strong>
          <span>{getRoleLabel(member.cargo)}</span>
        </span>
      </>
    )

    return (
      <article key={member.usuario_id} className="community-member-card">
        <div className="community-member-header">
          {memberPath ? (
            <Link to={memberPath} className="community-member-author">
              {authorContent}
            </Link>
          ) : (
            <div className="community-member-author">{authorContent}</div>
          )}
        </div>

        {canKick || canManageAdmin || canTransfer ? (
          <div className="community-member-actions">
            {canManageAdmin ? (
              <button
                type="button"
                className="community-secondary-button"
                onClick={() =>
                  setConfirmState({
                    kind: member.cargo === 'admin' ? 'demote-admin' : 'promote-member',
                    member,
                  })
                }
              >
                {member.cargo === 'admin'
                  ? t('communities.member.removeAdmin')
                  : t('communities.member.promoteAdmin')}
              </button>
            ) : null}

            {canTransfer ? (
              <button
                type="button"
                className="community-secondary-button"
                onClick={() => setConfirmState({ kind: 'transfer-leadership', member })}
              >
                {t('communities.member.transferLeadership')}
              </button>
            ) : null}

            {canKick ? (
              <button
                type="button"
                className="community-danger-button"
                onClick={() => setConfirmState({ kind: 'kick-member', member })}
              >
                {t('communities.member.kick')}
              </button>
            ) : null}
          </div>
        ) : null}
      </article>
    )
  }

  const renderPostsTab = () => (
    <div className="community-feed">
      <section className="community-section">
        <h2>{t('communities.post.createTitle')}</h2>
        {canPost ? (
          <form className="community-post-form" onSubmit={handleCreatePost}>
            <textarea
              value={postText}
              onChange={event => setPostText(event.target.value)}
              placeholder={t('communities.post.placeholder')}
              maxLength={4000}
              disabled={postSubmitting}
            />
            <CommunityFilePicker
              label={t('communities.post.optionalImage')}
              buttonLabel={t('communities.upload.addImage')}
              removeLabel={t('communities.upload.removeImage')}
              uploadingLabel={t('communities.upload.uploading')}
              previewAlt={t('communities.post.imageAlt')}
              helperText={t('communities.upload.postImageHelper')}
              file={postImageFile}
              previewUrl={postImagePreviewUrl}
              disabled={postSubmitting}
              isUploading={postSubmitting && Boolean(postImageFile)}
              onChange={setPostImageFile}
            />
            <button type="submit" disabled={postSubmitting}>
              {postSubmitting ? t('communities.post.publishing') : t('communities.post.publish')}
            </button>
          </form>
        ) : (
          <p>
            {user
              ? getNoPostPermissionMessage(community.permissao_postagem)
              : t('communities.post.loginToInteract')}
          </p>
        )}
      </section>

      {postsLoading ? (
        <div className="communities-state-card">{t('communities.post.loading')}</div>
      ) : posts.length === 0 ? (
        <div className="communities-state-card">{t('communities.post.empty')}</div>
      ) : (
        <>
          {posts.map(post => (
            <CommunityPostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              currentUserRole={community.currentUserRole}
              onToggleReaction={handleToggleReaction}
              onToggleSave={handleToggleSave}
              onCreateComment={handleCreateComment}
              onDeletePost={postToDelete =>
                setConfirmState({ kind: 'delete-post', post: postToDelete })
              }
              onDeleteComment={(postWithComment, commentId) =>
                setConfirmState({
                  kind: 'delete-comment',
                  post: postWithComment,
                  commentId,
                })
              }
              onReport={setReportTarget}
              onOpenImage={(url, alt) => setLightbox({ url, alt })}
              activeAnchorId={activeAnchorId}
            />
          ))}

          <nav className="community-pagination" aria-label={t('communities.post.pagination')}>
            <button
              type="button"
              className="community-secondary-button"
              disabled={postsPage <= 1}
              onClick={() => setPostsPage(currentPage => Math.max(1, currentPage - 1))}
            >
              {t('communities.post.previousPage')}
            </button>
            <span>{t('communities.post.pageLabel', { page: postsPage, total: totalPostPages })}</span>
            <button
              type="button"
              className="community-secondary-button"
              disabled={postsPage >= totalPostPages}
              onClick={() => setPostsPage(currentPage => currentPage + 1)}
            >
              {t('communities.post.nextPage')}
            </button>
          </nav>
        </>
      )}
    </div>
  )

  const renderMembersTab = () => (
    <section className="community-section">
      <div className="community-section-head">
        <div>
          <h2>{t('communities.tabs.members')}</h2>
          <p>{t('communities.membersCount', { count: formatNumber(members.length) })}</p>
        </div>
        <label className="communities-field community-member-search">
          <span>{t('communities.members.search')}</span>
          <input
            type="search"
            value={memberSearch}
            onChange={event => setMemberSearch(event.target.value)}
            placeholder={t('communities.members.searchPlaceholder')}
          />
        </label>
      </div>

      {membersLoading ? (
        <div className="communities-state-card">{t('communities.members.loading')}</div>
      ) : sortedMembers.length === 0 ? (
        <div className="communities-state-card">{t('communities.members.empty')}</div>
      ) : (
        <div className="community-member-list is-grid">
          {sortedMembers.map(renderMemberCard)}
        </div>
      )}
    </section>
  )

  const renderAboutTab = () => (
    <CommunityAboutCard
      community={community}
      categoryLabel={communityCategoryLabel}
      t={t}
      formatDate={formatDate}
      formatNumber={formatNumber}
    />
  )

  const renderModerationTab = () => (
    <div className="community-moderation-grid">
      <section className="community-section">
        <div className="community-section-head">
          <div>
            <h2>{t('communities.moderation.requests')}</h2>
            <p>{t('communities.moderation.requestsHelp')}</p>
          </div>
          <label className="communities-field community-compact-select">
            <span>{t('common.status')}</span>
            <select
              value={requestFilter}
              onChange={event => setRequestFilter(event.target.value as RequestFilter)}
            >
              <option value="pendente">{t('communities.requestStatus.pendente')}</option>
              <option value="all">{t('communities.moderation.all')}</option>
            </select>
          </label>
        </div>

        {moderationLoading ? (
          <div className="communities-state-card">{t('communities.moderation.loading')}</div>
        ) : joinRequests.length === 0 ? (
          <div className="communities-state-card">{t('communities.moderation.noRequests')}</div>
        ) : (
          <div className="community-moderation-list">
            {joinRequests.map(request => {
              const userName = request.usuario?.username || request.usuario?.nome_completo || t('common.profile')
              return (
                <article key={request.id} className="community-moderation-card">
                  <div>
                    <strong>@{userName}</strong>
                    <span>{t(`communities.requestStatus.${request.status}`)}</span>
                  </div>
                  <small>{formatDate(request.created_at, { fallback: t('common.noDate') })}</small>
                  {request.status === 'pendente' ? (
                    <div className="community-member-actions">
                      <button
                        type="button"
                        className="community-secondary-button"
                        onClick={() => void handleApproveRequest(request)}
                      >
                        {t('communities.moderation.approve')}
                      </button>
                      <button
                        type="button"
                        className="community-danger-button"
                        onClick={() => void handleRejectRequest(request)}
                      >
                        {t('communities.moderation.reject')}
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="community-section">
        <div className="community-section-head">
          <div>
            <h2>{t('communities.moderation.reports')}</h2>
            <p>{t('communities.moderation.reportsHelp')}</p>
          </div>
          <label className="communities-field community-compact-select">
            <span>{t('common.status')}</span>
            <select
              value={reportFilter}
              onChange={event => setReportFilter(event.target.value as ReportFilter)}
            >
              <option value="all">{t('communities.moderation.all')}</option>
              <option value="pending">{t('report.status.pending')}</option>
              <option value="under_review">{t('report.status.under_review')}</option>
              <option value="resolved">{t('report.status.resolved')}</option>
              <option value="dismissed">{t('report.status.dismissed')}</option>
            </select>
          </label>
        </div>

        {moderationLoading ? (
          <div className="communities-state-card">{t('communities.moderation.loading')}</div>
        ) : reports.length === 0 ? (
          <div className="communities-state-card">{t('communities.moderation.noReports')}</div>
        ) : (
          <div className="community-moderation-list">
            {reports.map(report => {
              const reporterName = getAuthorName(report.denunciante)
              const targetAuthorName = getAuthorName(report.targetAuthor)
              return (
                <article key={report.id} className="community-moderation-card">
                  <div className="community-report-card-head">
                    <div>
                      <strong>{t(`communities.report.type.${report.tipo_conteudo}`)}</strong>
                      <span>{t('communities.moderation.reportBy', { user: `@${reporterName}` })}</span>
                    </div>
                    <select
                      value={report.status}
                      onChange={event =>
                        void handleReportStatusChange(report, event.target.value as CommunityReportStatus)
                      }
                    >
                      <option value="pending">{t('report.status.pending')}</option>
                      <option value="under_review">{t('report.status.under_review')}</option>
                      <option value="resolved">{t('report.status.resolved')}</option>
                      <option value="dismissed">{t('report.status.dismissed')}</option>
                    </select>
                  </div>
                  <p>{t('communities.moderation.reason', { reason: t(`report.reason.${report.motivo}`) })}</p>
                  <p>{t('communities.moderation.targetAuthor', { user: `@${targetAuthorName}` })}</p>
                  {getReportPreview(report) ? <blockquote>{getReportPreview(report)}</blockquote> : null}
                  {report.descricao ? <p>{report.descricao}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )

  const renderSettingsTab = () => (
    <div className="community-settings-layout">
      <section className="community-settings-card">
        <h2>{t('communities.tabs.settings')}</h2>
        <form className="community-settings-form" onSubmit={handleSaveSettings}>
          <label className="communities-field">
            <span>{t('communities.field.name')}</span>
            <input
              value={settingsDraft.nome}
              onChange={event => updateSettingsDraft('nome', event.target.value)}
              maxLength={80}
              required
              disabled={!isLeader}
            />
          </label>
          <label className="communities-field">
            <span>{t('communities.field.description')}</span>
            <textarea
              value={settingsDraft.descricao}
              onChange={event => updateSettingsDraft('descricao', event.target.value)}
              maxLength={600}
            />
          </label>
          <div className="communities-form-grid">
            <label className="communities-field">
              <span>{t('communities.field.theme')}</span>
              <input
                value={settingsDraft.tipo}
                onChange={event => updateSettingsDraft('tipo', event.target.value)}
                disabled={!isLeader}
              />
            </label>
            <label className="communities-field">
              <span>{t('communities.field.category')}</span>
              <select
                value={settingsDraft.categoria}
                onChange={event => updateSettingsDraft('categoria', event.target.value as CommunityCategoryValue | '')}
                disabled={!isLeader}
              >
                <option value="">{t('communities.field.categoryPlaceholder')}</option>
                {COMMUNITY_CATEGORY_VALUES.map(option => (
                  <option key={option} value={option}>
                    {t(`communities.category.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="communities-field">
            <span>{t('communities.field.rules')}</span>
            <textarea
              value={settingsDraft.regras}
              onChange={event => updateSettingsDraft('regras', event.target.value)}
              maxLength={3000}
            />
          </label>
          <div className="communities-form-grid">
            <label className="communities-field">
              <span>{t('communities.field.visibility')}</span>
              <select
                value={settingsDraft.visibilidade}
                onChange={event => updateSettingsDraft('visibilidade', event.target.value as CommunityVisibility)}
                disabled={!isLeader}
              >
                <option value="publica">{t('communities.visibility.publica')}</option>
                <option value="privada">{t('communities.visibility.privada')}</option>
              </select>
            </label>
          </div>
          <CommunityFilePicker
            label={t('communities.field.banner')}
            buttonLabel={t('communities.upload.chooseBanner')}
            removeLabel={t('communities.upload.removeImage')}
            uploadingLabel={t('communities.upload.uploading')}
            previewAlt={t('communities.settings.bannerPreview')}
            helperText={t('communities.upload.bannerHelper')}
            file={bannerFile}
            previewUrl={bannerPreviewUrl}
            disabled={settingsSaving}
            isUploading={settingsSaving && Boolean(bannerFile)}
            onChange={setBannerFile}
          />
          <button type="submit" className="community-settings-button" disabled={settingsSaving}>
            {settingsSaving ? t('common.saving') : t('communities.settings.saveInfo')}
          </button>
        </form>
      </section>

      <section className="community-settings-card community-posting-settings-card">
        <div className="community-settings-card-head">
          <div>
            <h2>{t('communities.settings.postingTitle')}</h2>
            <p>{t('communities.settings.postingCompactHelp')}</p>
          </div>
        </div>

        <div className="community-posting-option-group" role="radiogroup" aria-label={t('communities.settings.postingRule')}>
          {POSTING_PERMISSION_OPTIONS.map(option => (
            <label
              key={option}
              className={`community-posting-option${postingPermissionDraft === option ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="community-posting-permission"
                value={option}
                checked={postingPermissionDraft === option}
                onChange={() => setPostingPermissionDraft(option)}
              />
              <span>
                <strong>{t(`communities.permission.${option}`)}</strong>
                <small>{t(`communities.permissionDescription.${option}`)}</small>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="community-settings-button"
          disabled={postingPermissionDraft === community.permissao_postagem}
          onClick={() =>
            setConfirmState({
              kind: 'posting-permission',
              permission: postingPermissionDraft,
            })
          }
        >
          {t('communities.settings.changePosting')}
        </button>
      </section>

      {isLeader ? (
        <section className="community-settings-card is-danger-zone">
          <h2>{t('common.dangerZone')}</h2>
          <p>{t('communities.settings.dangerText')}</p>
          <button
            type="button"
            className="community-danger-button"
            onClick={() => setConfirmState({ kind: 'delete-community' })}
          >
            {t('communities.settings.deleteCommunity')}
          </button>
        </section>
      ) : null}
    </div>
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
                    className={activeTab === tab ? 'is-active' : ''}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`communities.tabs.${tab}`)}
                  </button>
                ))}
              </nav>

              <section className="community-tab-panel">
                {activeTab === 'posts' ? renderPostsTab() : null}
                {activeTab === 'members' ? renderMembersTab() : null}
                {activeTab === 'about' ? renderAboutTab() : null}
                {activeTab === 'moderation' && isModerator ? renderModerationTab() : null}
                {activeTab === 'settings' && isModerator ? renderSettingsTab() : null}
                {activeTab === 'memberSettings' && !isModerator ? renderMemberSettingsTab() : null}
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
