import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { ProfileGameStatusSection } from '../components/profile/ProfileGameStatusSection'
import { ProfileReviewsSection } from '../components/profile/ProfileReviewsSection'
import { ProfileTopFiveSection } from '../components/profile/ProfileTopFiveSection'
import { ProfileWishlistSection } from '../components/profile/ProfileWishlistSection'
import { useAuth } from '../contexts/AuthContext'
import {
  getGameStatusesByUserId,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusValue,
} from '../services/gameStatusService'
import {
  getReviewsByUserId,
  type ProfileReviewItem,
  type ReviewError,
} from '../services/reviewService'
import {
  getPublicProfileByUsername,
  getFollowState,
  followUser,
  unfollowUser,
  type PublicUserProfile,
  type UserServiceError,
  type UserFollowState,
} from '../services/userService'
import {
  getWishlistGamesByUserId,
  type WishlistError,
  type WishlistGameItem,
} from '../services/wishlistService'
import type { TopFiveStoredEntry } from '../utils/profileTopFive'
import './ProfilePage.css'
import './PublicProfilePage.css'

type ProfileTab = 'status' | 'wishlist' | 'reviews'
type FollowFeedbackTone = 'error' | 'info'

interface FollowFeedbackState {
  tone: FollowFeedbackTone
  message: string
}

