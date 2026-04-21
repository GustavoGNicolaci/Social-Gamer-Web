import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { ProfileGameStatusSection } from '../components/profile/ProfileGameStatusSection'
import { ProfileReviewsSection } from '../components/profile/ProfileReviewsSection'
import { ProfileTopFiveSection } from '../components/profile/ProfileTopFiveSection'
import { ProfileWishlistSection } from '../components/profile/ProfileWishlistSection'
import {
  useAuth,
  type ProfileUpdateError,
  type UserProfile,
} from '../contexts/AuthContext'
import {
  deleteGameStatus,
  getGameStatusesByUserId,
  saveGameStatus,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusValue,
} from '../services/gameStatusService'
import {
  deleteReview,
  getReviewsByUserId,
  type ProfileReviewItem,
  type ReviewError,
} from '../services/reviewService'
import { uploadAvatarImage } from '../services/storageService'
import {
  followUser,
  getFollowState,
  getPublicProfileByUsername,
  unfollowUser,
  type PublicUserProfile,
  type UserFollowState,
  type UserServiceError,
} from '../services/userService'
import {
  deleteWishlistEntry,
  getWishlistGamesByUserId,
  type WishlistError,
  type WishlistGameItem,
} from '../services/wishlistService'
import {
  getTopFiveEntriesFromPrivacySettings,
  mergeTopFiveEntriesIntoPrivacySettings,
  type TopFiveStoredEntry,
} from '../utils/profileTopFive'
import './ProfilePage.css'

type FeedbackTone = 'success' | 'error'
type FollowFeedbackTone = 'error' | 'info'
type ProfileTab = 'status' | 'wishlist' | 'reviews'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface FollowFeedbackState {
  tone: FollowFeedbackTone
  message: string
}

interface ProfileDraft {
  nome_completo: string
  username: string
  bio: string
}

type ResolvedProfile =
  | {
      kind: 'own'
      data: UserProfile
      topFiveEntries: TopFiveStoredEntry[]
    }
  | {
      kind: 'public'
      data: PublicUserProfile
      topFiveEntries: TopFiveStoredEntry[]
    }

const createProfileDraft = (profile: UserProfile | null): ProfileDraft => ({
  nome_completo: profile?.nome_completo || '',
  username: profile?.username || '',
  bio: profile?.bio || '',
})

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

function getProfileUpdateErrorMessage(error: ProfileUpdateError | null) {
  if (!error) {
    return 'Nao foi possivel salvar as alteracoes do perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '23505' ||
    fullMessage.includes('duplicate') ||
    fullMessage.includes('key (username)') ||
    fullMessage.includes('unique')
  ) {
    return 'Esse username ja esta em uso. Tente outro.'
  }

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return 'Nao foi possivel atualizar o perfil por permissao. Verifique as policies de UPDATE e SELECT da tabela usuarios no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return 'Nao foi possivel salvar o perfil porque a estrutura da tabela usuarios nao corresponde ao frontend.'
  }

  if (
    fullMessage.includes('nenhum registro') ||
    fullMessage.includes('no rows') ||
    fullMessage.includes('json object requested')
  ) {
    return 'Nao foi possivel confirmar a atualizacao do perfil. Verifique as policies de UPDATE e SELECT da tabela usuarios no Supabase.'
  }

  return 'Nao foi possivel salvar as alteracoes do perfil agora.'
}

function getPublicProfileErrorMessage(error: UserServiceError | null) {
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

  return error.message || 'Nao foi possivel continuar com esta acao agora.'
}

function getWishlistErrorMessage(
  error: WishlistError | null,
  action: 'load' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'delete') {
      return 'Nao foi possivel remover este jogo da sua lista agora.'
    }

    return isOwnerView
      ? 'Nao foi possivel carregar os jogos que voce quer jogar agora.'
      : 'Nao foi possivel carregar os jogos que este perfil quer jogar agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'delete'
      ? 'Nao foi possivel remover este jogo por permissao. Verifique as policies DELETE da tabela lista_desejos no Supabase.'
      : 'Nao foi possivel carregar esta lista por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
  }

  return action === 'delete'
    ? 'Nao foi possivel remover este jogo da sua lista agora.'
    : isOwnerView
      ? 'Nao foi possivel carregar os jogos que voce quer jogar agora.'
      : 'Nao foi possivel carregar os jogos que este perfil quer jogar agora.'
}

