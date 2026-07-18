export function ReviewHeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4L10.55 19.08C5.4 14.36 2 11.27 2 7.5C2 4.41 4.42 2 7.5 2C9.24 2 10.91 2.81 12 4.09C13.09 2.81 14.76 2 16.5 2C19.58 2 22 4.41 22 7.5C22 11.27 18.6 14.36 13.45 19.09L12 20.4Z"
        fill={filled ? '⚑' : '⚐'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReviewThumbDownIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 4H6.5C5.67 4 4.95 4.5 4.64 5.22L2.08 11.18C2.03 11.31 2 11.45 2 11.6V13.5C2 14.33 2.67 15 3.5 15H8.24L7.52 18.46C7.5 18.56 7.49 18.66 7.49 18.76C7.49 19.17 7.66 19.56 7.93 19.84L8.72 20.62L13.64 15.71C13.88 15.47 14 15.15 14 14.81V4ZM18 4H22V14H18V4Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ReviewFlagIcon({ filled }: { filled: boolean }) {
  return (
    <span className={`game-review-report-emoji${filled ? ' is-filled' : ''}`} aria-hidden="true">
      {filled ? '⚑' : '⚐'}
    </span>
  )
}
