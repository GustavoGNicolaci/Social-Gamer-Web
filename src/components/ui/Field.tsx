import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { id, label, hint, error, children, className = '', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`ui-field${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <label className="ui-field-label" htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="ui-field-message is-error" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="ui-field-message">{hint}</p>
      ) : null}
    </div>
  )
})
