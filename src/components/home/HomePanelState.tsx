interface HomePanelStateProps {
  message: string
  tone?: 'loading' | 'empty' | 'error'
  rows?: number
}

export function HomePanelState({
  message,
  tone = 'empty',
  rows = 3,
}: HomePanelStateProps) {
  const isLoading = tone === 'loading'

  return (
    <div
      className={`home-empty-state is-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <>
          <span className="home-sr-only">{message}</span>
          <div className="home-state-skeleton" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
              <span
                key={`home-state-skeleton-${index}`}
                className={index % 2 === 0 ? 'is-wide' : 'is-short'}
              />
            ))}
          </div>
        </>
      ) : (
        <p>{message}</p>
      )}
    </div>
  )
}
