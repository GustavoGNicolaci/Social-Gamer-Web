interface GameCoverImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  sizes?: string
  eager?: boolean
}

export function GameCoverImage({
  src,
  alt,
  className,
  width = 320,
  height = 400,
  sizes,
  eager = false,
}: GameCoverImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
    />
  )
}
