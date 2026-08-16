// Serving the built SPA, replacing what nginx.conf used to do.
//
// The behaviour it has to reproduce exactly:
//   • /assets/* is fingerprinted by Vite, so cache it hard and immutably
//   • index.html must never be cached, or a deploy is invisible until a hard
//     refresh — the one bug that makes a release look like it did not happen
//   • unknown paths return the app shell, not a 404 (SPA history fallback)
//
// Range requests are supported because the editor's audio blocks stream media
// through the same server, and Safari will not play audio from a source that
// answers a Range request with a 200.

import { statSync } from 'node:fs'
import { open } from 'node:fs/promises'
import path from 'node:path'
import { log } from './log.mjs'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

/**
 * Resolve a URL path to a file inside `root`, or null if it escapes.
 *
 * The containment check is done on the *resolved* path rather than by looking
 * for ".." in the URL: percent-encoding, backslashes and unicode all give a
 * string check something to miss, and `path.resolve` gives an answer that
 * cannot be argued with.
 */
function resolveInside(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null // malformed percent-encoding
  }
  if (decoded.includes('\0')) return null
  const full = path.resolve(root, '.' + path.posix.normalize(decoded))
  if (full !== root && !full.startsWith(root + path.sep)) return null
  return full
}

export function createStaticHandler(root) {
  const dist = path.resolve(root)
  const indexPath = path.join(dist, 'index.html')

  let haveIndex = true
  try {
    statSync(indexPath)
  } catch {
    haveIndex = false
    log.warn('no built SPA found — API only', { dist })
  }

  async function sendFile(req, res, file, { immutable }) {
    let handle
    try {
      handle = await open(file, 'r')
    } catch {
      return false
    }
    try {
      const stat = await handle.stat()
      if (!stat.isFile()) return false

      const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
      const headers = {
        'Content-Type': mimeFor(file),
        'Last-Modified': stat.mtime.toUTCString(),
        ETag: etag,
        'Cache-Control': immutable
          ? 'public, max-age=31536000, immutable'
          : 'no-cache', // revalidate every time; the ETag makes that cheap
        'Accept-Ranges': 'bytes',
      }

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers)
        res.end()
        return true
      }

      const range = parseRange(req.headers.range, stat.size)
      if (range === 'unsatisfiable') {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
        res.end()
        return true
      }

      const [start, end] = range ?? [0, stat.size - 1]
      const length = end - start + 1
      res.writeHead(range ? 206 : 200, {
        ...headers,
        'Content-Length': length,
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}),
      })

      if (req.method === 'HEAD') {
        res.end()
        return true
      }

      // Stream from the handle we already hold, and close it exactly once — in
      // `finally`, after the transfer settles.
      //
      // `autoClose: false` is load-bearing. Letting the stream own the handle
      // means the FileHandle object itself is never closed, only its descriptor,
      // and Node then throws when it is garbage collected ("A FileHandle object
      // was closed during garbage collection") — which takes the whole server
      // down, some seconds after the request that caused it has succeeded.
      const stream = handle.createReadStream({ start, end, autoClose: false })
      await new Promise((resolve) => {
        stream.on('error', () => { res.destroy(); resolve() })
        stream.on('close', resolve)
        // A client that disconnects mid-download must not leave the stream
        // reading a file nobody is listening to.
        res.on('close', () => stream.destroy())
        stream.pipe(res)
      })
      return true
    } finally {
      await handle?.close().catch(() => {})
    }
  }

  /** Returns true if it handled the request. */
  return async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false
    if (!haveIndex) return false

    const file = resolveInside(dist, pathname)
    if (!file) return false

    // Fingerprinted assets: cache for a year, and never fall back to the shell.
    // A missing /assets/* file is a broken deploy, and answering it with HTML
    // makes the browser report a confusing MIME error instead of a plain 404.
    if (pathname.startsWith('/assets/')) {
      if (await sendFile(req, res, file, { immutable: true })) return true
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return true
    }

    if (pathname !== '/' && (await sendFile(req, res, file, { immutable: false }))) return true

    // SPA fallback.
    return sendFile(req, res, indexPath, { immutable: false })
  }
}

function parseRange(header, size) {
  if (!header || !header.startsWith('bytes=')) return null
  const spec = header.slice(6).split(',')[0]?.trim()
  if (!spec) return null
  const [rawStart, rawEnd] = spec.split('-')
  let start
  let end
  if (rawStart === '') {
    // Suffix form: "bytes=-500" means the last 500 bytes.
    const n = Number(rawEnd)
    if (!Number.isFinite(n) || n <= 0) return null
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' || rawEnd === undefined ? size - 1 : Number(rawEnd)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start > end || start >= size) return 'unsatisfiable'
  return [start, Math.min(end, size - 1)]
}
