import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nContext'
import {
  getCommunitiesByUserId,
  getCommunityPostsByUserId,
  getSavedCommunityPostsByUserId,
  type CommunityPost,
  type CommunitySummary,
} from '../../services/communityService'
import { resolvePublicFileUrl } from '../../services/storageService'
import './ProfileCommunitiesSection.css'

type ProfileCommunitiesKind = 'communities' | 'posts' | 'saved'

interface ProfileCommunitiesSectionProps {
  profileId: string
  currentUserId?: string | null
  isOwnerView: boolean
  kind: ProfileCommunitiesKind
}

interface SectionState {
  communities: CommunitySummary[]
  posts: CommunityPost[]
  loading: boolean
  error: string | null
}

function getCommunityImage(community: CommunitySummary) {
  return resolvePublicFileUrl(community.banner_path) || community.jogo?.capa_url || null
}

function getPostImage(post: CommunityPost) {
  return resolvePublicFileUrl(post.imagem_path)
}

function getSectionCopy(
  kind: ProfileCommunitiesKind,
  isOwnerView: boolean,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (kind === 'communities') {
    return {
      kicker: t('profileCommunities.communities.kicker'),
      title: isOwnerView ? t('profileCommunities.communities.ownerTitle') : t('profileCommunities.communities.publicTitle'),
      text: isOwnerView
        ? t('profileCommunities.communities.ownerText')
        : t('profileCommunities.communities.publicText'),
      empty: isOwnerView
        ? t('profileCommunities.communities.ownerEmpty')
        : t('profileCommunities.communities.publicEmpty'),
    }
  }

  if (kind === 'saved') {
    return {
      kicker: t('profileCommunities.saved.kicker'),
      title: t('profileCommunities.saved.title'),
      text: t('profileCommunities.saved.text'),
      empty: isOwnerView
        ? t('profileCommunities.saved.ownerEmpty')
        : t('profileCommunities.saved.publicEmpty'),
    }
  }

  return {
    kicker: t('profileCommunities.posts.kicker'),
    title: isOwnerView ? t('profileCommunities.posts.ownerTitle') : t('profileCommunities.posts.publicTitle'),
    text: isOwnerView
      ? t('profileCommunities.posts.ownerText')
      : t('profileCommunities.posts.publicText'),
    empty: isOwnerView
      ? t('profileCommunities.posts.ownerEmpty')
      : t('profileCommunities.posts.publicEmpty'),
  }
}

export function ProfileCommunitiesSection({
  profileId,
  currentUserId,
  isOwnerView,
  kind,
}: ProfileCommunitiesSectionProps) {
  const { t, formatDate, formatNumber } = useI18n()
  const [state, setState] = useState<SectionState>({
    communities: [],
    posts: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    const loadSection = async () => {
      setState(currentState => ({ ...currentState, loading: true, error: null }))

      const result =
        kind === 'communities'
          ? await getCommunitiesByUserId(profileId, currentUserId)
          : kind === 'saved'
            ? await getSavedCommunityPostsByUserId(profileId, currentUserId)
            : await getCommunityPostsByUserId(profileId, currentUserId)

      if (!isMounted) return

      if (kind === 'communities') {
        setState({
          communities: result.data as CommunitySummary[],
          posts: [],
          loading: false,
          error: result.error?.message || null,
        })
        return
      }

      setState({
        communities: [],
        posts: result.data as CommunityPost[],
        loading: false,
        error: result.error?.message || null,
      })
    }

    void loadSection()

    return () => {
      isMounted = false
    }
  }, [currentUserId, kind, profileId])

  const copy = getSectionCopy(kind, isOwnerView, t)
  const hasItems =
    kind === 'communities' ? state.communities.length > 0 : state.posts.length > 0

  return (
    <section className="profile-card profile-communities-section">
      <div className="profile-card-glow profile-card-glow-left"></div>
      <div className="profile-card-glow profile-card-glow-right"></div>

      <div className="profile-communities-content">
        <div className="profile-section-head">
          <div className="profile-section-copy">
            <span className="profile-section-label">{copy.kicker}</span>
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
          </div>
        </div>

        {state.loading ? (
          <div className="profile-communities-empty">{t('common.loading')}</div>
        ) : state.error ? (
          <div className="profile-communities-empty">{state.error}</div>
        ) : !hasItems ? (
          <div className="profile-communities-empty">
            <p>{copy.empty}</p>
            {kind === 'communities' && isOwnerView ? (
              <Link to="/comunidades" className="profile-secondary-button">
                {t('profileCommunities.explore')}
              </Link>
            ) : null}
          </div>
        ) : kind === 'communities' ? (
          <div className="profile-communities-grid">
            {state.communities.map(community => {
              const imageUrl = getCommunityImage(community)

              return (
                <Link
                  key={community.id}
                  to={`/comunidades/${community.id}`}
                  className="profile-community-card"
                >
                  <div className="profile-community-media">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : (
                      <span>{community.nome.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="profile-community-card-copy">
                    <h3>{community.nome}</h3>
                    <p>{community.descricao || t('communities.noDescription')}</p>
                    <span>
                      {t('communities.about.membersPosts', {
                        members: formatNumber(community.membros_count),
                        posts: formatNumber(community.posts_count),
                      })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="profile-communities-grid">
            {state.posts.map(post => {
              const imageUrl = getPostImage(post)
              const communityName = post.comunidade?.nome || t('communities.kicker')

              return (
                <Link
                  key={post.id}
                  to={`/comunidades/${post.comunidade_id}`}
                  className="profile-community-card"
                >
                  <div className="profile-community-media">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : (
                      <span>{communityName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="profile-community-card-copy">
                    <span>{communityName}</span>
                    <h3>{post.texto || t('profileCommunities.imagePost')}</h3>
                    <p>{formatDate(post.created_at, { fallback: t('common.noDate') })}</p>
                    <span>
                      {t('profileCommunities.postStats', {
                        likes: formatNumber(post.curtidas_count),
                        comments: formatNumber(post.comentarios_count),
                      })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
