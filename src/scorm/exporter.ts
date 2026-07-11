import JSZip from 'jszip'
import type { Course } from '../types'
import { buildPlayerHtml } from './buildPlayerHtml'
import { buildManifest12, buildManifest2004 } from './manifest'
import { downloadBlob, slugify } from '../utils/file'

export async function exportScorm(course: Course, version: '1.2' | '2004'): Promise<void> {
  const zip = new JSZip()
  zip.file('index.html', buildPlayerHtml(course, version))
  zip.file(
    'imsmanifest.xml',
    version === '1.2' ? buildManifest12(course) : buildManifest2004(course)
  )
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  const suffix = version === '1.2' ? 'scorm12' : 'scorm2004'
  downloadBlob(blob, `${slugify(course.title)}-${suffix}.zip`)
}

/** Standalone web version (no LMS) — just open index.html. */
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

/** JSON backup that can be re-imported into Learn Editor. */
export function exportJson(course: Course): void {
  const blob = new Blob([JSON.stringify(course, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${slugify(course.title)}.learneditor.json`)
}
