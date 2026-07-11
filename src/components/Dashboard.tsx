import { useRef, useState } from 'react'
import { BookOpen, Plus, Upload, Copy, Trash2, GraduationCap } from 'lucide-react'
import { useStore } from '../store'
import type { Course } from '../types'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function Dashboard() {
  const { courses, loaded, createCourse, openCourse, deleteCourse, duplicateCourse, importCourse } =
    useStore()
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
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
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import
          </button>
          <button className="btn primary" onClick={() => setShowNew(true)}>
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
          <button className="btn primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New course
          </button>
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
                    if (e.key === 'Enter' && title.trim()) {
                      createCourse(title.trim())
                      setShowNew(false)
                      setTitle('')
                    }
                  }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!title.trim()}
                onClick={() => {
                  createCourse(title.trim())
                  setShowNew(false)
                  setTitle('')
                }}
              >
                Create course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
