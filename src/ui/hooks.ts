import { useCallback, useEffect, useRef, useState } from 'react'

/** Elements that can hold focus, in DOM order. `:not([disabled])` matters —
    a trap that lands on a disabled button strands the keyboard user. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

/**
 * Trap Tab inside `ref` while `active`, move focus in on open, and return it
 * to whatever was focused before on close.
 *
 * Restoring focus is the half that is usually skipped and the half a keyboard
 * user actually feels: without it, closing a dialog dumps focus back to
 * <body> and the next Tab restarts from the top of the page.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active = true) {
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const root = ref.current
    if (!root) return

    restoreTo.current = document.activeElement as HTMLElement | null

    // Prefer an explicitly marked target, else the first focusable, else the
    // container itself (which carries tabIndex={-1}).
    const initial =
      root.querySelector<HTMLElement>('[data-autofocus]') ?? focusableWithin(root)[0] ?? root
    // Defer past paint so autoFocus inputs and transitions don't fight us.
    const raf = requestAnimationFrame(() => initial.focus())

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !root) return
      const items = focusableWithin(root)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement as HTMLElement | null

      if (e.shiftKey && (activeEl === first || !root.contains(activeEl))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (activeEl === last || !root.contains(activeEl))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      restoreTo.current?.focus?.()
    }
  }, [ref, active])
}

/** Lock body scroll while a layer is open, compensating for the scrollbar so
    the page behind doesn't shift sideways as it appears. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [active])
}

/** Escape handling for the topmost layer only. Layers register on a stack, so
    a confirm opened over a dialog closes just the confirm. */
const escapeStack: Array<() => void> = []

export function useEscape(onEscape: () => void, active = true) {
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!active) return
    const entry = () => handler.current()
    escapeStack.push(entry)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (escapeStack[escapeStack.length - 1] !== entry) return
      e.stopPropagation()
      entry()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const i = escapeStack.indexOf(entry)
      if (i >= 0) escapeStack.splice(i, 1)
    }
  }, [active])
}

/** Fire when a pointer goes down outside `ref`. Uses pointerdown rather than
    click so a popover closes before the underlying control reacts. */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  active = true,
  ignore?: React.RefObject<HTMLElement | null>
) {
  const handler = useRef(onOutside)
  handler.current = onOutside

  useEffect(() => {
    if (!active) return
    function onDown(e: PointerEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (ignore?.current?.contains(target)) return
      handler.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [ref, active, ignore])
}

/** Roving-tabindex arrow navigation over a list of items. Wraps at both ends,
    and treats Home/End as jump-to-edge, per the APG listbox pattern. */
export function useRovingIndex(count: number, onSelect?: (i: number) => void) {
  const [index, setIndex] = useState(0)

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (count === 0) return
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          setIndex((i) => (i + 1) % count)
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          setIndex((i) => (i - 1 + count) % count)
          break
        case 'Home':
          e.preventDefault()
          setIndex(0)
          break
        case 'End':
          e.preventDefault()
          setIndex(count - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onSelect?.(index)
          break
      }
    },
    [count, index, onSelect]
  )

  return { index, setIndex, onKeyDown }
}
