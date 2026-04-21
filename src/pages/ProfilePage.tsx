import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import type { ProfileUpdateError, UserProfile } from '../contexts/AuthContext'
import { ProfileGameStatusSection } from '../components/profile/ProfileGameStatusSection'
import { ProfileReviewsSection } from '../components/profile/ProfileReviewsSection'
import { ProfileTopFiveSection } from '../components/profile/ProfileTopFiveSection'
import { ProfileWishlistSection } from '../components/profile/ProfileWishlistSection'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import {
  deleteReview,
  getReviewsByUserId,
  type ProfileReviewItem,
  type ReviewError,
} from '../services/reviewService'
import {
  deleteGameStatus,
  getGameStatusesByUserId,
  saveGameStatus,
  type GameStatusError,
  type GameStatusItem,
  type GameStatusValue,
} from '../services/gameStatusService'
import { uploadAvatarImage } from '../services/storageService'
import {
  deleteWishlistEntry,
  getWishlistGamesByUserId,
  type WishlistGameItem,
} from '../services/wishlistService'
import {
  getTopFiveEntriesFromPrivacySettings,
  mergeTopFiveEntriesIntoPrivacySettings,
  type TopFiveStoredEntry,
} from '../utils/profileTopFive'
import './ProfilePage.css'

type FeedbackTone = 'success' | 'error'

interface FeedbackState {
  tone: FeedbackTone
  message: string
}

interface ProfileDraft {
  nome_completo: string
  username: string
  bio: string
}

type ProfileTab = 'status' | 'wishlist' | 'reviews'

const createProfileDraft = (profile: UserProfile | null): ProfileDraft => ({
  nome_completo: profile?.nome_completo || '',
  username: profile?.username || '',
  bio: profile?.bio || '',
})

