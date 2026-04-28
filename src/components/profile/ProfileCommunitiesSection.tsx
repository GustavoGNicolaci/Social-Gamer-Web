import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

function formatDate(value: string) {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Data nao informada'

  return parsedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getSectionCopy(kind: ProfileCommunitiesKind, isOwnerView: boolean) {
  if (kind === 'communities') {
    return {
      kicker: 'Comunidades',
      title: isOwnerView ? 'Suas comunidades' : 'Comunidades deste perfil',
      text: isOwnerView
        ? 'Espacos dos quais voce participa.'
        : 'Espacos em que este usuario participa.',
      empty: isOwnerView
        ? 'Voce ainda nao participa de comunidades.'
        : 'Este perfil ainda nao participa de comunidades visiveis.',
    }
  }

  if (kind === 'saved') {
    return {
      kicker: 'Posts salvos',
      title: 'Posts salvos',
      text: 'Posts de comunidades que voce marcou para rever depois.',
      empty: isOwnerView
        ? 'Voce ainda nao salvou posts de comunidades.'
        : 'Posts salvos ficam visiveis apenas para o dono do perfil.',
    }
  }

  return {
    kicker: 'Posts',
    title: isOwnerView ? 'Seus posts em comunidades' : 'Posts deste perfil',
    text: isOwnerView
      ? 'Publicacoes que voce criou nas comunidades.'
      : 'Publicacoes criadas por este usuario nas comunidades.',
    empty: isOwnerView
      ? 'Voce ainda nao criou posts em comunidades.'
      : 'Este perfil ainda nao criou posts em comunidades.',
  }
}

export function ProfileCommunitiesSection({
  profileId,
  currentUserId,
  isOwnerView,
  kind,
}: ProfileCommunitiesSectionProps) {
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

  const copy = getSectionCopy(kind, isOwnerView)
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
          <div className="profile-communities-empty">Carregando...</div>
        ) : state.error ? (
          <div className="profile-communities-empty">{state.error}</div>
        ) : !hasItems ? (
          <div className="profile-communities-empty">
            <p>{copy.empty}</p>
            {kind === 'communities' && isOwnerView ? (
              <Link to="/comunidades" className="profile-secondary-button">
                Explorar comunidades
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
                    <p>{community.descricao || 'Sem descricao informada.'}</p>
                    <span>
                      {community.membros_count} membros / {community.posts_count} posts
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
              const communityName = post.comunidade?.nome || 'Comunidade'

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
                    <h3>{post.texto || 'Post com imagem'}</h3>
                    <p>{formatDate(post.created_at)}</p>
                    <span>
                      {post.curtidas_count} curtidas / {post.comentarios_count} comentarios
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
