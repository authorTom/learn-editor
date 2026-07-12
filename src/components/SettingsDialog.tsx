import { X } from 'lucide-react'
import { useStore } from '../store'
import type { CourseTheme } from '../types'
import { FONT_PACKS, SCHEMES } from '../types'
import { UploadZone } from './blocks/MediaBlocks'

const THEME_COLORS = [
  '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#334155',
]

function SegField<K extends keyof CourseTheme>({
  label, themeKey, options,
}: {
  label: string
  themeKey: K
  options: { v: CourseTheme[K]; label: string }[]
}) {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)
  return (
    <div className="layout-field">
      <span className="lo-label">{label}</span>
      <span className="seg">
        {options.map((o) => (
          <button
            key={String(o.v)}
            className={course.theme[themeKey] === o.v ? 'active' : ''}
            onClick={() => updateCourse({ theme: { ...course.theme, [themeKey]: o.v } })}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  )
}

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)
  const theme = course.theme

  function setTheme(patch: Partial<CourseTheme>) {
    updateCourse({ theme: { ...theme, ...patch } })
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Course settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-section-title">Details</div>
          <div className="field">
            <label>Description (shown on your dashboard)</label>
            <textarea
              value={course.description}
              placeholder="What will learners get from this course?"
              onChange={(e) => updateCourse({ description: e.target.value })}
            />
          </div>
          <div className="settings-2col">
            <div className="field">
              <label>Author name (shown to learners)</label>
              <input
                type="text"
                value={course.author}
                placeholder="e.g. Jane Doe, Learning & Development"
                onChange={(e) => updateCourse({ author: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Cover image (dashboard card)</label>
              {course.coverImage ? (
                <div className="img-preview">
                  <img src={course.coverImage} alt="Cover" style={{ maxHeight: 90, objectFit: 'cover', width: '100%' }} />
                  <div className="img-replace">
                    <button className="btn sm" onClick={() => updateCourse({ coverImage: '' })}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <UploadZone compact label="Add a cover image" onImage={(src) => updateCourse({ coverImage: src })} />
              )}
            </div>
          </div>

          <div className="settings-section-title">Colour scheme</div>
          <div className="theme-grid">
            {SCHEMES.map((s) => (
              <button
                key={s.id}
                className={'theme-card' + (theme.scheme === s.id ? ' sel' : '')}
                onClick={() => setTheme({ scheme: s.id })}
              >
                <span className="scheme-strip" style={{ background: s.bgSoft, borderColor: s.line }}>
                  <span style={{ background: theme.primaryColor }} />
                  <span style={{ background: s.bg, border: `1px solid ${s.line}` }} />
                  <span style={{ background: s.ink }} />
                </span>
                <span className="tc-name">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Accent colour</label>
            <div className="swatches">
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (theme.primaryColor === c ? ' sel' : '')}
                  style={{ background: c }}
                  title={c}
                  onClick={() => setTheme({ primaryColor: c })}
                />
              ))}
              <input
                type="color"
                value={theme.primaryColor}
                title="Custom colour"
                style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
                onChange={(e) => setTheme({ primaryColor: e.target.value })}
              />
            </div>
          </div>

          <div className="settings-section-title">Font pack</div>
          <div className="theme-grid">
            {FONT_PACKS.map((p) => (
              <button
                key={p.id}
                className={'theme-card' + (theme.fontPack === p.id ? ' sel' : '')}
                onClick={() => setTheme({ fontPack: p.id })}
              >
                <span className="font-sample" style={{ fontFamily: p.heading }}>Ag</span>
                <span className="tc-name">{p.label}</span>
                <span className="tc-desc">{p.description}</span>
              </button>
            ))}
          </div>

          <div className="settings-section-title">Layout</div>
          <SegField
            label="Navigation"
            themeKey="nav"
            options={[{ v: 'side', label: 'Sidebar' }, { v: 'top', label: 'Top bar + menu' }]}
          />
          <SegField
            label="Lesson header"
            themeKey="hero"
            options={[
              { v: 'gradient', label: 'Gradient banner' },
              { v: 'solid', label: 'Solid banner' },
              { v: 'minimal', label: 'Minimal' },
            ]}
          />
          <SegField
            label="Content width"
            themeKey="width"
            options={[
              { v: 'narrow', label: 'Narrow' },
              { v: 'normal', label: 'Normal' },
              { v: 'wide', label: 'Wide' },
            ]}
          />
          <SegField
            label="Corners"
            themeKey="corners"
            options={[{ v: 'soft', label: 'Rounded' }, { v: 'sharp', label: 'Square' }]}
          />
          <SegField
            label="Heading weight"
            themeKey="headingWeight"
            options={[{ v: 'extrabold', label: 'Extra bold' }, { v: 'bold', label: 'Bold' }]}
          />
          <p className="drop-hint" style={{ marginTop: 14 }}>
            Theme changes apply to the course player — open Preview to see them exactly as learners will.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
