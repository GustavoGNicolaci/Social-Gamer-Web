import { useState } from 'react'
import { resolveAvatarPublicUrl } from '../services/storageService'

interface UserAvatarProps {
  name?: string | null
  avatarPath?: string | null
  imageClassName: string
  fallbackClassName: string
  alt?: string
}

function getInitial(name?: string | null) {
  const firstCharacter = name?.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : '?'
}

export function UserAvatar({
  name,
  avatarPath,
  imageClassName,
  fallbackClassName,
  alt,
}: UserAvatarProps) {
  const safeSrc = resolveAvatarPublicUrl(avatarPath)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const shouldShowImage = Boolean(safeSrc) && safeSrc !== failedSrc

  if (safeSrc && shouldShowImage) {
    return (
      <img
        src={safeSrc}
        alt={alt || `Avatar de ${name || 'perfil'}`}
        className={imageClassName}
        onError={() => setFailedSrc(safeSrc)}
        loading="lazy"
      />
    )
  }

  return (
    <span className={fallbackClassName} aria-label={alt || `Avatar de ${name || 'perfil'}`}>
      {getInitial(name)}
    </span>
  )
}
