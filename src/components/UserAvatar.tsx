import { useState } from 'react'
import { resolveAvatarPublicUrl } from '../services/storageService'

interface UserAvatarProps {
  name: string
  avatarPath?: string | null
  imageClassName: string
  fallbackClassName: string
  alt?: string
}

function getInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
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
        alt={alt || `Avatar de ${name}`}
        className={imageClassName}
        onError={() => setFailedSrc(safeSrc)}
        loading="lazy"
      />
    )
  }

  return (
    <span className={fallbackClassName} aria-label={alt || `Avatar de ${name}`}>
      {getInitial(name)}
    </span>
  )
}
