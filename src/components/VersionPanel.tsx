import { useCallback, useEffect, useState } from 'react'
import { GitCompare, History, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, IconButton, Input, useConfirm, useToast } from '../ui'
import {
  deleteVersion, getVersionCourse, listVersions, saveVersion, type CourseVersion,
} from '../versions/storage'
import { diffCourses } from '../versions/diff'
import DiffView from './DiffView'
import type { Course } from '../types'

/**
 * Version history for the open course.
 *
 * Undo covers the last few minutes. This covers the question a compliance file
 * has to answer: what changed between the version we approved and the one that
 * shipped, and can we go back to it.
 */

function when(ts: number): string {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function VersionPanel() {
  const course = useStore((s) => s.course)!
  const updateCourse = useStore((s) => s.updateCourse)
  const [versions, setVersions] = useState<CourseVersion[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [comparing, setComparing] = useState<{ before: Course; label: string } | null>(null)
  const confirm = useConfirm()
  const toast = useToast()

  const refresh = useCallback(async () => {
    setVersions(await listVersions(course.id))
  }, [course.id])

  useEffect(() => { void refresh() }, [refresh])

  async function save() {
    setBusy(true)
    try {
      await saveVersion(course, name.trim() || `Version ${versions.length + 1}`)
      setName('')
      await refresh()
      toast.success('Version saved.')
    } finally {
      setBusy(false)
    }
  }

  async function compare(v: CourseVersion) {
    const snap = await getVersionCourse(v.id)
    if (!snap) {
      toast.error('That version could not be loaded.')
      return
    }
    setComparing({ before: snap, label: v.name })
  }

  async function restore(v: CourseVersion) {
    const snap = await getVersionCourse(v.id)
    if (!snap) return
    const d = diffCourses(course, snap)
    const ok = await confirm({
      title: `Restore “${v.name}”?`,
      message:
        d.total === 0
          ? 'This version is identical to the course as it stands, so nothing will change.'
          : `This replaces the current course content with the version from ${when(v.createdAt)} — ` +
            `${d.total} change${d.total === 1 ? '' : 's'} will be reverted. ` +
            'Take a version of the current state first if you might want it back. You can also undo with ⌘Z.',
      confirmLabel: 'Restore',
      destructive: true,
    })
    if (!ok) return
    // Restore content, not identity: the course keeps its own id, so the
    // dashboard entry, review rounds and version history all stay attached.
    updateCourse({
      title: snap.title,
      description: snap.description,
      author: snap.author,
      coverImage: snap.coverImage,
      lessons: structuredClone(snap.lessons),
      theme: { ...snap.theme },
      assets: structuredClone(snap.assets),
      completion: { ...snap.completion },
    })
    toast.success(`Restored “${v.name}”.`)
  }

  return (
    <div className="ver">
      <div className="ver-save">
        <Input
          value={name}
          placeholder={`Version ${versions.length + 1}`}
          aria-label="Version name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
        />
        <Button size="sm" variant="primary" icon={<Save size={14} />} disabled={busy} onClick={save}>
          Save
        </Button>
      </div>
      <p className="ver-note">
        A snapshot of the whole course — lessons, blocks, media and theme — kept on this machine.
        Compare any two to see exactly what changed.
      </p>

      {versions.length === 0 ? (
        <p className="insp-empty">
          <History size={15} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
          No versions yet. Save one before a review round or a release, and you will be able to
          show what changed afterwards.
        </p>
      ) : (
        <ul className="ver-list">
          {versions.map((v) => (
            <li key={v.id} className="ver-item">
              <div className="ver-item__main">
                <span className="ver-item__name">{v.name}</span>
                <span className="ver-item__meta">
                  {when(v.createdAt)} · {v.lessonCount} lesson{v.lessonCount === 1 ? '' : 's'} ·{' '}
                  {v.blockCount} block{v.blockCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="ver-item__actions">
                <IconButton
                  label={`Compare ${v.name} with the course now`}
                  size="sm"
                  icon={<GitCompare size={14} />}
                  onClick={() => compare(v)}
                />
                <IconButton
                  label={`Restore ${v.name}`}
                  size="sm"
                  icon={<RotateCcw size={14} />}
                  onClick={() => restore(v)}
                />
                <IconButton
                  label={`Delete ${v.name}`}
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete “${v.name}”?`,
                      message: 'The snapshot is removed. The course itself is untouched.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    })
                    if (ok) {
                      await deleteVersion(v.id)
                      await refresh()
                    }
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {comparing && (
        <DiffView
          before={comparing.before}
          after={course}
          beforeLabel={comparing.label}
          afterLabel="Now"
          onClose={() => setComparing(null)}
        />
      )}
    </div>
  )
}
