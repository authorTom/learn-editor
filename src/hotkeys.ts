import { useEffect } from 'react'

/**
 * One registry for every editor shortcut.
 *
 * Both the command palette and the shortcut sheet read from this list, so a
 * shortcut can only exist in one place — the previous three ad-hoc
 * `addEventListener('keydown')` sites could drift from whatever the UI claimed
 * the keys were, and nothing enumerated them for the user at all.
 */

export interface Command {
  id: string
  label: string
  /** Grouping in the palette and the shortcut sheet. */
  group: 'Course' | 'Edit' | 'Insert' | 'View' | 'Navigate'
  /** Canonical binding, e.g. "mod+k", "mod+shift+z". `mod` is ⌘ on Apple, Ctrl elsewhere. */
  keys?: string
  /** Synonyms the palette also matches on: the word on the button, the word the
      user's LMS admin uses, the word they'd have typed in another tool. Never
      outranks a match on the label itself. */
  keywords?: string[]
  run: () => void
  /** Hidden from the palette (still bound, still listed in the shortcut sheet). */
  paletteHidden?: boolean
  disabled?: boolean
}

export const isApple =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** Human-readable form, e.g. "⌘⇧Z" or "Ctrl+Shift+Z". */
export function formatKeys(keys: string): string {
  const parts = keys.split('+')
  const out = parts.map((p) => {
    if (p === 'mod') return isApple ? '⌘' : 'Ctrl'
    if (p === 'shift') return isApple ? '⇧' : 'Shift'
    if (p === 'alt') return isApple ? '⌥' : 'Alt'
    if (p === 'escape') return 'Esc'
    if (p === 'backspace') return isApple ? '⌫' : 'Backspace'
    return p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)
  })
  return isApple ? out.join('') : out.join('+')
}

function matches(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+')
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')

  const mod = isApple ? e.metaKey : e.ctrlKey
  if (wantMod !== mod) return false
  if (wantShift !== e.shiftKey) return false
  if (wantAlt !== e.altKey) return false
  return e.key.toLowerCase() === key.toLowerCase()
}

/** True when the caret is in a field, so shortcuts without a modifier stand down. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  const node = el as HTMLElement
  return (
    node.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName) ||
    !!node.closest?.('.tiptap')
  )
}

export function useHotkeys(commands: Command[], enabled = true) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      for (const c of commands) {
        if (!c.keys || c.disabled) continue
        if (!matches(e, c.keys)) continue
        // Unmodified shortcuts must never fire while typing.
        if (!c.keys.includes('mod') && isTypingTarget(document.activeElement)) continue
        e.preventDefault()
        c.run()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commands, enabled])
}
