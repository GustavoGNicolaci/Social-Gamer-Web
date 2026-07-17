import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { ProfileConnectionsModal } from '../components/profile/ProfileConnectionsModal'
import { ProfileCommunitiesSection } from '../components/profile/ProfileCommunitiesSection'
import { ProfileGameStatusSection } from '../components/profile/ProfileGameStatusSection'
import { ProfileReportModal } from '../components/profile/ProfileReportModal'
import { ProfileReviewsSection } from '../components/profile/ProfileReviewsSection'
import { ProfileTopFiveSection } from '../components/profile/ProfileTopFiveSection'
import { ProfileWishlistSection } from '../components/profile/ProfileWishlistSection'
import { useAuth } from '../contexts/AuthContext'
import {
  useProfileCollections,
  type ProfileTab,
} from '../features/profile/hooks/useProfileCollections'
import { useProfileEditor } from '../features/profile/hooks/useProfileEditor'
import { useProfileFollow } from '../features/profile/hooks/useProfileFollow'
import { useProfileReport } from '../features/profile/hooks/useProfileReport'
import { useResolvedProfile } from '../features/profile/hooks/useResolvedProfile'
import { useI18n } from '../i18n/I18nContext'
import type { GameStatusValue } from '../services/gameStatusService'
import type { TopFiveStoredEntry } from '../utils/profileTopFive'
import './ProfilePage.css'


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


const readOnlySaveStatus = async (_params: {
  gameId: number
  status: GameStatusValue
  favorito: boolean
}) => {
  void _params
  return {
    ok: false,
    message: 'Only the profile owner can change this data.',
  }
}

const readOnlyDeleteStatus = async (_itemId: string) => {
  void _itemId
  return {
    ok: false,
    message: 'Only the profile owner can change this data.',
  }
}

const readOnlyDeleteWishlist = async (_itemId: string) => {
  void _itemId
  return {
    ok: false,
    message: 'Only the profile owner can change this data.',
  }
}

const readOnlySaveTopFive = async (_entries: TopFiveStoredEntry[]) => {
  void _entries
  return {
    ok: false,
    message: 'Only the profile owner can change this data.',
  }
}

