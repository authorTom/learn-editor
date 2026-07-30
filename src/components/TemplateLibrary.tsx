import { useRef, useState } from 'react'
import { Trash2, Download, Upload, Bookmark, LayoutTemplate, Plus } from 'lucide-react'
import { useStore } from '../store'
import { Button, Surface, useConfirm, useToast } from '../ui'
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
  as = 'dialog',
}: {
  onClose: () => void
  onUseCourseTemplate: (templateId: string) => void
  /** 'panel' renders it bare for the right-hand dock. */
  as?: 'dialog' | 'panel'
}) {
  const {
    blockTemplates,
    courseTemplates,
    deleteBlockTemplate,
    deleteCourseTemplate,
    importTemplates,
  } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
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
      if (n === 0) toast.show('That library file was empty — nothing to import.')
      else toast.success(`Imported ${n} template${n === 1 ? '' : 's'}.`)
    } catch {
      toast.error('That file isn’t a Learn Editor template library. Use the JSON file saved by Export library.')
    }
  }

  const empty = blockTemplates.length === 0 && courseTemplates.length === 0

  const tabs = [
    { id: 'courses' as const, label: `Course templates (${courseTemplates.length})`, Icon: LayoutTemplate },
    { id: 'blocks' as const, label: `Saved blocks (${blockTemplates.length})`, Icon: Bookmark },
  ]

  return (
    <Surface
      as={as}
      title="Template library"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button size={as === 'panel' ? 'sm' : 'md'} icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button size={as === 'panel' ? 'sm' : 'md'} icon={<Download size={15} />} disabled={empty} onClick={exportLibrary}>
            Export
          </Button>
          <span style={{ flex: 1 }} />
          {as === 'dialog' && (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          )}
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
        </>
      }
    >
        {/* Real tablist: arrow keys move between tabs, and each panel is
            associated with its tab rather than being an anonymous div. */}
        <div
          className="tpl-tabs"
          role="tablist"
          aria-label="Template type"
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!dir) return
            e.preventDefault()
            const i = tabs.findIndex((t) => t.id === tab)
            setTab(tabs[(i + dir + tabs.length) % tabs.length].id)
          }}
        >
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              id={`tpl-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`tpl-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`tpl-panel-${tab}`}
          aria-labelledby={`tpl-tab-${tab}`}
          tabIndex={0}
        >
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
                      aria-label="Delete template" onClick={async () => {
                        const ok = await confirm({
                          title: `Delete the template “${t.name}”?`,
                          message:
                            'Courses already created from this template keep their own copy and are unaffected. Deleting a template cannot be undone.',
                          confirmLabel: 'Delete template',
                          destructive: true,
                        })
                        if (ok) deleteCourseTemplate(t.id)
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
                      aria-label="Delete saved block" onClick={async () => {
                        const ok = await confirm({
                          title: `Remove “${t.name}” from your block library?`,
                          message:
                            'Blocks you already inserted from it stay where they are. This only removes it from the Add-a-block menu.',
                          confirmLabel: 'Remove',
                          destructive: true,
                        })
                        if (ok) deleteBlockTemplate(t.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
    </Surface>
  )
}
