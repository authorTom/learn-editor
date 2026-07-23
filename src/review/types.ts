import type { Course } from '../types'

// ---------- Review data model ----------
//
// A review round freezes a copy of the course and ships it to reviewers as a
// single self-contained HTML file (see buildReviewHtml). Reviewers annotate the
// real rendered course and send back a small JSON bundle — anchors and text
// only, no media — which the author merges into the round's comment thread.
//
// Block ids are preserved by the snapshot, so a comment made against the frozen
// copy still resolves against the live course even after the author edits it.

/** Where a comment sits in the text of a block.
 *
 *  We store the selected text plus a little context on either side rather than
 *  DOM offsets, so a comment survives the author editing the block around it.
 *  Re-anchoring searches the block for `quote`, using `prefix`/`suffix` to pick
 *  the right occurrence when the same words appear more than once. */
export interface TextSelector {
  quote: string
  prefix: string
  suffix: string
}

/** What a comment is about. Narrowing from lesson → block → text range. */
export interface CommentTarget {
  lessonId: string
  /** Absent for a comment on the lesson as a whole. */
  blockId?: string
  /** Absent for a comment on the block as a whole. */
  text?: TextSelector
}

export type CommentStatus = 'open' | 'resolved' | 'declined' | 'applied'

export interface ReviewReply {
  id: string
  author: string
  body: string
  createdAt: number
}

export interface ReviewComment {
  id: string
  reviewId: string
  author: string // reviewer's name, as they typed it
  createdAt: number
  target: CommentTarget
  body: string
  /** Proposed replacement for `target.text.quote` — a suggested edit the author
      can apply in one click. Only ever set alongside `target.text`. */
  suggestion?: string
  status: CommentStatus
  replies: ReviewReply[]
}

/** A review round. Deliberately *without* the course copy it was cut from: the
    snapshot is stored under its own key and loaded only when the share file is
    built. Keeping it out of here means marking a comment resolved rewrites a few
    kilobytes, not a course's worth of embedded media. */
export interface Review {
  id: string
  courseId: string
  /** Round name, e.g. "Clinical sign-off" — reviewers see this. */
  name: string
  /** Title at the time the round was cut, for filenames and headings. */
  courseTitle: string
  createdAt: number
  status: 'open' | 'closed'
  comments: ReviewComment[]
}

/** The frozen copy sent to reviewers, stored apart from its Review. */
export type ReviewSnapshot = Course

/** What a reviewer sends back. Deliberately tiny: no course, no media. */
export interface ReviewBundle {
  kind: 'learn-editor-review'
  version: 1
  reviewId: string
  courseId: string
  courseTitle: string
  reviewer: string
  submittedAt: number
  comments: ReviewComment[]
}

export const REVIEW_BUNDLE_KIND = 'learn-editor-review'

/** A bundle that has been checked comment by comment. `skipped` counts entries
    that were dropped as malformed. */
export interface SafeBundle {
  reviewId: string
  courseId: string
  reviewer: string
  comments: ReviewComment[]
  skipped: number
}

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback
}

/** Validate one comment out of a feedback file. Returns null if it is unusable.

    Nothing here trusts the file: it was produced on someone else's machine,
    mailed around, and possibly truncated or hand-edited on the way. A comment
    with no target would throw inside the inbox's re-anchoring and take the whole
    editor down with it, so it is cheaper to drop it than to defend downstream. */
function safeComment(x: unknown, reviewId: string, reviewer: string): ReviewComment | null {
  if (!x || typeof x !== 'object') return null
  const c = x as Record<string, unknown>
  const t = c.target as Record<string, unknown> | undefined
  if (!t || typeof t !== 'object' || typeof t.lessonId !== 'string' || !t.lessonId) return null

  const body = str(c.body)
  const suggestion = typeof c.suggestion === 'string' ? c.suggestion : undefined

  let text: TextSelector | undefined
  const raw = t.text as Record<string, unknown> | undefined
  if (raw && typeof raw === 'object' && typeof raw.quote === 'string' && raw.quote) {
    text = { quote: raw.quote, prefix: str(raw.prefix), suffix: str(raw.suffix) }
  }

  // A suggestion is a replacement for quoted text; without the quote there is
  // nothing to replace, so demote it to a plain comment rather than offer an
  // Apply button that could never work.
  const blockId = typeof t.blockId === 'string' && t.blockId ? t.blockId : undefined
  const keepSuggestion = suggestion !== undefined && !!text && !!blockId

  // Once a quote-less suggestion has been demoted, a comment with no body has
  // nothing left to say — it would import as a blank card.
  if (!body && !keepSuggestion) return null

  const replies = Array.isArray(c.replies)
    ? (c.replies as unknown[]).flatMap((r) => {
        if (!r || typeof r !== 'object') return []
        const rr = r as Record<string, unknown>
        if (!str(rr.body)) return []
        return [{
          id: str(rr.id) || Math.random().toString(36).slice(2),
          author: str(rr.author, 'Reviewer'),
          body: str(rr.body),
          createdAt: typeof rr.createdAt === 'number' ? rr.createdAt : Date.now(),
        }]
      })
    : []

  return {
    id: str(c.id),
    reviewId,
    author: str(c.author, reviewer),
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    target: { lessonId: t.lessonId, blockId, text },
    body,
    suggestion: keepSuggestion ? suggestion : undefined,
    status: 'open',
    replies,
  }
}

/** Parse and validate a reviewer's feedback file. Returns null if it isn't one. */
export function sanitizeBundle(x: unknown): SafeBundle | null {
  if (!x || typeof x !== 'object') return null
  const b = x as Record<string, unknown>
  if (b.kind !== REVIEW_BUNDLE_KIND) return null
  if (typeof b.reviewId !== 'string' || !b.reviewId) return null
  if (typeof b.courseId !== 'string') return null
  if (!Array.isArray(b.comments)) return null

  const reviewer = str(b.reviewer, 'Reviewer')
  const comments: ReviewComment[] = []
  let skipped = 0
  const seen = new Set<string>()

  for (const raw of b.comments as unknown[]) {
    const c = safeComment(raw, b.reviewId, reviewer)
    // An id is what dedupes re-imports; a comment without one, or with a
    // duplicate, can't be tracked, so it doesn't come in.
    if (!c || !c.id || seen.has(c.id)) {
      skipped++
      continue
    }
    seen.add(c.id)
    comments.push(c)
  }

  return { reviewId: b.reviewId, courseId: b.courseId, reviewer, comments, skipped }
}

/** A course-level view of a comment, resolved against the *live* course. */
export type AnchorState =
  | 'anchored' // text found in the live course
  | 'drifted' // block still exists, but the quoted text no longer does
  | 'orphaned' // the block itself is gone

export const STATUS_LABEL: Record<CommentStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  declined: 'Declined',
  applied: 'Applied',
}
