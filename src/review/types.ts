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

/** A course-level view of a comment, resolved against the *live* course. */
export type AnchorState =
  | 'anchored' // text found in the live course
  | 'drifted' // block still exists, but the quoted text no longer does
  | 'orphaned' // the block itself is gone

export function isReviewBundle(x: unknown): x is ReviewBundle {
  const b = x as ReviewBundle | null
  return !!b && b.kind === REVIEW_BUNDLE_KIND && Array.isArray(b.comments) && !!b.reviewId
}

export const STATUS_LABEL: Record<CommentStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  declined: 'Declined',
  applied: 'Applied',
}