export function ProfilePage() {
  const { username } = useParams()
  const { t, formatDate } = useI18n()
  const requestedUsername = username?.trim() || ''
  const { user, profile, loading, updateOwnProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>('status')

  const {
    activeProfile,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    isUsernameRoute,
    pageLoading,
    publicProfile,
    publicProfileError,
    refreshPublicProfile,
    resolvedProfile,
    topFiveEntries,
  } = useResolvedProfile({
    requestedUsername,
    user,
    ownProfile: profile,
    authLoading: loading,
  })

  const {
    avatarFeedback,
    draftProfile,
    handleAvatarChange,
    handleCancelEditing,
    handleDraftChange,
    handleSaveProfile,
    handleSaveTopFive,
    handleStartEditing,
    isEditing,
    isSaving,
    isUploadingAvatar,
    saveFeedback,
  } = useProfileEditor({
    editableProfile,
    user,
    updateOwnProfile,
  })

  const {
    handleDeleteReview,
    handleDeleteStatus,
    handleDeleteWishlistItem,
    handleLoadFullWishlistForReorder,
    handleLoadMoreReviews,
    handleLoadMoreStatusGames,
    handleLoadMoreWishlistGames,
    handleRefreshStatusGames,
    handleSaveGameStatus,
    handleStatusControlsChange,
    hasCurrentCollections,
    loadedProfileTabs,
    reviewItemsForView,
    reviewsError,
    reviewsLoading,
    reviewsLoadingMore,
    reviewsPageState,
    statusError,
    statusItemsForView,
    statusLoading,
    statusLoadingMore,
    statusPageState,
    wishlistError,
    wishlistItemsForView,
    wishlistLoading,
    wishlistLoadingMore,
    wishlistPageState,
    wishlistPreparingReorder,
  } = useProfileCollections({
    activeProfile,
    activeTab,
    editableProfile,
    isOwnerView,
    isRestrictedPublicView,
    userId: user?.id,
  })

  const {
    closeConnectionsModal,
    connectionsInitialTab,
    followFeedback,
    followLoading,
    followState,
    followSubmitting,
    followersRefreshKey,
    handleOpenConnectionsModal,
    handleToggleFollow,
    isConnectionsModalOpen,
    refreshFollowState,
  } = useProfileFollow({
    activeProfile,
    isRestrictedPublicView,
    onFollowChanged: refreshPublicProfile,
    user,
  })

  const {
    canReportProfile,
    currentProfileReport,
    handleCloseProfileReportModal,
    handleOpenProfileReportModal,
    handleRemoveProfileReport,
    handleSubmitProfileReport,
    isProfileReportModalOpen,
    profileReportFeedback,
    profileReportLoading,
    profileReportRemoving,
    profileReportSubmitting,
  } = useProfileReport({
    activeProfile,
    isOwnerView,
    user,
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveTab('status')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeProfile?.id])

  if (pageLoading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="profile-state-card">
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.loadingTitle')}</h1>
            <p>{t('profile.loadingText')}</p>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.loginTitle')}</h1>
            <p>{t('profile.loginText')}</p>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.unavailableTitle')}</h1>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.unavailableTitle')}</h1>
            <p>{t('profile.ownLoadError')}</p>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.notFoundTitle')}</h1>
            <p>{t('profile.notFoundText')}</p>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.unavailableTitle')}</h1>
            <p>{t('profile.editableLoadError')}</p>
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
            <span className="profile-state-badge">{t('common.profile')}</span>
            <h1>{t('profile.unavailableTitle')}</h1>
            <p>{t('profile.pageLoadError')}</p>
          </div>
        </div>
      </div>
    )
  }

  const joinedDate = formatDate(activeProfile.data_cadastro, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    fallback: t('profile.dateFallback'),
  })
  const visibleFullName = isEditing
    ? draftProfile.nome_completo.trim()
    : activeProfile.nome_completo?.trim() || ''
  const visibleUsername = isEditing ? draftProfile.username || 'usuario' : activeProfile.username || 'usuario'
  const visibleProfileLabel = visibleFullName || visibleUsername
  const visibleBio = isEditing ? draftProfile.bio.trim() : activeProfile.bio?.trim() || ''
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
        ? t('profile.statusCountOne')
        : t('profile.statusCountMany', { count: statusTotalCount })
  const wishlistCountLabel =
    wishlistSectionLoading
      ? '...'
      : wishlistTotalCount === 1
        ? t('profile.wishlistCountOne')
        : t('profile.wishlistCountMany', { count: wishlistTotalCount })
  const reviewsCountLabel =
    reviewsSectionLoading
      ? '...'
      : reviewsTotalCount === 1
        ? t('profile.reviewsCountOne')
        : t('profile.reviewsCountMany', { count: reviewsTotalCount })
  const followButtonLabel = followSubmitting
    ? followState.isFollowing
      ? t('profile.followUpdating')
      : t('profile.followPending')
    : followState.isFollowing
      ? t('common.unfollow')
      : t('common.follow')
  const restrictedProfileTitle =
    resolvedProfile?.kind === 'public' && resolvedProfile.data.privacyMode === 'friends'
      ? t('profile.restrictedFriendsTitle')
      : t('profile.restrictedPrivateTitle')
  const restrictedProfileMessage =
    resolvedProfile?.kind === 'public'
      ? resolvedProfile.data.privacyMode === 'friends'
        ? t('profile.restricted.friends')
        : t('profile.restricted.private')
      : null
  const sectionEyebrow = isRestrictedPublicView
    ? restrictedProfileTitle
    : isOwnerView
      ? t('profile.ownerEyebrow')
      : t('profile.publicEyebrow')
  const canOpenFollowersModal =
    !isRestrictedPublicView && !followLoading && followState.followersCount > 0
  const canOpenFollowingModal =
    !isRestrictedPublicView && !followLoading && followState.followingCount > 0
  const profileReportButtonLabel = profileReportLoading
    ? t('profile.reportLoading')
    : currentProfileReport
      ? t('profile.reportDetails')
      : t('profile.reportProfile')
  const profileReportTargetLabel = activeProfile.username
    ? t('profile.reportTargetProfile', { username: activeProfile.username })
    : t('profile.reportTargetThis')

  const avatarContent = (
    <UserAvatar
      name={visibleProfileLabel}
      avatarPath={activeProfile.avatar_path}
      imageClassName="avatar-img profile-avatar-large"
      fallbackClassName="avatar-placeholder-large profile-avatar-large"
      alt={t('profile.avatarAlt', { name: visibleProfileLabel })}
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
                      title={t('profile.avatarTitle')}
                    >
                      {avatarContent}
                      <span className="profile-avatar-overlay">
                        {isUploadingAvatar ? t('profile.uploadingPhoto') : t('profile.changePhoto')}
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
                      aria-label={isEditing ? t('profile.cancelEdit') : t('profile.editProfile')}
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
                      <span>{isEditing ? t('common.cancel') : t('profile.edit')}</span>
                    </button>
                  ) : (
                    <div className="public-profile-actions">
                      {!user ? (
                        <Link to="/login" className="profile-secondary-button public-profile-follow-link">
                          {t('profile.loginToFollow')}
                        </Link>
                      ) : followState.isFollowing ? (
                        <>
                          <span className="public-profile-follow-status">{t('profile.followingStatus')}</span>
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
                      <span>{t('profile.memberSince')}</span>
                      <strong>{joinedDate}</strong>
                    </div>

                    {canOpenFollowersModal ? (
                      <button
                        type="button"
                        className="profile-meta-item profile-meta-item-button is-interactive"
                        onClick={() => handleOpenConnectionsModal('followers')}
                        aria-label={t('profile.followersAria', { count: followState.followersCount })}
                      >
                        <span>{t('common.followers')}</span>
                        <strong>{followState.followersCount}</strong>
                      </button>
                    ) : (
                      <div className="profile-meta-item profile-meta-item-button is-disabled">
                        <span>{t('common.followers')}</span>
                        <strong>{followLoading ? '...' : followState.followersCount}</strong>
                      </div>
                    )}

                    {canOpenFollowingModal ? (
                      <button
                        type="button"
                        className="profile-meta-item profile-meta-item-button is-interactive"
                        onClick={() => handleOpenConnectionsModal('following')}
                        aria-label={t('profile.followingAria', { count: followState.followingCount })}
                      >
                        <span>{t('common.following')}</span>
                        <strong>{followState.followingCount}</strong>
                      </button>
                    ) : (
                      <div className="profile-meta-item profile-meta-item-button is-disabled">
                        <span>{t('common.following')}</span>
                        <strong>{followLoading ? '...' : followState.followingCount}</strong>
                      </div>
                    )}
                  </div>
                ) : null}

                {isRestrictedPublicView ? (
                  <div className="profile-private-notice" role="status">
                    <span className="profile-section-label">{t('profile.privacyLabel')}</span>
                    <h2>{restrictedProfileTitle}</h2>
                    <p>
                      {restrictedProfileMessage ||
                        t('profile.privateFallback')}
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
                        <span>{t('common.username')}</span>
                        <div className="profile-input-wrap">
                          <span className="profile-input-prefix">@</span>
                          <input
                            type="text"
                            className="profile-input profile-input-plain"
                            value={draftProfile.username}
                            onChange={event => handleDraftChange('username', event.target.value)}
                            placeholder={t('profile.usernamePlaceholder')}
                            disabled={isSaving}
                          />
                        </div>
                      </label>

                      <label className="profile-field">
                        <span>{t('common.fullNameOptional')}</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={draftProfile.nome_completo}
                          onChange={event => handleDraftChange('nome_completo', event.target.value)}
                          placeholder={t('common.fullNameOptional')}
                          disabled={isSaving}
                        />
                      </label>
                    </div>

                    <label className="profile-field">
                      <span>{t('common.bio')}</span>
                      <textarea
                        className="profile-textarea"
                        value={draftProfile.bio}
                        onChange={event => handleDraftChange('bio', event.target.value)}
                        maxLength={220}
                        placeholder={t('profile.bioPlaceholder')}
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
                          {t('common.cancel')}
                        </button>

                        <button type="submit" className="profile-save-button" disabled={isSaving}>
                          {isSaving ? t('common.saving') : t('profile.saveChanges')}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="profile-bio-block">
                    <span className="profile-section-label">{t('common.bio')}</span>
                    <p className={`profile-bio-copy${visibleBio ? '' : ' is-empty'}`}>
                      {visibleBio || t('profile.noBio')}
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
            <section className="profile-tabs-shell" aria-label={t('profile.contentLabel')}>
              <div className="profile-tabs" role="tablist" aria-label={t('profile.navigationLabel')}>
                <button
                  id="profile-tab-status"
                  type="button"
                  role="tab"
                  className={`profile-tab-button${activeTab === 'status' ? ' is-active' : ''}`}
                  aria-selected={activeTab === 'status'}
                  aria-controls="profile-panel-status"
                  onClick={() => setActiveTab('status')}
                >
                  <span>{t('profile.tab.status')}</span>
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
                  <span>{t('profile.tab.wishlist')}</span>
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
                  <span>{t('profile.tab.reviews')}</span>
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
                  <span>{t('communities.nav')}</span>
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
                  <span>{t('profileCommunities.posts.kicker')}</span>
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
                    <span>{t('profileCommunities.saved.title')}</span>
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
            onClose={closeConnectionsModal}
            onRefreshFollowState={refreshFollowState}
          />
        ) : null}
      </div>
    </div>
  )
}
