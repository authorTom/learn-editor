import { useStore } from '../store'
import { SCHEMES, normalizeTheme, resolveAssetSrc } from '../types'
import { Button, Dialog, Field, Input } from '../ui'
import { UploadZone } from './blocks/MediaBlocks'
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
  const effectiveHero = t.hero ?? normalizeTheme(course.theme).hero
  const heroSrc = resolveAssetSrc(t.heroImage ?? '', course.assets) || course.coverImage

  return (
    <Dialog
      title={`Style for “${lesson.title || 'Untitled lesson'}”`}
      description="Overrides apply to this lesson only, in the player and in Preview. Anything left as “Course default” follows the course theme."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            disabled={!overrides}
            onClick={() => updateLesson(lesson.id, { theme: undefined })}
          >
            Reset to course theme
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
          <div className="settings-section-title">Accent colour</div>
          <div className="swatches">
            <button
              className={'swatch inherit' + (t.primaryColor === undefined ? ' sel' : '')}
              aria-label="Course default" title="Course default"
              onClick={() => set({ primaryColor: undefined })}
            >
              A
            </button>
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={'swatch' + (t.primaryColor === c ? ' sel' : '')}
                style={{ background: c }}
                aria-label={`Accent ${c}`}
                aria-checked={t.primaryColor === c}
                role="radio"
                title={c}
                onClick={() => set({ primaryColor: c })}
              />
            ))}
            <input
              type="color"
              value={t.primaryColor ?? course.theme.primaryColor}
              aria-label="Custom accent colour" title="Custom colour"
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
                { v: 'split' as const, label: 'Split' },
                { v: 'image' as const, label: 'Image' },
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

          {/* Shown whenever an image header is in force here — whether this
              lesson chose it or inherited it — because that is exactly when the
              picture matters. */}
          {effectiveHero === 'image' && (
            <Field
              label="Header image"
              hint={
                heroSrc
                  ? 'Sits behind the lesson title, under a scrim that keeps the title readable.'
                  : 'Without a picture here or a course cover image, this lesson falls back to the gradient header.'
              }
            >
              {t.heroImage ? (
                <div className="img-preview">
                  <img
                    src={heroSrc}
                    alt=""
                    style={{ maxHeight: 120, objectFit: 'cover', width: '100%', borderRadius: 8 }}
                  />
                  <div className="img-replace">
                    <Button size="sm" onClick={() => set({ heroImage: undefined })}>
                      Use course cover
                    </Button>
                  </div>
                </div>
              ) : (
                <UploadZone
                  compact
                  label={
                    course.coverImage
                      ? 'Replace the course cover for this lesson'
                      : 'Add a header image for this lesson'
                  }
                  onImage={(heroImage) => set({ heroImage })}
                />
              )}
            </Field>
          )}

          <div className="settings-section-title">Module</div>
          <Field
            label="Section name"
            hint="Lessons next to each other that share a name are grouped under it in the course outline and the learner's menu. Leave blank for no grouping."
          >
            <Input
              value={lesson.section ?? ''}
              placeholder="e.g. Getting started"
              onChange={(e) =>
                updateLesson(lesson.id, { section: e.target.value.trim() ? e.target.value : undefined })
              }
            />
          </Field>
    </Dialog>
  )
}
