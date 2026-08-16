import { create } from 'zustand'
import { get as idbGet, set as idbSet, keys as idbKeys } from 'idb-keyval'
import type { Course } from '../types'
import { useStore } from '../store'
import { uid } from '../utils/id'
import { applySuggestionToBlock } from './anchor'
import { REVIEW_PREFIX, SNAP_PREFIX, deleteReviewData } from './storage'
import type { CommentStatus, Review, ReviewComment } from './types'
import { sanitizeBundle } from './types'

export interface ImportResult {
  added: number
  skipped: number
  reviewer: string
}

interface ReviewState {
  reviews: Review[]
  loaded: boolean

  loadReviews: () => Promise<void>
  createReview: (course: Course, name: string) => Promise<Review>
  deleteReview: (id: string) => Promise<void>
  closeReview: (id: string, closed: boolean) => Promise<void>
  /** Drop a deleted course's rounds from memory. The store that owns courses
      purges them from IndexedDB and calls this to keep the two in step. */
  forgetCourse: (courseId: string) => void

  /** Merge a reviewer's returned bundle. Comments are deduped by id, so the same
      file can be dropped in twice without doubling up. */
  importBundle: (bundle: unknown) => Promise<ImportResult>

  setCommentStatus: (reviewId: string, commentId: string, status: CommentStatus) => Promise<void>
  addReply: (reviewId: string, commentId: string, author: string, body: string) => Promise<void>

  /** Write a reviewer's suggested edit into the live course. Returns false if the
      quoted text has drifted — we never overwrite text the author has since changed. */
  applySuggestion: (reviewId: string, commentId: string) => Promise<boolean>
}

/** Reviews for one course, newest first. */
export function reviewsForCourse(reviews: Review[], courseId: string): Review[] {
  return reviews
    .filter((r) => r.courseId === courseId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function openCommentCount(reviews: Review[], courseId: string): number {
  return reviewsForCourse(reviews, courseId)
    .flatMap((r) => r.comments)
    .filter((c) => c.status === 'open').length
}

export function reviewersOf(review: Review): string[] {
  return [...new Set(review.comments.map((c) => c.author))].sort()
}

export const useReviews = create<ReviewState>((set, get) => {
  async function persist(r: Review) {
    await idbSet(REVIEW_PREFIX + r.id, r)
    set((s) => ({ reviews: s.reviews.map((x) => (x.id === r.id ? r : x)) }))
  }

  /** Rewrite one comment inside one review, then save. */
  async function patchComment(
    reviewId: string,
    commentId: string,
    fn: (c: ReviewComment) => ReviewComment
  ) {
    const review = get().reviews.find((r) => r.id === reviewId)
    if (!review) return
    const next: Review = {
      ...review,
      comments: review.comments.map((c) => (c.id === commentId ? fn(c) : c)),
    }
    await persist(next)
  }

  return {
    reviews: [],
    loaded: false,

    loadReviews: async () => {
      const ks = (await idbKeys()) as string[]
      const out: Review[] = []
      for (const k of ks) {
        if (typeof k !== 'string' || !k.startsWith(REVIEW_PREFIX)) continue
        const r = (await idbGet(k)) as Review | undefined
        if (r) out.push(r)
      }
      out.sort((a, b) => b.createdAt - a.createdAt)
      set({ reviews: out, loaded: true })
    },

    createReview: async (course, name) => {
      const r: Review = {
        id: uid(),
        courseId: course.id,
        name: name.trim() || 'Review',
        courseTitle: course.title,
        createdAt: Date.now(),
        status: 'open',
        comments: [],
      }
      // A frozen copy, so the author can keep editing while reviewers read. Block
      // ids are preserved, which is what lets comments made against this snapshot
      // still resolve against the live course.
      await idbSet(SNAP_PREFIX + r.id, structuredClone(course))
      await idbSet(REVIEW_PREFIX + r.id, r)
      set((s) => ({ reviews: [r, ...s.reviews] }))
      return r
    },

    deleteReview: async (id) => {
      await deleteReviewData(id)
      set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) }))
    },

    forgetCourse: (courseId) =>
      set((s) => ({ reviews: s.reviews.filter((r) => r.courseId !== courseId) })),

    closeReview: async (id, closed) => {
      const r = get().reviews.find((x) => x.id === id)
      if (!r) return
      await persist({ ...r, status: closed ? 'closed' : 'open' })
    },

    /** Feedback files arrive by email from other people — a truncated download or
        a hand-edited file must never take the inbox down, so every comment is
        validated and anything malformed is dropped rather than trusted. */
    importBundle: async (raw) => {
      const bundle = sanitizeBundle(raw)
      if (!bundle) throw new Error('That file is not Quoin review feedback.')

      const review = get().reviews.find((r) => r.id === bundle.reviewId)
      if (!review) {
        throw new Error(
          'This feedback is for a review round that no longer exists in this browser.'
        )
      }
      if (bundle.courseId !== review.courseId) {
        throw new Error('That feedback belongs to a different course.')
      }

      const have = new Set(review.comments.map((c) => c.id))
      const fresh = bundle.comments.filter((c) => !have.has(c.id))
      const cleaned: ReviewComment[] = fresh.map((c) => ({
        ...c,
        reviewId: review.id,
        author: c.author || bundle.reviewer,
        // The author owns triage, so everything lands open however the file arrived.
        status: 'open',
      }))

      await persist({ ...review, comments: [...review.comments, ...cleaned] })
      return {
        added: cleaned.length,
        skipped: bundle.skipped + (bundle.comments.length - cleaned.length),
        reviewer: bundle.reviewer,
      }
    },

    setCommentStatus: (reviewId, commentId, status) =>
      patchComment(reviewId, commentId, (c) => ({ ...c, status })),

    addReply: (reviewId, commentId, author, body) =>
      patchComment(reviewId, commentId, (c) => ({
        ...c,
        replies: [
          ...c.replies,
          { id: uid(), author: author || 'Author', body, createdAt: Date.now() },
        ],
      })),

    applySuggestion: async (reviewId, commentId) => {
      const review = get().reviews.find((r) => r.id === reviewId)
      const comment = review?.comments.find((c) => c.id === commentId)
      if (!review || !comment?.suggestion || !comment.target.text || !comment.target.blockId) {
        return false
      }

      const editor = useStore.getState()
      const course = editor.course
      if (!course || course.id !== review.courseId) return false

      const lesson = course.lessons.find((l) => l.id === comment.target.lessonId)
      const block = lesson?.blocks.find((b) => b.id === comment.target.blockId)
      if (!lesson || !block) return false

      const next = applySuggestionToBlock(block, comment.target.text, comment.suggestion)
      if (!next) return false // quote has drifted — leave the author's text alone

      // Goes through the editor store, so applying a suggestion is a normal,
      // undoable edit and autosaves like any other.
      editor.updateBlockIn(lesson.id, block.id, next)
      await patchComment(reviewId, commentId, (c) => ({ ...c, status: 'applied' }))
      return true
    },
  }
})
