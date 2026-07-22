import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CommunityAboutCard } from '../components/communities/CommunityAboutCard'
import { CommunityConfirmModal } from '../components/communities/CommunityConfirmModal'
import { CommunityReportModal } from '../components/communities/CommunityReportModal'
import { useAuth } from '../contexts/AuthContext'
import { CommunityFeedSection } from '../features/communities/components/CommunityFeedSection'
import { CommunityMembersSection } from '../features/communities/components/CommunityMembersSection'
import { CommunityModerationSection } from '../features/communities/components/CommunityModerationSection'
import { CommunityParticipationSection } from '../features/communities/components/CommunityParticipationSection'
import { CommunitySettingsSection } from '../features/communities/components/CommunitySettingsSection'
import type {
  FeedbackState,
} from '../features/communities/domain/communityDetailsTypes'
import { useCommunityCommentReader } from '../features/communities/hooks/useCommunityCommentReader'
import { useCommunityConfirmationController } from '../features/communities/hooks/useCommunityConfirmationController'
import { useCommunityFeedActions } from '../features/communities/hooks/useCommunityFeedActions'
import { useCommunityFeedController } from '../features/communities/hooks/useCommunityFeedController'
import { useCommunityMembershipActions } from '../features/communities/hooks/useCommunityMembershipActions'
import { useCommunityMembersController } from '../features/communities/hooks/useCommunityMembersController'
import { useCommunityModerationController } from '../features/communities/hooks/useCommunityModerationController'
import { useCommunityPostComposer } from '../features/communities/hooks/useCommunityPostComposer'
import { useCommunitySettingsController } from '../features/communities/hooks/useCommunitySettingsController'
import { useCommunitySummaryController } from '../features/communities/hooks/useCommunitySummaryController'
import { useI18n } from '../i18n/I18nContext'
import {
  COMMUNITY_CATEGORY_VALUES,
  type CommunityCategoryValue,
  type CommunityMember,
  type CommunityPostingPermission,
  type CommunityReportStatus,
  type CommunitySummary,
} from '../services/communityService'
import { resolvePublicFileUrl } from '../services/storageService'
import { DialogShell } from '../components/ui/DialogShell'
import './CommunitiesPage.css'

type CommunityTab = 'posts' | 'members' | 'about' | 'moderation' | 'settings' | 'memberSettings'
type RequestFilter = 'pendente' | 'all'
type ReportFilter = CommunityReportStatus | 'all'

const POST_PAGE_SIZE = 8

function handleCommunityTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return

  const tabList = event.currentTarget.closest('[role="tablist"]')
  const tabs = Array.from(tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || [])
  const currentIndex = tabs.indexOf(event.currentTarget)

  if (currentIndex < 0 || tabs.length === 0) return

  event.preventDefault()
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length

  tabs[nextIndex].focus()
  tabs[nextIndex].click()
}

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
  const [postingPermissionDraft, setPostingPermissionDraft] =
    useState<CommunityPostingPermission>('todos_membros')
  const [memberSearch, setMemberSearch] = useState('')
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState('')
  const [postsPage, setPostsPage] = useState(1)
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('pendente')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedMemberSearch(memberSearch), 220)
    return () => window.clearTimeout(timeoutId)
  }, [memberSearch])

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

  const navigateToCommunities = useCallback(() => {
    navigate('/comunidades')
  }, [navigate])
  const resetPostsPage = useCallback(() => {
    setPostsPage(1)
  }, [])
  const showPostsTab = useCallback(() => {
    setActiveTab('posts')
  }, [])
  const confirmation = useCommunityConfirmationController({
    communityId: community?.id ?? null,
    reloadAll,
    navigateToCommunities,
    publishFeedback: setFeedback,
    t,
  })
  const membershipActions = useCommunityMembershipActions({
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    reloadAll,
    reloadModeration,
    publishFeedback: setFeedback,
    closeConfirmation: confirmation.close,
    t,
  })
  const composer = useCommunityPostComposer({
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    reloadAll,
    resetPostsPage,
    publishFeedback: setFeedback,
    t,
  })
  const feedActions = useCommunityFeedActions({
    communityId: community?.id ?? null,
    postsPage,
    setPostsPage,
    reloadPosts,
    reloadModeration,
    updatePosts,
    publishFeedback: setFeedback,
    t,
  })
  const commentReader = useCommunityCommentReader({
    activeAnchorId,
    routeCommunityId: communityId,
    communityId: community?.id ?? null,
    currentUserId: user?.id ?? null,
    currentUserRole,
    canViewContent,
    postsLoading,
    postsPage,
    posts,
    updatePosts,
    showPostsTab,
    publishFeedback: setFeedback,
  })

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="communities-state-card" role="status" aria-busy="true">
            {t('communities.details.loading')}
          </div>
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
        confirmation.open({ kind: 'posting-permission', permission })
      }
      onDeleteCommunity={() =>
        confirmation.open({ kind: 'delete-community' })
      }
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
                  <img className="community-media-foreground" src={bannerUrl} alt={community.nome} />
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
            <p className={`communities-feedback is-${feedback.tone}`} role="status">
              {feedback.message}
            </p>
          ) : null}

          {visibleTabs.length === 0 ? (
            <section className="community-section">
              <h2>{t('communities.private.title')}</h2>
              <p>{t('communities.private.text')}</p>
            </section>
          ) : (
            <>
              <nav className="community-tabs" role="tablist" aria-label={t('communities.tabs.label')}>
                {visibleTabs.map(tab => (
                  <button
                    key={tab}
                    id={`community-tab-${tab}`}
                    type="button"
                    role="tab"
                    className={visibleActiveTab === tab ? 'is-active' : ''}
                    aria-selected={visibleActiveTab === tab}
                    aria-controls="community-active-panel"
                    tabIndex={visibleActiveTab === tab ? 0 : -1}
                    onKeyDown={handleCommunityTabKeyDown}
                    onClick={() => setActiveTab(tab)}
                  >
                    {t(`communities.tabs.${tab}`)}
                  </button>
                ))}
              </nav>

              <section
                id="community-active-panel"
                className="community-tab-panel"
                role="tabpanel"
                aria-labelledby={`community-tab-${visibleActiveTab}`}
              >
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
                      text: composer.text,
                      imageFile: composer.imageFile,
                      imagePreviewUrl: composer.imagePreviewUrl,
                      submitting: composer.submitting,
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
                      onCreatePost: composer.submit,
                      onPostTextChange: composer.setText,
                      onPostImageFileChange: composer.setImage,
                      onToggleReaction: feedActions.toggleReaction,
                      onToggleSave: feedActions.toggleSave,
                      onTogglePin: feedActions.togglePinned,
                      onCreateComment: feedActions.createComment,
                      onLoadMoreComments: commentReader.loadMoreComments,
                      onDeletePost: post =>
                        confirmation.open({ kind: 'delete-post', post }),
                      onDeleteComment: (post, commentId) =>
                        confirmation.open({
                          kind: 'delete-comment',
                          post,
                          commentId,
                        }),
                      onReport: feedActions.report.open,
                      onOpenImage: feedActions.lightbox.open,
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
                        confirmation.open({ kind: 'promote-member', member }),
                      onRequestDemote: member =>
                        confirmation.open({ kind: 'demote-admin', member }),
                      onRequestTransferLeadership: member =>
                        confirmation.open({
                          kind: 'transfer-leadership',
                          member,
                        }),
                      onRequestKick: member =>
                        confirmation.open({ kind: 'kick-member', member }),
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
                      onStatusChange: feedActions.report.changeStatus,
                    }}
                  />
                ) : null}
                {visibleActiveTab === 'settings' && isModerator ? renderSettingsTab() : null}
                {visibleActiveTab === 'memberSettings' && !isModerator ? (
                  <CommunityParticipationSection
                    community={community}
                    isAuthenticated={Boolean(user)}
                    onJoin={membershipActions.join}
                    onRequestLeave={() =>
                      confirmation.open({ kind: 'leave-community' })
                    }
                  />
                ) : null}
              </section>
            </>
          )}

          {confirmation.copy && confirmation.state ? (
            <CommunityConfirmModal
              title={confirmation.copy.title}
              description={confirmation.copy.description}
              confirmLabel={confirmation.copy.confirmLabel}
              cancelLabel={t('common.cancel')}
              submittingLabel={t('common.updating')}
              tone={confirmation.copy.tone}
              isSubmitting={confirmation.submitting}
              onClose={confirmation.close}
              onConfirm={() =>
                void confirmation.execute(
                  membershipActions.executeConfirmation,
                )
              }
            />
          ) : null}

          {feedActions.report.target ? (
            <CommunityReportModal
              targetType={feedActions.report.target.type}
              targetLabel={feedActions.report.target.label}
              isSubmitting={feedActions.report.submitting}
              onClose={feedActions.report.close}
              onSubmit={feedActions.report.submit}
            />
          ) : null}

          {feedActions.lightbox.state ? (
            <DialogShell
              open
              onClose={feedActions.lightbox.close}
              titleId="community-lightbox-title"
              className="community-lightbox-content"
            >
                <span id="community-lightbox-title" className="sr-only">
                  {feedActions.lightbox.state.alt}
                </span>
                <button
                  type="button"
                  className="community-lightbox-close"
                  onClick={feedActions.lightbox.close}
                  aria-label={t('common.close')}
                >
                  X
                </button>
                <img
                  src={feedActions.lightbox.state.url}
                  alt={feedActions.lightbox.state.alt}
                />
            </DialogShell>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default CommunityDetailsPage
