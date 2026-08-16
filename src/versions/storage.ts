import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Course } from '../types'
import { uid } from '../utils/id'

/**
 * Named course snapshots.
 *
 * Undo/redo already covers "I just did something wrong". This covers the other
 * question, the one regulated training has to answer in writing: *what changed
 * between the version we approved and the version that shipped?* Today that is
 * answered with a spreadsheet and a good memory.
 *
 * Stored the way review snapshots are — the record and the course kept apart,
 * so listing versions reads kilobytes rather than every embedded image in every
 * version of the course.
 */

export const VERSION_PREFIX = 'ver:'
export const VERSION_DATA_PREFIX = 'verdata:'

export interface CourseVersion {
  id: string
  courseId: string
  name: string
  note: string
  createdAt: number
  /** Cheap headline stats, so the list needs no course loads. */
  lessonCount: number
  blockCount: number
  /** Set when the snapshot was taken automatically rather than by hand. */
  auto?: boolean
}

function statsOf(course: Course) {
  return {
    lessonCount: course.lessons.length,
    blockCount: course.lessons.reduce((n, l) => n + l.blocks.length, 0),
  }
}

export async function listVersions(courseId: string): Promise<CourseVersion[]> {
  const ks = (await idbKeys()) as string[]
  const out: CourseVersion[] = []
  for (const k of ks) {
    if (typeof k !== 'string' || !k.startsWith(VERSION_PREFIX)) continue
    const v = (await idbGet(k)) as CourseVersion | undefined
    if (v && v.courseId === courseId) out.push(v)
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveVersion(
  course: Course,
  name: string,
  note = '',
  auto = false
): Promise<CourseVersion> {
  const v: CourseVersion = {
    id: uid(),
    courseId: course.id,
    name,
    note,
    createdAt: Date.now(),
    ...statsOf(course),
    ...(auto ? { auto: true } : {}),
  }
  // structuredClone: the live course keeps mutating, and a snapshot that shared
  // its arrays would silently follow along and defeat the entire feature.
  await idbSet(VERSION_DATA_PREFIX + v.id, structuredClone(course))
  await idbSet(VERSION_PREFIX + v.id, v)
  return v
}

export function getVersionCourse(id: string): Promise<Course | undefined> {
  return idbGet(VERSION_DATA_PREFIX + id) as Promise<Course | undefined>
}

/**
 * Write a snapshot that already has an id — the one the server gave it.
 *
 * Sync needs this and `saveVersion` cannot serve: it mints a fresh id, so
 * pulling the same snapshot twice would leave two copies of one moment in the
 * history. Snapshots are immutable, so an id that already exists is a no-op
 * rather than an overwrite.
 */
export async function upsertVersion(v: CourseVersion, course: Course): Promise<void> {
  if (await idbGet(VERSION_PREFIX + v.id)) return
  await idbSet(VERSION_DATA_PREFIX + v.id, course)
  await idbSet(VERSION_PREFIX + v.id, v)
}

export async function deleteVersion(id: string): Promise<void> {
  await idbDel(VERSION_PREFIX + id)
  await idbDel(VERSION_DATA_PREFIX + id)
}

/** Remove every version of a course. Called when the course itself is deleted —
    otherwise a deleted course leaves its whole history, media included, behind. */
export async function purgeCourseVersions(courseId: string): Promise<number> {
  const versions = await listVersions(courseId)
  for (const v of versions) await deleteVersion(v.id)
  return versions.length
}
