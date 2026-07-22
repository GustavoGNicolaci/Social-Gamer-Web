import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  fieldLabel: string
}

export function PasswordInput({
  fieldLabel,
  className = '',
  disabled,
  id,
  ...inputProps
}: PasswordInputProps) {
  const { t } = useI18n()
  const [isVisible, setIsVisible] = useState(false)
  const visibilityLabel = isVisible
    ? t('auth.hidePassword', { field: fieldLabel })
    : t('auth.showPassword', { field: fieldLabel })

  return (
    <div className="auth-password-input">
      <input
        {...inputProps}
        id={id}
        type={isVisible ? 'text' : 'password'}
        className={className}
        disabled={disabled}
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setIsVisible((current) => !current)}
        disabled={disabled}
        aria-label={visibilityLabel}
        aria-controls={id}
        aria-pressed={isVisible}
        title={visibilityLabel}
      >
        {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  )
}
