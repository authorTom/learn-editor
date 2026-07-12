import { useEffect, useRef, useState } from 'react'
import { X, Download, Upload, Trash2, MessageSquare, Lock, LockOpen } from 'lucide-react'
import type { Course } from '../types'
import { downloadReviewHtml } from '../review/buildReviewHtml'
import { reviewersOf, reviewsForCourse, useReviews } from '../review/reviewStore'
import type { Review } from '../review/types'

function when(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReviewDialog({
  course,
  onClose,
  onOpenInbox,
}: {
  course: Course
  onClose: () => void
  onOpenInbox: () => void
}) {
  const reviews = useReviews((s) => s.reviews)
  const loaded = useReviews((s) => s.loaded)
  const loadReviews = useReviews((s) => s.loadReviews)
  const createReview = useReviews((s) => s.createReview)
  const deleteReview = useReviews((s) => s.deleteReview)
  const closeReview = useReviews((s) => s.closeReview)
  const importBundle = useReviews((s) => s.importBundle)

  const [name, setName] = useState('')
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loaded) loadReviews()
  }, [loaded, loadReviews])

  const rounds = reviewsForCourse(reviews, course.id)

  async function start() {
    const r = await createReview(course, name || `Review — ${when(Date.now())}`)
    setName('')
    await downloadReviewHtml(r)
    setNote({
      kind: 'ok',
      text: 'Review file downloaded. Share it with your reviewers — see below for how.',
    })
  }

  async function redownload(r: Review) {
    const ok = await downloadReviewHtml(r)
    if (!ok) setNote({ kind: 'err', text: 'The copy for that round is missing from this browser.' })
  }

  /** Reviewers each send back their own file, so accept a multi-select. */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    let added = 0
    const who: string[] = []
    for (const f of Array.from(files)) {
      try {
        const data = JSON.parse(await f.text())
        const res = await importBundle(data)
        added += res.added
        if (res.added) who.push(res.reviewer)
      } catch (e) {
        setNote({ kind: 'err', text: `${f.name}: ${(e as Error).message}` })
        return
      }
    }
    setNote(
      added
        ? {
            kind: 'ok',
            text: `Imported ${added} comment${added === 1 ? '' : 's'} from ${who.join(', ')}.`,
          }
        : { kind: 'ok', text: 'No new comments — those had already been imported.' }
    )
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Send for review</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="modal-body">
          <div className="rv-explain">
            <p>
              A review round freezes a <strong>copy</strong> of this course into one
              self-contained file. Reviewers open it, read the course exactly as a learner
              would, highlight anything and leave comments or suggested rewrites. Keep editing
              the live course meanwhile — comments stay attached to the right blocks.
            </p>
            <p className="muted">
              Learn Editor has no server, so nothing is uploaded. Put the file anywhere your
              reviewers can reach it — SharePoint, Google Drive, Dropbox, a static host — and
              send that link, or just email the file. They send back a small feedback file that
              you import below.
            </p>
          </div>

          <div className="rv-start">
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>New review round</label>
              <input
                value={name}
                placeholder="e.g. Clinical sign-off, Round 2"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && start()}
              />
            </div>
            <button className="btn primary" onClick={start}>
              <Download size={15} /> Create &amp; download
            </button>
          </div>

          {note && <div className={'rv-note ' + note.kind}>{note.text}</div>}

          <div className="rv-rounds">
            {!rounds.length && (
              <p className="muted" style={{ padding: '18px 0 4px' }}>
                No review rounds yet.
              </p>
            )}
            {rounds.map((r) => (
              <Round
                key={r.id}
                review={r}
                onDownload={() => redownload(r)}
                onDelete={() => deleteReview(r.id)}
                onToggleClosed={() => closeReview(r.id, r.status === 'open')}
                onOpenInbox={() => {
                  onOpenInbox()
                  onClose()
                }}
              />
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              onFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import feedback…
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Round({
  review,
  onDownload,
  onDelete,
  onToggleClosed,
  onOpenInbox,
}: {
  review: Review
  onDownload: () => void
  onDelete: () => void
  onToggleClosed: () => void
  onOpenInbox: () => void
}) {
  const people = reviewersOf(review)
  const open = review.comments.filter((c) => c.status === 'open').length

  return (
    <div className="rv-round">
      <div className="rv-round-main">
        <h4>
          {review.name}
          {review.status === 'closed' && <span className="rv-pill">Closed</span>}
        </h4>
        <p className="muted">
          Started {when(review.createdAt)} ·{' '}
          {people.length
            ? `${people.length} reviewer${people.length === 1 ? '' : 's'}: ${people.join(', ')}`
            : 'no feedback in yet'}
        </p>
      </div>
      <div className="rv-round-acts">
        {!!review.comments.length && (
          <button className="btn sm" onClick={onOpenInbox}>
            <MessageSquare size={14} /> {open} open / {review.comments.length}
          </button>
        )}
        <button className="btn sm" title="Download the review file again" onClick={onDownload}>
          <Download size={14} />
        </button>
        <button
          className="btn sm"
          title={review.status === 'open' ? 'Close this round' : 'Reopen'}
          onClick={onToggleClosed}
        >
          {review.status === 'open' ? <LockOpen size={14} /> : <Lock size={14} />}
        </button>
        <button className="btn sm danger" title="Delete round" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
