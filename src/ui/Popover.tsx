import {
  cloneElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useClickOutside, useEscape, useFocusTrap } from './hooks'

type Side = 'bottom' | 'top'
type Align = 'start' | 'center' | 'end'

interface Props {
  /** Element that opens the popover. Cloned with a ref and an onClick. */
  trigger: ReactElement
  children: ReactNode | ((api: { close: () => void }) => ReactNode)
  side?: Side
  align?: Align
  /** Keep focus where it is instead of pulling it into the panel — right for
      a colour swatch grid you tab into, wrong for a menu. */
  noAutoFocus?: boolean
  label?: string
  className?: string
  onOpenChange?: (open: boolean) => void
}

const GAP = 6
const MARGIN = 8

/**
 * Anchored, non-modal layer: closes on Escape or an outside press, keeps the
 * page behind interactive, and flips/clamps itself to stay on screen.
 *
 * Non-modal is the distinction from Dialog — this does not lock scroll or
 * trap the page, only the panel's own Tab order when focus is inside it.
 */
export default function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  noAutoFocus,
  label,
  className = '',
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const anchorRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => onOpenChange?.(open), [open, onOpenChange])
  useEscape(close, open)
  useClickOutside(panelRef, close, open, anchorRef)
  useFocusTrap(panelRef, open && !noAutoFocus)

  // Measure after paint so the panel has real dimensions to flip against.
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    function place() {
      const a = anchor!.getBoundingClientRect()
      const p = panel!.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight

      let top = side === 'bottom' ? a.bottom + GAP : a.top - p.height - GAP
      // Flip to the other side if this one doesn't fit.
      if (side === 'bottom' && top + p.height > vh - MARGIN && a.top - p.height - GAP > MARGIN) {
        top = a.top - p.height - GAP
      } else if (side === 'top' && top < MARGIN && a.bottom + p.height + GAP < vh - MARGIN) {
        top = a.bottom + GAP
      }

      let left =
        align === 'start'
          ? a.left
          : align === 'end'
            ? a.right - p.width
            : a.left + a.width / 2 - p.width / 2
      // Clamp inside the viewport rather than letting it hang off the edge.
      left = Math.max(MARGIN, Math.min(left, vw - p.width - MARGIN))
      top = Math.max(MARGIN, Math.min(top, vh - p.height - MARGIN))

      setStyle({ top, left, visibility: 'visible' })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, side, align])

  const triggerEl = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node
      const r = (trigger as unknown as { ref?: unknown }).ref
      if (typeof r === 'function') r(node)
      else if (r && typeof r === 'object') (r as { current: unknown }).current = node
    },
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(e)
      if (!e.defaultPrevented) setOpen((v) => !v)
    },
  } as Partial<React.HTMLAttributes<HTMLElement>> & Record<string, unknown>)

  return (
    <>
      {triggerEl}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`ui-popover ${className}`.trim()}
            role="dialog"
            aria-label={label}
            style={style}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body
        )}
    </>
  )
}
