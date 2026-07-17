import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import { useI18n } from '../../i18n/I18nContext'
import {
  followUser,
  getProfileFollowListPage,
  unfollowUser,
  type FollowListKind,
  type FollowListUser,
  type UserServiceError,
} from '../../services/userService'
import { getPublicProfilePath } from '../../utils/profileRoutes'
import './ProfileConnectionsModal.css'

interface ProfileConnectionsModalProps {
  initialTab: FollowListKind
  profileId: string
  profileUsername: string
  profileDisplayName: string
  viewerId?: string | null
  isOwnerView: boolean
  followersCount: number
  followingCount: number
  followersRefreshKey: number
  onClose: () => void
  onRefreshFollowState: () => Promise<void> | void
}

interface FollowTabState {
  items: FollowListUser[]
  errorMessage: string | null
  isLoading: boolean
  isLoadingMore: boolean
  hasLoaded: boolean
  hasMore: boolean
  nextOffset: number
}

const PROFILE_CONNECTIONS_PAGE_SIZE = 20

const CONNECTION_TABS: Array<{
  kind: FollowListKind
}> = [
  { kind: 'followers' },
  { kind: 'following' },
]

function createEmptyTabState(): Record<FollowListKind, FollowTabState> {
  return {
    followers: {
      items: [],
      errorMessage: null,
      isLoading: false,
      isLoadingMore: false,
      hasLoaded: false,
      hasMore: false,
      nextOffset: 0,
    },
    following: {
      items: [],
      errorMessage: null,
      isLoading: false,
      isLoadingMore: false,
      hasLoaded: false,
      hasMore: false,
      nextOffset: 0,
    },
  }
}

function mergeFollowListUsers(
  currentItems: FollowListUser[],
  incomingItems: FollowListUser[]
) {
  return Array.from(
    new Map([...currentItems, ...incomingItems].map(user => [user.id, user])).values()
  )
}

function getFollowListErrorMessage(
  error: UserServiceError | null,
  kind: FollowListKind,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!error) {
    return kind === 'followers'
      ? t('connections.errorFollowers')
      : t('connections.errorFollowing')
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return t('connections.permissionError')
  }

  return error.message || (kind === 'followers'
    ? t('connections.errorFollowers')
    : t('connections.errorFollowing'))
}

function getFollowActionErrorMessage(
  error: UserServiceError | null,
  action: 'follow' | 'unfollow',
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (!error) {
    return action === 'follow'
      ? t('connections.followError')
      : t('connections.unfollowError')
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'follow'
      ? t('connections.followPermissionError')
      : t('connections.unfollowPermissionError')
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return t('connections.alreadyFollowing')
  }

  return error.message || t('connections.actionError')
}

function getEmptyStateTitle(
  kind: FollowListKind,
  isOwnerView: boolean,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (kind === 'followers') {
    return t('connections.emptyFollowers')
  }

  return isOwnerView ? t('connections.emptyFollowingOwner') : t('connections.emptyFollowingPublic')
}

function getEmptyStateDescription(
  kind: FollowListKind,
  isOwnerView: boolean,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (kind === 'followers') {
    return isOwnerView
      ? t('connections.emptyFollowersOwnerText')
      : t('connections.emptyFollowersPublicText')
  }

  return isOwnerView
    ? t('connections.emptyFollowingOwnerText')
    : t('connections.emptyFollowingPublicText')
}

