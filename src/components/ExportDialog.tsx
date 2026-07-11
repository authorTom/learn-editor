import { useState } from 'react'
import { X, Package, Globe, FileJson, Download, Loader2 } from 'lucide-react'
import type { Course } from '../types'
import { exportScorm, exportWeb, exportJson } from '../scorm/exporter'

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

  async function doExport() {
    setBusy(true)
    try {
      if (format === 'scorm12') await exportScorm(course, '1.2')
      else if (format === 'scorm2004') await exportScorm(course, '2004')
      else if (format === 'web') await exportWeb(course)
      else exportJson(course)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Export course</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          {OPTIONS.map((o) => {
            const Icon = o.icon
            return (
              <div
                key={o.v}
                className={'export-opt' + (format === o.v ? ' sel' : '')}
                onClick={() => setFormat(o.v)}
              >
                <span className="xo-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <h4>{o.title}</h4>
                  <p>{o.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy} onClick={doExport}>
            {busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {busy ? 'Packaging…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
