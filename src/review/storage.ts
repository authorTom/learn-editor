import { get as idbGet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Course } from '../types'
import type { Review } from './types'

// The review feature's IndexedDB keys, kept in a module that depends on nothing
// else of ours. The editor store has to purge review data when a course is
// deleted, and the review store has to read it — importing this from both keeps
// those two stores from importing each other.

export const REVIEW_PREFIX = 'review:'

/** The frozen course copy for a round. Stored apart from its Review so that
    triage writes (resolve, reply) rewrite kilobytes, not a course's worth of
    embedded media. */
export const SNAP_PREFIX = 'rsnap:'

export function getSnapshot(reviewId: string): Promise<Course | undefined> {
  return idbGet(SNAP_PREFIX + reviewId) as Promise<Course | undefined>
}

/** Delete a round and the course copy it was cut from. */
export async function deleteReviewData(reviewId: string): Promise<void> {
  await idbDel(REVIEW_PREFIX + reviewId)
  await idbDel(SNAP_PREFIX + reviewId)
}

/** Every round belonging to a course. Deleting a course has to take these with
    it — a stranded snapshot is a whole course's media sat in storage with
    nothing left pointing at it. Returns the ids removed. */
export async function purgeCourseReviews(courseId: string): Promise<string[]> {
  const ks = (await idbKeys()) as string[]
  const removed: string[] = []
  for (const k of ks) {
    if (typeof k !== 'string' || !k.startsWith(REVIEW_PREFIX)) continue
    const r = (await idbGet(k)) as Review | undefined
    if (!r || r.courseId !== courseId) continue
    await deleteReviewData(r.id)
    removed.push(r.id)
  }
  return removed
}
