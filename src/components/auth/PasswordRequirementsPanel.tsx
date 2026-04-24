import {
  getPasswordRequirementStates,
  PASSWORD_REQUIREMENTS_TITLE,
} from '../../utils/passwordValidation'

interface PasswordRequirementsPanelProps {
  password: string
  shouldValidate?: boolean
  isVisible?: boolean
  id?: string
  className?: string
}

function PasswordRequirementsPanel({
  password,
  shouldValidate = false,
  isVisible = false,
  id,
  className = '',
}: PasswordRequirementsPanelProps) {
  const requirementStates = getPasswordRequirementStates(password, shouldValidate)

  return (
    <aside
      id={id}
      className={`password-requirements-panel${isVisible ? ' is-visible' : ' is-hidden'}${className ? ` ${className}` : ''}`}
    >
      <div className="password-requirements-card">
        <div className="password-requirements-title">{PASSWORD_REQUIREMENTS_TITLE}</div>
        <ul className="password-requirements-list">
          {requirementStates.map((requirement) => {
            const visualStatus = requirement.isMet ? 'valid' : 'pending'

            return (
              <li
                key={requirement.id}
                className={`password-requirement-item is-${visualStatus}`}
              >
                <span
                  className={`password-requirement-indicator is-${visualStatus}`}
                  aria-hidden="true"
                >
                  {requirement.isMet ? 'OK' : '--'}
                </span>
                <span>{requirement.label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

export default PasswordRequirementsPanel
