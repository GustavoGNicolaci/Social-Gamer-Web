import type { CSSProperties } from 'react'
import './RatingCircle.css'

interface RatingCircleProps {
  value: number | null | undefined
  max?: number
  size?: number
  strokeWidth?: number
  className?: string
  ariaLabel?: string
}

const EMPTY_RATING_LABEL = '\u2013'

function clampRating(value: number, max: number) {
  return Math.min(Math.max(value, 0), max)
}

function formatRatingValue(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function RatingCircle({
  value,
  max = 10,
  size = 54,
  strokeWidth = 5,
  className = '',
  ariaLabel,
}: RatingCircleProps) {
  const hasRating = typeof value === 'number' && Number.isFinite(value)
  const normalizedRating = hasRating ? clampRating(value, max) : null
  const progress = normalizedRating === null || max <= 0 ? 0 : normalizedRating / max
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  const formattedRating =
    normalizedRating === null ? EMPTY_RATING_LABEL : formatRatingValue(normalizedRating)
  const formattedMax = formatRatingValue(max)
  const accessibleLabel =
    ariaLabel || (normalizedRating === null ? 'Sem nota' : `Nota ${formattedRating} de ${formattedMax}`)

  return (
    <span
      className={`rating-circle${normalizedRating === null ? ' is-empty' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={accessibleLabel}
      style={
        {
          '--rating-circle-size': `${size}px`,
        } as CSSProperties
      }
    >
      <svg className="rating-circle-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="rating-circle-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="rating-circle-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <span className="rating-circle-value">{formattedRating}</span>
    </span>
  )
}

export default RatingCircle
