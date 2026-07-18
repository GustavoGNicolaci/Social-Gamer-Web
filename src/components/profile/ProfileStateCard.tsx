import type { ReactNode } from 'react'

interface ProfileStateCardProps {
  badge: ReactNode
  title: ReactNode
  message: ReactNode
}

export function ProfileStateCard({
  badge,
  title,
  message,
}: ProfileStateCardProps) {
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="profile-state-card">
          <span className="profile-state-badge">{badge}</span>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </div>
    </div>
  )
}
