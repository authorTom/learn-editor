import type { Asset, Course } from '../types'
import { decodeDataUrl, extensionFor, isPrecompressed, safeFileStem } from '../utils/dataUrl'

/**
 * Turning a course's embedded media into real files.
 *
 * A course carries its images and audio as base64 data URLs, which is right for
 * a browser-resident editor: one IndexedDB record, no file handles, no paths to
 * keep in sync. It is wrong for a package an LMS serves, where it means the
 * learner downloads and parses every byte of every image before the first
 * lesson can paint, base64 costs a third again in size, and nothing can be
 * lazily loaded or cached.
 *
 * So packages get `media/…` files and a course whose srcs point at them. The
 * player needs no changes for this: it already resolves `asset:<id>` through a
 * single lookup, and a relative path passes through it as readily as a data URL.
 *
 * Only the zip exports use this. Preview, the diff view, the flight recorder
 * and the review build are single self-contained documents by design and stay
 * inline — that is the whole point of them.
 */

export interface PackagedFile {
  path: string
  bytes: Uint8Array
  /** Already-compressed bytes; the zip stores rather than deflates them. */
  precompressed: boolean
}

export interface PackagedMedia {
  /** The course's assets with `src` rewritten to a relative path. */
  assets: Asset[]
  coverImage: string
  logo: string
  /** Rewritten lesson hero images, by lesson id — only for lessons whose hero
      is a raw data URL. An `asset:` hero resolves through `assets` already. */
  heroImages: Record<string, string>
  files: PackagedFile[]
}

const DIR = 'media/'

/** Collects files, reusing one path for any bytes packaged twice — a cover
    image also used as a lesson hero should not ship two copies. */
class Collector {
  readonly files: PackagedFile[] = []
  private readonly seen = new Map<string, string>()

  /** Package `src` if it is a data URL; otherwise hand it straight back, which
      covers external URLs, `asset:` references, '' and anything undecodable. */
  add(src: string, stem: string, kind?: 'image' | 'audio'): string {
    if (!src) return src
    const existing = this.seen.get(src)
    if (existing) return existing

    const decoded = decodeDataUrl(src)
    if (!decoded) return src

    const ext = extensionFor(decoded.mime, kind)
    const path = `${DIR}${safeFileStem(stem)}.${ext}`
    this.seen.set(src, path)
    this.files.push({ path, bytes: decoded.bytes, precompressed: isPrecompressed(ext) })
    return path
  }
}

/** Decode every embedded data URL in a course into a file, and report the
    rewritten srcs that point at them. Pure: the course is not modified. */
export function packageMedia(course: Course): PackagedMedia {
  const c = new Collector()

  const assets = (course.assets ?? []).map((a) => ({
    ...a,
    src: c.add(a.src, a.id, a.kind),
  }))

  const coverImage = c.add(course.coverImage ?? '', 'cover', 'image')
  const logo = c.add(course.theme?.logo ?? '', 'logo', 'image')

  const heroImages: Record<string, string> = {}
  for (const lesson of course.lessons) {
    const hero = lesson.theme?.heroImage
    if (!hero) continue
    const packaged = c.add(hero, `hero-${lesson.id}`, 'image')
    if (packaged !== hero) heroImages[lesson.id] = packaged
  }

  return { assets, coverImage, logo, heroImages, files: c.files }
}

/** Every path in the package, for the manifest's resource listing. */
export function packagedPaths(media: PackagedMedia): string[] {
  return media.files.map((f) => f.path)
}
