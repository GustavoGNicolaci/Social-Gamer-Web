import { LoaderCircle } from 'lucide-react'

interface AuthSubmitButtonProps {
  isSubmitting: boolean
  idleLabel: string
  busyLabel: string
}

export function AuthSubmitButton({
  isSubmitting,
  idleLabel,
  busyLabel,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      className="auth-button auth-button--primary"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
    >
      {isSubmitting ? (
        <LoaderCircle className="auth-button__spinner" aria-hidden="true" />
      ) : null}
      <span>{isSubmitting ? busyLabel : idleLabel}</span>
    </button>
  )
}
