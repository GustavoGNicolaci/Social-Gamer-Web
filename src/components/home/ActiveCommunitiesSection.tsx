import { Link } from 'react-router-dom'
import { MessageSquare, TrendingUp, Users } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { type HomeActiveCommunity } from '../../services/homeService'
import { resolvePublicFileUrl } from '../../services/storageService'

interface ActiveCommunitiesSectionProps {
  items: HomeActiveCommunity[]
  isLoading: boolean
  errorMessage: string | null
}

function getCommunityImage(community: HomeActiveCommunity) {
  return resolvePublicFileUrl(community.bannerPath) || community.game?.coverUrl || null
}

function getInitial(value: string) {
  const firstCharacter = value.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'C'
}

export function ActiveCommunitiesSection({
  items,
  isLoading,
  errorMessage,
}: ActiveCommunitiesSectionProps) {
  const { t, formatNumber } = useI18n()

  const getActivityLabel = (community: HomeActiveCommunity) => {
    if (community.newMembersCount > 0) {
      return t('home.communities.newMembers', {
        count: formatNumber(community.newMembersCount),
      })
    }

    if (community.recentPostsCount > 0) {
      return t('home.communities.recentPosts', {
        count: formatNumber(community.recentPostsCount),
      })
    }

    return t('home.communities.memberTotal', {
      count: formatNumber(community.membersCount),
    })
  }

  return (
    <section className="home-section home-active-communities-section">
      <div className="home-section-head">
        <div>
          <span className="home-eyebrow">{t('home.communities.eyebrow')}</span>
          <h2>{t('home.communities.title')}</h2>
          <p>{t('home.communities.description')}</p>
        </div>

        <Link to="/comunidades" className="home-inline-link">
          {t('home.communities.viewAll')}
        </Link>
      </div>

      {isLoading ? (
        <div className="home-active-communities-grid" aria-label={t('home.communities.loading')}>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`active-community-skeleton-${index}`}
              className="home-active-community-card is-skeleton"
              aria-hidden="true"
            >
              <span className="home-active-community-skeleton-media" />
              <span className="home-active-community-skeleton-line is-short" />
              <span className="home-active-community-skeleton-line" />
              <span className="home-active-community-skeleton-line" />
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="home-empty-state is-error">
          <p>{errorMessage}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="home-empty-state">
          <p>{t('home.communities.empty')}</p>
        </div>
      ) : (
        <div className="home-active-communities-grid">
          {items.map(community => {
            const imageUrl = getCommunityImage(community)

            return (
              <Link
                key={community.id}
                to={`/comunidades/${community.id}`}
                className="home-active-community-card"
              >
                <div className="home-active-community-media">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="home-active-community-fallback">
                      {getInitial(community.name)}
                    </div>
                  )}
                </div>

                <div className="home-active-community-copy">
                  <div className="home-active-community-kicker">
                    <TrendingUp size={15} aria-hidden="true" />
                    <span>{getActivityLabel(community)}</span>
                  </div>

                  <h3>{community.name}</h3>
                  <p>{community.description || t('communities.noDescription')}</p>
                </div>

                <div className="home-active-community-stats">
                  <span>
                    <Users size={15} aria-hidden="true" />
                    {t('home.communities.members', {
                      count: formatNumber(community.membersCount),
                    })}
                  </span>
                  <span>
                    <MessageSquare size={15} aria-hidden="true" />
                    {t('home.communities.posts', {
                      count: formatNumber(community.postsCount),
                    })}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
