import { useState } from 'react'
import { BookOpen, LayoutTemplate, Palette, Ruler, Repeat, CheckCircle2, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { contrastRatio, courseVars, schemeOf } from '../theme'
import { THEME_PRESETS, matchingPreset } from '../themePresets'
import type { CompletionRules, CourseTheme } from '../types'
import { FONT_PACKS, SCHEMES, normalizeTheme, resolveAssetSrc } from '../types'
import { Button, Checkbox, Field, Input, Segmented, Sheet, Textarea } from '../ui'
import SaveTemplateDialog from './SaveTemplateDialog'
import { UploadZone } from './blocks/MediaBlocks'

const THEME_COLORS = [
  '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#334155',
]

/**
 * Live WCAG readout for the accent against the course's page colour.
 *
 * The accent is not only decoration — it sets link colour, quiz numbering and
 * nav highlights — so a pale accent on a pale scheme produces text nobody can
 * read. The player now derives a darkened `--accent-ink` for exactly those
 * uses, which means the course stays legible either way; this tells the author
 * when that derivation is doing heavy lifting, so they can pick a stronger
 * brand colour if they would rather see their own.
 */
function ContrastNote({ theme }: { theme: CourseTheme }) {
  const scheme = schemeOf(theme.scheme)
  const ratio = contrastRatio(theme.primaryColor, scheme.bg)
  const ok = ratio >= 4.5
  return (
    <p className={ok ? 'set-note' : 'set-warn'} role={ok ? undefined : 'status'}>
      {ok ? (
        <>Accent contrast {ratio.toFixed(1)}:1 against the page — clears WCAG AA for text.</>
      ) : (
        <>
          Accent contrast is {ratio.toFixed(1)}:1 against the page, below the 4.5:1 AA minimum.
          Links and small accent text will be darkened automatically so they stay readable; fills
          and rules keep your exact colour.
        </>
      )}
    </p>
  )
}

type SectionId = 'details' | 'presets' | 'theme' | 'layout' | 'completion' | 'reuse'

const SECTIONS: { id: SectionId; label: string; Icon: typeof BookOpen }[] = [
  { id: 'details', label: 'Details', Icon: BookOpen },
  { id: 'presets', label: 'Presets', Icon: Sparkles },
  { id: 'theme', label: 'Theme', Icon: Palette },
  { id: 'layout', label: 'Layout', Icon: Ruler },
  { id: 'completion', label: 'Completion', Icon: CheckCircle2 },
  { id: 'reuse', label: 'Reuse', Icon: Repeat },
]

/** Small always-visible rendering of the current theme, so you can judge a
    scheme or font change without opening the full Preview overlay. */
function ThemePreview() {
  const course = useStore((s) => s.course)!
  return (
    <div className="set-preview" style={courseVars(course) as React.CSSProperties} aria-hidden="true">
      <div className="set-preview__page">
        <div className="set-preview__hero">
          <span className="set-preview__title">{course.title || 'Course title'}</span>
        </div>
        <div className="set-preview__body">
          <span className="set-preview__h">A heading</span>
          <span className="set-preview__p">
            Body copy renders in the course font, at the course text size and spacing.
          </span>
          <span className="set-preview__note">A callout, tinted with the accent colour.</span>
          <span className="set-preview__btn">Continue</span>
        </div>
      </div>
    </div>
  )
}

function ThemeSeg<K extends keyof CourseTheme>({
  label, themeKey, options,
}: {
  label: string
  themeKey: K
  options: { value: CourseTheme[K] & string; label: string }[]
}) {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)
  return (
    <div className="set-row">
      <span className="set-row__label">{label}</span>
      <Segmented
        label={label}
        size="sm"
        value={course.theme[themeKey] as string}
        options={options}
        onChange={(v) => updateCourse({ theme: { ...course.theme, [themeKey]: v } })}
      />
    </div>
  )
}

