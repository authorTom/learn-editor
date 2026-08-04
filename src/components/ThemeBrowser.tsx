import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { FONT_PACKS, SCHEMES } from '../types'
import { THEME_PRESETS, matchingPreset, type PresetPatch } from '../themePresets'
import { Button, useEscape } from '../ui'

/**
 * Trying on a whole look, with the course still in front of you.
 *
 * Presets already existed, but inside the settings sheet — a modal over the
 * canvas. So choosing one meant picking a name and two thumbnails' worth of
 * swatch, closing the sheet, and finding out. The eight looks are the most
 * consequential visual decision in the tool and they were the one decision made
 * without being able to see the thing being decided about.
 *
 * This is the same eight presets as a strip along the bottom, with the lesson
 * live above it. Arrow along and the course retints under you. It is a genuine
 * try-on: the preview lives in UI state, the course is untouched until you
 * confirm, so browsing all eight costs no undo history and Escape leaves no
 * trace. Confirming writes the theme once, as a single undoable step.
 */
export default function ThemeBrowser({ onClose }: { onClose: () => void }) {
  const course = useStore((s) => s.course)
  const updateCourse = useStore((s) => s.updateCourse)
  const setThemePreview = useUi((s) => s.setThemePreview)
  const stripRef = useRef<HTMLDivElement>(null)

  // Where we started, so Escape and the close button can put it back. Captured
  // once: re-reading the course would follow our own preview around.
  const original = useRef(course?.theme)
  const startedOn = original.current ? matchingPreset(original.current) : null
  const [index, setIndex] = useState(() => {
    const i = THEME_PRESETS.findIndex((p) => p.id === startedOn)
    return i < 0 ? 0 : i
  })
  const [tried, setTried] = useState(startedOn !== null)

  // Preview whatever is under the cursor. Cleared on unmount by `cancel`/`keep`,
  // and by this effect's teardown if the component goes away another way.
  useEffect(() => {
    if (tried) setThemePreview(THEME_PRESETS[index].theme)
    return () => setThemePreview(null)
  }, [index, tried, setThemePreview])

  // Focus a card on open so the arrows work immediately. It falls back to the
  // first card because a course whose theme has been hand-tuned matches no
  // preset at all — which is the common case, and used to leave the strip open
  // with nothing focused and every key press going nowhere.
  useEffect(() => {
    const strip = stripRef.current
    const card =
      strip?.querySelector<HTMLButtonElement>('.tb-card.sel') ??
      strip?.querySelector<HTMLButtonElement>('.tb-card')
    card?.focus()
  }, [])

  function cancel() {
    setThemePreview(null)
    onClose()
  }

  function keep() {
    const patch = THEME_PRESETS[index].theme
    setThemePreview(null)
    if (course) updateCourse({ theme: { ...course.theme, ...patch } })
    onClose()
  }

  // Escape has to work wherever focus is — the strip is a band across the
  // bottom, and the canvas above it stays interactive by design.
  useEscape(cancel)

  function move(delta: number) {
    setTried(true)
    setIndex((i) => {
      const next = Math.min(THEME_PRESETS.length - 1, Math.max(0, i + delta))
      requestAnimationFrame(() => {
        stripRef.current
          ?.querySelectorAll<HTMLButtonElement>('.tb-card')
          [next]?.focus()
      })
      return next
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); move(-THEME_PRESETS.length) }
    else if (e.key === 'End') { e.preventDefault(); move(THEME_PRESETS.length) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keep() }
    else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  if (!course) return null

  return (
    <div className="tb" role="dialog" aria-label="Try a design preset">
      <div className="tb__lead">
        <strong className="tb__title">{tried ? THEME_PRESETS[index].name : 'Design presets'}</strong>
        <span className="tb__desc">
          {tried ? THEME_PRESETS[index].description : 'Arrow to try each one on the lesson behind.'}
        </span>
      </div>

      <div
        className="tb__strip"
        ref={stripRef}
        role="radiogroup"
        aria-label="Design presets"
        onKeyDown={onKeyDown}
      >
        {THEME_PRESETS.map((p, i) => (
          <PresetCard
            key={p.id}
            preset={p.theme}
            name={p.name}
            selected={tried && i === index}
            // With nothing tried yet no card is selected, so the roving
            // tabindex would leave the whole strip unreachable by Tab.
            tabbable={tried ? i === index : i === 0}
            onPick={() => { setTried(true); setIndex(i) }}
            onCommit={keep}
          />
        ))}
      </div>

      <div className="tb__actions">
        <Button icon={<X size={15} />} onClick={cancel}>Cancel</Button>
        <Button variant="primary" icon={<Check size={15} />} onClick={keep} disabled={!tried}>
          Use this
        </Button>
      </div>
    </div>
  )
}

/** A miniature of the look: its page colour, accent, heading face and corners.
    Same ingredients as the settings-sheet swatch, sized for a strip. */
function PresetCard({
  preset, name, selected, tabbable, onPick, onCommit,
}: {
  preset: PresetPatch
  name: string
  selected: boolean
  tabbable: boolean
  onPick: () => void
  onCommit: () => void
}) {
  const scheme = SCHEMES.find((s) => s.id === preset.scheme) ?? SCHEMES[0]
  const pack = FONT_PACKS.find((f) => f.id === preset.fontPack) ?? FONT_PACKS[0]

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      className={'tb-card' + (selected ? ' sel' : '')}
      onClick={onPick}
      onDoubleClick={onCommit}
      onMouseEnter={onPick}
    >
      <span
        className="tb-card__swatch"
        style={{
          background: scheme.bgSoft,
          borderColor: scheme.line,
          borderRadius: preset.corners === 'sharp' ? 2 : 9,
        }}
        aria-hidden="true"
      >
        <span className="tb-card__bar" style={{ background: preset.primaryColor }} />
        <span
          className="tb-card__type"
          style={{
            fontFamily: pack.heading,
            color: scheme.ink,
            fontWeight: preset.headingWeight === 'bold' ? 700 : 800,
          }}
        >
          Ag
        </span>
        <span className="tb-card__line" style={{ background: scheme.line }} />
      </span>
      <span className="tb-card__name">{name}</span>
    </button>
  )
}
