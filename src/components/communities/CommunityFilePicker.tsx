import { useId, useRef, type ChangeEvent } from 'react'
import { Image } from 'lucide-react'

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
          <Image size={20} strokeWidth={1.8} aria-hidden="true" />
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
