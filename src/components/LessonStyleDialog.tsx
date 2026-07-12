import { X } from 'lucide-react'
import { useStore } from '../store'
import { SCHEMES } from '../types'
import type { Lesson, LessonTheme, SchemeId } from '../types'

const ACCENTS = [
  '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#334155',
]

/** Per-lesson overrides. Anything left on "Course default" inherits the theme,
    so a lesson only carries what actually differs. */
export default function LessonStyleDialog({
  lesson,
  onClose,
}: {
  lesson: Lesson
  onClose: () => void
}) {
  const course = useStore((s) => s.course)!
  const updateLesson = useStore((s) => s.updateLesson)
  const t: LessonTheme = lesson.theme ?? {}

  function set(patch: LessonTheme) {
    const next = { ...t, ...patch }
    // drop keys set back to inherit, so an untouched lesson stays clean
    for (const k of Object.keys(next) as (keyof LessonTheme)[]) {
      if (next[k] === undefined) delete next[k]
    }
    updateLesson(lesson.id, { theme: Object.keys(next).length ? next : undefined })
  }

  const overrides = Object.keys(t).length

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Style for “{lesson.title || 'Untitled lesson'}”</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          <p className="drop-hint" style={{ marginTop: 0 }}>
            Overrides apply to this lesson only, in the player and in Preview. Anything left as
            “Course default” follows the course theme.
          </p>

          <div className="settings-section-title">Accent colour</div>
          <div className="swatches">
            <button
              className={'swatch inherit' + (t.primaryColor === undefined ? ' sel' : '')}
              title="Course default"
              onClick={() => set({ primaryColor: undefined })}
            >
              A
            </button>
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={'swatch' + (t.primaryColor === c ? ' sel' : '')}
                style={{ background: c }}
                title={c}
                onClick={() => set({ primaryColor: c })}
              />
            ))}
            <input
              type="color"
              value={t.primaryColor ?? course.theme.primaryColor}
              title="Custom colour"
              style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
              onChange={(e) => set({ primaryColor: e.target.value })}
            />
          </div>

          <div className="settings-section-title">Colour scheme</div>
          <div className="theme-grid">
            <button
              className={'theme-card' + (t.scheme === undefined ? ' sel' : '')}
              onClick={() => set({ scheme: undefined })}
            >
              <span className="scheme-strip inherit-strip" />
              <span className="tc-name">Course default</span>
            </button>
            {SCHEMES.map((s) => (
              <button
                key={s.id}
                className={'theme-card' + (t.scheme === s.id ? ' sel' : '')}
                onClick={() => set({ scheme: s.id as SchemeId })}
              >
                <span className="scheme-strip" style={{ background: s.bgSoft, borderColor: s.line }}>
                  <span style={{ background: t.primaryColor ?? course.theme.primaryColor }} />
                  <span style={{ background: s.bg, border: `1px solid ${s.line}` }} />
                  <span style={{ background: s.ink }} />
                </span>
                <span className="tc-name">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="settings-section-title">Lesson header</div>
          <div className="layout-field">
            <span className="lo-label">Header style</span>
            <span className="seg">
              {[
                { v: undefined, label: 'Course default' },
                { v: 'gradient' as const, label: 'Gradient' },
                { v: 'solid' as const, label: 'Solid' },
                { v: 'minimal' as const, label: 'Minimal' },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  className={t.hero === o.v ? 'active' : ''}
                  onClick={() => set({ hero: o.v })}
                >
                  {o.label}
                </button>
              ))}
            </span>
          </div>
        </div>
        <div className="modal-foot">
          <button
            className="btn"
            disabled={!overrides}
            onClick={() => updateLesson(lesson.id, { theme: undefined })}
          >
            Reset to course theme
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