const getProfileErrorMessage = (error: ProfileUpdateError | null) => {
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

const getWishlistErrorMessage = (error: {
  code?: string
  message: string
  details?: string | null
  hint?: string | null
} | null, action: 'load' | 'delete' = 'load') => {
  if (!error) {
    return action === 'load'
      ? 'Nao foi possivel carregar sua lista de desejos agora.'
      : 'Nao foi possivel remover este jogo da wishlist agora.'
  }

  const fullMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()

  if (
    error.code === '42501' ||
    fullMessage.includes('permission denied') ||
    fullMessage.includes('row-level security') ||
    fullMessage.includes('policy')
  ) {
    return action === 'load'
      ? 'Nao foi possivel carregar a lista de desejos por permissao. Verifique as policies da tabela lista_desejos no Supabase.'
      : 'Nao foi possivel remover este jogo da wishlist por permissao. Verifique as policies DELETE da tabela lista_desejos no Supabase.'
  }

  return action === 'load'
    ? 'Nao foi possivel carregar sua lista de desejos agora.'
    : 'Nao foi possivel remover este jogo da wishlist agora.'
}

const getGameStatusErrorMessage = (
  error: GameStatusError | null,
  action: 'load' | 'save' | 'delete'
) => {
  if (!error) {
    return action === 'load'
      ? 'Nao foi possivel carregar os status dos jogos agora.'
      : action === 'save'
        ? 'Nao foi possivel salvar o status deste jogo agora.'
        : 'Nao foi possivel remover este jogo do perfil agora.'
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

  return action === 'load'
    ? 'Nao foi possivel carregar os status dos jogos agora.'
    : action === 'save'
      ? 'Nao foi possivel salvar o status deste jogo agora.'
      : 'Nao foi possivel remover este jogo do perfil agora.'
}

const getReviewErrorMessage = (error: ReviewError | null, action: 'load' | 'delete' = 'load') => {
  if (!error) {
    return action === 'delete'
      ? 'Nao foi possivel apagar esta review agora.'
      : 'Nao foi possivel carregar suas reviews agora.'
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
      : 'Nao foi possivel carregar suas reviews por permissao. Verifique as policies das tabelas avaliacoes e jogos no Supabase.'
  }

  if (fullMessage.includes('column')) {
    return action === 'delete'
      ? 'Nao foi possivel apagar a review porque a estrutura da tabela avaliacoes nao corresponde ao frontend.'
      : 'Nao foi possivel carregar suas reviews porque a estrutura das tabelas nao corresponde ao frontend.'
  }

  return action === 'delete'
    ? error.message || 'Nao foi possivel apagar esta review agora.'
    : 'Nao foi possivel carregar suas reviews agora.'
}

export function ProfilePage() {
  const { user, profile, loading, updateOwnProfile } = useAuth()
  const [draftProfile, setDraftProfile] = useState<ProfileDraft>(() => createProfileDraft(null))
  const [activeTab, setActiveTab] = useState<ProfileTab>('status')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null)
  const [avatarFeedback, setAvatarFeedback] = useState<FeedbackState | null>(null)
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
    if (profile && !isEditing) {
      setDraftProfile(createProfileDraft(profile))
      return
    }

    if (!profile && !isEditing) {
      setDraftProfile(createProfileDraft(null))
    }
  }, [profile, isEditing])

  useEffect(() => {
    setActiveTab('status')
  }, [profile?.id])

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
        loadStatusGames(profile.id),
        getWishlistGamesByUserId(profile.id),
        getReviewsByUserId(profile.id),
      ])

      if (!isMounted) return

      if (statusResult.error) {
        setStatusGames([])
        setStatusError(getGameStatusErrorMessage(statusResult.error, 'load'))
      } else {
        setStatusGames(statusResult.data)
      }

      if (wishlistResult.error) {
        console.error('Erro ao carregar wishlist do perfil:', wishlistResult.error)
        setWishlistGames([])
        setWishlistError(getWishlistErrorMessage(wishlistResult.error, 'load'))
      } else {
        setWishlistGames(wishlistResult.data)
      }

      if (reviewsResult.error) {
        console.error('Erro ao carregar reviews do perfil:', reviewsResult.error)
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
  }, [loadStatusGames, profile])

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Carregando perfil</h1>
            <p>Estamos buscando suas informacoes.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">Perfil</span>
            <h1>Faça login para acessar seu perfil</h1>
            <p>Entre na sua conta para visualizar e editar seus dados.</p>
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
            <h1>Perfil indisponivel</h1>
            <p>Nao foi possivel carregar seus dados agora. Tente novamente em instantes.</p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnerView = Boolean(user && profile && user.id === profile.id)
  const joinedDate = profile.data_cadastro
    ? new Date(profile.data_cadastro).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data nao informada'

  const visibleFullName = draftProfile.nome_completo || 'Nome nao informado'
  const visibleUsername = draftProfile.username || 'usuario'
  const visibleBio = draftProfile.bio.trim()
  const statusCountLabel =
    statusGames.length === 1 ? '1 jogo com status' : `${statusGames.length} jogos com status`
  const wishlistCountLabel =
    wishlistGames.length === 1 ? '1 jogo salvo' : `${wishlistGames.length} jogos salvos`
  const reviewsCountLabel =
    userReviews.length === 1 ? '1 review publicada' : `${userReviews.length} reviews publicadas`

  const resetDraft = () => {
    setDraftProfile(createProfileDraft(profile))
  }

  const handleStartEditing = () => {
    if (!isOwnerView) return

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
    setDraftProfile((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !isOwnerView) return

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
          message: getProfileErrorMessage(error),
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
    if (!isOwnerView) return

    const trimmedName = draftProfile.nome_completo.trim()
    const trimmedUsername = draftProfile.username.trim()
    const trimmedBio = draftProfile.bio.trim()
    const currentName = profile.nome_completo?.trim() || ''
    const currentUsername = profile.username?.trim() || ''
    const currentBio = profile.bio?.trim() || ''

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
          message: getProfileErrorMessage(error),
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
    if (!profile) {
      setStatusGames([])
      setStatusError(null)
      setStatusLoading(false)
      return
    }

    setStatusLoading(true)
    setStatusError(null)

    const { data, error } = await loadStatusGames(profile.id)

    if (error) {
      setStatusGames([])
      setStatusError(getGameStatusErrorMessage(error, 'load'))
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
    if (!profile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para salvar este status.',
      }
    }

    const { error } = await saveGameStatus({
      userId: profile.id,
      gameId,
      status,
      favorito,
    })

    if (error) {
      return {
        ok: false,
        message: getGameStatusErrorMessage(error, 'save'),
      }
    }

    const { data, error: reloadError } = await loadStatusGames(profile.id)

    if (reloadError) {
      setStatusError(getGameStatusErrorMessage(reloadError, 'load'))
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
    if (!profile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para remover este jogo.',
      }
    }

    const { error } = await deleteGameStatus({
      userId: profile.id,
      statusId: itemId,
    })

    if (error) {
      return {
        ok: false,
        message: getGameStatusErrorMessage(error, 'delete'),
      }
    }

    setStatusGames(currentItems => currentItems.filter(item => item.id !== itemId))
    setStatusError(null)

    return {
      ok: true,
    }
  }

  const handleDeleteWishlistItem = async (itemId: string) => {
    if (!profile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para remover este jogo.',
      }
    }

    const { error } = await deleteWishlistEntry({
      userId: profile.id,
      wishlistEntryId: itemId,
    })

    if (error) {
      return {
        ok: false,
        message: getWishlistErrorMessage(error, 'delete'),
      }
    }

    setWishlistGames(currentItems => currentItems.filter(item => item.id !== itemId))
    setWishlistError(null)

    return {
      ok: true,
    }
  }

  const handleSaveTopFive = async (entries: TopFiveStoredEntry[]) => {
    if (!profile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para atualizar o Top 5.',
      }
    }

    const nextPrivacySettings = mergeTopFiveEntriesIntoPrivacySettings(
      profile.configuracoes_privacidade,
      entries
    )

    const { data, error } = await updateOwnProfile({
      configuracoes_privacidade: nextPrivacySettings,
    })

    if (error || !data) {
      return {
        ok: false,
        message: getProfileErrorMessage(error),
      }
    }

    return {
      ok: true,
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!profile) {
      return {
        ok: false,
        message: 'Nao foi possivel identificar o perfil para apagar esta review.',
      }
    }

    const result = await deleteReview({
      userId: profile.id,
      reviewId,
    })

    if (!result.ok) {
      return {
        ok: false,
        message: getReviewErrorMessage(result.error, 'delete'),
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

  const avatarContent = (
    <UserAvatar
      name={visibleFullName}
      avatarPath={profile.avatar_path}
      imageClassName="avatar-img profile-avatar-large"
      fallbackClassName="avatar-placeholder-large profile-avatar-large"
      alt={`Foto de perfil de ${visibleFullName}`}
    />
  )

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="profile-page">
          <section className="profile-card">
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

                {avatarFeedback && (
                  <p className={`profile-feedback profile-feedback-center is-${avatarFeedback.tone}`}>
                    {avatarFeedback.message}
                  </p>
                )}
              </div>

              <div className="profile-info-column">
                <div className="profile-info-header">
                  <div className="profile-heading">
                    <span className="profile-eyebrow">Perfil</span>
                    <h1>@{visibleUsername}</h1>
                    <p className="profile-handle">{visibleFullName}</p>
                  </div>

                  {isOwnerView && (
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
                  )}
                </div>

                <div className="profile-meta">
                  <div className="profile-meta-item">
                    <span>Membro desde</span>
                    <strong>{joinedDate}</strong>
                  </div>
                </div>

                {isEditing ? (
                  <form
                    className="profile-form"
                    onSubmit={(event) => {
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
                            onChange={(event) => handleDraftChange('username', event.target.value)}
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
                          onChange={(event) => handleDraftChange('nome_completo', event.target.value)}
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
                        onChange={(event) => handleDraftChange('bio', event.target.value)}
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

                {saveFeedback && (
                  <p className={`profile-feedback is-${saveFeedback.tone}`}>{saveFeedback.message}</p>
                )}
              </div>
            </div>

            <ProfileTopFiveSection
              isOwnerView={isOwnerView}
              entries={getTopFiveEntriesFromPrivacySettings(profile.configuracoes_privacidade)}
              onSaveTopFive={handleSaveTopFive}
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
                <span>Wishlist</span>
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
                  userId={profile.id}
                  items={statusGames}
                  isLoading={statusLoading}
                  errorMessage={statusError}
                  countLabel={statusCountLabel}
                  isOwnerView={isOwnerView}
                  onSaveStatus={handleSaveGameStatus}
                  onDeleteStatus={handleDeleteStatus}
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
                  userId={profile.id}
                  items={wishlistGames}
                  isLoading={wishlistLoading}
                  errorMessage={wishlistError}
                  countLabel={wishlistCountLabel}
                  isOwnerView={isOwnerView}
                  onDeleteWishlistItem={handleDeleteWishlistItem}
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
                  isOwnerView={isOwnerView}
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
