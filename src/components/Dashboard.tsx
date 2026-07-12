import { useRef, useState } from 'react'
import {
  BookOpen, Plus, Upload, Copy, Trash2, GraduationCap, LayoutTemplate, FilePlus2, Check, Sparkles,
} from 'lucide-react'
import { useStore } from '../store'
import SaveTemplateDialog from './SaveTemplateDialog'
import TemplateLibrary from './TemplateLibrary'
import { EXAMPLE_COURSE, fetchExampleCourse } from '../exampleCourse'
import type { Course } from '../types'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function Dashboard() {
  const {
    courses,
    loaded,
    courseTemplates,
    createCourse,
    createCourseFromTemplate,
    openCourse,
    deleteCourse,
    duplicateCourse,
    importCourse,
    saveCourseTemplateById,
  } = useStore()
  const [showNew, setShowNew] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null) // null = blank course
  const [title, setTitle] = useState('')
  const [savingTplFor, setSavingTplFor] = useState<string | null>(null) // course id
  const [loadingExample, setLoadingExample] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Course
      if (!data.lessons || !Array.isArray(data.lessons)) throw new Error('bad format')
      await importCourse(data)
    } catch {
      alert('Could not import: this is not a valid Learn Editor course file.')
    }
  }

  /** Seed the bundled exemplar — or just open it if it is already here, so the
      button can't quietly fill the dashboard with copies. */
  async function loadExample() {
    const existing = courses.find((c) => c.title === EXAMPLE_COURSE.title)
    if (existing) {
      openCourse(existing.id)
      return
    }
    setLoadingExample(true)
    try {
      const course = await importCourse(await fetchExampleCourse())
      await openCourse(course.id)
    } catch {
      alert('Could not load the example course. Check your connection and try again.')
    } finally {
      setLoadingExample(false)
    }
  }

  function openNew(fromTemplate: string | null = null) {
    setTemplateId(fromTemplate)
    setTitle('')
    setShowNew(true)
  }

  function create() {
    if (!title.trim()) return
    if (templateId) createCourseFromTemplate(title.trim(), templateId)
    else createCourse(title.trim())
    setShowNew(false)
    setTitle('')
    setTemplateId(null)
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <div className="dash-brand">
          <div className="logo">
            <GraduationCap size={23} />
          </div>
          <div>
            <h1>Learn Editor</h1>
            <div className="sub">Author responsive SCORM e-learning courses</div>
          </div>
        </div>
        <div className="dash-actions">
          <button
            className="btn"
            title={EXAMPLE_COURSE.blurb}
            disabled={loadingExample}
            onClick={loadExample}
          >
            <Sparkles size={15} /> {loadingExample ? 'Loading…' : 'Example'}
          </button>
          <button className="btn" onClick={() => setShowLibrary(true)}>
            <LayoutTemplate size={15} /> Templates
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import
          </button>
          <button className="btn primary" onClick={() => openNew()}>
            <Plus size={15} /> New course
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {loaded && courses.length === 0 ? (
        <div className="empty-state">
          <div className="big">🎓</div>
          <h2>Create your first course</h2>
          <p>Build beautiful, responsive e-learning and export it as SCORM for any LMS.</p>
          <div className="empty-actions">
            <button className="btn primary" onClick={() => openNew()}>
              <Plus size={15} /> New course
            </button>
            <button className="btn" disabled={loadingExample} onClick={loadExample}>
              <Sparkles size={15} /> {loadingExample ? 'Loading…' : 'Open the example course'}
            </button>
          </div>
          <p className="example-blurb">{EXAMPLE_COURSE.blurb}</p>
        </div>
      ) : (
        <div className="course-grid">
          {courses.map((c) => (
            <div key={c.id} className="course-card" onClick={() => openCourse(c.id)}>
              <div
                className="card-cover"
                style={c.coverImage ? { backgroundImage: `url(${c.coverImage})` } : undefined}
              />
              <div className="card-body">
                <h3>{c.title || 'Untitled course'}</h3>
                <div className="desc">{c.description || 'No description yet.'}</div>
                <div className="card-meta">
                  <span>
                    <BookOpen size={11} style={{ verticalAlign: '-1px' }} /> {c.lessonCount} lesson
                    {c.lessonCount === 1 ? '' : 's'} · {timeAgo(c.updatedAt)}
                  </span>
                  <span className="card-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn"
                      title="Save as course template"
                      onClick={() => setSavingTplFor(c.id)}
                    >
                      <LayoutTemplate size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      title="Duplicate"
                      onClick={() => duplicateCourse(c.id)}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete "${c.title}"? This cannot be undone.`)) deleteCourse(c.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="modal-scrim" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>New course</h2>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Course title</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Workplace Safety Essentials"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') create()
                  }}
                />
              </div>

              <div className="field">
                <label>Start from</label>
                <div className="tpl-choice">
                  <button
                    className={'tpl-option' + (templateId === null ? ' sel' : '')}
                    onClick={() => setTemplateId(null)}
                  >
                    <span className="to-icon">
                      <FilePlus2 size={16} />
                    </span>
                    <span className="tpl-text">
                      <div className="tpl-name">Blank course</div>
                      <div className="tpl-meta">One empty lesson, default theme</div>
                    </span>
                    {templateId === null && <Check size={15} className="to-check" />}
                  </button>

                  {courseTemplates.map((t) => (
                    <button
                      key={t.id}
                      className={'tpl-option' + (templateId === t.id ? ' sel' : '')}
                      onClick={() => setTemplateId(t.id)}
                    >
                      <span
                        className="to-icon"
                        style={{ background: t.theme.primaryColor, color: '#fff' }}
                      >
                        <LayoutTemplate size={16} />
                      </span>
                      <span className="tpl-text">
                        <div className="tpl-name">{t.name}</div>
                        <div className="tpl-meta">
                          {t.lessons.length} lesson{t.lessons.length === 1 ? '' : 's'} ·{' '}
                          {t.lessons.reduce((n, l) => n + l.blocks.length, 0)} blocks
                        </div>
                      </span>
                      {templateId === t.id && <Check size={15} className="to-check" />}
                    </button>
                  ))}
                </div>
                {courseTemplates.length === 0 && (
                  <p className="drop-hint">
                    Tip: save any course as a template to reuse its lessons and theme here.
                  </p>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={!title.trim()} onClick={create}>
                Create course
              </button>
            </div>
          </div>
        </div>
      )}

      {savingTplFor && (
        <SaveTemplateDialog
          heading="Save as course template"
          hint="The template copies this course's lessons, blocks and theme. New courses started from it get their own copy — later edits to either side stay separate."
          defaultName={
            (courses.find((c) => c.id === savingTplFor)?.title || 'Untitled course') + ' template'
          }
          withDescription
          onSave={(name, description) =>
            saveCourseTemplateById(name, description, savingTplFor)
          }
          onClose={() => setSavingTplFor(null)}
        />
      )}

      {showLibrary && (
        <TemplateLibrary
          onClose={() => setShowLibrary(false)}
          onUseCourseTemplate={(id) => {
            setShowLibrary(false)
            openNew(id)
          }}
        />
      )}
    </div>
  )
}
