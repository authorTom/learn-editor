import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Course } from './types'

/**
 * Where a course lives on disk, and — the point of this module — what autosave
 * actually has to write.
 *
 * Autosave fires 400ms after a keystroke. It used to write the whole course
 * record, and a course record contains every image and every sound the author
 * has ever uploaded, as base64. So typing a sentence into a course with a
 * handful of photographs rewrote tens of megabytes, repeatedly, on a debounce —
 * a structured clone and an IndexedDB transaction of that size, between one
 * word and the next.
 *
 * The media is the part that never changes. It is written once, to a key of its
 * own, and the course record keeps only the metadata plus an empty `src`. The
 * hot path is then proportional to the prose, which is what was edited.
 *
 * In memory the course is unchanged: `loadCourse` puts the bytes back before
 * anyone sees it, so the editor, the exporter, version snapshots and review
 * rounds all still get a `Course` with real data URLs on its assets and need to
 * know nothing about any of this.
 */

export const COURSE_PREFIX = 'course:'
/** One asset's bytes: `amedia:<courseId>:<assetId>`. Keyed by course rather
    than content so that deleting a course can purge by prefix, with no
    reference counting and no chance of freeing bytes another course is using. */
export const ASSET_MEDIA_PREFIX = 'amedia:'

function mediaKey(courseId: string, assetId: string): string {
  return `${ASSET_MEDIA_PREFIX}${courseId}:${assetId}`
}

export interface LoadedCourse {
  course: Course
  /** Media keys already on disk, so the first save after opening doesn't
      rewrite bytes that are sitting there unchanged. Hand this to `saveCourse`. */
  persisted: Set<string>
}

/**
 * Write a course, keeping its media out of the hot path.
 *
 * `persisted` is the set of media keys known to be written already; anything in
 * it is skipped and anything newly written is added. Pass the set through from
 * `loadCourse` and across saves. Omit it and every asset is rewritten, which is
 * what a first save of a new or imported course wants.
 */
export async function saveCourse(course: Course, persisted?: Set<string>): Promise<void> {
  const known = persisted ?? new Set<string>()

  // Bytes first. Interrupted halfway, that leaves orphaned media which the next
  // open collects; the other order would leave a course record pointing at
  // bytes that were never written, which is a course full of dead images.
  for (const asset of course.assets ?? []) {
    const key = mediaKey(course.id, asset.id)
    if (known.has(key) || !asset.src) continue
    await idbSet(key, asset.src)
    known.add(key)
  }

  const record: Course = {
    ...course,
    assets: (course.assets ?? []).map((a) => ({ ...a, src: '' })),
  }
  await idbSet(COURSE_PREFIX + course.id, record)
}

/** Read a course back with its media reattached. */
export async function loadCourse(id: string): Promise<LoadedCourse | undefined> {
  const raw = (await idbGet(COURSE_PREFIX + id)) as Course | undefined
  if (!raw) return undefined

  const persisted = new Set<string>()
  const assets = await Promise.all(
    (raw.assets ?? []).map(async (a) => {
      // A record written before media was split out still carries its own bytes.
      // Leaving it out of `persisted` means the next save migrates it.
      if (a.src) return a
      const key = mediaKey(id, a.id)
      const src = (await idbGet(key)) as string | undefined
      if (src === undefined) return { ...a, src: '' }
      persisted.add(key)
      return { ...a, src }
    })
  )

  return { course: { ...raw, assets }, persisted }
}

/**
 * Drop media belonging to assets the course no longer has.
 *
 * Deleting an asset can't free its bytes there and then, because undo can bring
 * the asset back and would otherwise restore a reference to nothing. Undo
 * history is discarded whenever a course is opened or closed, so that is the
 * safe moment to collect — by then nothing can resurrect the deleted asset.
 */
export async function collectAssetGarbage(course: Course): Promise<number> {
  const prefix = `${ASSET_MEDIA_PREFIX}${course.id}:`
  const live = new Set((course.assets ?? []).map((a) => mediaKey(course.id, a.id)))
  let removed = 0
  for (const k of (await idbKeys()) as string[]) {
    if (typeof k !== 'string' || !k.startsWith(prefix) || live.has(k)) continue
    await idbDel(k)
    removed++
  }
  return removed
}

/** Remove a course and every byte of media it owns. */
export async function deleteCourseRecord(courseId: string): Promise<void> {
  await idbDel(COURSE_PREFIX + courseId)
  const prefix = `${ASSET_MEDIA_PREFIX}${courseId}:`
  for (const k of (await idbKeys()) as string[]) {
    if (typeof k === 'string' && k.startsWith(prefix)) await idbDel(k)
  }
}
