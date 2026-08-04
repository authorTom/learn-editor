/** Decoding data URLs back into bytes, so media can be written as real files
    rather than embedded as base64. */

/** MIME → the extension a packaged file gets. An LMS serves the package as
    static files and picks the Content-Type off the extension, so an unknown
    type is safer as its closest known relative than as `.bin`. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'weba',
  'audio/flac': 'flac',
}

/** Types that are already compressed — re-DEFLATEing them costs time for
    roughly nothing, so the packager stores them verbatim. */
const PRECOMPRESSED = new Set(['jpg', 'png', 'gif', 'webp', 'avif', 'mp3', 'm4a', 'aac', 'ogg', 'weba', 'flac'])

export interface DecodedDataUrl {
  mime: string
  bytes: Uint8Array
}

/** Decode a `data:` URL. Returns null for anything else — an external URL, an
    `asset:` reference, an empty string, or a payload we can't parse — which the
    callers treat as "leave this src alone". */
export function decodeDataUrl(src: string): DecodedDataUrl | null {
  if (!src || !src.startsWith('data:')) return null
  const comma = src.indexOf(',')
  if (comma < 0) return null

  const header = src.slice(5, comma)
  const body = src.slice(comma + 1)
  const isBase64 = /;base64$/i.test(header)
  const mime = (isBase64 ? header.slice(0, -';base64'.length) : header).split(';')[0] || ''

  try {
    if (!isBase64) {
      // Rare, but legal: `data:image/svg+xml,<svg…>`, percent-encoded.
      return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) }
    }
    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { mime, bytes }
  } catch {
    // Truncated or malformed base64. Better to ship the data URL inline than to
    // write a corrupt file and have the course render a broken image.
    return null
  }
}

/** File extension for a decoded MIME, falling back on the asset's own kind. */
export function extensionFor(mime: string, kind?: 'image' | 'audio'): string {
  const known = EXTENSIONS[mime.toLowerCase()]
  if (known) return known
  // `image/tiff` and friends: keep the subtype if it looks like an extension.
  const sub = mime.split('/')[1]?.replace(/\+.*$/, '')
  if (sub && /^[a-z0-9]{1,5}$/i.test(sub)) return sub.toLowerCase()
  return kind === 'audio' ? 'mp3' : 'png'
}

export function isPrecompressed(extension: string): boolean {
  return PRECOMPRESSED.has(extension)
}

/** Ids reach us from imported course JSON as well as from `uid()`, so they are
    not automatically safe to use as a path segment. */
export function safeFileStem(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_-]/g, '')
  return cleaned || 'file'
}
