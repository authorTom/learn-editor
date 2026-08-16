import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Plus, Upload, Copy, Trash2, GraduationCap, LayoutTemplate, FilePlus2,
  Check, Sparkles, Search, MoreHorizontal, LayoutGrid, Rows3,
  ArrowRight, MessageSquare, HelpCircle, Database,
} from 'lucide-react'
import { useStore } from '../store'
import { openCommentCount, useReviews } from '../review/reviewStore'
import { Button, Dialog, Field, IconButton, Input, Popover, Segmented, useConfirm, useToast } from '../ui'
import SaveTemplateDialog from './SaveTemplateDialog'
import TemplateLibrary from './TemplateLibrary'
import UserMenu from './auth/UserMenu'
import SyncStatus from './SyncStatus'
import { EXAMPLE_COURSE, fetchExampleCourse } from '../exampleCourse'
import type { Course, CourseMeta } from '../types'

type Sort = 'recent' | 'title' | 'lessons'
type View = 'grid' | 'list'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Deterministic cover for courses with no image, so cards are distinguishable
    at a glance instead of all sharing the same indigo→violet gradient. */
function coverFor(id: string): string {
  const hues = [212, 258, 288, 330, 12, 32, 152, 186]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const hue = hues[h % hues.length]
  return `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 38) % 360} 58% 42%))`
}

/** Bytes the origin is using, when the browser will say. Worth surfacing on a
    tool whose whole premise is that the work lives in this browser: an author
    with 40 image-heavy courses is the one person who needs to know there is a
    ceiling, and they currently find out by losing something. */
function useStorageEstimate() {
  const [used, setUsed] = useState<{ usage: number; quota: number } | null>(null)
  useEffect(() => {
    if (!navigator.storage?.estimate) return
    let live = true
    navigator.storage.estimate().then((e) => {
      if (live && e.usage != null && e.quota) setUsed({ usage: e.usage, quota: e.quota })
    })
    return () => { live = false }
  }, [])
  return used
}

/** A course in one phrase. Falls back to lessons alone for records written
    before block counts were carried on the meta. */
