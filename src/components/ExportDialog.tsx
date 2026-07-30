import { useRef, useState } from 'react'
import { Package, Globe, FileJson, Download, Loader2, Check } from 'lucide-react'
import type { Course } from '../types'
import { exportScorm, exportWeb, exportJson } from '../scorm/exporter'
import { Button, Dialog, useToast } from '../ui'

type Format = 'scorm12' | 'scorm2004' | 'web' | 'json'

const OPTIONS: { v: Format; icon: typeof Package; title: string; desc: string }[] = [
  {
    v: 'scorm12',
    icon: Package,
    title: 'SCORM 1.2 package',
    desc: 'The most widely supported standard — works in virtually every LMS (Moodle, Canvas, Blackboard, TalentLMS, SCORM Cloud…). Reports completion and quiz scores.',
  },
  {
    v: 'scorm2004',
    icon: Package,
    title: 'SCORM 2004 (4th Ed.) package',
    desc: 'Newer standard with richer status reporting (completion + pass/fail separately). Choose this if your LMS prefers 2004.',
  },
  {
    v: 'web',
    icon: Globe,
    title: 'Standalone web version',
    desc: 'A zip with a single index.html — host it anywhere or open it locally. No LMS tracking.',
  },
  {
    v: 'json',
    icon: FileJson,
    title: 'Course backup (.json)',
    desc: 'Editable source file you can re-import into Learn Editor on any machine.',
  },
]

export default function ExportDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const [format, setFormat] = useState<Format>('scorm12')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  async function doExport() {
    setBusy(true)
    try {
      if (format === 'scorm12') await exportScorm(course, '1.2')
      else if (format === 'scorm2004') await exportScorm(course, '2004')
      else if (format === 'web') await exportWeb(course)
      else exportJson(course)
      toast.success('Package downloaded.')
      onClose()
    } catch {
      toast.error('Export failed. If the course has a lot of media, try removing unused files from the media library first.')
    } finally {
      setBusy(false)
    }
  }

  /** Arrow keys move and select, per the APG radiogroup pattern. */
  function onKeyDown(e: React.KeyboardEvent) {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const i = OPTIONS.findIndex((o) => o.v === format)
    const next = (i + dir + OPTIONS.length) % OPTIONS.length
    setFormat(OPTIONS[next].v)
    refs.current[next]?.focus()
  }

  return (
    <Dialog
      title="Export course"
      description="Pick a format. The package contains the whole course — no server or account needed."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            icon={busy ? <Loader2 size={15} className="ui-spin" /> : <Download size={15} />}
            onClick={doExport}
          >
            {busy ? 'Packaging…' : 'Download'}
          </Button>
        </>
      }
    >
      {/* Was a list of <div onClick> — invisible to the keyboard and to assistive
          tech, with no indication the four choices were mutually exclusive. */}
      <div role="radiogroup" aria-label="Export format" onKeyDown={onKeyDown}>
        {OPTIONS.map((o, i) => {
          const Icon = o.icon
          const selected = format === o.v
          return (
            <button
              key={o.v}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={'export-opt' + (selected ? ' sel' : '')}
              onClick={() => setFormat(o.v)}
            >
              <span className="xo-icon" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="xo-text">
                <h4>{o.title}</h4>
                <p>{o.desc}</p>
              </span>
              {selected && <Check size={16} className="xo-check" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
