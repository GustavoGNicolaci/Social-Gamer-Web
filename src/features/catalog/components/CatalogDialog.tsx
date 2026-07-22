import type { PropsWithChildren } from 'react'
import { DialogShell } from '../../../components/ui/DialogShell'

interface CatalogDialogProps extends PropsWithChildren {
  open: boolean
  className?: string
  labelledBy: string
  describedBy?: string
  onClose: () => void
}

export function CatalogDialog({
  open,
  className = '',
  labelledBy,
  describedBy,
  onClose,
  children,
}: CatalogDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      titleId={labelledBy}
      descriptionId={describedBy}
      backdropClassName="gp-modal"
      className={`gp-modal-card${className ? ` ${className}` : ''}`}
    >
      {children}
    </DialogShell>
  )
}