export function ProfileConnectionsModal({
  initialTab,
  profileId,
  profileUsername,
  profileDisplayName,
  viewerId,
  isOwnerView,
  followersCount,
  followingCount,
  followersRefreshKey,
  onClose,
  onRefreshFollowState,
}: ProfileConnectionsModalProps) {
  const { t, formatNumber } = useI18n()
  const [activeTab, setActiveTab] = useState<FollowListKind>(initialTab)
  const [tabState, setTabState] = useState<Record<FollowListKind, FollowTabState>>(
    createEmptyTabState
  )
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const requestIdsRef = useRef<Record<FollowListKind, number>>({
    followers: 0,
    following: 0,
  })
  const tabStateRef = useRef<Record<FollowListKind, FollowTabState>>(createEmptyTabState())
  const staleTabsRef = useRef<Record<FollowListKind, boolean>>({
    followers: false,
    following: false,
  })
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const previousFollowersRefreshKeyRef = useRef(followersRefreshKey)
  const tabButtonRefs = useRef<Record<FollowListKind, HTMLButtonElement | null>>({
    followers: null,
    following: null,
  })

  const titleId = useId()
  const descriptionId = useId()

  const tabCounts = {
    followers: followersCount,
    following: followingCount,
  } satisfies Record<FollowListKind, number>

  const updateTabState = useCallback(
    (
      updater: (
        currentState: Record<FollowListKind, FollowTabState>
      ) => Record<FollowListKind, FollowTabState>
    ) => {
      setTabState(currentState => {
        const nextState = updater(currentState)
        tabStateRef.current = nextState
        return nextState
      })
    },
    []
  )

  const loadTab = useCallback(
    async (kind: FollowListKind, options?: { append?: boolean; force?: boolean }) => {
      const totalItems = kind === 'followers' ? followersCount : followingCount
      const shouldAppend = Boolean(options?.append)

      if (totalItems <= 0) {
        requestIdsRef.current[kind] += 1
        staleTabsRef.current[kind] = false
        updateTabState(currentState => ({
          ...currentState,
          [kind]: {
            items: [],
            errorMessage: null,
            isLoading: false,
            isLoadingMore: false,
            hasLoaded: true,
            hasMore: false,
            nextOffset: 0,
          },
        }))
        return
      }

      const currentTabState = tabStateRef.current[kind]

      if (
        (!options?.force && (currentTabState.isLoading || currentTabState.isLoadingMore)) ||
        (!options?.force && !shouldAppend && currentTabState.hasLoaded) ||
        (shouldAppend && !currentTabState.hasMore)
      ) return

      const offset = shouldAppend ? currentTabState.nextOffset : 0

      updateTabState(currentState => ({
        ...currentState,
        [kind]: {
          ...currentState[kind],
          isLoading: !shouldAppend,
          isLoadingMore: shouldAppend,
          errorMessage: null,
        },
      }))

      const requestId = requestIdsRef.current[kind] + 1
      requestIdsRef.current[kind] = requestId

      const result = await getProfileFollowListPage(profileId, kind, viewerId, {
        limit: PROFILE_CONNECTIONS_PAGE_SIZE,
        offset,
      })

      if (requestIdsRef.current[kind] !== requestId) return

      staleTabsRef.current[kind] = false
      updateTabState(currentState => ({
        ...currentState,
        [kind]: {
          items: result.error
            ? shouldAppend
              ? currentState[kind].items
              : []
            : shouldAppend
              ? mergeFollowListUsers(currentState[kind].items, result.data.items)
              : result.data.items,
          errorMessage: result.error ? getFollowListErrorMessage(result.error, kind, t) : null,
          isLoading: false,
          isLoadingMore: false,
          hasLoaded: true,
          hasMore: result.error ? currentState[kind].hasMore : result.data.hasMore,
          nextOffset: result.error ? currentState[kind].nextOffset : result.data.nextOffset,
        },
      }))
    },
    [followersCount, followingCount, profileId, t, updateTabState, viewerId]
  )

  const updateUserFollowFlag = useCallback((userId: string, isFollowing: boolean) => {
    updateTabState(currentState => ({
      followers: {
        ...currentState.followers,
        items: currentState.followers.items.map(user =>
          user.id === userId ? { ...user, isFollowing } : user
        ),
      },
      following: {
        ...currentState.following,
        items: currentState.following.items.map(user =>
          user.id === userId ? { ...user, isFollowing } : user
        ),
      },
    }))
  }, [updateTabState])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const shouldForce = staleTabsRef.current[activeTab]
      void loadTab(activeTab, shouldForce ? { force: true } : undefined)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeTab, loadTab])

  useEffect(() => {
    if (previousFollowersRefreshKeyRef.current === followersRefreshKey) return

    previousFollowersRefreshKeyRef.current = followersRefreshKey
    staleTabsRef.current.followers = true

    if (activeTab === 'followers') {
      const frameId = window.requestAnimationFrame(() => {
        void loadTab('followers', { force: true })
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [activeTab, followersRefreshKey, loadTab])

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const previousOverflow = document.body.style.overflow
    const frameId = window.requestAnimationFrame(() => {
      tabButtonRefs.current[initialTab]?.focus()
    })

    document.body.style.overflow = 'hidden'

    return () => {
      window.cancelAnimationFrame(frameId)
      document.body.style.overflow = previousOverflow

      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus()
      }
    }
  }, [initialTab])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleToggleFollow = useCallback(
    async (listedUser: FollowListUser) => {
      if (!viewerId || listedUser.id === viewerId || pendingUserIds.includes(listedUser.id)) return

      const wasFollowing = listedUser.isFollowing

      setActionError(null)
      setPendingUserIds(currentIds =>
        currentIds.includes(listedUser.id) ? currentIds : [...currentIds, listedUser.id]
      )

      const result = wasFollowing
        ? await unfollowUser(viewerId, listedUser.id)
        : await followUser(viewerId, listedUser.id)

      setPendingUserIds(currentIds => currentIds.filter(currentId => currentId !== listedUser.id))

      if (result.error) {
        setActionError(getFollowActionErrorMessage(result.error, wasFollowing ? 'unfollow' : 'follow', t))
        return
      }

      updateUserFollowFlag(listedUser.id, result.data.isFollowing)

      if (profileId === viewerId) {
        staleTabsRef.current.following = true
        void Promise.resolve(onRefreshFollowState())

        if (activeTab === 'following') {
          void loadTab('following', { force: true })
        }
      }
    },
    [
      activeTab,
      loadTab,
      onRefreshFollowState,
      pendingUserIds,
      profileId,
      t,
      updateUserFollowFlag,
      viewerId,
    ]
  )

  const currentTabState = tabState[activeTab]
  const shouldShowBlockingError =
    !currentTabState.isLoading &&
    Boolean(currentTabState.errorMessage) &&
    currentTabState.items.length === 0
  const shouldShowEmptyState =
    !currentTabState.isLoading &&
    !currentTabState.errorMessage &&
    currentTabState.hasLoaded &&
    currentTabState.items.length === 0

  return (
    <div
      className="profile-connections-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="profile-connections-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={event => event.stopPropagation()}
      >
        <div className="profile-connections-modal-glow profile-connections-modal-glow-left"></div>
        <div className="profile-connections-modal-glow profile-connections-modal-glow-right"></div>

        <div className="profile-connections-modal-content">
          <header className="profile-connections-modal-header">
            <div className="profile-connections-modal-copy">
              <span className="profile-section-label">{t('connections.label')}</span>
              <h2 id={titleId}>{t('connections.title', { username: profileUsername })}</h2>
              <p id={descriptionId}>
                {t('connections.description', { name: profileDisplayName })}
              </p>
            </div>

            <button
              type="button"
              className="profile-connections-close-button"
              onClick={onClose}
              aria-label={t('connections.close')}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </header>

          <div
            className="profile-connections-tabs"
            role="tablist"
            aria-label={t('connections.tabsAria')}
          >
            {CONNECTION_TABS.map(tab => (
              <button
                key={tab.kind}
                id={`profile-connections-tab-${tab.kind}`}
                ref={node => {
                  tabButtonRefs.current[tab.kind] = node
                }}
                type="button"
                role="tab"
                className={`profile-connections-tab-button${activeTab === tab.kind ? ' is-active' : ''}`}
                aria-selected={activeTab === tab.kind}
                aria-controls={`profile-connections-panel-${tab.kind}`}
                onClick={() => {
                  setActionError(null)
                  setActiveTab(tab.kind)
                }}
              >
                <span>{tab.kind === 'followers' ? t('common.followers') : t('common.following')}</span>
                <strong>{formatNumber(tabCounts[tab.kind])}</strong>
              </button>
            ))}
          </div>

          <section
            id={`profile-connections-panel-${activeTab}`}
            className="profile-connections-panel"
            role="tabpanel"
            aria-labelledby={`profile-connections-tab-${activeTab}`}
          >
            {currentTabState.isLoading ? (
              <div className="profile-connections-state-card">
                <h3>
                  {activeTab === 'followers'
                    ? t('connections.loadingFollowers')
                    : t('connections.loadingFollowing')}
                </h3>
                <p>
                  {activeTab === 'followers'
                    ? t('connections.loadingFollowersText')
                    : t('connections.loadingFollowingText')}
                </p>
              </div>
            ) : shouldShowBlockingError ? (
              <div className="profile-connections-state-card">
                <h3>{t('connections.errorTitle')}</h3>
                <p>{currentTabState.errorMessage}</p>
                <button
                  type="button"
                  className="profile-secondary-button profile-connections-retry-button"
                  onClick={() => void loadTab(activeTab, { force: true })}
                >
                  {t('common.tryAgain')}
                </button>
              </div>
            ) : shouldShowEmptyState ? (
              <div className="profile-connections-state-card">
                <h3>{getEmptyStateTitle(activeTab, isOwnerView, t)}</h3>
                <p>{getEmptyStateDescription(activeTab, isOwnerView, t)}</p>
              </div>
            ) : (
              <div className="profile-connections-list-shell">
                {currentTabState.errorMessage ? (
                  <p className="profile-feedback is-error">{currentTabState.errorMessage}</p>
                ) : null}

                {actionError ? (
                  <p className="profile-feedback is-error">{actionError}</p>
                ) : null}

                <div className="profile-connections-list">
                  {currentTabState.items.map(listedUser => {
                    const isOwnUser = Boolean(viewerId && listedUser.id === viewerId)
                    const isFollowPending = pendingUserIds.includes(listedUser.id)
                    const followButtonLabel = isFollowPending
                      ? listedUser.isFollowing
                        ? t('connections.updating')
                        : t('connections.followingPending')
                      : listedUser.isFollowing
                        ? t('common.unfollow')
                        : t('common.follow')
                    const visibleFullName = listedUser.nome_completo?.trim() || ''
                    const visibleName = visibleFullName || listedUser.username

                    return (
                      <article key={listedUser.id} className="profile-connections-user-card">
                        <Link
                          to={getPublicProfilePath(listedUser.username)}
                          className="profile-connections-user-link"
                          onClick={onClose}
                        >
                          <UserAvatar
                            name={visibleName}
                            avatarPath={listedUser.avatar_path}
                            imageClassName="profile-connections-user-avatar"
                            fallbackClassName="profile-connections-user-avatar profile-connections-user-avatar-fallback"
                            alt={t('connections.profilePhotoAlt', { name: visibleName })}
                          />

                          <div className="profile-connections-user-copy">
                            <strong>@{listedUser.username}</strong>
                            {visibleFullName ? <span>{visibleFullName}</span> : null}
                          </div>
                        </Link>

                        <div className="profile-connections-user-actions">
                          {isOwnUser ? (
                            <span className="profile-connections-user-chip">{t('connections.selfProfile')}</span>
                          ) : viewerId ? (
                            <button
                              type="button"
                              className={`profile-save-button profile-connections-follow-button${listedUser.isFollowing ? ' is-following' : ''}`}
                              onClick={() => void handleToggleFollow(listedUser)}
                              disabled={isFollowPending}
                            >
                              {followButtonLabel}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {currentTabState.hasMore ? (
                  <button
                    type="button"
                    className="profile-secondary-button profile-connections-load-more-button"
                    onClick={() => void loadTab(activeTab, { append: true })}
                    disabled={currentTabState.isLoadingMore}
                  >
                    {currentTabState.isLoadingMore
                      ? t('connections.loadingMore')
                      : t('connections.loadMore')}
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
