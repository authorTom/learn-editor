import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, FileText } from 'lucide-react'
import { useStore } from '../store'
import { Input, useEscape, useFocusTrap, useScrollLock } from '../ui'
import { formatKeys, type Command } from '../hotkeys'

interface Item {
  key: string
  label: string
  group: string
  keywords?: string[]
  hint?: string
  run: () => void
}

/** With no query the palette used to show commands in declaration order, which
    put "Keyboard shortcuts" first and made a bare ⌘K↵ open the help sheet.
    Group order is what a first-time reader would expect to scan. */
const GROUP_ORDER = ['Course', 'Insert', 'Edit', 'View', 'Navigate', 'Go to lesson']
const groupRank = (g: string) => {
  const i = GROUP_ORDER.indexOf(g)
  return i === -1 ? GROUP_ORDER.length : i
}

/**
 * ⌘K palette over commands and lessons.
 *
 * Matching is subsequence-based ("ncr" finds "New course"), which is what makes
 * a palette faster than a menu — you type the shape of the thing, not its
 * prefix.
 */
function score(needle: string, haystack: string): number | null {
  if (!needle) return 0
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()
  const direct = h.indexOf(n)
  if (direct >= 0) {
    // A match that starts a word beats one buried inside one. Without this,
    // "board" ranked "Keyboard shortcuts" (hit at 3) above "Open the course
    // board" (hit at 16), so Enter opened the wrong dialog.
    if (direct === 0) return 1000
    return /[\s\-/(]/.test(h[direct - 1]) ? 800 - direct : 500 - direct
  }
  let i = 0
  let hits = 0
  let last = -1
  let gaps = 0
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) {
      if (last >= 0) gaps += j - last - 1
      last = j
      i++
      hits++
    }
  }
  return i === n.length ? 200 - gaps + hits : null
}

/** Best of the label and the item's synonyms. A keyword hit is docked one point
    so a real label match always wins a tie. */
function best(needle: string, item: Item): number | null {
  let out = score(needle, item.label)
  for (const k of item.keywords ?? []) {
    const s = score(needle, k)
    if (s !== null) out = out === null ? s - 1 : Math.max(out, s - 1)
  }
  return out
}

export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const course = useStore((s) => s.course)
  const selectLesson = useStore((s) => s.selectLesson)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef)
  useScrollLock()
  useEscape(onClose)

  const all = useMemo<Item[]>(() => {
    const out: Item[] = commands
      .filter((c) => !c.paletteHidden && !c.disabled)
      .map((c) => ({
        key: 'cmd:' + c.id,
        label: c.label,
        group: c.group,
        keywords: c.keywords,
        hint: c.keys ? formatKeys(c.keys) : undefined,
        run: c.run,
      }))

    // Jumping to a lesson by name is the single most common navigation, so
    // lessons are first-class palette entries rather than a separate mode.
    for (const [i, l] of (course?.lessons ?? []).entries()) {
      out.push({
        key: 'lesson:' + l.id,
        label: `${i + 1}. ${l.title || 'Untitled lesson'}`,
        group: 'Go to lesson',
        run: () => selectLesson(l.id),
      })
    }
    out.sort((a, b) => groupRank(a.group) - groupRank(b.group))
    return out
  }, [commands, course, selectLesson])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return all
    return all
      .map((it) => ({ it, s: best(q, it) }))
      .filter((r): r is { it: Item; s: number } => r.s !== null)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.it)
  }, [all, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function pick(item: Item | undefined) {
    if (!item) return
    onClose()
    // After close, so the command runs against a settled DOM.
    requestAnimationFrame(() => item.run())
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[active])
    }
  }

  let lastGroup = ''

  return createPortal(
    <div className="ui-scrim cmdk-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="cmdk__search">
          <Input
            data-autofocus
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmdk-${results[active].key}` : undefined}
            aria-label="Search commands and lessons"
            placeholder="Search commands and lessons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="cmdk__list" id="cmdk-list" role="listbox" aria-label="Results" ref={listRef}>
          {results.length === 0 && <p className="cmdk__empty">No matches for “{query}”.</p>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            const isActive = i === active
            return (
              <div key={it.key}>
                {header && <div className="cmdk__group">{header}</div>}
                <div
                  id={`cmdk-${it.key}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  className={'cmdk__item' + (isActive ? ' is-active' : '')}
                  onClick={() => pick(it)}
                  onPointerMove={() => setActive(i)}
                >
                  {it.group === 'Go to lesson' && (
                    <FileText size={14} className="cmdk__icon" aria-hidden="true" />
                  )}
                  <span className="cmdk__label">{it.label}</span>
                  {it.hint && <kbd className="cmdk__kbd">{it.hint}</kbd>}
                  {isActive && !it.hint && (
                    <CornerDownLeft size={13} className="cmdk__enter" aria-hidden="true" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
