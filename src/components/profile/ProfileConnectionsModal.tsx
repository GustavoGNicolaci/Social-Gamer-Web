import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../UserAvatar'
import {
  followUser,
  getProfileFollowList,
  unfollowUser,
  type FollowListKind,
  type FollowListUser,
  type UserServiceError,
} from '../../services/userService'
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
  hasLoaded: boolean
}

const CONNECTION_TABS: Array<{
  kind: FollowListKind
  label: string
}> = [
  {
    kind: 'followers',
    label: 'Seguidores',
  },
  {
    kind: 'following',
    label: 'Seguindo',
  },
]

function createEmptyTabState(): Record<FollowListKind, FollowTabState> {
  return {
    followers: {
      items: [],
      errorMessage: null,
      isLoading: false,
      hasLoaded: false,
    },
    following: {
      items: [],
      errorMessage: null,
      isLoading: false,
      hasLoaded: false,
    },
  }
}

function getPublicProfilePath(username: string) {
  return `/u/${encodeURIComponent(username.trim())}`
}

function getFollowListErrorMessage(error: UserServiceError | null, kind: FollowListKind) {
  if (!error) {
    return kind === 'followers'
      ? 'Nao foi possivel carregar os seguidores deste perfil agora.'
      : 'Nao foi possivel carregar os perfis seguidos por este usuario agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel carregar esta lista por permissao. Verifique as policies SELECT das tabelas usuarios e seguidores no Supabase.'
  }

  return error.message || (kind === 'followers'
    ? 'Nao foi possivel carregar os seguidores deste perfil agora.'
    : 'Nao foi possivel carregar os perfis seguidos por este usuario agora.')
}

function getFollowActionErrorMessage(error: UserServiceError | null, action: 'follow' | 'unfollow') {
  if (!error) {
    return action === 'follow'
      ? 'Nao foi possivel seguir este usuario agora.'
      : 'Nao foi possivel deixar de seguir este usuario agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'follow'
      ? 'Nao foi possivel seguir este usuario por permissao. Verifique as policies INSERT da tabela seguidores.'
      : 'Nao foi possivel deixar de seguir este usuario por permissao. Verifique as policies DELETE da tabela seguidores.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'Voce ja segue este usuario.'
  }

  return error.message || 'Nao foi possivel concluir esta acao agora.'
}

function getEmptyStateTitle(kind: FollowListKind, isOwnerView: boolean) {
  if (kind === 'followers') {
    return 'Nenhum seguidor ainda'
  }

  return isOwnerView ? 'Voce ainda nao segue ninguem' : 'Esse usuario ainda nao esta seguindo ninguem'
}

function getEmptyStateDescription(kind: FollowListKind, isOwnerView: boolean) {
  if (kind === 'followers') {
    return isOwnerView
      ? 'Quando alguem comecar a seguir voce, a lista aparecera aqui.'
      : 'Quando alguem comecar a seguir este usuario, a lista aparecera aqui.'
  }

  return isOwnerView
    ? 'Quando voce seguir outros perfis, eles aparecerao aqui.'
    : 'Quando este usuario seguir outros perfis, eles aparecerao aqui.'
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
    async (kind: FollowListKind, options?: { force?: boolean }) => {
      const totalItems = kind === 'followers' ? followersCount : followingCount

      if (totalItems <= 0) {
        requestIdsRef.current[kind] += 1
        staleTabsRef.current[kind] = false
        updateTabState(currentState => ({
          ...currentState,
          [kind]: {
            items: [],
            errorMessage: null,
            isLoading: false,
            hasLoaded: true,
          },
        }))
        return
      }

      const currentTabState = tabStateRef.current[kind]

      if (currentTabState.isLoading || (!options?.force && currentTabState.hasLoaded)) return

      updateTabState(currentState => ({
        ...currentState,
        [kind]: {
          ...currentState[kind],
          isLoading: true,
          errorMessage: null,
        },
      }))

      const requestId = requestIdsRef.current[kind] + 1
      requestIdsRef.current[kind] = requestId

      const result = await getProfileFollowList(profileId, kind, viewerId)

      if (requestIdsRef.current[kind] !== requestId) return

      staleTabsRef.current[kind] = false
      updateTabState(currentState => ({
        ...currentState,
        [kind]: {
          items: result.data,
          errorMessage: result.error ? getFollowListErrorMessage(result.error, kind) : null,
          isLoading: false,
          hasLoaded: true,
        },
      }))
    },
    [followersCount, followingCount, profileId, updateTabState, viewerId]
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
        setActionError(getFollowActionErrorMessage(result.error, wasFollowing ? 'unfollow' : 'follow'))
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
              <span className="profile-section-label">Conexoes</span>
              <h2 id={titleId}>Seguidores e seguindo de @{profileUsername}</h2>
              <p id={descriptionId}>
                Explore as conexoes de {profileDisplayName} com troca rapida entre seguidores e perfis seguidos.
              </p>
            </div>

            <button
              type="button"
              className="profile-connections-close-button"
              onClick={onClose}
              aria-label="Fechar modal de seguidores e seguindo"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </header>

          <div
            className="profile-connections-tabs"
            role="tablist"
            aria-label="Alternar entre seguidores e perfis seguidos"
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
                <span>{tab.label}</span>
                <strong>{tabCounts[tab.kind].toLocaleString('pt-BR')}</strong>
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
                    ? 'Carregando seguidores'
                    : 'Carregando perfis seguidos'}
                </h3>
                <p>
                  {activeTab === 'followers'
                    ? 'Estamos buscando quem acompanha este perfil.'
                    : 'Estamos buscando os perfis que este usuario acompanha.'}
                </p>
              </div>
            ) : shouldShowBlockingError ? (
              <div className="profile-connections-state-card">
                <h3>Ocorreu um problema ao carregar esta lista</h3>
                <p>{currentTabState.errorMessage}</p>
                <button
                  type="button"
                  className="profile-secondary-button profile-connections-retry-button"
                  onClick={() => void loadTab(activeTab, { force: true })}
                >
                  Tentar novamente
                </button>
              </div>
            ) : shouldShowEmptyState ? (
              <div className="profile-connections-state-card">
                <h3>{getEmptyStateTitle(activeTab, isOwnerView)}</h3>
                <p>{getEmptyStateDescription(activeTab, isOwnerView)}</p>
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
                        ? 'Atualizando...'
                        : 'Seguindo...'
                      : listedUser.isFollowing
                        ? 'Deixar de seguir'
                        : 'Seguir'
                    const visibleName = listedUser.nome_completo || listedUser.username

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
                            alt={`Foto de perfil de ${visibleName}`}
                          />

                          <div className="profile-connections-user-copy">
                            <strong>{visibleName}</strong>
                            <span>@{listedUser.username}</span>
                          </div>
                        </Link>

                        <div className="profile-connections-user-actions">
                          {isOwnUser ? (
                            <span className="profile-connections-user-chip">Seu perfil</span>
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
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
