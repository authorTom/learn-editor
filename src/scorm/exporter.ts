import JSZip from 'jszip'
import type { Course } from '../types'
import { buildPlayerHtml } from './buildPlayerHtml'
import { buildManifest12, buildManifest2004 } from './manifest'
import { packageMedia, packagedPaths, type PackagedMedia } from './media'
import { downloadBlob, slugify } from '../utils/file'

/** Add the packaged media to a zip. Images and audio arrive already compressed,
    so deflating them again buys a percent or two for a lot of CPU — those are
    stored verbatim and only the text-ish formats (SVG, WAV) get deflated. */
function addMediaFiles(zip: JSZip, media: PackagedMedia): void {
  for (const f of media.files) {
    zip.file(f.path, f.bytes, {
      compression: f.precompressed ? 'STORE' : 'DEFLATE',
      ...(f.precompressed ? {} : { compressionOptions: { level: 6 } }),
    })
  }
}

export async function exportScorm(course: Course, version: '1.2' | '2004'): Promise<void> {
  const media = packageMedia(course)
  const zip = new JSZip()
  zip.file('index.html', buildPlayerHtml(course, version, media))
  addMediaFiles(zip, media)
  const paths = packagedPaths(media)
  zip.file(
    'imsmanifest.xml',
    version === '1.2' ? buildManifest12(course, paths) : buildManifest2004(course, paths)
  )
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  const suffix = version === '1.2' ? 'scorm12' : 'scorm2004'
  downloadBlob(blob, `${slugify(course.title)}-${suffix}.zip`)
}

/** Standalone web version (no LMS) — just open index.html.
 *
 *  Deliberately still one inlined file, unlike the SCORM packages: this export
 *  exists to be handed over whole — emailed, dropped on a share, opened off a
 *  USB stick — and a folder of loose media files is exactly what breaks when
 *  someone forwards only the page. Host a course properly and you want the
 *  SCORM or a real static deploy. */
export async function exportWeb(course: Course): Promise<void> {
  const zip = new JSZip()
  zip.file('index.html', buildPlayerHtml(course, 'preview'))
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(blob, `${slugify(course.title)}-web.zip`)
}

/** JSON backup that can be re-imported into Quoin. */
export function exportJson(course: Course): void {
  const blob = new Blob([JSON.stringify(course, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${slugify(course.title)}.quoin.json`)
}
