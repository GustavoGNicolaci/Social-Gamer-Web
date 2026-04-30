import { useId, useRef, type ChangeEvent } from 'react'

interface CommunityFilePickerProps {
  label: string
  buttonLabel: string
  removeLabel: string
  uploadingLabel: string
  previewAlt: string
  file: File | null
  previewUrl: string | null
  accept?: string
  helperText?: string
  successMessage?: string | null
  errorMessage?: string | null
  disabled?: boolean
  isUploading?: boolean
  onChange: (file: File | null) => void
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function imageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.8 5.5C4.8 4.56 5.56 3.8 6.5 3.8H17.5C18.44 3.8 19.2 4.56 19.2 5.5V18.5C19.2 19.44 18.44 20.2 17.5 20.2H6.5C5.56 20.2 4.8 19.44 4.8 18.5V5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M7.6 16.4L10.2 13.35C10.62 12.86 11.37 12.84 11.82 13.3L12.7 14.2L14.65 11.8C15.08 11.27 15.9 11.29 16.3 11.85L19.1 15.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.35H9.02"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CommunityFilePicker({
  label,
  buttonLabel,
  removeLabel,
  uploadingLabel,
  previewAlt,
  file,
  previewUrl,
  accept = 'image/*',
  helperText,
  successMessage,
  errorMessage,
  disabled = false,
  isUploading = false,
  onChange,
}: CommunityFilePickerProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] || null)
  }

  const handleRemove = () => {
    if (inputRef.current) inputRef.current.value = ''
    onChange(null)
  }

  return (
    <div className="community-file-picker">
      <span className="community-file-picker-label">{label}</span>
      <div className="community-file-picker-control">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled || isUploading}
          onChange={handleChange}
        />
        <label className="community-file-picker-button" htmlFor={inputId}>
          {imageIcon()}
          <span>{isUploading ? uploadingLabel : buttonLabel}</span>
        </label>

        {file ? (
          <button
            type="button"
            className="community-file-picker-remove"
            disabled={disabled || isUploading}
            onClick={handleRemove}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>

      {file ? (
        <p className="community-file-picker-meta">
          {file.name} - {formatFileSize(file.size)}
        </p>
      ) : helperText ? (
        <p className="community-file-picker-meta">{helperText}</p>
      ) : null}

      {previewUrl ? (
        <div className="community-file-picker-preview community-media-frame">
          <img className="community-media-backdrop" src={previewUrl} alt="" aria-hidden="true" />
          <img className="community-media-foreground" src={previewUrl} alt={previewAlt} />
        </div>
      ) : null}

      {successMessage ? (
        <p className="community-file-picker-status is-success">{successMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="community-file-picker-status is-error">{errorMessage}</p>
      ) : null}
    </div>
  )
}
