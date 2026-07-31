import { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Eye, FileCheck2 } from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { auditCourse, type Finding, type Severity } from '../a11y/audit'
import { buildAcrHtml } from '../a11y/buildAcr'
import { criterionOf } from '../a11y/criteria'
import { Button, Segmented, useToast } from '../ui'
import { downloadBlob, slugify } from '../utils/file'

/**
 * The accessibility panel.
 *
 * Three severities, and the distinction between them is the point:
 *   error   — a WCAG failure that is in the content and can be fixed here
 *   warning — a real risk, or a failure this tool cannot prove
 *   review  — something only a person can decide, surfaced so it is not forgotten
 *
 * Lumping those together produces a list nobody acts on. Separating them means
 * "0 errors" is a claim the conformance report can actually make.
 */

const ICON: Record<Severity, typeof AlertOctagon> = {
  error: AlertOctagon,
  warning: AlertTriangle,
  review: Eye,
}

const LABEL: Record<Severity, string> = {
  error: 'Fails',
  warning: 'Risk',
  review: 'Check by hand',
}

function FindingRow({ f, onGo }: { f: Finding; onGo: () => void }) {
  const Icon = ICON[f.severity]
  const c = criterionOf(f.criterion)
  const clickable = !!f.lessonId
  return (
    <li className={'a11y-item is-' + f.severity}>
      <div className="a11y-item__head">
        <Icon size={14} aria-hidden="true" />
        <span className="a11y-item__sev">{LABEL[f.severity]}</span>
        <span className="a11y-item__crit" title={c ? `${c.name} (Level ${c.level})` : undefined}>
          WCAG {f.criterion}
        </span>
      </div>
      <p className="a11y-item__msg">{f.message}</p>
      <p className="a11y-item__fix">{f.fix}</p>
      {clickable && (
        <button type="button" className="a11y-item__go" onClick={onGo}>
          {f.lessonTitle || 'Untitled lesson'}
          {f.blockType ? ` · ${f.blockType}` : ''} →
        </button>
      )}
    </li>
  )
}

export default function AccessibilityPanel() {
  const course = useStore((s) => s.course)!
  const selectLesson = useStore((s) => s.selectLesson)
  const selectBlock = useUi((s) => s.selectBlock)
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const toast = useToast()

  // Cheap enough to run on every course change — it is a pass over the model,
  // no layout and no DOM.
  const audit = useMemo(() => auditCourse(course), [course])

  const shown = filter === 'all' ? audit.findings : audit.findings.filter((f) => f.severity === filter)

  function goTo(f: Finding) {
    if (!f.lessonId) return
    selectLesson(f.lessonId)
    if (f.blockId) {
      selectBlock(f.blockId)
      // The canvas scrolls the selected block into view itself, but only once
      // the new lesson has rendered.
      requestAnimationFrame(() =>
        document.getElementById('blk-' + f.blockId)?.scrollIntoView({ block: 'center' })
      )
    }
  }

  function downloadReport() {
    const html = buildAcrHtml(course, audit)
    downloadBlob(
      new Blob([html], { type: 'text/html' }),
      `${slugify(course.title || 'course')}-accessibility-report.html`
    )
    toast.success('Conformance report downloaded.')
  }

  return (
    <div className="a11y">
      <div className="a11y-summary">
        <span className={'a11y-count is-error' + (audit.errors ? '' : ' is-zero')}>
          <b>{audit.errors}</b> failing
        </span>
        <span className={'a11y-count is-warning' + (audit.warnings ? '' : ' is-zero')}>
          <b>{audit.warnings}</b> at risk
        </span>
        <span className="a11y-count is-review">
          <b>{audit.reviews}</b> to check
        </span>
      </div>

      {audit.errors === 0 && (
        <p className="a11y-clear">
          <CheckCircle2 size={15} aria-hidden="true" />
          No automated WCAG 2.2 AA failures in the authored content. The items marked
          “check by hand” still need a person.
        </p>
      )}

      <Button size="sm" block icon={<FileCheck2 size={14} />} onClick={downloadReport}>
        Download conformance report
      </Button>
      <p className="a11y-note">
        A per-criterion conformance report over every WCAG 2.2 Level A and AA success criterion,
        with each verdict traced back to the findings below. Hand it to procurement, or keep it in
        the audit file.
      </p>

      <Segmented
        label="Filter findings"
        size="sm"
        block
        value={filter}
        options={[
          { value: 'all', label: `All ${audit.findings.length}` },
          { value: 'error', label: 'Fails' },
          { value: 'warning', label: 'Risks' },
          { value: 'review', label: 'Manual' },
        ]}
        onChange={setFilter}
      />

      {shown.length === 0 ? (
        <p className="insp-empty">Nothing in this category.</p>
      ) : (
        <ul className="a11y-list">
          {shown.map((f) => (
            <FindingRow key={f.id} f={f} onGo={() => goTo(f)} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Error count for the dock badge, without rendering the panel. */
export function useA11yErrorCount(): number {
  const course = useStore((s) => s.course)
  return useMemo(() => (course ? auditCourse(course).errors : 0), [course])
}
