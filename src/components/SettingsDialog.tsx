import { useState } from 'react'
import { LayoutTemplate, X } from 'lucide-react'
import { useStore } from '../store'
import type { CompletionRules, CourseTheme } from '../types'
import { FONT_PACKS, SCHEMES, resolveAssetSrc } from '../types'
import SaveTemplateDialog from './SaveTemplateDialog'
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
  const saveCourseTemplate = useStore((s) => s.saveCourseTemplate)
  const courseTemplates = useStore((s) => s.courseTemplates)
  const [savingTpl, setSavingTpl] = useState(false)
  const theme = course.theme
  const completion = course.completion
  const logoSrc = resolveAssetSrc(theme.logo, course.assets)
  const quizCount = course.lessons.reduce(
    (n, l) => n + l.blocks.filter((b) => b.type === 'quiz').length,
    0
  )

  function setTheme(patch: Partial<CourseTheme>) {
    updateCourse({ theme: { ...theme, ...patch } })
  }

  function setCompletion(patch: Partial<CompletionRules>) {
    updateCourse({ completion: { ...completion, ...patch } })
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
                // raw: the dashboard card shows this outside the course, where assets aren't loaded
                <UploadZone raw compact label="Add a cover image" onImage={(src) => updateCourse({ coverImage: src })} />
              )}
            </div>
          </div>

          <div className="settings-section-title">Colour scheme</div>
          {[
            { label: 'Light backgrounds', schemes: SCHEMES.filter((s) => !s.dark) },
            { label: 'Dark backgrounds', schemes: SCHEMES.filter((s) => s.dark) },
          ].map((group) => (
            <div key={group.label}>
              <div className="scheme-group-label">{group.label}</div>
              <div className="theme-grid">
                {group.schemes.map((s) => (
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
            </div>
          ))}
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
          <SegField
            label="Text size"
            themeKey="fontScale"
            options={[
              { v: 'small', label: 'Small' },
              { v: 'normal', label: 'Normal' },
              { v: 'large', label: 'Large' },
            ]}
          />
          <SegField
            label="Spacing"
            themeKey="spacing"
            options={[
              { v: 'compact', label: 'Compact' },
              { v: 'normal', label: 'Normal' },
              { v: 'airy', label: 'Airy' },
            ]}
          />
          <div className="layout-field">
            <span className="lo-label">Logo</span>
            {theme.logo ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={logoSrc} alt="Course logo" className="logo-preview" />
                <button className="btn sm" onClick={() => setTheme({ logo: '' })}>
                  Remove
                </button>
              </span>
            ) : (
              <span style={{ flex: 1, minWidth: 220 }}>
                <UploadZone
                  compact
                  label="Add a logo for the course header"
                  onImage={(logo) => setTheme({ logo })}
                />
              </span>
            )}
          </div>
          <p className="drop-hint" style={{ marginTop: 14 }}>
            Theme changes apply to the course player — open Preview to see them exactly as learners
            will. Individual lessons can override the accent, scheme and header from{' '}
            <strong>Lesson style</strong> in the canvas.
          </p>

          <div className="settings-section-title">Completion rules</div>
          <p className="drop-hint" style={{ marginTop: 0, marginBottom: 12 }}>
            What the learner must do before the player reports the course complete to the LMS.
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={completion.allLessons}
              onChange={(e) => setCompletion({ allLessons: e.target.checked })}
            />
            <span>
              Finish every lesson
              <span className="lo-sub">Each lesson must be completed with Continue / Finish.</span>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={completion.quizPass}
              disabled={quizCount === 0}
              onChange={(e) => setCompletion({ quizPass: e.target.checked })}
            />
            <span>
              Pass every quiz
              <span className="lo-sub">
                {quizCount === 0
                  ? 'No quizzes in this course yet.'
                  : `Each of the ${quizCount} quiz${quizCount === 1 ? '' : 'zes'} must reach its own pass mark.`}
              </span>
            </span>
          </label>
          <div className="layout-field">
            <span className="lo-label lo-wide">
              Minimum average quiz score
              <span className="lo-sub">0 turns this off.</span>
            </span>
            <input
              className="mini-input"
              type="number"
              min={0}
              max={100}
              step={5}
              style={{ width: 90 }}
              disabled={quizCount === 0}
              value={completion.minScore}
              onChange={(e) =>
                setCompletion({ minScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
              }
            />
            <span className="lbl">%</span>
          </div>
          <div className="layout-field">
            <span className="lo-label lo-wide">
              Minimum time in the course
              <span className="lo-sub">0 turns this off. Useful for compliance minimums.</span>
            </span>
            <input
              className="mini-input"
              type="number"
              min={0}
              max={600}
              step={5}
              style={{ width: 90 }}
              value={completion.minMinutes}
              onChange={(e) =>
                setCompletion({ minMinutes: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <span className="lbl">minutes</span>
          </div>
          {!completion.allLessons &&
            !completion.quizPass &&
            !completion.minScore &&
            !completion.minMinutes && (
              <p className="drop-hint" style={{ color: 'var(--danger)' }}>
                With every rule off, the course reports complete as soon as it is opened.
              </p>
            )}

          <div className="settings-section-title">Reuse</div>
          <div className="layout-field">
            <span className="lo-label lo-wide">
              Course template
              <span className="lo-sub">
                Save this course's lessons, blocks and theme as a starting point for new courses.
                {courseTemplates.length > 0 &&
                  ` You have ${courseTemplates.length} template${courseTemplates.length === 1 ? '' : 's'}.`}
              </span>
            </span>
            <button className="btn" onClick={() => setSavingTpl(true)}>
              <LayoutTemplate size={15} /> Save as template
            </button>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {savingTpl && (
        // stop clicks in the nested dialog from reaching the settings scrim behind it
        <div onClick={(e) => e.stopPropagation()}>
          <SaveTemplateDialog
            heading="Save as course template"
            hint="Templates live in your Template library on the dashboard, and are offered whenever you create a new course."
            defaultName={(course.title || 'Untitled course') + ' template'}
            withDescription
            onSave={(name, description) => saveCourseTemplate(name, description, course)}
            onClose={() => setSavingTpl(false)}
          />
        </div>
      )}
    </div>
  )
}
