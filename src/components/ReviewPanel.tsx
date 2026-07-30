import { useEffect, useMemo, useState } from 'react'
import { X, Check, Ban, Wand2, CornerDownRight, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { Button, IconButton } from '../ui'
import { applyBlocker, resolveTarget, suggestionIsInCourse, targetLabel } from '../review/anchor'
import { reviewsForCourse, useReviews } from '../review/reviewStore'
import type { ApplyBlocker } from '../review/anchor'
import type { CommentStatus, Review, ReviewComment } from '../review/types'

type Filter = 'open' | 'all' | 'suggestions'

export default function ReviewPanel({
  onClose,
  onManage,
  embedded = false,
}: {
  onClose: () => void
  onManage: () => void
  /** Inside the dock: drop the panel's own frame and close button, since the
      dock already supplies both. */
  embedded?: boolean
}) {
  const course = useStore((s) => s.course)!
  const selectLesson = useStore((s) => s.selectLesson)
  const reviews = useReviews((s) => s.reviews)
  const loaded = useReviews((s) => s.loaded)
  const loadReviews = useReviews((s) => s.loadReviews)

  const [filter, setFilter] = useState<Filter>('open')
  const [who, setWho] = useState<string>('')

  useEffect(() => {
    if (!loaded) loadReviews()
  }, [loaded, loadReviews])

  const rounds = reviewsForCourse(reviews, course.id)

  const items = useMemo(() => {
    const all: { review: Review; comment: ReviewComment }[] = []
    for (const r of rounds) for (const c of r.comments) all.push({ review: r, comment: c })
    return all
      .filter(({ comment: c }) => {
        if (who && c.author !== who) return false
        if (filter === 'open') return c.status === 'open'
        if (filter === 'suggestions') return typeof c.suggestion === 'string'
        return true
      })
      .sort((a, b) => {
        // Course order, so triage reads top-to-bottom like the course does.
        const la = course.lessons.findIndex((l) => l.id === a.comment.target.lessonId)
        const lb = course.lessons.findIndex((l) => l.id === b.comment.target.lessonId)
        if (la !== lb) return la - lb
        return a.comment.createdAt - b.comment.createdAt
      })
  }, [rounds, filter, who, course.lessons])

  const people = useMemo(
    () => [...new Set(rounds.flatMap((r) => r.comments.map((c) => c.author)))].sort(),
    [rounds]
  )
  const openCount = rounds.flatMap((r) => r.comments).filter((c) => c.status === 'open').length

  function jump(c: ReviewComment) {
    if (!course.lessons.some((l) => l.id === c.target.lessonId)) return
    selectLesson(c.target.lessonId)
    if (!c.target.blockId) return
    // Wait for the lesson to render before scrolling to the block.
    setTimeout(() => {
      const el = document.getElementById('blk-' + c.target.blockId)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('rv-target')
      setTimeout(() => el.classList.remove('rv-target'), 1600)
    }, 60)
  }

  return (
    <aside className={'review-panel' + (embedded ? ' review-panel--embedded' : '')}>
      <div className="rp-head">
        <div>
          <strong>Review feedback</strong>
          <span className="rp-sub">
            {openCount} open of {rounds.flatMap((r) => r.comments).length}
          </span>
        </div>
        <span style={{ display: 'flex', gap: 2 }}>
          <Button size="sm" onClick={onManage}>
            Rounds
          </Button>
          {!embedded && (
            <IconButton label="Close review panel" icon={<X size={16} />} onClick={onClose} />
          )}
        </span>
      </div>

      <div className="rp-filters">
        <span className="seg">
          {(['open', 'suggestions', 'all'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'open' ? 'Open' : f === 'suggestions' ? 'Suggestions' : 'All'}
            </button>
          ))}
        </span>
        {people.length > 1 && (
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rp-list">
        {!items.length && (
          <p className="rp-empty">
            {rounds.length
              ? 'Nothing here. Try a different filter.'
              : 'No feedback yet. Start a review round from the Review button and share the file with your reviewers.'}
          </p>
        )}
        {items.map(({ review, comment }) => (
          <CommentCard
            key={comment.id}
            review={review}
            comment={comment}
            onJump={() => jump(comment)}
          />
        ))}
      </div>
    </aside>
  )
}

const STATUS_ICON: Partial<Record<CommentStatus, string>> = {
  resolved: 'Resolved',
  declined: 'Declined',
  applied: 'Applied',
}

const APPLY_HINT: Record<ApplyBlocker, string> = {
  none: 'Write this change into the course',
  'not-a-suggestion': 'Nothing to apply',
  orphaned: 'The block this refers to has been deleted',
  drifted: "You've changed this text since — apply by hand",
  'spans-fields': "The selection crosses two fields — apply by hand",
}

function CommentCard({
  review,
  comment,
  onJump,
}: {
  review: Review
  comment: ReviewComment
  onJump: () => void
}) {
  const course = useStore((s) => s.course)!
  const setCommentStatus = useReviews((s) => s.setCommentStatus)
  const addReply = useReviews((s) => s.addReply)
  const applySuggestion = useReviews((s) => s.applySuggestion)
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')

  const anchor = resolveTarget(course, comment.target)
  const blocker = applyBlocker(course, comment)
  const isSug = typeof comment.suggestion === 'string'

  // An applied suggestion whose replacement text is no longer in the course has
  // been undone (⌘Z) or edited away. Saying "Applied" then would be a lie, so
  // the card offers to apply it again.
  const undone =
    comment.status === 'applied' &&
    isSug &&
    !!comment.target.blockId &&
    !suggestionIsInCourse(course, comment)

  const canApplyNow = blocker === 'none' && (comment.status === 'open' || undone)

  async function onApply() {
    setErr('')
    const ok = await applySuggestion(review.id, comment.id)
    if (!ok) setErr('Could not apply — the text has changed since this was written.')
  }

  async function send() {
    const body = draft.trim()
    if (!body) return
    await addReply(review.id, comment.id, course.author || 'Author', body)
    setDraft('')
    setReplying(false)
  }

  return (
    <div className={'rp-card' + (comment.status !== 'open' ? ' done' : '')}>
      <div className="rp-card-head">
        <span className="rp-author">{comment.author}</span>
        {isSug && <span className="rp-tag sug">Suggestion</span>}
        {STATUS_ICON[comment.status] && !undone && (
          <span className="rp-tag">{STATUS_ICON[comment.status]}</span>
        )}
        {undone && <span className="rp-tag">Undone</span>}
      </div>

      <button className="rp-loc" onClick={onJump}>
        {targetLabel(course, comment.target)}
      </button>

      {anchor.state === 'orphaned' && (
        <div className="rp-warn">
          <AlertTriangle size={13} /> The block this refers to has been deleted.
        </div>
      )}
      {anchor.state === 'drifted' && (
        <div className="rp-warn">
          <AlertTriangle size={13} /> You've edited this text since — the quote below is what the
          reviewer saw.
        </div>
      )}
      {blocker === 'spans-fields' && (
        <div className="rp-warn">
          <AlertTriangle size={13} /> This selection crosses two separate fields, so it can't be
          rewritten in one step — apply it by hand.
        </div>
      )}
      {undone && (
        <div className="rp-warn">
          <AlertTriangle size={13} /> This was applied, but the text is no longer in the course —
          you probably undid it.
        </div>
      )}

      {comment.target.text && (
        <blockquote className="rp-quote">{comment.target.text.quote}</blockquote>
      )}
      {isSug && <div className="rp-sug">→ {comment.suggestion}</div>}
      {comment.body && <p className="rp-body">{comment.body}</p>}

      {comment.replies.map((r) => (
        <div key={r.id} className="rp-reply">
          <CornerDownRight size={12} />
          <span>
            <strong>{r.author}</strong> {r.body}
          </span>
        </div>
      ))}

      {err && <div className="rp-warn">{err}</div>}

      {replying ? (
        <div className="rp-reply-box">
          <textarea
            autoFocus
            rows={2}
            value={draft}
            placeholder="Reply to the reviewer…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              if (e.key === 'Escape') setReplying(false)
            }}
          />
          <div className="rp-acts">
            <button className="btn sm" onClick={() => setReplying(false)}>
              Cancel
            </button>
            <button className="btn sm primary" onClick={send}>
              Reply
            </button>
          </div>
        </div>
      ) : (
        <div className="rp-acts">
          {isSug && (comment.status === 'open' || undone) && (
            <button
              className="btn sm primary"
              disabled={!canApplyNow}
              title={APPLY_HINT[blocker]}
              onClick={onApply}
            >
              <Wand2 size={13} /> {undone ? 'Apply again' : 'Apply'}
            </button>
          )}
          <button className="btn sm" onClick={() => setReplying(true)}>
            Reply
          </button>
          {comment.status === 'open' ? (
            <>
              <button
                className="btn sm"
                aria-label="Mark as handled" title="Mark as handled"
                onClick={() => setCommentStatus(review.id, comment.id, 'resolved')}
              >
                <Check size={13} /> Resolve
              </button>
              <button
                className="btn sm"
                aria-label="Won't do" title="Won't do"
                onClick={() => setCommentStatus(review.id, comment.id, 'declined')}
              >
                <Ban size={13} />
              </button>
            </>
          ) : (
            <button
              className="btn sm ghost"
              onClick={() => setCommentStatus(review.id, comment.id, 'open')}
            >
              Reopen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
