import { X } from 'lucide-react'
import { useStore } from '../store'
import { UploadZone } from './blocks/MediaBlocks'

const THEME_COLORS = [
  '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#334155',
]

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Course settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Description (shown on your dashboard)</label>
            <textarea
              value={course.description}
              placeholder="What will learners get from this course?"
              onChange={(e) => updateCourse({ description: e.target.value })}
            />
          </div>
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
                <img src={course.coverImage} alt="Cover" style={{ maxHeight: 140, objectFit: 'cover', width: '100%' }} />
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
          <div className="field">
            <label>Theme colour (used throughout the course player)</label>
            <div className="swatches">
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (course.theme.primaryColor === c ? ' sel' : '')}
                  style={{ background: c }}
                  title={c}
                  onClick={() => updateCourse({ theme: { ...course.theme, primaryColor: c } })}
                />
              ))}
              <input
                type="color"
                value={course.theme.primaryColor}
                title="Custom colour"
                style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
                onChange={(e) => updateCourse({ theme: { ...course.theme, primaryColor: e.target.value } })}
              />
            </div>
          </div>
          <div className="field">
            <label>Body font</label>
            <span className="seg">
              {(['inter', 'serif'] as const).map((f) => (
                <button
                  key={f}
                  className={course.theme.font === f ? 'active' : ''}
                  onClick={() => updateCourse({ theme: { ...course.theme, font: f } })}
                >
                  {f === 'inter' ? 'Modern (Inter)' : 'Classic (Serif)'}
                </button>
              ))}
            </span>
          </div>
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
