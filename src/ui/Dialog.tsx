import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import IconButton from './IconButton'
import { useEscape, useFocusTrap, useScrollLock } from './hooks'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface BaseProps {
  open?: boolean
  onClose: () => void
  title: ReactNode
  /** Optional line under the title. Also wired up as aria-describedby. */
  description?: ReactNode
  children: ReactNode
  /** Buttons for the footer. Omit for a dialog with no committing action. */
  footer?: ReactNode
  size?: Size
  /** Hide the close affordance for flows that must be resolved by a footer
      action. Escape and scrim click are disabled to match. */
  mandatory?: boolean
  className?: string
}

/**
 * Modal dialog.
 *
 * Everything the previous hand-rolled `.modal-scrim` blocks left out lives
 * here, once: role="dialog", aria-modal, a real accessible name and
 * description, a Tab trap, focus restoration on close, body scroll lock, and
 * Escape scoped so the topmost layer wins.
 */
export function Dialog({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  mandatory = false,
  className = '',
}: BaseProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useFocusTrap(panelRef, open)
  useScrollLock(open)
  useEscape(onClose, open && !mandatory)

  if (!open) return null

  return createPortal(
    <div
      className="ui-scrim"
      onPointerDown={(e) => {
        // Only a press that both starts and ends on the scrim dismisses —
        // otherwise a text selection dragged out of the dialog closes it.
        if (mandatory || e.target !== e.currentTarget) return
        onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`ui-dialog ui-dialog--${size} ${className}`.trim()}
      >
        <header className="ui-dialog__head">
          <div className="ui-dialog__heading">
            <h2 id={titleId} className="ui-dialog__title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="ui-dialog__desc">
                {description}
              </p>
            )}
          </div>
          {!mandatory && (
            <IconButton label="Close" icon={<X size={17} />} variant="ghost" onClick={onClose} />
          )}
        </header>

        <div className="ui-dialog__body">{children}</div>

        {footer && <footer className="ui-dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

interface SheetProps extends BaseProps {
  side?: 'right' | 'left' | 'bottom'
}

/**
 * Edge-anchored panel. Same semantics as Dialog — it is still a modal layer —
 * but it keeps the underlying course visible, which is why Settings and the
 * libraries move onto it in later phases instead of a centred box.
 */
export function Sheet({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  size = 'md',
  mandatory = false,
  className = '',
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useFocusTrap(panelRef, open)
  useScrollLock(open)
  useEscape(onClose, open && !mandatory)

  if (!open) return null

  return createPortal(
    <div
      className="ui-scrim ui-scrim--sheet"
      onPointerDown={(e) => {
        if (mandatory || e.target !== e.currentTarget) return
        onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`ui-sheet ui-sheet--${side} ui-sheet--${size} ${className}`.trim()}
      >
        <header className="ui-dialog__head">
          <div className="ui-dialog__heading">
            <h2 id={titleId} className="ui-dialog__title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="ui-dialog__desc">
                {description}
              </p>
            )}
          </div>
          {!mandatory && (
            <IconButton label="Close" icon={<X size={17} />} variant="ghost" onClick={onClose} />
          )}
        </header>

        <div className="ui-dialog__body">{children}</div>

        {footer && <footer className="ui-dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
