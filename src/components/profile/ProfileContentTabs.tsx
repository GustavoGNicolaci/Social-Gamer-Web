import type { ReactNode } from 'react'
import type { ProfileTab } from '../../features/profile/hooks/useProfileCollections'

interface ProfileContentTabsProps {
  activeTab: ProfileTab
  isOwnerView: boolean
  contentLabel: string
  navigationLabel: string
  statusLabel: string
  wishlistLabel: string
  reviewsLabel: string
  communitiesLabel: string
  communityPostsLabel: string
  savedCommunityPostsLabel: string
  statusPanel: ReactNode
  wishlistPanel: ReactNode
  reviewsPanel: ReactNode
  communitiesPanel: ReactNode
  communityPostsPanel: ReactNode
  savedCommunityPostsPanel: ReactNode
  onTabChange: (tab: ProfileTab) => void
}

export function ProfileContentTabs({
  activeTab,
  isOwnerView,
  contentLabel,
  navigationLabel,
  statusLabel,
  wishlistLabel,
  reviewsLabel,
  communitiesLabel,
  communityPostsLabel,
  savedCommunityPostsLabel,
  statusPanel,
  wishlistPanel,
  reviewsPanel,
  communitiesPanel,
  communityPostsPanel,
  savedCommunityPostsPanel,
  onTabChange,
}: ProfileContentTabsProps) {
  return (
    <section className="profile-tabs-shell" aria-label={contentLabel}>
      <div className="profile-tabs" role="tablist" aria-label={navigationLabel}>
        <button
          id="profile-tab-status"
          type="button"
          role="tab"
          className={`profile-tab-button${activeTab === 'status' ? ' is-active' : ''}`}
          aria-selected={activeTab === 'status'}
          aria-controls="profile-panel-status"
          onClick={() => onTabChange('status')}
        >
          <span>{statusLabel}</span>
        </button>

        <button
          id="profile-tab-wishlist"
          type="button"
          role="tab"
          className={`profile-tab-button${activeTab === 'wishlist' ? ' is-active' : ''}`}
          aria-selected={activeTab === 'wishlist'}
          aria-controls="profile-panel-wishlist"
          onClick={() => onTabChange('wishlist')}
        >
          <span>{wishlistLabel}</span>
        </button>

        <button
          id="profile-tab-reviews"
          type="button"
          role="tab"
          className={`profile-tab-button${activeTab === 'reviews' ? ' is-active' : ''}`}
          aria-selected={activeTab === 'reviews'}
          aria-controls="profile-panel-reviews"
          onClick={() => onTabChange('reviews')}
        >
          <span>{reviewsLabel}</span>
        </button>

        <button
          id="profile-tab-communities"
          type="button"
          role="tab"
          className={`profile-tab-button${activeTab === 'communities' ? ' is-active' : ''}`}
          aria-selected={activeTab === 'communities'}
          aria-controls="profile-panel-communities"
          onClick={() => onTabChange('communities')}
        >
          <span>{communitiesLabel}</span>
        </button>

        <button
          id="profile-tab-community-posts"
          type="button"
          role="tab"
          className={`profile-tab-button${activeTab === 'communityPosts' ? ' is-active' : ''}`}
          aria-selected={activeTab === 'communityPosts'}
          aria-controls="profile-panel-community-posts"
          onClick={() => onTabChange('communityPosts')}
        >
          <span>{communityPostsLabel}</span>
        </button>

        {isOwnerView ? (
          <button
            id="profile-tab-saved-community-posts"
            type="button"
            role="tab"
            className={`profile-tab-button${activeTab === 'savedCommunityPosts' ? ' is-active' : ''}`}
            aria-selected={activeTab === 'savedCommunityPosts'}
            aria-controls="profile-panel-saved-community-posts"
            onClick={() => onTabChange('savedCommunityPosts')}
          >
            <span>{savedCommunityPostsLabel}</span>
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
        {activeTab === 'status' ? statusPanel : null}
      </div>

      <div
        id="profile-panel-wishlist"
        className="profile-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-tab-wishlist"
        hidden={activeTab !== 'wishlist'}
      >
        {activeTab === 'wishlist' ? wishlistPanel : null}
      </div>

      <div
        id="profile-panel-reviews"
        className="profile-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-tab-reviews"
        hidden={activeTab !== 'reviews'}
      >
        {activeTab === 'reviews' ? reviewsPanel : null}
      </div>

      <div
        id="profile-panel-communities"
        className="profile-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-tab-communities"
        hidden={activeTab !== 'communities'}
      >
        {activeTab === 'communities' ? communitiesPanel : null}
      </div>

      <div
        id="profile-panel-community-posts"
        className="profile-tab-panel"
        role="tabpanel"
        aria-labelledby="profile-tab-community-posts"
        hidden={activeTab !== 'communityPosts'}
      >
        {activeTab === 'communityPosts' ? communityPostsPanel : null}
      </div>

      {isOwnerView ? (
        <div
          id="profile-panel-saved-community-posts"
          className="profile-tab-panel"
          role="tabpanel"
          aria-labelledby="profile-tab-saved-community-posts"
          hidden={activeTab !== 'savedCommunityPosts'}
        >
          {activeTab === 'savedCommunityPosts'
            ? savedCommunityPostsPanel
            : null}
        </div>
      ) : null}
    </section>
  )
}
