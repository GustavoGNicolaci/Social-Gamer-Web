import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { ProfileConnectionsModal } from '../components/profile/ProfileConnectionsModal'
import { ProfileCommunitiesSection } from '../components/profile/ProfileCommunitiesSection'
import { ProfileGameStatusSection } from '../components/profile/ProfileGameStatusSection'
import { ProfileReportModal } from '../components/profile/ProfileReportModal'
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
  getGameStatusesPageByUserId,
  saveGameStatus,
  type GameStatusSortValue,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusValue,
} from '../services/gameStatusService'
import {
  deleteProfileReport,
  getCurrentUserProfileReport,
  submitProfileReport,
  type CurrentUserProfileReportSummary,
  type ProfileReportError,
  type ProfileReportReason,
} from '../services/profileReportService'
import {
  deleteReview,
  getReviewsPageByUserId,
  type ProfileReviewItem,
  type ReviewError,
} from '../services/reviewService'
import { uploadAvatarImage } from '../services/storageService'
import {
  followUser,
  type FollowListKind,
  getFollowState,
  getPublicProfileByUsername,
  unfollowUser,
  type PublicUserProfile,
  type UserFollowState,
  type UserServiceError,
} from '../services/userService'
import {
  deleteWishlistEntry,
  getWishlistGamesPageByUserId,
  getWishlistGamesByUserId,
  type WishlistError,
  type WishlistGameItem,
} from '../services/wishlistService'
import { getPerformanceNow, logPerformanceTiming } from '../utils/performanceDiagnostics'
import {
  getTopFiveEntriesFromPrivacySettings,
  mergeTopFiveEntriesIntoPrivacySettings,
  type TopFiveStoredEntry,
} from '../utils/profileTopFive'
import './ProfilePage.css'

type FeedbackTone = 'success' | 'error'
type FollowFeedbackTone = 'error' | 'info'
type ReportFeedbackTone = 'success' | 'error' | 'info'
type ProfileTab =
  | 'status'
  | 'wishlist'
  | 'reviews'
  | 'communities'
  | 'communityPosts'
  | 'savedCommunityPosts'
type LoadedProfileTabs = Record<ProfileTab, boolean>

interface ProfilePageState {
  totalCount: number | null
  hasMore: boolean
  nextPage: number | null
  loaded: boolean
}

interface ProfileStatusControls {
  sortValue: GameStatusSortValue
  statuses: GameStatusValue[]
}

interface CachedCollection<T> extends ProfilePageState {
  items: T[]
}

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface FollowFeedbackState {
  tone: FollowFeedbackTone
  message: string
}

interface ReportFeedbackState {
  tone: ReportFeedbackTone
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

const createEmptyLoadedProfileTabs = (): LoadedProfileTabs => ({
  status: false,
  wishlist: false,
  reviews: false,
  communities: false,
  communityPosts: false,
  savedCommunityPosts: false,
})

const PROFILE_STATUS_PAGE_SIZE = 12
const PROFILE_WISHLIST_PAGE_SIZE = 12
const PROFILE_REVIEWS_PAGE_SIZE = 6

const DEFAULT_STATUS_CONTROLS: ProfileStatusControls = {
  sortValue: 'recent',
  statuses: [],
}

const createEmptyProfilePageState = (): ProfilePageState => ({
  totalCount: null,
  hasMore: false,
  nextPage: null,
  loaded: false,
})

const createCachedCollection = <T,>(
  items: T[],
  pageState: ProfilePageState
): CachedCollection<T> => ({
  items,
  ...pageState,
})

const createLoadedPageState = (
  totalCount: number | null,
  hasMore: boolean,
  nextPage: number | null
): ProfilePageState => ({
  totalCount,
  hasMore,
  nextPage,
  loaded: true,
})

function getStatusControlsCacheKey(controls: ProfileStatusControls) {
  const statusesKey = controls.statuses.length > 0 ? [...controls.statuses].sort().join(',') : 'all'
  return `${controls.sortValue}:${statusesKey}`
}

function mergeCollectionsById<T extends { id: string }>(currentItems: T[], nextItems: T[]) {
  const mergedItems = new Map<string, T>()

  currentItems.forEach(item => {
    mergedItems.set(item.id, item)
  })

  nextItems.forEach(item => {
    mergedItems.set(item.id, item)
  })

  return Array.from(mergedItems.values())
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

function getProfileReportErrorMessage(
  error: ProfileReportError | null,
  action: 'load' | 'submit' | 'delete'
) {
  if (!error) {
    return action === 'load'
      ? 'Nao foi possivel carregar o estado da denuncia deste perfil agora.'
      : action === 'submit'
        ? 'Nao foi possivel registrar esta denuncia de perfil agora.'
        : 'Nao foi possivel remover esta denuncia de perfil agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'load'
      ? 'Nao foi possivel carregar a denuncia deste perfil por permissao. Verifique as policies da tabela denuncias_perfil no Supabase.'
      : action === 'submit'
        ? 'Nao foi possivel registrar esta denuncia por permissao. Verifique as policies da tabela denuncias_perfil no Supabase.'
        : 'Nao foi possivel remover esta denuncia por permissao. Verifique as policies DELETE da tabela denuncias_perfil no Supabase.'
  }

  if (fullMessage.includes('duplicate') || fullMessage.includes('unique')) {
    return 'Voce ja denunciou este perfil anteriormente.'
  }

  if (fullMessage.includes('column')) {
    return 'A estrutura da tabela denuncias_perfil nao corresponde ao frontend.'
  }

  return error.message
}

function iconFlag(isFilled: boolean) {
  return (
    <span className="profile-report-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M6 4V20"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 5.2H15.5L14.2 8.3L17.5 11.4H6V5.2Z"
          fill={isFilled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
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
  const [publicProfileRefreshKey, setPublicProfileRefreshKey] = useState(0)
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
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false)
  const [connectionsInitialTab, setConnectionsInitialTab] = useState<FollowListKind>('followers')
  const [followersRefreshKey, setFollowersRefreshKey] = useState(0)
  const [statusGames, setStatusGames] = useState<GameStatusItem[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusLoadingMore, setStatusLoadingMore] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusPageState, setStatusPageState] = useState<ProfilePageState>(createEmptyProfilePageState)
  const [statusControls, setStatusControls] =
    useState<ProfileStatusControls>(DEFAULT_STATUS_CONTROLS)
  const [wishlistGames, setWishlistGames] = useState<WishlistGameItem[]>([])
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistLoadingMore, setWishlistLoadingMore] = useState(false)
  const [wishlistPreparingReorder, setWishlistPreparingReorder] = useState(false)
  const [wishlistError, setWishlistError] = useState<string | null>(null)
  const [wishlistPageState, setWishlistPageState] =
    useState<ProfilePageState>(createEmptyProfilePageState)
  const [userReviews, setUserReviews] = useState<ProfileReviewItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewsPageState, setReviewsPageState] =
    useState<ProfilePageState>(createEmptyProfilePageState)
  const [loadedProfileTabs, setLoadedProfileTabs] = useState<LoadedProfileTabs>(
    createEmptyLoadedProfileTabs
  )
  const [loadedCollectionsKey, setLoadedCollectionsKey] = useState<string | null>(null)
  const [currentProfileReport, setCurrentProfileReport] =
    useState<CurrentUserProfileReportSummary | null>(null)
  const [profileReportLoading, setProfileReportLoading] = useState(false)
  const [isProfileReportModalOpen, setIsProfileReportModalOpen] = useState(false)
  const [profileReportSubmitting, setProfileReportSubmitting] = useState(false)
  const [profileReportRemoving, setProfileReportRemoving] = useState(false)
  const [profileReportFeedback, setProfileReportFeedback] = useState<ReportFeedbackState | null>(null)

