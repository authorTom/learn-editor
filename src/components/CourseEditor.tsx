import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Settings, Share, PanelLeft, Undo2, Redo2, Images } from 'lucide-react'
import { useStore } from '../store'
import OutlineSidebar from './OutlineSidebar'
import LessonEditor from './LessonEditor'
import Preview from './Preview'
import ExportDialog from './ExportDialog'
import SettingsDialog from './SettingsDialog'
import MediaLibrary from './MediaLibrary'

export default function CourseEditor() {
  const course = useStore((s) => s.course)!
  const saveState = useStore((s) => s.saveState)
  const closeCourse = useStore((s) => s.closeCourse)
  const updateCourse = useStore((s) => s.updateCourse)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const [showPreview, setShowPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMedia, setShowMedia] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      // Inside a rich-text block, TipTap's own history owns ⌘Z.
      const el = document.activeElement
      if (el && el.closest('.tiptap')) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return (
    <div className={'editor' + (outlineOpen ? ' outline-open' : '')}>
      <div className="editor-topbar">
        <button className="icon-btn" title="Back to courses" onClick={closeCourse}>
          <ArrowLeft size={17} />
        </button>
        <button
          className="icon-btn"
          title="Toggle outline"
          style={{ display: 'none' }}
          id="outline-toggle"
          onClick={() => setOutlineOpen((v) => !v)}
        >
          <PanelLeft size={17} />
        </button>
        <input
          className="course-title-input"
          value={course.title}
          placeholder="Untitled course"
          onChange={(e) => updateCourse({ title: e.target.value })}
        />
        <span className="undo-group">
          <button className="icon-btn" title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button className="icon-btn" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>
            <Redo2 size={16} />
          </button>
        </span>
        <span className={'save-state' + (saveState === 'saving' ? ' saving' : '')}>
          <span className="dot" /> {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </span>
        <span className="topbar-spacer" />
        <button className="btn" onClick={() => setShowMedia(true)}>
          <Images size={15} /> Media
        </button>
        <button className="btn" onClick={() => setShowSettings(true)}>
          <Settings size={15} /> Settings
        </button>
        <button className="btn" onClick={() => setShowPreview(true)}>
          <Eye size={15} /> Preview
        </button>
        <button className="btn primary" onClick={() => setShowExport(true)}>
          <Share size={15} /> Export
        </button>
      </div>

      <div className="editor-main">
        <OutlineSidebar />
        <LessonEditor />
      </div>

      {showPreview && <Preview course={course} onClose={() => setShowPreview(false)} />}
      {showExport && <ExportDialog course={course} onClose={() => setShowExport(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showMedia && <MediaLibrary onClose={() => setShowMedia(false)} />}
    </div>
  )
}
