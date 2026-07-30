import { cloneElement, useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  label: string
  shortcut?: string
  side?: Side
  /** Must accept a ref and the pointer/focus handlers. */
  children: ReactElement
}

const OPEN_DELAY = 350
const GAP = 8

/**
 * Hover/focus tooltip.
 *
 * Deliberately `aria-hidden`: every caller (IconButton) already exposes the
 * same string as the element's accessible name, so exposing the tooltip too
 * would make a screen reader announce the label twice. The tooltip here is a
 * purely visual affordance for sighted mouse users.
 *
 * It also shows on keyboard focus, which is what makes an icon-only toolbar
 * legible to someone tabbing through it.
 */
export default function Tooltip({ label, shortcut, side = 'bottom', children }: Props) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pos = {
      top: { x: r.left + r.width / 2, y: r.top - GAP },
      bottom: { x: r.left + r.width / 2, y: r.bottom + GAP },
      left: { x: r.left - GAP, y: r.top + r.height / 2 },
      right: { x: r.right + GAP, y: r.top + r.height / 2 },
    }[side]
    setCoords(pos)
  }, [side])

  const open = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(place, OPEN_DELAY)
  }, [place])

  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    setCoords(null)
  }, [])

  // Focus shows it immediately — a keyboard user has already committed to the
  // control, so the hover grace period is just latency.
  const openNow = useCallback(() => {
    window.clearTimeout(timer.current)
    place()
  }, [place])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!coords) return
    // Any scroll or resize invalidates a fixed-position tooltip; cheaper to
    // dismiss than to track.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [coords, close])

  const child = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node
      const r = (children as unknown as { ref?: unknown }).ref
      if (typeof r === 'function') r(node)
      else if (r && typeof r === 'object') (r as { current: unknown }).current = node
    },
    onPointerEnter: open,
    onPointerLeave: close,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.target.matches(':focus-visible')) openNow()
      children.props.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      close()
      children.props.onBlur?.(e)
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      close()
      children.props.onPointerDown?.(e)
    },
  } as Partial<React.HTMLAttributes<HTMLElement>>)

  return (
    <>
      {child}
      {coords &&
        createPortal(
          <span
            className={`ui-tooltip ui-tooltip--${side}`}
            aria-hidden="true"
            style={{ left: coords.x, top: coords.y }}
          >
            {label}
            {shortcut && <kbd className="ui-tooltip__kbd">{shortcut}</kbd>}
          </span>,
          document.body
        )}
    </>
  )
}
