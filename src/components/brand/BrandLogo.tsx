import controllerLogo from '../../assets/social-gamer-controller-icon.svg'
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
        <img src={controllerLogo} alt="" className="brand-logo-image" draggable={false} />
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
