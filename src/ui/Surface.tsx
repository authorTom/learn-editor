import type { ReactNode } from 'react'
import { Dialog } from './Dialog'

type Mode = 'dialog' | 'panel'

interface Props {
  /** 'dialog' centres it over the course; 'panel' renders bare for the dock. */
  as?: Mode
  title: string
  description?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

/**
 * Lets one component body serve both a modal dialog and a docked panel.
 *
 * The dock supplies its own header (the tab strip names the panel), so the
 * panel form drops the title bar and close button rather than showing a second
 * redundant one. The dialog form keeps them.
 */
export default function Surface({
  as = 'dialog',
  title,
  description,
  size = 'md',
  onClose,
  footer,
  children,
}: Props) {
  if (as === 'panel') {
    return (
      <div className="ui-panel">
        {description && <p className="ui-panel__desc">{description}</p>}
        <div className="ui-panel__body">{children}</div>
        {footer && <div className="ui-panel__foot">{footer}</div>}
      </div>
    )
  }

  return (
    <Dialog title={title} description={description} size={size} onClose={onClose} footer={footer}>
      {children}
    </Dialog>
  )
}
