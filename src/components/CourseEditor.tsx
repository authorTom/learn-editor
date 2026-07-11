import { useState } from 'react'
import { ArrowLeft, Eye, Settings, Share, PanelLeft } from 'lucide-react'
import { useStore } from '../store'
import OutlineSidebar from './OutlineSidebar'
import LessonEditor from './LessonEditor'
import Preview from './Preview'
import ExportDialog from './ExportDialog'
import SettingsDialog from './SettingsDialog'

export default function CourseEditor() {
  const course = useStore((s) => s.course)!
  const saveState = useStore((s) => s.saveState)
  const closeCourse = useStore((s) => s.closeCourse)
  const updateCourse = useStore((s) => s.updateCourse)
  const [showPreview, setShowPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)

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
        <span className={'save-state' + (saveState === 'saving' ? ' saving' : '')}>
          <span className="dot" /> {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </span>
        <span className="topbar-spacer" />
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
    </div>
  )
}
