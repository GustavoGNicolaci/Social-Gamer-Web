import { useState } from 'react'

interface UserAvatarProps {
  name: string
  src?: string | null
  imageClassName: string
  fallbackClassName: string
  alt?: string
}

function sanitizeAvatarSrc(src: string | null | undefined) {
  const normalizedSrc = src?.trim()

  if (!normalizedSrc) return null
  if (/^(null|undefined)$/i.test(normalizedSrc)) return null
  if (/^javascript:/i.test(normalizedSrc)) return null

  return normalizedSrc
}

function getInitial(name: string) {
  const firstCharacter = name.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : 'U'
}

export function UserAvatar({
  name,
  src,
  imageClassName,
  fallbackClassName,
  alt,
}: UserAvatarProps) {
  const safeSrc = sanitizeAvatarSrc(src)
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