function getGameStatusErrorMessage(
  error: GameStatusError | null,
  action: 'load' | 'save' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'save') {
      return 'Nao foi possivel salvar o status deste jogo agora.'
    }

    if (action === 'delete') {
      return 'Nao foi possivel remover este jogo do perfil agora.'
    }

    return isOwnerView
      ? 'Nao foi possivel carregar os status do seu perfil agora.'
      : 'Nao foi possivel carregar os status deste perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'load'
      ? 'Nao foi possivel carregar os status por permissao. Verifique as policies da tabela status_jogo no Supabase.'
      : action === 'save'
        ? 'Nao foi possivel salvar o status por permissao. Verifique as policies da tabela status_jogo no Supabase.'
        : 'Nao foi possivel remover este jogo do perfil por permissao. Verifique as policies DELETE da tabela status_jogo no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return 'Nao foi possivel continuar porque a estrutura da tabela status_jogo nao corresponde ao frontend.'
  }

  if (action === 'save') {
    return 'Nao foi possivel salvar o status deste jogo agora.'
  }

  if (action === 'delete') {
    return 'Nao foi possivel remover este jogo do perfil agora.'
  }

  return isOwnerView
    ? 'Nao foi possivel carregar os status do seu perfil agora.'
    : 'Nao foi possivel carregar os status deste perfil agora.'
}

