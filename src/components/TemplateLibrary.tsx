import { useRef, useState } from 'react'
import { X, Trash2, Download, Upload, Bookmark, LayoutTemplate, Plus } from 'lucide-react'
import { useStore } from '../store'
import { blockDefs } from '../blockDefaults'
import { downloadBlob } from '../utils/file'
import type { BlockType, TemplateLibraryFile } from '../types'

function typeLabel(type: BlockType): string {
  return blockDefs.find((d) => d.type === type)?.label ?? type
}

/** Manages both libraries and moves them between browsers as a JSON file. */
export default function TemplateLibrary({
  onClose,
  onUseCourseTemplate,
}: {
  onClose: () => void
  onUseCourseTemplate: (templateId: string) => void
}) {
  const {
    blockTemplates,
    courseTemplates,
    deleteBlockTemplate,
    deleteCourseTemplate,
    importTemplates,
  } = useStore()
  const [tab, setTab] = useState<'courses' | 'blocks'>('courses')
  const fileRef = useRef<HTMLInputElement>(null)

  function exportLibrary() {
    const data: TemplateLibraryFile = {
      kind: 'learn-editor-templates',
      version: 1,
      blockTemplates,
      courseTemplates,
    }
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'learn-editor-templates.json'
    )
  }

  async function importLibrary(file: File) {
    try {
      const data = JSON.parse(await file.text()) as TemplateLibraryFile
      if (data.kind !== 'learn-editor-templates') throw new Error('bad format')
      const n = await importTemplates(data.blockTemplates ?? [], data.courseTemplates ?? [])
      alert(n === 0 ? 'That library file was empty.' : `Imported ${n} template${n === 1 ? '' : 's'}.`)
    } catch {
      alert('Could not import: this is not a valid Learn Editor template library file.')
    }
  }

  const empty = blockTemplates.length === 0 && courseTemplates.length === 0

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Template library</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="tpl-tabs">
          <button
            className={tab === 'courses' ? 'active' : ''}
            onClick={() => setTab('courses')}
          >
            <LayoutTemplate size={14} /> Course templates ({courseTemplates.length})
          </button>
          <button className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')}>
            <Bookmark size={14} /> Saved blocks ({blockTemplates.length})
          </button>
        </div>

        <div className="modal-body">
          {tab === 'courses' &&
            (courseTemplates.length === 0 ? (
              <p className="drop-hint">
                No course templates yet. Open a course and choose <strong>Save as template</strong>{' '}
                (in Settings, or from the course card menu) to reuse its lessons, blocks and theme
                as the starting point for new courses.
              </p>
            ) : (
              <div className="tpl-list">
                {courseTemplates.map((t) => (
                  <div key={t.id} className="tpl-row">
                    <span
                      className="tpl-thumb"
                      style={
                        t.coverImage
                          ? { backgroundImage: `url(${t.coverImage})` }
                          : { background: t.theme.primaryColor }
                      }
                    />
                    <span className="tpl-text">
                      <div className="tpl-name">{t.name}</div>
                      <div className="tpl-meta">
                        {t.lessons.length} lesson{t.lessons.length === 1 ? '' : 's'} ·{' '}
                        {t.lessons.reduce((n, l) => n + l.blocks.length, 0)} blocks
                        {t.description ? ` · ${t.description}` : ''}
                      </div>
                    </span>
                    <button className="btn sm" onClick={() => onUseCourseTemplate(t.id)}>
                      <Plus size={13} /> New course
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete template"
                      onClick={() => {
                        if (confirm(`Delete the template "${t.name}"?`)) deleteCourseTemplate(t.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'blocks' &&
            (blockTemplates.length === 0 ? (
              <p className="drop-hint">
                No saved blocks yet. In a lesson, hover a block and click the bookmark icon to save
                it here — it will then be available from the Add-a-block menu in every course.
              </p>
            ) : (
              <div className="tpl-list">
                {blockTemplates.map((t) => (
                  <div key={t.id} className="tpl-row">
                    <span className="tpl-thumb icon">
                      <Bookmark size={16} />
                    </span>
                    <span className="tpl-text">
                      <div className="tpl-name">{t.name}</div>
                      <div className="tpl-meta">{typeLabel(t.blockType)} block</div>
                    </span>
                    <button
                      className="icon-btn danger"
                      title="Delete saved block"
                      onClick={() => {
                        if (confirm(`Remove "${t.name}" from your block library?`))
                          deleteBlockTemplate(t.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import library
          </button>
          <button className="btn" disabled={empty} onClick={exportLibrary}>
            <Download size={15} /> Export library
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importLibrary(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}
