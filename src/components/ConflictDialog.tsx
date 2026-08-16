import { useMemo, useState } from 'react'
import { GitCompare, Laptop, Server } from 'lucide-react'
import { Button, Dialog } from '../ui'
import { useSync } from '../sync/syncStore'
import { diffCourses } from '../versions/diff'
import DiffView from './DiffView'

/**
 * Two versions of one course, and a decision only the author can make.
 *
 * This happens when the same course was edited on two machines since they last
 * agreed. The tempting answer is last-write-wins, and it is the wrong one: the
 * losing side is somebody's afternoon, and for the regulated training this tool
 * exists to produce, quietly discarding an approved revision is the worst thing
 * the software could do.
 *
 * So nothing is merged and nothing is chosen automatically. The author is told
 * exactly what differs — through the same rendered diff the version panel uses,
 * so it reads as the course rather than as JSON — and offered three honest
 * outcomes, one of which keeps both.
 */

export default function ConflictDialog() {
  const conflict = useSync((s) => s.conflict)
  const resolve = useSync((s) => s.resolveConflict)
  const [showDiff, setShowDiff] = useState(false)
  const [busy, setBusy] = useState<'mine' | 'theirs' | 'copy' | null>(null)

  const summary = useMemo(
    () => (conflict ? diffCourses(conflict.theirs, conflict.mine) : null),
    [conflict]
  )

  if (!conflict) return null

  if (showDiff) {
    return (
      <DiffView
        before={conflict.theirs}
        after={conflict.mine}
        beforeLabel="On the server"
        afterLabel="On this computer"
        onClose={() => setShowDiff(false)}
      />
    )
  }

  async function choose(choice: 'mine' | 'theirs' | 'copy') {
    setBusy(choice)
    try {
      await resolve(choice)
    } finally {
      setBusy(null)
    }
  }

  const n = summary?.total ?? 0

  return (
    // `mandatory`: Escape must not dismiss this. A conflict left unresolved
    // means the course stops syncing, and closing it by reflex would be a
    // silent decision to do nothing.
    <Dialog
      open
      mandatory
      onClose={() => {}}
      title={`“${conflict.title}” changed in two places`}
      size="md"
    >
      <div className="conflict">
        <p className="conflict__lede">
          This course was edited somewhere else since this computer last synced. Nothing has been
          overwritten — choose which version to keep.
        </p>

        <p className="conflict__count">
          {n === 0
            ? 'The two versions look the same, but the server recorded a change from another device.'
            : `${n} difference${n === 1 ? '' : 's'} between them.`}
        </p>

        <Button variant="secondary" icon={<GitCompare size={16} />} onClick={() => setShowDiff(true)}>
          Compare them side by side
        </Button>

        <div className="conflict__choices">
          <button
            type="button"
            className="conflict__choice"
            disabled={!!busy}
            onClick={() => choose('copy')}
          >
            <span className="conflict__choice-title">Keep both (recommended)</span>
            <span className="conflict__choice-body">
              This computer's version stays as it is. The server's version is added to your
              dashboard as a separate course, so you can look at it and merge by hand.
            </span>
            {busy === 'copy' && <span className="conflict__working">Working…</span>}
          </button>

          <button
            type="button"
            className="conflict__choice"
            disabled={!!busy}
            onClick={() => choose('mine')}
          >
            <span className="conflict__choice-title">
              <Laptop size={15} aria-hidden="true" /> Keep this computer's version
            </span>
            <span className="conflict__choice-body">
              What is on screen wins and replaces the server's copy. The other machine's changes to
              this course are discarded.
            </span>
            {busy === 'mine' && <span className="conflict__working">Working…</span>}
          </button>

          <button
            type="button"
            className="conflict__choice"
            disabled={!!busy}
            onClick={() => choose('theirs')}
          >
            <span className="conflict__choice-title">
              <Server size={15} aria-hidden="true" /> Take the server's version
            </span>
            <span className="conflict__choice-body">
              The server's copy replaces what is on this computer. Any change made here since the
              last sync is discarded.
            </span>
            {busy === 'theirs' && <span className="conflict__working">Working…</span>}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