function describe(c: CourseMeta): string {
  const parts = [`${c.lessonCount} lesson${c.lessonCount === 1 ? '' : 's'}`]
  if (c.blockCount) parts.push(`${c.blockCount} blocks`)
  return parts.join(' · ')
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
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
  const confirm = useConfirm()
  const toast = useToast()
  const [showNew, setShowNew] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const storage = useStorageEstimate()
  // Sorting is user-controlled, so the resume card takes the newest by date
  // rather than whatever happens to be first in the current view.
  const mostRecent = useMemo(
    () => [...courses].sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [courses]
  )
  const reviews = useReviews((r) => r.reviews)
  const loadReviews = useReviews((r) => r.loadReviews)
  useEffect(() => { void loadReviews() }, [loadReviews])
  const [templateId, setTemplateId] = useState<string | null>(null) // null = blank course
  const [title, setTitle] = useState('')
  const [savingTplFor, setSavingTplFor] = useState<string | null>(null)
  const [loadingExample, setLoadingExample] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<View>('grid')
  const fileRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? courses.filter(
          (c) =>
            c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)
        )
      : courses
    const sorted = [...filtered]
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'lessons') sorted.sort((a, b) => b.lessonCount - a.lessonCount)
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt)
    return sorted
  }, [courses, query, sort])

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Course
      if (!data.lessons || !Array.isArray(data.lessons)) throw new Error('bad format')
      const course = await importCourse(data)
      toast.success(`Imported “${course.title || 'Untitled course'}”.`)
    } catch {
      toast.error('That file isn’t a Quoin course export. Look for the JSON file you saved from Export → JSON backup.')
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
      toast.error('Could not load the example course. Check your connection and try again.')
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

  async function removeCourse(c: (typeof courses)[number]) {
    const ok = await confirm({
      title: `Delete “${c.title || 'Untitled course'}”?`,
      message:
        'This permanently removes the course and its media from this browser. Unlike edits inside a course, deleting one cannot be undone — export a JSON backup first if you might want it back.',
      confirmLabel: 'Delete course',
      destructive: true,
    })
    if (ok) {
      await deleteCourse(c.id)
      toast.show(`Deleted “${c.title || 'Untitled course'}”.`)
    }
  }

  const isEmpty = loaded && courses.length === 0

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-brand">
          <div className="dash-brand__logo" aria-hidden="true">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1>Quoin</h1>
            <p className="dash-brand__sub">
              Author responsive SCORM e-learning courses
              {storage && (
                <span className="dash-storage" title="Held in this browser's storage">
                  <Database size={11} aria-hidden="true" />
                  {formatBytes(storage.usage)} in this browser
                </span>
              )}
              {/* Says the other half of the truth when there is a server:
                  where the work exists besides this machine, and when it
                  last got there. Renders nothing in local mode. */}
              <SyncStatus />
            </p>
          </div>
        </div>
        <div className="dash-actions">
          <Button icon={<Sparkles size={15} />} disabled={loadingExample} onClick={loadExample}>
            {loadingExample ? 'Loading…' : 'Example'}
          </Button>
          <Button icon={<LayoutTemplate size={15} />} onClick={() => setShowLibrary(true)}>
            Templates
          </Button>
          <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => openNew()}>
            New course
          </Button>
          {/* Renders nothing at all in local mode — no server, no account. */}
          <UserMenu />
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
      </header>

      {isEmpty ? (
        <div className="dash-empty">
          <div className="dash-empty__icon" aria-hidden="true">
            <GraduationCap size={30} />
          </div>
          <h2>Create your first course</h2>
          <p>Build responsive e-learning and export it as SCORM for any LMS.</p>
          <div className="dash-empty__actions">
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => openNew()}>
              New course
            </Button>
            <Button icon={<Sparkles size={15} />} disabled={loadingExample} onClick={loadExample}>
              {loadingExample ? 'Loading…' : 'Open the example course'}
            </Button>
          </div>
          <p className="dash-empty__blurb">{EXAMPLE_COURSE.blurb}</p>
        </div>
      ) : (
        <>
          {/* Only worth showing once there is enough to search through. */}
          {courses.length > 3 && (
            <div className="dash-toolbar">
              <div className="dash-search">
                <Search size={15} aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Search courses"
                  placeholder="Search courses…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Segmented
                label="Sort by"
                size="sm"
                value={sort}
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'title', label: 'Title' },
                  { value: 'lessons', label: 'Lessons' },
                ]}
                onChange={setSort}
              />
              <Segmented
                label="View"
                size="sm"
                value={view}
                options={[
                  { value: 'grid', label: <LayoutGrid size={14} />, srLabel: 'Grid view' },
                  { value: 'list', label: <Rows3 size={14} />, srLabel: 'List view' },
                ]}
                onChange={setView}
              />
            </div>
          )}

          {mostRecent && !query && (
            <button className="dash-resume" onClick={() => openCourse(mostRecent.id)}>
              <span
                className="dash-resume__cover"
                style={
                  mostRecent.coverImage
                    ? { backgroundImage: `url(${mostRecent.coverImage})` }
                    : { backgroundImage: coverFor(mostRecent.id) }
                }
                aria-hidden="true"
              />
              <span className="dash-resume__body">
                <span className="dash-resume__kicker">Pick up where you left off</span>
                <span className="dash-resume__title">{mostRecent.title || 'Untitled course'}</span>
                <span className="dash-resume__meta">
                  {describe(mostRecent)} · edited {timeAgo(mostRecent.updatedAt)}
                </span>
              </span>
              <span className="dash-resume__go" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </button>
          )}

          {visible.length === 0 ? (
            <p className="dash-none">No courses match “{query}”.</p>
          ) : (
            <ul className={'course-list course-list--' + view}>
              {visible.map((c) => (
                <li key={c.id}>
                  <div className="course-card">
                    {/* The whole card is clickable, but the accessible control
                        is this one button, so the menu inside is not nested
                        inside an interactive element. */}
                    <button
                      className="course-card__open"
                      onClick={() => openCourse(c.id)}
                    >
                      <span
                        className="course-card__cover"
                        style={
                          c.coverImage
                            ? { backgroundImage: `url(${c.coverImage})` }
                            : { backgroundImage: coverFor(c.id) }
                        }
                        aria-hidden="true"
                      />
                      <span className="course-card__body">
                        <span className="course-card__title">{c.title || 'Untitled course'}</span>
                        <span className="course-card__desc">
                          {c.description || 'No description yet.'}
                        </span>
                        <span className="course-card__meta">
                          <BookOpen size={12} aria-hidden="true" />
                          {describe(c)} · {timeAgo(c.updatedAt)}
                        </span>
                        <span className="course-card__tags">
                          {!!c.quizCount && (
                            <span className="dash-tag">
                              <HelpCircle size={11} aria-hidden="true" />
                              {c.quizCount} quiz{c.quizCount === 1 ? '' : 'zes'}
                            </span>
                          )}
                          {openCommentCount(reviews, c.id) > 0 && (
                            <span className="dash-tag dash-tag--review">
                              <MessageSquare size={11} aria-hidden="true" />
                              {openCommentCount(reviews, c.id)} open
                            </span>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="course-card__menu">
                      <Popover
                        label={`Actions for ${c.title || 'Untitled course'}`}
                        align="end"
                        className="menu-pop"
                        trigger={
                          <IconButton
                            label={`Actions for ${c.title || 'Untitled course'}`}
                            icon={<MoreHorizontal size={16} />}
                          />
                        }
                      >
                        {({ close }) => (
                          <div>
                            <button
                              className="menu-item"
                              onClick={() => {
                                duplicateCourse(c.id)
                                close()
                              }}
                            >
                              <Copy size={15} aria-hidden="true" /> Duplicate
                            </button>
                            <button
                              className="menu-item"
                              onClick={() => {
                                setSavingTplFor(c.id)
                                close()
                              }}
                            >
                              <LayoutTemplate size={15} aria-hidden="true" /> Save as template
                            </button>
                            <button
                              className="menu-item is-danger"
                              onClick={() => {
                                close()
                                removeCourse(c)
                              }}
                            >
                              <Trash2 size={15} aria-hidden="true" /> Delete
                            </button>
                          </div>
                        )}
                      </Popover>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showNew && (
        <Dialog
          title="New course"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <Button onClick={() => setShowNew(false)}>Cancel</Button>
              <Button variant="primary" disabled={!title.trim()} onClick={create}>
                Create course
              </Button>
            </>
          }
        >
          <Field label="Course title" required>
            <Input
              data-autofocus
              placeholder="e.g. Workplace Safety Essentials"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create()
              }}
            />
          </Field>

          <div className="ui-field">
            <span className="ui-field__label" id="start-from-label">
              Start from
            </span>
            <div className="tpl-choice" role="radiogroup" aria-labelledby="start-from-label">
              <button
                type="button"
                role="radio"
                aria-checked={templateId === null}
                className={'tpl-option' + (templateId === null ? ' sel' : '')}
                onClick={() => setTemplateId(null)}
              >
                <span className="to-icon" aria-hidden="true">
                  <FilePlus2 size={16} />
                </span>
                <span className="tpl-text">
                  <div className="tpl-name">Blank course</div>
                  <div className="tpl-meta">One empty lesson, default theme</div>
                </span>
                {templateId === null && <Check size={15} className="to-check" aria-hidden="true" />}
              </button>

              {courseTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={templateId === t.id}
                  className={'tpl-option' + (templateId === t.id ? ' sel' : '')}
                  onClick={() => setTemplateId(t.id)}
                >
                  <span
                    className="to-icon"
                    aria-hidden="true"
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
                  {templateId === t.id && <Check size={15} className="to-check" aria-hidden="true" />}
                </button>
              ))}
            </div>
            {courseTemplates.length === 0 && (
              <p className="ui-field__hint">
                Tip: save any course as a template to reuse its lessons and theme here.
              </p>
            )}
          </div>
        </Dialog>
      )}

      {savingTplFor && (
        <SaveTemplateDialog
          heading="Save as course template"
          hint="The template copies this course's lessons, blocks and theme. New courses started from it get their own copy — later edits to either side stay separate."
          defaultName={
            (courses.find((c) => c.id === savingTplFor)?.title || 'Untitled course') + ' template'
          }
          withDescription
          onSave={(name, description) => saveCourseTemplateById(name, description, savingTplFor)}
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