  const followStateRequestIdRef = useRef(0)
  const statusRequestIdRef = useRef(0)
  const wishlistRequestIdRef = useRef(0)
  const reviewsRequestIdRef = useRef(0)
  const statusCacheRef = useRef(new Map<string, CachedCollection<GameStatusItem>>())
  const wishlistCacheRef = useRef(new Map<string, CachedCollection<WishlistGameItem>>())
  const reviewsCacheRef = useRef(new Map<string, CachedCollection<ProfileReviewItem>>())

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

      const result = await getPublicProfileByUsername(requestedUsername, user?.id)

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
  }, [isUsernameRoute, publicProfileRefreshKey, requestedUsername, user?.id])

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
  const isRestrictedPublicView = Boolean(
    resolvedProfile?.kind === 'public' && !resolvedProfile.data.canViewRestrictedContent
  )
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
    setStatusControls({
      sortValue: DEFAULT_STATUS_CONTROLS.sortValue,
      statuses: [],
    })
    setIsConnectionsModalOpen(false)
    setConnectionsInitialTab('followers')
    setIsProfileReportModalOpen(false)
    setProfileReportFeedback(null)
  }, [activeProfile?.id])

  const collectionsKey = useMemo(() => {
    if (!activeProfile || isRestrictedPublicView) return null

    return [
      activeProfile.id,
      user?.id || 'anon',
      isOwnerView ? 'owner' : 'viewer',
    ].join(':')
  }, [activeProfile, isOwnerView, isRestrictedPublicView, user?.id])

  const statusCacheKey = useMemo(
    () => (collectionsKey ? `${collectionsKey}:status:${getStatusControlsCacheKey(statusControls)}` : null),
    [collectionsKey, statusControls]
  )
  const wishlistCacheKey = useMemo(
    () => (collectionsKey ? `${collectionsKey}:wishlist` : null),
    [collectionsKey]
  )
  const reviewsCacheKey = useMemo(
    () => (collectionsKey ? `${collectionsKey}:reviews` : null),
    [collectionsKey]
  )

  const resetCollections = useCallback((nextCollectionsKey: string | null) => {
    setStatusGames([])
    setStatusError(null)
    setStatusLoading(false)
    setStatusLoadingMore(false)
    setStatusPageState(createEmptyProfilePageState())
    setWishlistGames([])
    setWishlistError(null)
    setWishlistLoading(false)
    setWishlistLoadingMore(false)
    setWishlistPreparingReorder(false)
    setWishlistPageState(createEmptyProfilePageState())
    setUserReviews([])
    setReviewsError(null)
    setReviewsLoading(false)
    setReviewsLoadingMore(false)
    setReviewsPageState(createEmptyProfilePageState())
    setLoadedProfileTabs(createEmptyLoadedProfileTabs())
    setLoadedCollectionsKey(nextCollectionsKey)
  }, [])

  const loadStatusPage = useCallback(
    async ({
      page = 0,
      append = false,
      force = false,
    }: {
      page?: number
      append?: boolean
      force?: boolean
    } = {}) => {
      if (!activeProfile || !statusCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = statusCacheRef.current.get(statusCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setStatusGames(cachedCollection.items)
        setStatusPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setStatusError(null)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, status: true }))
        return { ok: true }
      }

      const requestId = statusRequestIdRef.current + 1
      statusRequestIdRef.current = requestId

      if (append) {
        setStatusLoadingMore(true)
      } else {
        setStatusLoading(true)
      }

      setStatusError(null)
      const startedAt = getPerformanceNow()

      const statusResult = await getGameStatusesPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_STATUS_PAGE_SIZE,
        sort: statusControls.sortValue,
        statuses: statusControls.statuses,
      })

      if (statusRequestIdRef.current !== requestId) {
        return { ok: false }
      }

      logPerformanceTiming('profile.status.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: statusResult.timings.requestCount,
        itemCount: statusResult.data.length,
      })

      if (statusResult.error) {
        console.error('Erro ao carregar status dos jogos do perfil:', statusResult.error)
        if (!append) {
          setStatusGames([])
          setStatusPageState(createEmptyProfilePageState())
        }
        setStatusError(getGameStatusErrorMessage(statusResult.error, 'load', Boolean(isOwnerView)))
        setStatusLoading(false)
        setStatusLoadingMore(false)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, status: true }))
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        statusResult.totalCount,
        statusResult.hasMore,
        statusResult.nextPage
      )

      setStatusGames(currentItems => {
        const nextItems = append ? mergeCollectionsById(currentItems, statusResult.data) : statusResult.data
        statusCacheRef.current.set(statusCacheKey, createCachedCollection(nextItems, nextPageState))
        return nextItems
      })
      setStatusPageState(nextPageState)
      setStatusError(null)
      setStatusLoading(false)
      setStatusLoadingMore(false)
      setLoadedProfileTabs(currentTabs => ({ ...currentTabs, status: true }))

      return { ok: true }
    },
    [
      activeProfile,
      collectionsKey,
      isOwnerView,
      isRestrictedPublicView,
      statusCacheKey,
      statusControls.sortValue,
      statusControls.statuses,
    ]
  )

  const loadWishlistPage = useCallback(
    async ({
      page = 0,
      append = false,
      force = false,
    }: {
      page?: number
      append?: boolean
      force?: boolean
    } = {}) => {
      if (!activeProfile || !wishlistCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = wishlistCacheRef.current.get(wishlistCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setWishlistGames(cachedCollection.items)
        setWishlistPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setWishlistError(null)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, wishlist: true }))
        return { ok: true }
      }

      const requestId = wishlistRequestIdRef.current + 1
      wishlistRequestIdRef.current = requestId

      if (append) {
        setWishlistLoadingMore(true)
      } else {
        setWishlistLoading(true)
      }

      setWishlistError(null)
      const startedAt = getPerformanceNow()

      const wishlistResult = await getWishlistGamesPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_WISHLIST_PAGE_SIZE,
      })

      if (wishlistRequestIdRef.current !== requestId) {
        return { ok: false }
      }

      logPerformanceTiming('profile.wishlist.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: wishlistResult.timings.requestCount,
        itemCount: wishlistResult.data.length,
      })

      if (wishlistResult.error) {
        console.error('Erro ao carregar jogos que quero jogar:', wishlistResult.error)
        if (!append) {
          setWishlistGames([])
          setWishlistPageState(createEmptyProfilePageState())
        }
        setWishlistError(getWishlistErrorMessage(wishlistResult.error, 'load', Boolean(isOwnerView)))
        setWishlistLoading(false)
        setWishlistLoadingMore(false)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, wishlist: true }))
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        wishlistResult.totalCount,
        wishlistResult.hasMore,
        wishlistResult.nextPage
      )

      setWishlistGames(currentItems => {
        const nextItems = append ? mergeCollectionsById(currentItems, wishlistResult.data) : wishlistResult.data
        wishlistCacheRef.current.set(wishlistCacheKey, createCachedCollection(nextItems, nextPageState))
        return nextItems
      })
      setWishlistPageState(nextPageState)
      setWishlistError(null)
      setWishlistLoading(false)
      setWishlistLoadingMore(false)
      setLoadedProfileTabs(currentTabs => ({ ...currentTabs, wishlist: true }))

      return { ok: true }
    },
    [activeProfile, collectionsKey, isOwnerView, isRestrictedPublicView, wishlistCacheKey]
  )

  const loadReviewsPage = useCallback(
    async ({
      page = 0,
      append = false,
      force = false,
    }: {
      page?: number
      append?: boolean
      force?: boolean
    } = {}) => {
      if (!activeProfile || !reviewsCacheKey || !collectionsKey || isRestrictedPublicView) {
        return { ok: false }
      }

      const cachedCollection = reviewsCacheRef.current.get(reviewsCacheKey)

      if (!force && !append && cachedCollection?.loaded) {
        setUserReviews(cachedCollection.items)
        setReviewsPageState({
          totalCount: cachedCollection.totalCount,
          hasMore: cachedCollection.hasMore,
          nextPage: cachedCollection.nextPage,
          loaded: cachedCollection.loaded,
        })
        setReviewsError(null)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, reviews: true }))
        return { ok: true }
      }

      const requestId = reviewsRequestIdRef.current + 1
      reviewsRequestIdRef.current = requestId

      if (append) {
        setReviewsLoadingMore(true)
      } else {
        setReviewsLoading(true)
      }

      setReviewsError(null)
      const startedAt = getPerformanceNow()

      const reviewsResult = await getReviewsPageByUserId(activeProfile.id, {
        page,
        pageSize: PROFILE_REVIEWS_PAGE_SIZE,
        currentUserId: user?.id,
        includeRestrictedAuthorReviews: Boolean(isOwnerView),
      })

      if (reviewsRequestIdRef.current !== requestId) {
        return { ok: false }
      }

      logPerformanceTiming('profile.reviews.ui-load', getPerformanceNow() - startedAt, {
        profileId: activeProfile.id,
        page,
        append,
        requestCount: reviewsResult.timings.requestCount,
        itemCount: reviewsResult.data.length,
      })

      if (reviewsResult.error) {
        console.error('Erro ao carregar reviews do perfil:', reviewsResult.error)
        if (!append) {
          setUserReviews(reviewsResult.data)
          setReviewsPageState(createEmptyProfilePageState())
        }
        setReviewsError(getReviewErrorMessage(reviewsResult.error, 'load', Boolean(isOwnerView)))
        setReviewsLoading(false)
        setReviewsLoadingMore(false)
        setLoadedProfileTabs(currentTabs => ({ ...currentTabs, reviews: true }))
        return { ok: false }
      }

      const nextPageState = createLoadedPageState(
        reviewsResult.totalCount,
        reviewsResult.hasMore,
        reviewsResult.nextPage
      )

      setUserReviews(currentItems => {
        const nextItems = append ? mergeCollectionsById(currentItems, reviewsResult.data) : reviewsResult.data
        reviewsCacheRef.current.set(reviewsCacheKey, createCachedCollection(nextItems, nextPageState))
        return nextItems
      })
      setReviewsPageState(nextPageState)
      setReviewsError(null)
      setReviewsLoading(false)
      setReviewsLoadingMore(false)
      setLoadedProfileTabs(currentTabs => ({ ...currentTabs, reviews: true }))

      return { ok: true }
    },
    [
      activeProfile,
      collectionsKey,
      isOwnerView,
      isRestrictedPublicView,
      reviewsCacheKey,
      user?.id,
    ]
  )

  useEffect(() => {
    if (!collectionsKey) {
      if (loadedCollectionsKey !== null) {
        resetCollections(null)
      }
      return
    }

    if (loadedCollectionsKey !== collectionsKey) {
      resetCollections(collectionsKey)
    }
  }, [collectionsKey, loadedCollectionsKey, resetCollections])

  useEffect(() => {
    if (!activeProfile || !collectionsKey || isRestrictedPublicView) return

    if (activeTab === 'status') {
      void loadStatusPage()
      return
    }

    if (activeTab === 'wishlist') {
      void loadWishlistPage()
      return
    }

    if (activeTab === 'reviews') {
      void loadReviewsPage()
    }
  }, [
    activeProfile,
    activeTab,
    collectionsKey,
    isRestrictedPublicView,
    loadReviewsPage,
    loadStatusPage,
    loadWishlistPage,
  ])

  useEffect(() => {
    let isMounted = true

    const loadCurrentProfileReport = async () => {
      if (!user || !activeProfile || isOwnerView) {
        if (isMounted) {
          setCurrentProfileReport(null)
          setProfileReportLoading(false)
          setProfileReportSubmitting(false)
          setProfileReportRemoving(false)
        }
        return
      }

      setProfileReportLoading(true)

      const result = await getCurrentUserProfileReport(user.id, activeProfile.id)

      if (!isMounted) return

      if (result.error) {
        console.error('Erro ao carregar denuncia atual do perfil:', result.error)
      }

      setCurrentProfileReport(result.data)
      setProfileReportLoading(false)
    }

    void loadCurrentProfileReport()

    return () => {
      isMounted = false
    }
  }, [activeProfile, isOwnerView, user])

  const refreshFollowState = useCallback(async () => {
    const requestId = followStateRequestIdRef.current + 1
    followStateRequestIdRef.current = requestId

    if (!activeProfile) {
      setFollowLoading(false)
      setFollowFeedback(null)
      setFollowState({
        isFollowing: false,
        followersCount: 0,
        followingCount: 0,
      })
      return
    }

    setFollowLoading(true)

    const result = await getFollowState(user?.id, activeProfile.id)

    if (followStateRequestIdRef.current !== requestId) {
      return
    }

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
  }, [activeProfile, user?.id])

  useEffect(() => {
    void refreshFollowState()

    return () => {
      followStateRequestIdRef.current += 1
    }
  }, [refreshFollowState])

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
    ? draftProfile.nome_completo.trim()
    : activeProfile.nome_completo?.trim() || ''
  const visibleUsername = isEditing ? draftProfile.username || 'usuario' : activeProfile.username || 'usuario'
  const visibleProfileLabel = visibleFullName || visibleUsername
  const visibleBio = isEditing ? draftProfile.bio.trim() : activeProfile.bio?.trim() || ''
  const hasCurrentCollections = Boolean(collectionsKey && loadedCollectionsKey === collectionsKey)
  const statusItemsForView = hasCurrentCollections ? statusGames : []
  const wishlistItemsForView = hasCurrentCollections ? wishlistGames : []
  const reviewItemsForView = hasCurrentCollections ? userReviews : []
  const statusTotalCount = statusPageState.totalCount ?? statusItemsForView.length
  const wishlistTotalCount = wishlistPageState.totalCount ?? wishlistItemsForView.length
  const reviewsTotalCount = reviewsPageState.totalCount ?? reviewItemsForView.length
  const statusSectionLoading =
    !hasCurrentCollections || (statusLoading && !statusPageState.loaded) || !loadedProfileTabs.status
  const wishlistSectionLoading =
    !hasCurrentCollections ||
    (wishlistLoading && !wishlistPageState.loaded) ||
    !loadedProfileTabs.wishlist
  const reviewsSectionLoading =
    !hasCurrentCollections || (reviewsLoading && !reviewsPageState.loaded) || !loadedProfileTabs.reviews
  const statusCountLabel =
    statusSectionLoading
      ? '...'
      : statusTotalCount === 1
        ? '1 jogo com status'
        : `${statusTotalCount} jogos com status`
  const wishlistCountLabel =
    wishlistSectionLoading
      ? '...'
      : wishlistTotalCount === 1
        ? '1 jogo salvo para jogar'
        : `${wishlistTotalCount} jogos salvos para jogar`
  const reviewsCountLabel =
    reviewsSectionLoading
      ? '...'
      : reviewsTotalCount === 1
        ? '1 review publicada'
        : `${reviewsTotalCount} reviews publicadas`
  const followButtonLabel = followSubmitting
    ? followState.isFollowing
      ? 'Atualizando...'
      : 'Seguindo...'
    : followState.isFollowing
      ? 'Deixar de seguir'
      : 'Seguir'
  const restrictedProfileTitle =
    resolvedProfile?.kind === 'public' && resolvedProfile.data.privacyMode === 'friends'
      ? 'Somente para amigos'
      : 'Perfil privado'
  const restrictedProfileMessage =
    resolvedProfile?.kind === 'public'
      ? resolvedProfile.data.restrictedContentMessage
      : null
  const sectionEyebrow = isRestrictedPublicView
    ? restrictedProfileTitle
    : isOwnerView
      ? 'Perfil'
      : 'Perfil publico'
  const canOpenFollowersModal =
    !isRestrictedPublicView && !followLoading && followState.followersCount > 0
  const canOpenFollowingModal =
    !isRestrictedPublicView && !followLoading && followState.followingCount > 0
  const canReportProfile = Boolean(user && activeProfile && !isOwnerView)
  const profileReportButtonLabel = profileReportLoading
    ? 'Carregando denuncia do perfil'
    : currentProfileReport
      ? 'Ver detalhes da sua denuncia deste perfil'
      : 'Denunciar perfil'
  const profileReportTargetLabel = activeProfile.username
    ? `o perfil de @${activeProfile.username}`
    : 'este perfil'

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

    if (!trimmedUsername) {
      setSaveFeedback({
        tone: 'error',
        message: 'Username e obrigatorio.',
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
        nome_completo: trimmedName || null,
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
      setStatusLoadingMore(false)
      setStatusPageState(createEmptyProfilePageState())
      return
    }

    if (statusCacheKey) {
      statusCacheRef.current.delete(statusCacheKey)
    }

    await loadStatusPage({ page: 0, force: true })
  }

  const handleStatusControlsChange = (nextControls: ProfileStatusControls) => {
    setStatusControls({
      sortValue: nextControls.sortValue,
      statuses: [...nextControls.statuses],
    })
    setStatusGames([])
    setStatusPageState(createEmptyProfilePageState())
    setStatusError(null)
    setLoadedProfileTabs(currentTabs => ({ ...currentTabs, status: false }))
  }

  const handleLoadMoreStatusGames = async () => {
    if (!statusPageState.hasMore || statusPageState.nextPage === null || statusLoadingMore) return

    await loadStatusPage({
      page: statusPageState.nextPage,
      append: true,
    })
  }

  const handleLoadMoreWishlistGames = async () => {
    if (!wishlistPageState.hasMore || wishlistPageState.nextPage === null || wishlistLoadingMore) return

    await loadWishlistPage({
      page: wishlistPageState.nextPage,
      append: true,
    })
  }

  const handleLoadMoreReviews = async () => {
    if (!reviewsPageState.hasMore || reviewsPageState.nextPage === null || reviewsLoadingMore) return

    await loadReviewsPage({
      page: reviewsPageState.nextPage,
      append: true,
    })
  }

  const handleLoadFullWishlistForReorder = async () => {
    if (!activeProfile || !wishlistCacheKey || wishlistPreparingReorder) {
      return {
        ok: false,
        message: 'Nao foi possivel preparar a reordenacao agora.',
      }
    }

    if (!wishlistPageState.hasMore && wishlistPageState.loaded) {
      return { ok: true }
    }

    setWishlistPreparingReorder(true)
    setWishlistError(null)
    const startedAt = getPerformanceNow()
    const { data, error } = await getWishlistGamesByUserId(activeProfile.id)

    logPerformanceTiming('profile.wishlist.full-reorder-load', getPerformanceNow() - startedAt, {
      profileId: activeProfile.id,
      itemCount: data.length,
      hasError: Boolean(error),
    })

    setWishlistPreparingReorder(false)

    if (error) {
      const message = getWishlistErrorMessage(error, 'load', Boolean(isOwnerView))
      setWishlistError(message)
      return {
        ok: false,
        message,
      }
    }

    const nextPageState = createLoadedPageState(data.length, false, null)
    setWishlistGames(data)
    setWishlistPageState(nextPageState)
    wishlistCacheRef.current.set(wishlistCacheKey, createCachedCollection(data, nextPageState))
    setLoadedProfileTabs(currentTabs => ({ ...currentTabs, wishlist: true }))
    setWishlistError(null)

    return { ok: true }
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

    if (statusCacheKey) {
      statusCacheRef.current.delete(statusCacheKey)
    }

    const reloadResult = await loadStatusPage({ page: 0, force: true })

    if (!reloadResult.ok) {
      return {
        ok: false,
        message: 'O status foi salvo, mas nao foi possivel atualizar a lista agora.',
      }
    }

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

    const nextPageState = {
      ...statusPageState,
      totalCount:
        statusPageState.totalCount === null ? null : Math.max(statusPageState.totalCount - 1, 0),
    }

    setStatusGames(currentItems => {
      const nextItems = currentItems.filter(item => item.id !== itemId)
      if (statusCacheKey) {
        statusCacheRef.current.set(statusCacheKey, createCachedCollection(nextItems, nextPageState))
      }
      return nextItems
    })
    setStatusPageState(nextPageState)
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

    const nextPageState = {
      ...wishlistPageState,
      totalCount:
        wishlistPageState.totalCount === null
          ? null
          : Math.max(wishlistPageState.totalCount - 1, 0),
    }

    setWishlistGames(currentItems => {
      const nextItems = currentItems.filter(item => item.id !== itemId)
      if (wishlistCacheKey) {
        wishlistCacheRef.current.set(wishlistCacheKey, createCachedCollection(nextItems, nextPageState))
      }
      return nextItems
    })
    setWishlistPageState(nextPageState)
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

    const nextPageState = {
      ...reviewsPageState,
      totalCount:
        reviewsPageState.totalCount === null ? null : Math.max(reviewsPageState.totalCount - 1, 0),
    }

    setUserReviews(currentReviews => {
      const nextReviews = currentReviews.filter(currentReview => currentReview.id !== reviewId)
      if (reviewsCacheKey) {
        reviewsCacheRef.current.set(reviewsCacheKey, createCachedCollection(nextReviews, nextPageState))
      }
      return nextReviews
    })
    setReviewsPageState(nextPageState)
    setReviewsError(null)

    return {
      ok: true,
    }
  }

  const handleOpenConnectionsModal = (kind: FollowListKind) => {
    const totalItems = kind === 'followers' ? followState.followersCount : followState.followingCount

    if (isRestrictedPublicView || followLoading || totalItems <= 0) return

    setConnectionsInitialTab(kind)
    setIsConnectionsModalOpen(true)
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
    setFollowersRefreshKey(currentKey => currentKey + 1)
    setPublicProfileRefreshKey(currentKey => currentKey + 1)
    setFollowSubmitting(false)
  }

  const handleOpenProfileReportModal = () => {
    if (!canReportProfile || profileReportLoading) return

    setProfileReportFeedback(null)
    setIsProfileReportModalOpen(true)
  }

  const handleCloseProfileReportModal = () => {
    if (profileReportSubmitting) return
    if (profileReportRemoving) return

    setIsProfileReportModalOpen(false)
    setProfileReportFeedback(null)
  }

  const handleSubmitProfileReport = async ({
    reason,
    description,
  }: {
    reason: ProfileReportReason
    description: string
  }) => {
    if (!user || !activeProfile || isOwnerView) return

    setProfileReportSubmitting(true)
    setProfileReportFeedback(null)

    const reportResult = await submitProfileReport({
      reporterId: user.id,
      reportedUserId: activeProfile.id,
      reason,
      description,
    })

    if (reportResult.error) {
      setProfileReportFeedback({
        tone: 'error',
        message: getProfileReportErrorMessage(reportResult.error, 'submit'),
      })
      setProfileReportSubmitting(false)
      return
    }

    if (reportResult.data) {
      setCurrentProfileReport(reportResult.data)
    }

    setProfileReportFeedback({
      tone: reportResult.status === 'already_exists' ? 'info' : 'success',
      message:
        reportResult.status === 'already_exists'
          ? 'Voce ja denunciou este perfil. Aqui esta o status atual da sua denuncia.'
          : 'Denuncia de perfil enviada com sucesso.',
    })
    setProfileReportSubmitting(false)
  }

  const handleRemoveProfileReport = async () => {
    if (!user || !currentProfileReport) return

    setProfileReportRemoving(true)
    setProfileReportFeedback(null)

    const result = await deleteProfileReport({
      reporterId: user.id,
      reportId: currentProfileReport.id,
    })

    if (result.error) {
      setProfileReportFeedback({
        tone: 'error',
        message: getProfileReportErrorMessage(result.error, 'delete'),
      })
      setProfileReportRemoving(false)
      return
    }

    setCurrentProfileReport(null)
    setProfileReportFeedback({
      tone: 'success',
      message: 'Denuncia de perfil removida com sucesso.',
    })
    setProfileReportRemoving(false)
  }

  const avatarContent = (
    <UserAvatar
      name={visibleProfileLabel}
      avatarPath={activeProfile.avatar_path}
      imageClassName="avatar-img profile-avatar-large"
      fallbackClassName="avatar-placeholder-large profile-avatar-large"
      alt={`Foto de perfil de ${visibleProfileLabel}`}
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
                    {visibleFullName ? (
                      <p className="profile-handle">{visibleFullName}</p>
                    ) : null}
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

                      {canReportProfile ? (
                        <button
                          type="button"
                          className={`profile-report-button${currentProfileReport ? ' is-reported' : ''}`}
                          onClick={handleOpenProfileReportModal}
                          disabled={
                            profileReportLoading || profileReportSubmitting || profileReportRemoving
                          }
                          aria-label={profileReportButtonLabel}
                          title={profileReportButtonLabel}
                        >
                          {iconFlag(Boolean(currentProfileReport))}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                {!isRestrictedPublicView ? (
                  <div className={`profile-meta${!isOwnerView ? ' public-profile-meta' : ''}`}>
                    <div className="profile-meta-item">
                      <span>Membro desde</span>
                      <strong>{joinedDate}</strong>
                    </div>

                    {canOpenFollowersModal ? (
                      <button
                        type="button"
                        className="profile-meta-item profile-meta-item-button is-interactive"
                        onClick={() => handleOpenConnectionsModal('followers')}
                        aria-label={`Abrir lista de seguidores. ${followState.followersCount} seguidores.`}
                      >
                        <span>Seguidores</span>
                        <strong>{followState.followersCount}</strong>
                      </button>
                    ) : (
                      <div className="profile-meta-item profile-meta-item-button is-disabled">
                        <span>Seguidores</span>
                        <strong>{followLoading ? '...' : followState.followersCount}</strong>
                      </div>
                    )}

                    {canOpenFollowingModal ? (
                      <button
                        type="button"
                        className="profile-meta-item profile-meta-item-button is-interactive"
                        onClick={() => handleOpenConnectionsModal('following')}
                        aria-label={`Abrir lista de perfis seguidos. ${followState.followingCount} perfis seguidos.`}
                      >
                        <span>Seguindo</span>
                        <strong>{followState.followingCount}</strong>
                      </button>
                    ) : (
                      <div className="profile-meta-item profile-meta-item-button is-disabled">
                        <span>Seguindo</span>
                        <strong>{followLoading ? '...' : followState.followingCount}</strong>
                      </div>
                    )}
                  </div>
                ) : null}

                {isRestrictedPublicView ? (
                  <div className="profile-private-notice" role="status">
                    <span className="profile-section-label">Privacidade</span>
                    <h2>{restrictedProfileTitle}</h2>
                    <p>
                      {restrictedProfileMessage ||
                        'Este usuario escolheu limitar a visibilidade das informacoes do perfil.'}
                    </p>
                  </div>
                ) : isEditing && isOwnerView ? (
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
                        <span>Nome completo (opcional)</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={draftProfile.nome_completo}
                          onChange={event => handleDraftChange('nome_completo', event.target.value)}
                          placeholder="Nome completo (opcional)"
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

            {!isRestrictedPublicView ? (
              <ProfileTopFiveSection
                isOwnerView={Boolean(isOwnerView)}
                entries={topFiveEntries}
                onSaveTopFive={isOwnerView ? handleSaveTopFive : readOnlySaveTopFive}
              />
            ) : null}
          </section>

          {!isRestrictedPublicView ? (
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
                </button>

                <button
                  id="profile-tab-communities"
                  type="button"
                  role="tab"
                  className={`profile-tab-button${activeTab === 'communities' ? ' is-active' : ''}`}
                  aria-selected={activeTab === 'communities'}
                  aria-controls="profile-panel-communities"
                  onClick={() => setActiveTab('communities')}
                >
                  <span>Comunidades</span>
                </button>

                <button
                  id="profile-tab-community-posts"
                  type="button"
                  role="tab"
                  className={`profile-tab-button${activeTab === 'communityPosts' ? ' is-active' : ''}`}
                  aria-selected={activeTab === 'communityPosts'}
                  aria-controls="profile-panel-community-posts"
                  onClick={() => setActiveTab('communityPosts')}
                >
                  <span>Posts em comunidades</span>
                </button>

                {isOwnerView ? (
                  <button
                    id="profile-tab-saved-community-posts"
                    type="button"
                    role="tab"
                    className={`profile-tab-button${activeTab === 'savedCommunityPosts' ? ' is-active' : ''}`}
                    aria-selected={activeTab === 'savedCommunityPosts'}
                    aria-controls="profile-panel-saved-community-posts"
                    onClick={() => setActiveTab('savedCommunityPosts')}
                  >
                    <span>Posts salvos</span>
                  </button>
                ) : null}
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
                    key={`profile-status-${activeProfile.id}`}
                    userId={activeProfile.id}
                    items={statusItemsForView}
                    isLoading={statusSectionLoading}
                    errorMessage={statusError}
                    countLabel={statusCountLabel}
                    totalCount={statusPageState.totalCount}
                    hasMore={statusPageState.hasMore}
                    isLoadingMore={statusLoadingMore}
                    isOwnerView={Boolean(isOwnerView)}
                    onSaveStatus={isOwnerView ? handleSaveGameStatus : readOnlySaveStatus}
                    onDeleteStatus={isOwnerView ? handleDeleteStatus : readOnlyDeleteStatus}
                    onRefresh={handleRefreshStatusGames}
                    onLoadMore={handleLoadMoreStatusGames}
                    onControlsChange={handleStatusControlsChange}
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
                    key={`profile-wishlist-${activeProfile.id}`}
                    userId={activeProfile.id}
                    items={wishlistItemsForView}
                    isLoading={wishlistSectionLoading}
                    errorMessage={wishlistError}
                    countLabel={wishlistCountLabel}
                    totalCount={wishlistPageState.totalCount}
                    hasMore={wishlistPageState.hasMore}
                    isLoadingMore={wishlistLoadingMore}
                    isPreparingReorder={wishlistPreparingReorder}
                    isFullyLoaded={wishlistPageState.loaded && !wishlistPageState.hasMore}
                    isOwnerView={Boolean(isOwnerView)}
                    onDeleteWishlistItem={isOwnerView ? handleDeleteWishlistItem : readOnlyDeleteWishlist}
                    onLoadMore={handleLoadMoreWishlistGames}
                    onLoadFullWishlistForReorder={handleLoadFullWishlistForReorder}
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
                    key={`profile-reviews-${activeProfile.id}`}
                    items={reviewItemsForView}
                    isLoading={reviewsSectionLoading}
                    errorMessage={reviewsError}
                    countLabel={reviewsCountLabel}
                    totalCount={reviewsPageState.totalCount}
                    hasMore={reviewsPageState.hasMore}
                    isLoadingMore={reviewsLoadingMore}
                    isOwnerView={Boolean(isOwnerView)}
                    onDeleteReview={isOwnerView ? handleDeleteReview : undefined}
                    onLoadMore={handleLoadMoreReviews}
                  />
                ) : null}
              </div>

              <div
                id="profile-panel-communities"
                className="profile-tab-panel"
                role="tabpanel"
                aria-labelledby="profile-tab-communities"
                hidden={activeTab !== 'communities'}
              >
                {activeTab === 'communities' ? (
                  <ProfileCommunitiesSection
                    key={`profile-communities-${activeProfile.id}`}
                    profileId={activeProfile.id}
                    currentUserId={user?.id}
                    isOwnerView={Boolean(isOwnerView)}
                    kind="communities"
                  />
                ) : null}
              </div>

              <div
                id="profile-panel-community-posts"
                className="profile-tab-panel"
                role="tabpanel"
                aria-labelledby="profile-tab-community-posts"
                hidden={activeTab !== 'communityPosts'}
              >
                {activeTab === 'communityPosts' ? (
                  <ProfileCommunitiesSection
                    key={`profile-community-posts-${activeProfile.id}`}
                    profileId={activeProfile.id}
                    currentUserId={user?.id}
                    isOwnerView={Boolean(isOwnerView)}
                    kind="posts"
                  />
                ) : null}
              </div>

              {isOwnerView ? (
                <div
                  id="profile-panel-saved-community-posts"
                  className="profile-tab-panel"
                  role="tabpanel"
                  aria-labelledby="profile-tab-saved-community-posts"
                  hidden={activeTab !== 'savedCommunityPosts'}
                >
                  {activeTab === 'savedCommunityPosts' ? (
                    <ProfileCommunitiesSection
                      key={`profile-saved-community-posts-${activeProfile.id}`}
                      profileId={activeProfile.id}
                      currentUserId={user?.id}
                      isOwnerView={Boolean(isOwnerView)}
                      kind="saved"
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        {isProfileReportModalOpen && canReportProfile ? (
          <ProfileReportModal
            key={`${activeProfile.id}-${currentProfileReport?.id || 'new'}`}
            currentReport={currentProfileReport}
            feedback={profileReportFeedback}
            isSubmitting={profileReportSubmitting}
            isRemoving={profileReportRemoving}
            reportedUserLabel={profileReportTargetLabel}
            onClose={handleCloseProfileReportModal}
            onSubmit={handleSubmitProfileReport}
            onRemove={handleRemoveProfileReport}
          />
        ) : null}

        {isConnectionsModalOpen && !isRestrictedPublicView ? (
          <ProfileConnectionsModal
            initialTab={connectionsInitialTab}
            profileId={activeProfile.id}
            profileUsername={activeProfile.username || 'usuario'}
            profileDisplayName={activeProfile.nome_completo?.trim() || `@${activeProfile.username || 'usuario'}`}
            viewerId={user?.id}
            isOwnerView={Boolean(isOwnerView)}
            followersCount={followState.followersCount}
            followingCount={followState.followingCount}
            followersRefreshKey={followersRefreshKey}
            onClose={() => setIsConnectionsModalOpen(false)}
            onRefreshFollowState={refreshFollowState}
          />
        ) : null}
      </div>
    </div>
  )
}
