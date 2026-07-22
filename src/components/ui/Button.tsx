import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leadingIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    className = '',
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`ui-button ui-button--${variant} ui-button--${size}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'secondary' | 'ghost' | 'danger'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      size = 'md',
      variant = 'ghost',
      className = '',
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`ui-icon-button ui-icon-button--${size} ui-button--${variant}${className ? ` ${className}` : ''}`}
        aria-label={label}
        {...props}
      >
        {children}
      </button>
    )
  },
)