export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)
  const saveCourseTemplate = useStore((s) => s.saveCourseTemplate)
  const courseTemplates = useStore((s) => s.courseTemplates)
  const [section, setSection] = useState<SectionId>('details')
  const [savingTpl, setSavingTpl] = useState(false)

  const theme = course.theme
  const completion = course.completion
  const logoSrc = resolveAssetSrc(theme.logo, course.assets)
  const quizCount = course.lessons.reduce(
    (n, l) => n + l.blocks.filter((b) => b.type === 'quiz').length,
    0
  )

  const setTheme = (patch: Partial<CourseTheme>) => updateCourse({ theme: { ...theme, ...patch } })
  const activePreset = matchingPreset(normalizeTheme(theme))
  const setCompletion = (patch: Partial<CompletionRules>) =>
    updateCourse({ completion: { ...completion, ...patch } })

  const noRules =
    !completion.allLessons && !completion.quizPass && !completion.minScore && !completion.minMinutes

  return (
    <Sheet
      title="Course settings"
      size="xl"
      onClose={onClose}
      className="set-sheet"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="set-layout">
        {/* Was one ~300-line scroll mixing metadata, theme, completion rules and
            templates. Sectioning it means each concern is a short, findable page. */}
        <nav className="set-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? 'page' : undefined}
              className={'set-nav__item' + (section === id ? ' is-active' : '')}
              onClick={() => setSection(id)}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="set-main">
          {section === 'details' && (
            <>
              <Field label="Description" hint="Shown on your dashboard card.">
                <Textarea
                  value={course.description}
                  placeholder="What will learners get from this course?"
                  onChange={(e) => updateCourse({ description: e.target.value })}
                />
              </Field>
              <Field label="Author" hint="Shown to learners in the course header.">
                <Input
                  value={course.author}
                  placeholder="e.g. Jane Doe, Learning & Development"
                  onChange={(e) => updateCourse({ author: e.target.value })}
                />
              </Field>
              <Field label="Cover image" hint="Used on the dashboard card only.">
                {course.coverImage ? (
                  <div className="img-preview">
                    <img
                      src={course.coverImage}
                      alt=""
                      style={{ maxHeight: 120, objectFit: 'cover', width: '100%', borderRadius: 8 }}
                    />
                    <div className="img-replace">
                      <Button size="sm" onClick={() => updateCourse({ coverImage: '' })}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  // raw: the dashboard shows this outside the course, where
                  // the asset library isn't loaded.
                  <UploadZone raw compact label="Add a cover image" onImage={(src) => updateCourse({ coverImage: src })} />
                )}
              </Field>
            </>
          )}

          {section === 'presets' && (
            <>
              <p className="set-note" style={{ marginTop: 0 }}>
                A starting point for the whole look — palette, type, headers, corners and spacing
                in one move. Everything stays editable afterwards in <strong>Theme</strong> and{' '}
                <strong>Layout</strong>, and your navigation, progress and title-page choices are
                left alone.
              </p>
              <div className="preset-grid" role="radiogroup" aria-label="Design presets">
                {THEME_PRESETS.map((p) => {
                  const s = SCHEMES.find((x) => x.id === p.theme.scheme) ?? SCHEMES[0]
                  const pack = FONT_PACKS.find((f) => f.id === p.theme.fontPack) ?? FONT_PACKS[0]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={activePreset === p.id}
                      className={'preset-card' + (activePreset === p.id ? ' sel' : '')}
                      onClick={() => setTheme(p.theme)}
                    >
                      <span
                        className="preset-swatch"
                        style={{
                          background: s.bgSoft,
                          borderColor: s.line,
                          borderRadius: p.theme.corners === 'sharp' ? 2 : 10,
                        }}
                        aria-hidden="true"
                      >
                        <span
                          className="preset-swatch__bar"
                          style={{ background: p.theme.primaryColor }}
                        />
                        <span
                          className="preset-swatch__type"
                          style={{
                            fontFamily: pack.heading,
                            color: s.ink,
                            fontWeight: p.theme.headingWeight === 'bold' ? 700 : 800,
                          }}
                        >
                          Ag
                        </span>
                        <span className="preset-swatch__line" style={{ background: s.line }} />
                        <span className="preset-swatch__line short" style={{ background: s.line }} />
                      </span>
                      <span className="tc-name">{p.name}</span>
                      <span className="tc-desc">{p.description}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {section === 'theme' && (
            <>
              <ThemePreview />
              <h3 className="set-h">Colour scheme</h3>
              {[
                { label: 'Light backgrounds', schemes: SCHEMES.filter((s) => !s.dark) },
                { label: 'Dark backgrounds', schemes: SCHEMES.filter((s) => s.dark) },
              ].map((group) => (
                <div key={group.label}>
                  <div className="set-sub">{group.label}</div>
                  <div
                    className="theme-grid"
                    role="radiogroup"
                    aria-label={`${group.label} colour schemes`}
                  >
                    {group.schemes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={theme.scheme === s.id}
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

              <h3 className="set-h">Accent colour</h3>
              <div className="swatches" role="radiogroup" aria-label="Accent colour">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={theme.primaryColor === c}
                    aria-label={c}
                    className={'swatch' + (theme.primaryColor === c ? ' sel' : '')}
                    style={{ background: c }}
                    onClick={() => setTheme({ primaryColor: c })}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  value={theme.primaryColor}
                  style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
                  onChange={(e) => setTheme({ primaryColor: e.target.value })}
                />
              </div>
              <ContrastNote theme={normalizeTheme(theme)} />

              <h3 className="set-h">Font pack</h3>
              <div className="theme-grid" role="radiogroup" aria-label="Font pack">
                {FONT_PACKS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={theme.fontPack === p.id}
                    className={'theme-card' + (theme.fontPack === p.id ? ' sel' : '')}
                    onClick={() => setTheme({ fontPack: p.id })}
                  >
                    <span className="font-sample" style={{ fontFamily: p.heading }}>Ag</span>
                    <span className="tc-name">{p.label}</span>
                    <span className="tc-desc">{p.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {section === 'layout' && (
            <>
              <ThemePreview />
              <h3 className="set-h">Structure</h3>
              <ThemeSeg
                label="Navigation"
                themeKey="nav"
                options={[
                  { value: 'side', label: 'Sidebar' },
                  { value: 'top', label: 'Top bar' },
                  { value: 'none', label: 'Linear' },
                ]}
              />
              {theme.nav === 'none' && (
                <p className="set-note">
                  Linear removes the lesson menu entirely — learners move only with Previous and
                  Continue. The usual choice for compliance training that must be taken in order.
                </p>
              )}
              <Checkbox
                label="Open on a title page"
                hint="A cover screen with the course title, author, description and contents, ahead of lesson 1."
                checked={theme.titlePage}
                onChange={(e) => setTheme({ titlePage: e.target.checked })}
              />
              <Checkbox
                label="Number the lessons"
                hint="Shows “1.”, “2.” … in the navigation and “Lesson 3 of 8” above each lesson title."
                checked={theme.lessonNumbers}
                onChange={(e) => setTheme({ lessonNumbers: e.target.checked })}
              />
              <ThemeSeg
                label="Progress"
                themeKey="progress"
                options={[
                  { value: 'bar', label: 'Bar' },
                  { value: 'steps', label: 'Steps' },
                  { value: 'none', label: 'Hidden' },
                ]}
              />

              <h3 className="set-h">Lesson header</h3>
              <ThemeSeg
                label="Style"
                themeKey="hero"
                options={[
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'solid', label: 'Solid' },
                  { value: 'split', label: 'Split' },
                  { value: 'image', label: 'Image' },
                  { value: 'minimal', label: 'Minimal' },
                ]}
              />
              {theme.hero === 'image' && (
                <p className={course.coverImage ? 'set-note' : 'set-warn'}>
                  {course.coverImage
                    ? 'Lessons use the course cover image by default. Give a lesson its own picture from Lesson style on the canvas.'
                    : 'No cover image set, so lessons fall back to the gradient header. Add one under Details, or give each lesson its own picture from Lesson style.'}
                </p>
              )}

              <h3 className="set-h">Type and space</h3>
              <ThemeSeg
                label="Content width"
                themeKey="width"
                options={[
                  { value: 'narrow', label: 'Narrow' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'wide', label: 'Wide' },
                ]}
              />
              <ThemeSeg
                label="Heading scale"
                themeKey="typeScale"
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'dramatic', label: 'Dramatic' },
                ]}
              />
              <ThemeSeg
                label="Corners"
                themeKey="corners"
                options={[{ value: 'soft', label: 'Rounded' }, { value: 'sharp', label: 'Square' }]}
              />
              <ThemeSeg
                label="Depth"
                themeKey="elevation"
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'soft', label: 'Soft' },
                  { value: 'raised', label: 'Raised' },
                ]}
              />
              <ThemeSeg
                label="Heading weight"
                themeKey="headingWeight"
                options={[{ value: 'extrabold', label: 'Extra bold' }, { value: 'bold', label: 'Bold' }]}
              />
              <ThemeSeg
                label="Text size"
                themeKey="fontScale"
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'large', label: 'Large' },
                ]}
              />
              <ThemeSeg
                label="Spacing"
                themeKey="spacing"
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'airy', label: 'Airy' },
                ]}
              />

              <h3 className="set-h">Branding</h3>
              <div className="set-row">
                <span className="set-row__label">Logo</span>
                {theme.logo ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={logoSrc} alt="Course logo" className="logo-preview" />
                    <Button size="sm" onClick={() => setTheme({ logo: '' })}>
                      Remove
                    </Button>
                  </span>
                ) : (
                  <span style={{ flex: 1, minWidth: 220 }}>
                    <UploadZone compact label="Add a logo for the course header" onImage={(logo) => setTheme({ logo })} />
                  </span>
                )}
              </div>
              <p className="set-note">
                Individual lessons can override the accent, scheme, header and header image from{' '}
                <strong>Lesson style</strong> on the canvas. Individual blocks can override their
                width and spacing from the inspector.
              </p>
            </>
          )}

          {section === 'completion' && (
            <>
              <p className="set-note" style={{ marginTop: 0 }}>
                What the learner must do before the player reports the course complete to the LMS.
              </p>
              <Checkbox
                label="Finish every lesson"
                hint="Each lesson must be completed with Continue / Finish."
                checked={completion.allLessons}
                onChange={(e) => setCompletion({ allLessons: e.target.checked })}
              />
              <Checkbox
                label="Pass every quiz"
                hint={
                  quizCount === 0
                    ? 'No quizzes in this course yet.'
                    : `Each of the ${quizCount} quiz${quizCount === 1 ? '' : 'zes'} must reach its own pass mark.`
                }
                disabled={quizCount === 0}
                checked={completion.quizPass}
                onChange={(e) => setCompletion({ quizPass: e.target.checked })}
              />
              <Field label="Minimum average quiz score" hint="0 turns this off.">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  style={{ width: 110 }}
                  disabled={quizCount === 0}
                  value={completion.minScore}
                  onChange={(e) =>
                    setCompletion({ minScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                  }
                />
              </Field>
              <Field label="Minimum time in the course" hint="Minutes. 0 turns this off — useful for compliance minimums.">
                <Input
                  type="number"
                  min={0}
                  max={600}
                  step={5}
                  style={{ width: 110 }}
                  value={completion.minMinutes}
                  onChange={(e) => setCompletion({ minMinutes: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
              {noRules && (
                <p className="set-warn" role="alert">
                  With every rule off, the course reports complete as soon as it is opened.
                </p>
              )}
            </>
          )}

          {section === 'reuse' && (
            <>
              <p className="set-note" style={{ marginTop: 0 }}>
                Save this course's lessons, blocks and theme as a starting point for new courses.
                {courseTemplates.length > 0 &&
                  ` You have ${courseTemplates.length} template${courseTemplates.length === 1 ? '' : 's'}.`}
              </p>
              <Button icon={<LayoutTemplate size={15} />} onClick={() => setSavingTpl(true)}>
                Save as course template
              </Button>
            </>
          )}
        </div>
      </div>

      {savingTpl && (
        <SaveTemplateDialog
          heading="Save as course template"
          hint="Templates live in your Template library, and are offered whenever you create a new course."
          defaultName={(course.title || 'Untitled course') + ' template'}
          withDescription
          onSave={(name, description) => saveCourseTemplate(name, description, course)}
          onClose={() => setSavingTpl(false)}
        />
      )}
    </Sheet>
  )
}
