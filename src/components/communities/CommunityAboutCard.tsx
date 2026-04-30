import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormatDateOptions, TranslationParams } from '../../i18n'
import type { CommunitySummary } from '../../services/communityService'
import { getOptionalPublicProfilePath } from '../../utils/profileRoutes'

interface CommunityAboutCardProps {
  community: CommunitySummary
  categoryLabel: string | null
  t: (key: string, params?: TranslationParams) => string
  formatDate: (
    value: string | number | Date | null | undefined,
    options?: FormatDateOptions
  ) => string
  formatNumber: (value: number) => string
}

const DESCRIPTION_PREVIEW_LENGTH = 360

function aboutIcon(type: 'description' | 'rules' | 'category' | 'game' | 'members' | 'date' | 'leader' | 'visibility' | 'posts') {
  const paths = {
    description: 'M5 5.8C5 4.81 5.81 4 6.8 4H17.2C18.19 4 19 4.81 19 5.8V18.2C19 19.19 18.19 20 17.2 20H6.8C5.81 20 5 19.19 5 18.2V5.8ZM8 8H16M8 12H16M8 16H13',
    rules: 'M8 4H16L19 7V19.2C19 20.19 18.19 21 17.2 21H6.8C5.81 21 5 20.19 5 19.2V5.8C5 4.81 5.81 4 6.8 4H8ZM8 9H16M8 13H16M8 17H12',
    category: 'M4 6.8C4 5.81 4.81 5 5.8 5H10L12 7H18.2C19.19 7 20 7.81 20 8.8V17.2C20 18.19 19.19 19 18.2 19H5.8C4.81 19 4 18.19 4 17.2V6.8Z',
    game: 'M8.2 9H15.8C18.67 9 21 11.33 21 14.2V15C21 16.1 20.1 17 19 17C18.35 17 17.74 16.68 17.36 16.15L16.55 15H7.45L6.64 16.15C6.26 16.68 5.65 17 5 17C3.9 17 3 16.1 3 15V14.2C3 11.33 5.33 9 8.2 9ZM8 12V15M6.5 13.5H9.5M16 12.6H16.02M18 14.4H18.02',
    members: 'M16 19C16 16.79 14.21 15 12 15H8C5.79 15 4 16.79 4 19M14 5.27C14.61 4.49 15.56 4 16.62 4C18.49 4 20 5.51 20 7.38C20 9.25 18.49 10.76 16.62 10.76M10 11C8.07 11 6.5 9.43 6.5 7.5C6.5 5.57 8.07 4 10 4C11.93 4 13.5 5.57 13.5 7.5C13.5 9.43 11.93 11 10 11ZM18 19C18 17.64 17.32 16.43 16.28 15.7',
    date: 'M7 3V6M17 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V7C4 5.9 4.9 5 6 5Z',
    leader: 'M12 14C9.24 14 7 11.76 7 9C7 6.24 9.24 4 12 4C14.76 4 17 6.24 17 9C17 11.76 14.76 14 12 14ZM4.5 21C5.34 17.6 8.4 15.5 12 15.5C15.6 15.5 18.66 17.6 19.5 21',
    visibility: 'M2.8 12C4.47 8.54 7.83 6 12 6C16.17 6 19.53 8.54 21.2 12C19.53 15.46 16.17 18 12 18C7.83 18 4.47 15.46 2.8 12ZM12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z',
    posts: 'M6 5H18C19.1 5 20 5.9 20 7V15C20 16.1 19.1 17 18 17H9L5 21V17H6C4.9 17 4 16.1 4 15V7C4 5.9 4.9 5 6 5ZM8 9H16M8 13H13',
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={paths[type]}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getLeaderName(community: CommunitySummary, fallback: string) {
  return community.lider?.username || community.lider?.nome_completo || fallback
}

function parseRules(rules: string | null | undefined) {
  return (rules || '')
    .split(/\r?\n/)
    .map(rule => rule.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
}

export function CommunityAboutCard({
  community,
  categoryLabel,
  t,
  formatDate,
  formatNumber,
}: CommunityAboutCardProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  const normalizedDescription = (community.descricao || '').trim()
  const hasLongDescription = normalizedDescription.length > DESCRIPTION_PREVIEW_LENGTH
  const visibleDescription =
    hasLongDescription && !isDescriptionExpanded
      ? `${normalizedDescription.slice(0, DESCRIPTION_PREVIEW_LENGTH).trim()}...`
      : normalizedDescription
  const rules = useMemo(() => parseRules(community.regras), [community.regras])
  const leaderName = getLeaderName(community, t('communities.about.unknownLeader'))
  const leaderPath = getOptionalPublicProfilePath(community.lider?.username)
  const createdAt = formatDate(community.created_at, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    fallback: t('common.noDate'),
  })

  const metaItems = [
    {
      key: 'category',
      icon: aboutIcon('category'),
      label: t('communities.about.categoryLabel'),
      value: categoryLabel || t('communities.about.notProvided'),
    },
    {
      key: 'game',
      icon: aboutIcon('game'),
      label: t('communities.about.gameLabel'),
      value: community.jogo?.titulo || t('communities.about.noRelatedGame'),
    },
    {
      key: 'members',
      icon: aboutIcon('members'),
      label: t('communities.about.membersLabel'),
      value: formatNumber(community.membros_count),
    },
    {
      key: 'posts',
      icon: aboutIcon('posts'),
      label: t('communities.about.postsLabel'),
      value: formatNumber(community.posts_count),
    },
    {
      key: 'date',
      icon: aboutIcon('date'),
      label: t('communities.about.createdAt'),
      value: createdAt,
    },
    {
      key: 'visibility',
      icon: aboutIcon('visibility'),
      label: t('communities.about.visibilityLabel'),
      value: t(`communities.visibility.${community.visibilidade}`),
    },
  ]

  return (
    <section className="community-about-card">
      <div className="community-about-hero">
        <span className="communities-kicker">{t('communities.tabs.about')}</span>
        <h2>{t('communities.about.title')}</h2>
        <p>{t('communities.about.subtitle')}</p>
      </div>

      <div className="community-about-layout">
        <article className="community-about-summary">
          <div className="community-about-section-title">
            {aboutIcon('description')}
            <h3>{t('communities.about.description')}</h3>
          </div>
          <p className="community-about-description">
            {visibleDescription || t('communities.noDescription')}
          </p>
          {hasLongDescription ? (
            <button
              type="button"
              className="community-expand-button"
              onClick={() => setIsDescriptionExpanded(current => !current)}
            >
              {isDescriptionExpanded
                ? t('communities.about.showLess')
                : t('communities.about.showMore')}
            </button>
          ) : null}
        </article>

        <aside className="community-about-leader-card">
          <div className="community-about-section-title">
            {aboutIcon('leader')}
            <h3>{t('communities.about.leader')}</h3>
          </div>
          {leaderPath ? (
            <Link to={leaderPath}>@{leaderName}</Link>
          ) : (
            <strong>{leaderName}</strong>
          )}
          <span>{t('communities.role.lider')}</span>
        </aside>
      </div>

      <div className="community-about-meta-grid">
        {metaItems.map(item => (
          <article key={item.key} className="community-about-meta-item">
            <span className="community-about-meta-icon">{item.icon}</span>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <article className="community-about-rules">
        <div className="community-about-section-title">
          {aboutIcon('rules')}
          <h3>{t('communities.about.rules')}</h3>
        </div>
        {rules.length > 0 ? (
          <ul className="community-rules-list">
            {rules.map((rule, index) => (
              <li key={`${rule}-${index}`}>{rule}</li>
            ))}
          </ul>
        ) : (
          <p>{t('communities.about.noRules')}</p>
        )}
      </article>
    </section>
  )
}