function getReviewErrorMessage(
  error: ReviewError | null,
  action: 'load' | 'delete',
  isOwnerView: boolean
) {
  if (!error) {
    if (action === 'delete') {
      return 'Nao foi possivel apagar esta review agora.'
    }

    return isOwnerView
      ? 'Nao foi possivel carregar suas reviews agora.'
      : 'Nao foi possivel carregar as reviews deste perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'delete'
      ? 'Nao foi possivel apagar sua review por permissao. Verifique as policies DELETE da tabela avaliacoes no Supabase.'
      : 'Nao foi possivel carregar as reviews por permissao. Verifique as policies das tabelas avaliacoes e jogos no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return action === 'delete'
      ? 'Nao foi possivel apagar a review porque a estrutura da tabela avaliacoes nao corresponde ao frontend.'
      : 'Nao foi possivel carregar as reviews porque a estrutura das tabelas nao corresponde ao frontend.'
  }

  return action === 'delete'
    ? error.message || 'Nao foi possivel apagar esta review agora.'
    : isOwnerView
      ? 'Nao foi possivel carregar suas reviews agora.'
      : 'Nao foi possivel carregar as reviews deste perfil agora.'
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

export function ProfilePage() {
  const { username } = useParams()
  const requestedUsername = username?.trim() || ''
  const isUsernameRoute = requestedUsername.length > 0

  const { user, profile, loading, updateOwnProfile } = useAuth()

  const [publicProfile, setPublicProfile] = useState<PublicUserProfile | null>(null)
  const [publicProfileLoading, setPublicProfileLoading] = useState(false)
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null)
  const [draftProfile, setDraftProfile] = useState<ProfileDraft>(() => createProfileDraft(null))
  const [activeTab, setActiveTab] = useState<ProfileTab>('status')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<FeedbackState | null>(null)
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

    const loadRequestedProfile = async () => {
      if (!isUsernameRoute) {
        if (isMounted) {
          setPublicProfile(null)
          setPublicProfileLoading(false)
          setPublicProfileError(null)
        }
        return
      }

      setPublicProfileLoading(true)
      setPublicProfileError(null)
      setFollowFeedback(null)

      const result = await getPublicProfileByUsername(requestedUsername)

      if (!isMounted) return

      if (result.error) {
        setPublicProfile(null)
        setPublicProfileError(getPublicProfileErrorMessage(result.error))
      } else {
        setPublicProfile(result.data)
        setPublicProfileError(null)
      }

      setPublicProfileLoading(false)
    }

    void loadRequestedProfile()

    return () => {
      isMounted = false
    }
  }, [isUsernameRoute, requestedUsername])

  const resolvedProfile = useMemo<ResolvedProfile | null>(() => {
    if (!isUsernameRoute) {
      if (!profile) return null

      return {
        kind: 'own',
        data: profile,
        topFiveEntries: getTopFiveEntriesFromPrivacySettings(profile.configuracoes_privacidade),
      }
    }

    if (!publicProfile) return null

    if (user && profile && user.id === publicProfile.id && profile.id === user.id) {
      return {
        kind: 'own',
        data: profile,
        topFiveEntries: getTopFiveEntriesFromPrivacySettings(profile.configuracoes_privacidade),
      }
    }

    return {
      kind: 'public',
      data: publicProfile,
      topFiveEntries: publicProfile.topFiveEntries,
    }
  }, [isUsernameRoute, profile, publicProfile, user])

  const activeProfile = resolvedProfile?.data || null
  const editableProfile = resolvedProfile?.kind === 'own' ? resolvedProfile.data : null
  const isOwnerView = resolvedProfile?.kind === 'own'
  const topFiveEntries = resolvedProfile?.topFiveEntries || []

  useEffect(() => {
    if (editableProfile && !isEditing) {
      setDraftProfile(createProfileDraft(editableProfile))
      return
    }

    if (!editableProfile && !isEditing) {
      setDraftProfile(createProfileDraft(null))
    }
  }, [editableProfile, isEditing])

  useEffect(() => {
    setActiveTab('status')
  }, [activeProfile?.id])

  const loadStatusGames = useCallback(async (userId: string) => {
    const result = await getGameStatusesByUserId(userId)

    if (result.error) {
      console.error('Erro ao carregar status dos jogos do perfil:', result.error)
    }

    return result
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadProfileCollections = async () => {
      if (!activeProfile) {
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
        loadStatusGames(activeProfile.id),
        getWishlistGamesByUserId(activeProfile.id),
        getReviewsByUserId(activeProfile.id),
      ])

      if (!isMounted) return

      if (statusResult.error) {
        setStatusGames([])
        setStatusError(getGameStatusErrorMessage(statusResult.error, 'load', Boolean(isOwnerView)))
      } else {
        setStatusGames(statusResult.data)
      }

      if (wishlistResult.error) {
        console.error('Erro ao carregar jogos que quero jogar:', wishlistResult.error)
        setWishlistGames([])
        setWishlistError(getWishlistErrorMessage(wishlistResult.error, 'load', Boolean(isOwnerView)))
      } else {
        setWishlistGames(wishlistResult.data)
      }

      if (reviewsResult.error) {
        console.error('Erro ao carregar reviews do perfil:', reviewsResult.error)
        setUserReviews(reviewsResult.data)
        setReviewsError(getReviewErrorMessage(reviewsResult.error, 'load', Boolean(isOwnerView)))
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
  }, [activeProfile, isOwnerView, loadStatusGames])

  useEffect(() => {
    let isMounted = true

    const loadCurrentFollowState = async () => {
      if (!activeProfile) {
        if (isMounted) {
          setFollowLoading(false)
          setFollowFeedback(null)
          setFollowState({
            isFollowing: false,
            followersCount: 0,
            followingCount: 0,
          })
        }
        return
      }

      setFollowLoading(true)

      const result = await getFollowState(user?.id, activeProfile.id)

      if (!isMounted) return

      if (result.error) {
        setFollowFeedback({
          tone: 'error',
          message: getFollowErrorMessage(result.error, 'load'),
        })
      } else {
        setFollowFeedback(null)
      }

      setFollowState(result.data)
      setFollowLoading(false)
    }

    void loadCurrentFollowState()

    return () => {
      isMounted = false
    }
  }, [activeProfile, user?.id])

  const pageLoading = loading || publicProfileLoading

  if (pageLoading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Carregando perfil</h1>
            <p>Estamos reunindo as informacoes desta pagina.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isUsernameRoute && !user) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Faca login para acessar seu perfil</h1>
            <p>Entre na sua conta para visualizar e editar seus dados.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isUsernameRoute && publicProfileError) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>{publicProfileError}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isUsernameRoute && !profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>Nao foi possivel carregar seus dados agora. Tente novamente em instantes.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isUsernameRoute && !publicProfile) {
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

  if (isUsernameRoute && publicProfile && user && user.id === publicProfile.id && !profile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>Nao foi possivel carregar os dados editaveis deste perfil agora.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!activeProfile) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Perfil indisponivel</h1>
            <p>Nao foi possivel montar esta pagina de perfil agora.</p>
          </div>
        </div>
      </div>
    )
  }

  const joinedDate = formatProfileDate(activeProfile.data_cadastro)
  const visibleFullName = isEditing
    ? draftProfile.nome_completo || 'Nome nao informado'
    : activeProfile.nome_completo || 'Nome nao informado'
  const visibleUsername = isEditing ? draftProfile.username || 'usuario' : activeProfile.username || 'usuario'
  const visibleBio = isEditing ? draftProfile.bio.trim() : activeProfile.bio?.trim() || ''
  const statusCountLabel =
    statusGames.length === 1 ? '1 jogo com status' : `${statusGames.length} jogos com status`
  const wishlistCountLabel =
    wishlistGames.length === 1
      ? '1 jogo salvo para jogar'
      : `${wishlistGames.length} jogos salvos para jogar`
  const reviewsCountLabel =
    userReviews.length === 1 ? '1 review publicada' : `${userReviews.length} reviews publicadas`
  const followButtonLabel = followSubmitting
    ? followState.isFollowing
      ? 'Atualizando...'
      : 'Seguindo...'
    : followState.isFollowing
      ? 'Deixar de seguir'
      : 'Seguir'
  const sectionEyebrow = isOwnerView ? 'Perfil' : 'Perfil publico'

  const resetDraft = () => {
    setDraftProfile(createProfileDraft(editableProfile))
  }

  const handleStartEditing = () => {
    if (!editableProfile) return

    resetDraft()
    setSaveFeedback(null)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    resetDraft()
    setSaveFeedback(null)
    setIsEditing(false)
  }

  const handleDraftChange = (field: keyof ProfileDraft, value: string) => {
    setDraftProfile(currentDraft => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !editableProfile || !user || user.id !== editableProfile.id) return

    setAvatarFeedback(null)
    setIsUploadingAvatar(true)

    try {
      const result = await uploadAvatarImage(file, user.id)

      if (!result) {
        setAvatarFeedback({
          tone: 'error',
          message: 'Nao foi possivel enviar a nova foto.',
        })
        return
      }

      const { error } = await updateOwnProfile({
        avatar_path: result.path,
        avatar_url: result.publicUrl,
      })

      if (error) {
        setAvatarFeedback({
          tone: 'error',
          message: getProfileUpdateErrorMessage(error),
        })
        return
      }

      setAvatarFeedback({
        tone: 'success',
        message: 'Foto de perfil atualizada com sucesso.',
      })
    } catch (error) {
      console.error('Erro inesperado ao atualizar avatar do perfil:', error)
      setAvatarFeedback({
        tone: 'error',
        message: 'Nao foi possivel atualizar a foto agora.',
      })
    } finally {
      setIsUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    if (!editableProfile) return

    const trimmedName = draftProfile.nome_completo.trim()
    const trimmedUsername = draftProfile.username.trim()
    const trimmedBio = draftProfile.bio.trim()
    const currentName = editableProfile.nome_completo?.trim() || ''
    const currentUsername = editableProfile.username?.trim() || ''
    const currentBio = editableProfile.bio?.trim() || ''

    if (!trimmedName || !trimmedUsername) {
      setSaveFeedback({
        tone: 'error',
        message: 'Nome exibido e username sao obrigatorios.',
      })
      return
    }

    if (
      trimmedName === currentName &&
      trimmedUsername === currentUsername &&
      trimmedBio === currentBio
    ) {
      setSaveFeedback(null)
      setIsEditing(false)
      return
    }

    setSaveFeedback(null)
    setIsSaving(true)

    try {
      const { data, error } = await updateOwnProfile({
        nome_completo: trimmedName,
        username: trimmedUsername,
        bio: trimmedBio || null,
      })

      if (error || !data) {
        setSaveFeedback({
          tone: 'error',
          message: getProfileUpdateErrorMessage(error),
        })
        return
      }

      setDraftProfile(createProfileDraft(data))
      setSaveFeedback({
        tone: 'success',
        message: 'Perfil atualizado com sucesso.',
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Erro inesperado ao salvar perfil:', error)
      setSaveFeedback({
        tone: 'error',
        message: 'Nao foi possivel salvar as alteracoes do perfil agora.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshStatusGames = async () => {
    if (!activeProfile) {
      setStatusGames([])
      setStatusError(null)
      setStatusLoading(false)
      return
    }

    setStatusLoading(true)
    setStatusError(null)

    const { data, error } = await loadStatusGames(activeProfile.id)

    if (error) {
      setStatusGames([])
      setStatusError(getGameStatusErrorMessage(error, 'load', Boolean(isOwnerView)))
    } else {
      setStatusGames(data)
      setStatusError(null)
    }

    setStatusLoading(false)
  }

  const handleSaveGameStatus = async ({
    gameId,
    status,
    favorito,
  }: {
    gameId: number
    status: GameStatusValue
    favorito: boolean
  }) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para salvar este status.',
      }
    }

    const { error } = await saveGameStatus({
      userId: editableProfile.id,
      gameId,
      status,
      favorito,
    })

    if (error) {
      return {
        ok: false,
        message: getGameStatusErrorMessage(error, 'save', true),
      }
    }

    const { data, error: reloadError } = await loadStatusGames(editableProfile.id)

    if (reloadError) {
      setStatusError(getGameStatusErrorMessage(reloadError, 'load', true))
      return {
        ok: false,
        message: 'O status foi salvo, mas nao foi possivel atualizar a lista agora.',
      }
    }

    setStatusGames(data)
    setStatusError(null)

    return {
      ok: true,
    }
  }

  const handleDeleteStatus = async (itemId: string) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para remover este jogo.',
      }
    }

    const { error } = await deleteGameStatus({
      userId: editableProfile.id,
      statusId: itemId,
    })

    if (error) {
      return {
        ok: false,
        message: getGameStatusErrorMessage(error, 'delete', true),
      }
    }

    setStatusGames(currentItems => currentItems.filter(item => item.id !== itemId))
    setStatusError(null)

    return {
      ok: true,
    }
  }

  const handleDeleteWishlistItem = async (itemId: string) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para remover este jogo.',
      }
    }

    const { error } = await deleteWishlistEntry({
      userId: editableProfile.id,
      wishlistEntryId: itemId,
    })

    if (error) {
      return {
        ok: false,
        message: getWishlistErrorMessage(error, 'delete', true),
      }
    }

    setWishlistGames(currentItems => currentItems.filter(item => item.id !== itemId))
    setWishlistError(null)

    return {
      ok: true,
    }
  }

  const handleSaveTopFive = async (entries: TopFiveStoredEntry[]) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para atualizar o Top 5.',
      }
    }

    const nextPrivacySettings = mergeTopFiveEntriesIntoPrivacySettings(
      editableProfile.configuracoes_privacidade,
      entries
    )

    const { data, error } = await updateOwnProfile({
      configuracoes_privacidade: nextPrivacySettings,
    })

    if (error || !data) {
      return {
        ok: false,
        message: getProfileUpdateErrorMessage(error),
      }
    }

    return {
      ok: true,
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!editableProfile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para apagar esta review.',
      }
    }

    const result = await deleteReview({
      userId: editableProfile.id,
      reviewId,
    })

    if (!result.ok) {
      return {
        ok: false,
        message: getReviewErrorMessage(result.error, 'delete', true),
      }
    }

    setUserReviews(currentReviews =>
      currentReviews.filter(currentReview => currentReview.id !== reviewId)
    )
    setReviewsError(null)

    return {
      ok: true,
    }
  }

  const handleToggleFollow = async () => {
    if (!user || !activeProfile || followSubmitting || user.id === activeProfile.id) return

    setFollowSubmitting(true)
    setFollowFeedback(null)

    const result = followState.isFollowing
      ? await unfollowUser(user.id, activeProfile.id)
      : await followUser(user.id, activeProfile.id)

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

  const avatarContent = (
    <UserAvatar
      name={visibleFullName}
      avatarPath={activeProfile.avatar_path}
      imageClassName="avatar-img profile-avatar-large"
      fallbackClassName="avatar-placeholder-large profile-avatar-large"
      alt={`Foto de perfil de ${visibleFullName}`}
    />
  )

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="profile-page">
          <section className={`profile-card${!isOwnerView ? ' public-profile-card' : ''}`}>
            <div className="profile-card-glow profile-card-glow-left"></div>
            <div className="profile-card-glow profile-card-glow-right"></div>

            <div className="profile-card-main">
              <div className="profile-avatar-column">
                {isOwnerView ? (
                  <>
                    <label
                      htmlFor="profile-avatar-input"
                      className={`profile-avatar-trigger${isUploadingAvatar ? ' is-uploading' : ''}`}
                      title="Clique para trocar a foto"
                    >
                      {avatarContent}
                      <span className="profile-avatar-overlay">
                        {isUploadingAvatar ? 'Enviando foto...' : 'Trocar foto'}
                      </span>
                    </label>

                    <input
                      id="profile-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={isUploadingAvatar}
                      className="profile-avatar-input"
                    />
                  </>
                ) : (
                  <div className="profile-avatar-shell">{avatarContent}</div>
                )}

                {avatarFeedback ? (
                  <p className={`profile-feedback profile-feedback-center is-${avatarFeedback.tone}`}>
                    {avatarFeedback.message}
                  </p>
                ) : null}
              </div>

              <div className="profile-info-column">
                <div className={`profile-info-header${!isOwnerView ? ' public-profile-info-header' : ''}`}>
                  <div className="profile-heading">
                    <span className="profile-eyebrow">{sectionEyebrow}</span>
                    <h1>@{visibleUsername}</h1>
                    <p className="profile-handle">{visibleFullName}</p>
                  </div>

                  {isOwnerView ? (
                    <button
                      type="button"
                      className={`profile-edit-button${isEditing ? ' is-active' : ''}`}
                      onClick={isEditing ? handleCancelEditing : handleStartEditing}
                      disabled={isSaving || isUploadingAvatar}
                      aria-label={isEditing ? 'Cancelar edicao do perfil' : 'Editar perfil'}
                      aria-pressed={isEditing}
                    >
                      <span className="profile-edit-button-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M4 20H8L18 10C18.5304 9.46957 18.8284 8.75022 18.8284 8C18.8284 7.24978 18.5304 6.53043 18 6C17.4696 5.46957 16.7502 5.17157 16 5.17157C15.2498 5.17157 14.5304 5.46957 14 6L4 16V20Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13 7L17 11"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
                    </button>
                  ) : (
                    <div className="public-profile-actions">
                      {!user ? (
                        <Link to="/login" className="profile-secondary-button public-profile-follow-link">
                          Fazer login para seguir
                        </Link>
                      ) : followState.isFollowing ? (
                        <>
                          <span className="public-profile-follow-status">Seguindo</span>
                          <button
                            type="button"
                            className="profile-save-button public-profile-follow-button is-following"
                            onClick={() => void handleToggleFollow()}
                            disabled={followSubmitting}
                          >
                            {followButtonLabel}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="profile-save-button public-profile-follow-button"
                          onClick={() => void handleToggleFollow()}
                          disabled={followSubmitting}
                        >
                          {followButtonLabel}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className={`profile-meta${!isOwnerView ? ' public-profile-meta' : ''}`}>
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

                {isEditing && isOwnerView ? (
                  <form
                    className="profile-form"
                    onSubmit={event => {
                      event.preventDefault()
                      void handleSaveProfile()
                    }}
                  >
                    <div className="profile-form-grid">
                      <label className="profile-field">
                        <span>Username</span>
                        <div className="profile-input-wrap">
                          <span className="profile-input-prefix">@</span>
                          <input
                            type="text"
                            className="profile-input profile-input-plain"
                            value={draftProfile.username}
                            onChange={event => handleDraftChange('username', event.target.value)}
                            placeholder="seuusername"
                            disabled={isSaving}
                          />
                        </div>
                      </label>

                      <label className="profile-field">
                        <span>Nome completo</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={draftProfile.nome_completo}
                          onChange={event => handleDraftChange('nome_completo', event.target.value)}
                          placeholder="Como seu nome aparece no perfil"
                          disabled={isSaving}
                        />
                      </label>
                    </div>

                    <label className="profile-field">
                      <span>Bio</span>
                      <textarea
                        className="profile-textarea"
                        value={draftProfile.bio}
                        onChange={event => handleDraftChange('bio', event.target.value)}
                        maxLength={220}
                        placeholder="Fale um pouco sobre voce."
                        disabled={isSaving}
                      />
                    </label>

                    <div className="profile-form-footer">
                      <span className="profile-counter">{draftProfile.bio.length}/220</span>

                      <div className="profile-actions">
                        <button
                          type="button"
                          className="profile-secondary-button"
                          onClick={handleCancelEditing}
                          disabled={isSaving}
                        >
                          Cancelar
                        </button>

                        <button type="submit" className="profile-save-button" disabled={isSaving}>
                          {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="profile-bio-block">
                    <span className="profile-section-label">Bio</span>
                    <p className={`profile-bio-copy${visibleBio ? '' : ' is-empty'}`}>
                      {visibleBio || 'Sem bio informada.'}
                    </p>
                  </div>
                )}

                {saveFeedback ? (
                  <p className={`profile-feedback is-${saveFeedback.tone}`}>{saveFeedback.message}</p>
                ) : null}

                {followFeedback ? (
                  <p className={`profile-feedback is-${followFeedback.tone}`}>{followFeedback.message}</p>
                ) : null}
              </div>
            </div>

            <ProfileTopFiveSection
              isOwnerView={Boolean(isOwnerView)}
              entries={topFiveEntries}
              onSaveTopFive={isOwnerView ? handleSaveTopFive : readOnlySaveTopFive}
            />
          </section>

          <section className="profile-tabs-shell" aria-label="Conteudo do perfil">
            <div className="profile-tabs" role="tablist" aria-label="Navegacao interna do perfil">
              <button
                id="profile-tab-status"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'status' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'status'}
                aria-controls="profile-panel-status"
                onClick={() => setActiveTab('status')}
              >
                <span>Status dos jogos</span>
                <small>{statusCountLabel}</small>
              </button>

              <button
                id="profile-tab-wishlist"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'wishlist' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'wishlist'}
                aria-controls="profile-panel-wishlist"
                onClick={() => setActiveTab('wishlist')}
              >
                <span>Jogos que quero jogar</span>
                <small>{wishlistCountLabel}</small>
              </button>

              <button
                id="profile-tab-reviews"
                type="button"
                role="tab"
                className={`profile-tab-button${activeTab === 'reviews' ? ' is-active' : ''}`}
                aria-selected={activeTab === 'reviews'}
                aria-controls="profile-panel-reviews"
                onClick={() => setActiveTab('reviews')}
              >
                <span>Reviews</span>
                <small>{reviewsCountLabel}</small>
              </button>
            </div>

            <div
              id="profile-panel-status"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-status"
              hidden={activeTab !== 'status'}
            >
              {activeTab === 'status' ? (
                <ProfileGameStatusSection
                  userId={activeProfile.id}
                  items={statusGames}
                  isLoading={statusLoading}
                  errorMessage={statusError}
                  countLabel={statusCountLabel}
                  isOwnerView={Boolean(isOwnerView)}
                  onSaveStatus={isOwnerView ? handleSaveGameStatus : readOnlySaveStatus}
                  onDeleteStatus={isOwnerView ? handleDeleteStatus : readOnlyDeleteStatus}
                  onRefresh={handleRefreshStatusGames}
                />
              ) : null}
            </div>

            <div
              id="profile-panel-wishlist"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-wishlist"
              hidden={activeTab !== 'wishlist'}
            >
              {activeTab === 'wishlist' ? (
                <ProfileWishlistSection
                  userId={activeProfile.id}
                  items={wishlistGames}
                  isLoading={wishlistLoading}
                  errorMessage={wishlistError}
                  countLabel={wishlistCountLabel}
                  isOwnerView={Boolean(isOwnerView)}
                  onDeleteWishlistItem={isOwnerView ? handleDeleteWishlistItem : readOnlyDeleteWishlist}
                />
              ) : null}
            </div>

            <div
              id="profile-panel-reviews"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby="profile-tab-reviews"
              hidden={activeTab !== 'reviews'}
            >
              {activeTab === 'reviews' ? (
                <ProfileReviewsSection
                  items={userReviews}
                  isLoading={reviewsLoading}
                  errorMessage={reviewsError}
                  countLabel={reviewsCountLabel}
                  isOwnerView={Boolean(isOwnerView)}
                  onDeleteReview={isOwnerView ? handleDeleteReview : undefined}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