function formatProfileDate(value: string | null | undefined, fallback = 'Data nao informada') {
  if (!value) return fallback

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return fallback

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getProfileErrorMessage(error: UserServiceError | null) {
  if (!error) {
    return 'Nao foi possivel carregar este perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel carregar este perfil por permissao. Verifique as policies de SELECT da tabela usuarios no Supabase.'
  }

  return 'Nao foi possivel carregar este perfil agora.'
}

function getFollowErrorMessage(error: UserServiceError | null, action: 'load' | 'follow' | 'unfollow') {
  if (!error) {
    return action === 'load'
      ? 'Nao foi possivel carregar as relacoes deste perfil agora.'
      : action === 'follow'
        ? 'Nao foi possivel seguir este perfil agora.'
        : 'Nao foi possivel deixar de seguir este perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'load'
      ? 'Nao foi possivel carregar seguidores por permissao. Verifique as policies da tabela seguidores no Supabase.'
      : action === 'follow'
        ? 'Nao foi possivel seguir este perfil por permissao. Verifique as policies INSERT da tabela seguidores no Supabase.'
        : 'Nao foi possivel deixar de seguir este perfil por permissao. Verifique as policies DELETE da tabela seguidores no Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'Voce ja segue este perfil.'
  }

  return error.message
}

function getWishlistErrorMessage(error: WishlistError | null) {
  if (!error) {
    return 'Nao foi possivel carregar a wishlist deste perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel carregar a wishlist deste perfil por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
  }

  return 'Nao foi possivel carregar a wishlist deste perfil agora.'
}

function getGameStatusErrorMessage(error: GameStatusError | null) {
  if (!error) {
    return 'Nao foi possivel carregar os status deste perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel carregar os status deste perfil por permissao. Verifique as policies da tabela status_jogo no Supabase.'
  }

  return 'Nao foi possivel carregar os status deste perfil agora.'
}

function getReviewErrorMessage(error: ReviewError | null) {
  if (!error) {
    return 'Nao foi possivel carregar as reviews deste perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel carregar as reviews deste perfil por permissao. Verifique as policies das tabelas avaliacoes e jogos no Supabase.'
  }

  return 'Nao foi possivel carregar as reviews deste perfil agora.'
}

const readOnlySaveStatus = async (_params: {
  gameId: number
  status: GameStatusValue
  favorito: boolean
}) => {
  void _params
  return {
    ok: false,
    message: 'Apenas o dono do perfil pode alterar estes dados.',
  }
}

const readOnlyDeleteStatus = async (_itemId: string) => {
  void _itemId
  return {
    ok: false,
    message: 'Apenas o dono do perfil pode alterar estes dados.',
  }
}

const readOnlyDeleteWishlist = async (_itemId: string) => {
  void _itemId
  return {
    ok: false,
    message: 'Apenas o dono do perfil pode alterar estes dados.',
  }
}

const readOnlySaveTopFive = async (_entries: TopFiveStoredEntry[]) => {
  void _entries
  return {
    ok: false,
    message: 'Apenas o dono do perfil pode alterar estes dados.',
  }
}

export function PublicProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ProfileTab>('status')
  const [followState, setFollowState] = useState<UserFollowState>({
    isFollowing: false,
    followersCount: 0,
    followingCount: 0,
  })
  const [followLoading, setFollowLoading] = useState(false)
  const [followSubmitting, setFollowSubmitting] = useState(false)
  const [followFeedback, setFollowFeedback] = useState<FollowFeedbackState | null>(null)
  const [statusGames, setStatusGames] = useState<GameStatusItem[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [wishlistGames, setWishlistGames] = useState<WishlistGameItem[]>([])
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistError, setWishlistError] = useState<string | null>(null)
  const [userReviews, setUserReviews] = useState<ProfileReviewItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const trimmedUsername = username?.trim() || ''

      if (!trimmedUsername) {
        if (isMounted) {
          setProfile(null)
          setProfileError('Este perfil nao e valido.')
          setProfileLoading(false)
        }
        return
      }

      setProfileLoading(true)
      setProfileError(null)
      setFollowFeedback(null)
      setActiveTab('status')

      const result = await getPublicProfileByUsername(trimmedUsername)

      if (!isMounted) return

      if (result.error) {
        setProfile(null)
        setProfileError(getProfileErrorMessage(result.error))
      } else {
        setProfile(result.data)
        setProfileError(null)
        setFollowState({
          isFollowing: false,
          followersCount: result.data?.followersCount || 0,
          followingCount: result.data?.followingCount || 0,
        })
      }

      setProfileLoading(false)
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [username])

  useEffect(() => {
    let isMounted = true

    const loadFollowState = async () => {
      if (!profile) {
        if (isMounted) {
          setFollowLoading(false)
          setFollowState({
            isFollowing: false,
            followersCount: 0,
            followingCount: 0,
          })
        }
        return
      }

      setFollowLoading(true)

      const result = await getFollowState(user?.id, profile.id)

      if (!isMounted) return

      if (result.error) {
        setFollowFeedback({
          tone: 'error',
          message: getFollowErrorMessage(result.error, 'load'),
        })
      } else {
        setFollowState(result.data)
      }

      setFollowLoading(false)
    }

    void loadFollowState()

    return () => {
      isMounted = false
    }
  }, [profile, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadProfileCollections = async () => {
      if (!profile) {
        if (isMounted) {
          setStatusGames([])
          setStatusError(null)
          setStatusLoading(false)
          setWishlistGames([])
          setWishlistError(null)
          setWishlistLoading(false)
          setUserReviews([])
          setReviewsError(null)
          setReviewsLoading(false)
        }
        return
      }

      setStatusLoading(true)
      setStatusError(null)
      setWishlistLoading(true)
      setWishlistError(null)
      setReviewsLoading(true)
      setReviewsError(null)

      const [statusResult, wishlistResult, reviewsResult] = await Promise.all([
        getGameStatusesByUserId(profile.id),
        getWishlistGamesByUserId(profile.id),
        getReviewsByUserId(profile.id),
      ])

      if (!isMounted) return

      if (statusResult.error) {
        setStatusGames([])
        setStatusError(getGameStatusErrorMessage(statusResult.error))
      } else {
        setStatusGames(statusResult.data)
      }

      if (wishlistResult.error) {
        setWishlistGames([])
        setWishlistError(getWishlistErrorMessage(wishlistResult.error))
      } else {
        setWishlistGames(wishlistResult.data)
      }

      if (reviewsResult.error) {
        setUserReviews(reviewsResult.data)
        setReviewsError(getReviewErrorMessage(reviewsResult.error))
      } else {
        setUserReviews(reviewsResult.data)
      }

      setStatusLoading(false)
      setWishlistLoading(false)
      setReviewsLoading(false)
    }

    void loadProfileCollections()

    return () => {
      isMounted = false
    }
  }, [profile])

  const handleToggleFollow = async () => {
    if (!user || !profile || followSubmitting || user.id === profile.id) return

    setFollowSubmitting(true)
    setFollowFeedback(null)

    const result = followState.isFollowing
      ? await unfollowUser(user.id, profile.id)
      : await followUser(user.id, profile.id)

    if (result.error) {
      setFollowFeedback({
        tone: 'error',
        message: getFollowErrorMessage(result.error, followState.isFollowing ? 'unfollow' : 'follow'),
      })
      setFollowSubmitting(false)
      return
    }

    setFollowState(result.data)
    setFollowSubmitting(false)
  }

  if (profileLoading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Carregando perfil</h1>
            <p>Estamos reunindo as informacoes publicas deste usuario.</p>
          </div>
        </div>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>{profileError}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil nao encontrado</h1>
            <p>Esse usuario nao existe ou ainda nao disponibilizou um perfil publico.</p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnPublicProfile = Boolean(user && user.id === profile.id)
  const joinedDate = formatProfileDate(profile.data_cadastro)
  const visibleBio = profile.bio?.trim() || ''
  const statusCountLabel =
    statusGames.length === 1 ? '1 jogo com status' : `${statusGames.length} jogos com status`
  const wishlistCountLabel =
    wishlistGames.length === 1 ? '1 jogo salvo' : `${wishlistGames.length} jogos salvos`
  const reviewsCountLabel =
    userReviews.length === 1 ? '1 review publicada' : `${userReviews.length} reviews publicadas`
  const followButtonLabel = followSubmitting
    ? followState.isFollowing
      ? 'Atualizando...'
      : 'Seguindo...'
    : followState.isFollowing
      ? 'Deixar de seguir'
      : 'Seguir'

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="profile-page">
          <section className="profile-card public-profile-card">
            <div className="profile-card-glow profile-card-glow-left"></div>
            <div className="profile-card-glow profile-card-glow-right"></div>

            <div className="profile-card-main">
              <div className="profile-avatar-column">
                <div className="profile-avatar-shell">
                  <UserAvatar
                    name={profile.nome_completo || profile.username}
                    avatarPath={profile.avatar_path}
                    imageClassName="avatar-img profile-avatar-large"
                    fallbackClassName="avatar-placeholder-large profile-avatar-large"
                    alt={`Foto de perfil de ${profile.nome_completo || profile.username}`}
                  />
                </div>
              </div>

              <div className="profile-info-column">
                <div className="profile-info-header public-profile-info-header">
                  <div className="profile-heading">
                    <span className="profile-eyebrow">Perfil publico</span>
                    <h1>@{profile.username}</h1>
                    <p className="profile-handle">{profile.nome_completo}</p>
                  </div>

                  <div className="public-profile-actions">
                    {!user ? (
                      <Link to="/login" className="profile-secondary-button public-profile-follow-link">
                        Fazer login para seguir
                      </Link>
                    ) : !isOwnPublicProfile ? (
                      <>
                        {followState.isFollowing ? (
                          <span className="public-profile-follow-status">Seguindo</span>
                        ) : null}
                        <button
                          type="button"
                          className={`profile-save-button public-profile-follow-button${followState.isFollowing ? ' is-following' : ''}`}
                          onClick={() => void handleToggleFollow()}
                          disabled={followSubmitting}
                        >
                          {followButtonLabel}
                        </button>
                      </>
                    ) : (
                      <Link to="/profile" className="profile-secondary-button public-profile-follow-link">
                        Ir para seu perfil editavel
                      </Link>
                    )}
                  </div>
                </div>

                <div className="profile-meta public-profile-meta">
                  <div className="profile-meta-item">
                    <span>Membro desde</span>
                    <strong>{joinedDate}</strong>
                  </div>

                  <div className="profile-meta-item">
                    <span>Seguidores</span>
                    <strong>{followLoading ? '...' : followState.followersCount}</strong>
                  </div>

                  <div className="profile-meta-item">
                    <span>Seguindo</span>
                    <strong>{followLoading ? '...' : followState.followingCount}</strong>
                  </div>
                </div>

                <div className="profile-bio-block">
                  <span className="profile-section-label">Bio</span>
                  <p className={`profile-bio-copy${visibleBio ? '' : ' is-empty'}`}>
                    {visibleBio || 'Sem bio informada.'}
                  </p>
                </div>

                {followFeedback ? (
                  <p className={`profile-feedback is-${followFeedback.tone}`}>{followFeedback.message}</p>
                ) : null}
              </div>
            </div>

            <ProfileTopFiveSection
              isOwnerView={false}
              entries={profile.topFiveEntries}
              onSaveTopFive={readOnlySaveTopFive}
            />
          </section>

          <section className="profile-tabs-shell" aria-label="Conteudo do perfil">
            <div className="profile-tabs" role="tablist" aria-label="Navegacao interna do perfil">
              <button
                id="profile-tab-status-public"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'status' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'status'}
                aria-controls="profile-panel-status-public"
                onClick={() => setActiveTab('status')}
              >
                <span>Status dos jogos</span>
                <small>{statusCountLabel}</small>
              </button>

              <button
                id="profile-tab-wishlist-public"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'wishlist' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'wishlist'}
                aria-controls="profile-panel-wishlist-public"
                onClick={() => setActiveTab('wishlist')}
              >
                <span>Wishlist</span>
                <small>{wishlistCountLabel}</small>
              </button>

              <button
                id="profile-tab-reviews-public"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'reviews' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'reviews'}
                aria-controls="profile-panel-reviews-public"
                onClick={() => setActiveTab('reviews')}
              >
                <span>Reviews</span>
                <small>{reviewsCountLabel}</small>
              </button>
            </div>

            <div
              id="profile-panel-status-public"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-status-public"
              hidden={activeTab !== 'status'}
            >
              {activeTab === 'status' ? (
                <ProfileGameStatusSection
                  userId={profile.id}
                  items={statusGames}
                  isLoading={statusLoading}
                  errorMessage={statusError}
                  countLabel={statusCountLabel}
                  isOwnerView={false}
                  onSaveStatus={readOnlySaveStatus}
                  onDeleteStatus={readOnlyDeleteStatus}
                  onRefresh={async () => undefined}
                />
              ) : null}
            </div>

            <div
              id="profile-panel-wishlist-public"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-wishlist-public"
              hidden={activeTab !== 'wishlist'}
            >
              {activeTab === 'wishlist' ? (
                <ProfileWishlistSection
                  userId={profile.id}
                  items={wishlistGames}
                  isLoading={wishlistLoading}
                  errorMessage={wishlistError}
                  countLabel={wishlistCountLabel}
                  isOwnerView={false}
                  onDeleteWishlistItem={readOnlyDeleteWishlist}
                />
              ) : null}
            </div>

            <div
              id="profile-panel-reviews-public"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-reviews-public"
              hidden={activeTab !== 'reviews'}
            >
              {activeTab === 'reviews' ? (
                <ProfileReviewsSection
                  items={userReviews}
                  isLoading={reviewsLoading}
                  errorMessage={reviewsError}
                  countLabel={reviewsCountLabel}
                  isOwnerView={false}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
