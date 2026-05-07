import './BrandLogo.css'

interface BrandLogoProps {
  className?: string
  showWordmark?: boolean
  subtitle?: string
  title?: string
}

function BrandLogo({
  className = '',
  showWordmark = false,
  subtitle = 'Reviews e comunidade',
  title = 'Social Gamer',
}: BrandLogoProps) {
  return (
    <span className={`brand-logo${showWordmark ? ' brand-logo--with-wordmark' : ''}${className ? ` ${className}` : ''}`}>
      <span className="brand-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" focusable="false">
          <path
            className="brand-logo-controller"
            d="M14.9 19.2C16.4 15.8 19.7 14 24 14s7.6 1.8 9.1 5.2l2.5 5.7c1.5 3.4.5 7.4-2.4 9.6-2.4 1.8-5.8 1.4-7.6-.9L24 31.7l-1.6 1.9c-1.9 2.3-5.2 2.7-7.6.9-2.9-2.2-3.9-6.2-2.4-9.6l2.5-5.7Z"
          />
          <path
            className="brand-logo-dpad"
            d="M17.4 23h2.2v-2.2h2.8V23h2.2v2.8h-2.2V28h-2.8v-2.2h-2.2V23Z"
          />
          <path
            className="brand-logo-star"
            d="m31.1 20.2 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2.1 1.1.4-2.3-1.6-1.6 2.3-.3 1-2.1Z"
          />
          <circle className="brand-logo-button" cx="34" cy="28.5" r="1.8" />
          <path className="brand-logo-spark" d="M13 13.2h2.7M14.4 11.8v2.8M35.3 13.5h2.2M36.4 12.4v2.2" />
        </svg>
      </span>

      {showWordmark ? (
        <span className="brand-logo-wordmark">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
      ) : null}
    </span>
  )
}

export default BrandLogo
