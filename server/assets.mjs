// Media storage, addressed by content.
//
// An image is identified by the SHA-256 of its bytes, so the same photograph
// used in six courses — or captured in twelve version snapshots of one course —
// is stored once. That is not an optimisation for its own sake: this app embeds
// media as data URLs inside the course document, and without dedup a library
// with a handful of image-heavy courses would multiply itself across every
// snapshot on the volume.
//
// It also makes upload cheap to skip. The client asks which hashes are missing
// and sends only those, so re-syncing a course after editing a sentence
// transfers the sentence.
//
// Bytes live on disk rather than in SQLite. A multi-megabyte BLOB column makes
// every backup, every WAL checkpoint and every query plan worse, and the
// filesystem is already very good at storing files.

import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { badRequest, notFound } from './routes.mjs'
import { readBuffer, readJson, sendEmpty, sendJson } from './routes.mjs'
import { log } from './log.mjs'

const SHA_RE = /^[a-f0-9]{64}$/

/** Two-character shard, so no directory ends up with a hundred thousand files. */
function blobPath(config, sha) {
  return path.join(config.blobDir, sha.slice(0, 2), sha)
}

function assertSha(sha) {
  if (!SHA_RE.test(sha)) throw badRequest('Asset id must be a lowercase hex SHA-256.')
  return sha
}

/**
 * Point a course at exactly this set of blobs.
 *
 * Called on every push. Rewriting the whole set rather than diffing it keeps
 * the reference table honest when an author deletes an image: the row goes, and
 * the blob becomes collectable the moment nothing else points at it.
 */
export function setCourseBlobs(db, courseId, shas) {
  db.prepare('DELETE FROM course_blobs WHERE course_id = ?').run(courseId)
  if (shas.length) {
    const link = db.prepare('INSERT OR IGNORE INTO course_blobs (course_id, sha) VALUES (?, ?)')
    const known = db.prepare('SELECT 1 AS ok FROM blobs WHERE sha = ?')
    for (const sha of shas) {
      // Only reference blobs that were actually uploaded. A client that declares
      // a hash it never sent would otherwise create a dangling reference that
      // keeps a missing file "alive" forever.
      if (known.get(sha)) link.run(courseId, sha)
    }
  }
}

/**
 * Delete every blob nothing points at any more.
 *
 * Needed because references are rewritten wholesale on each push, and because
 * deleting a user cascades their `course_blobs` rows away without touching the
 * `blobs` table. Without this an author who replaces the same photograph twenty
 * times leaves twenty copies on the volume permanently — and the row count grows
 * with edits rather than with content.
 *
 * The database is authoritative; unlinking the file is best-effort and logged.
 * A file left behind wastes space, which is a chore. A row deleted while the
 * file survives is the same chore. Neither loses anything anyone can see.
 */
export function collectOrphanBlobs(db, config) {
  const orphans = db
    .prepare('SELECT sha FROM blobs WHERE sha NOT IN (SELECT sha FROM course_blobs)')
    .all()
    .map((r) => r.sha)
  if (!orphans.length) return 0

  const drop = db.prepare('DELETE FROM blobs WHERE sha = ?')
  for (const sha of orphans) {
    drop.run(sha)
    unlink(blobPath(config, sha)).catch((err) => {
      if (err.code !== 'ENOENT') log.warn('could not remove blob', { sha, error: err.message })
    })
  }
  log.debug('collected orphaned media', { count: orphans.length })
  return orphans.length
}

/**
 * Drop a course's references and delete any blob left with none.
 *
 * Deliberately synchronous about the database and best-effort about the files:
 * an unlink that fails leaves an orphan taking up space, which is a chore. A
 * database row deleted before a successful unlink would leave a file nothing
 * remembers, which is the same chore. Neither loses data, so the simpler order
 * wins and failures are logged.
 */
export function releaseCourseBlobs(db, config, courseId) {
  const orphans = db
    .prepare(
      `SELECT sha FROM course_blobs WHERE course_id = ?
       AND sha NOT IN (SELECT sha FROM course_blobs WHERE course_id != ?)`
    )
    .all(courseId, courseId)
    .map((r) => r.sha)

  db.prepare('DELETE FROM course_blobs WHERE course_id = ?').run(courseId)
  for (const sha of orphans) {
    db.prepare('DELETE FROM blobs WHERE sha = ?').run(sha)
    unlink(blobPath(config, sha)).catch((err) => {
      if (err.code !== 'ENOENT') log.warn('could not remove blob', { sha, error: err.message })
    })
  }
  return orphans.length
}

export function registerAssetRoutes(router, { db, config, auth }) {
  const q = {
    get: db.prepare('SELECT * FROM blobs WHERE sha = ?'),
    insert: db.prepare('INSERT OR IGNORE INTO blobs (sha, bytes, mime, created_at) VALUES (?, ?, ?, ?)'),
  }

  // ---- which of these do you already have? ----
  //
  // One round trip for a whole course's media, rather than a HEAD per asset.
  router.post('/api/assets/missing', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    auth.requireUser(ctx.req)
    const body = await readJson(ctx.req, 1024 * 1024)
    if (!Array.isArray(body.shas)) throw badRequest('Send { shas: [...] }.')
    if (body.shas.length > 5000) throw badRequest('Too many hashes in one request.')

    const missing = []
    for (const sha of body.shas) {
      assertSha(sha)
      if (!q.get.get(sha)) missing.push(sha)
    }
    sendJson(ctx.res, 200, { missing })
  })

  router.head('/api/assets/:sha', (ctx) => {
    auth.requireUser(ctx.req)
    const row = q.get.get(assertSha(ctx.params.sha))
    sendEmpty(ctx.res, row ? 200 : 404)
  })

  // ---- upload ----
  router.put('/api/assets/:sha', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    auth.requireUser(ctx.req)
    const sha = assertSha(ctx.params.sha)

    if (q.get.get(sha)) {
      sendEmpty(ctx.res, 204) // already here — dedup, not an error
      return
    }

    const bytes = await readBuffer(ctx.req, config.maxBodyBytes)
    if (!bytes.length) throw badRequest('Empty upload.')

    // Verify the content matches the name it was given. Without this the store
    // is no longer content-addressed — a client could overwrite one asset's
    // hash with another's bytes, and every course referencing it would change.
    const actual = crypto.createHash('sha256').update(bytes).digest('hex')
    if (actual !== sha) {
      throw badRequest('Uploaded bytes do not match the hash in the URL.', 'sha_mismatch')
    }

    const mime = typeof ctx.req.headers['content-type'] === 'string'
      ? ctx.req.headers['content-type'].split(';')[0].trim().slice(0, 100)
      : ''

    const dest = blobPath(config, sha)
    await mkdir(path.dirname(dest), { recursive: true })
    // Write to a temporary name and rename into place: rename is atomic within
    // a filesystem, so a crash mid-write cannot leave a truncated file sitting
    // at a hash that says it is complete.
    const tmp = `${dest}.${crypto.randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(tmp, bytes)
      await rename(tmp, dest)
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }

    q.insert.run(sha, bytes.length, mime, Date.now())
    sendEmpty(ctx.res, 201)
  })

  // ---- download ----
  router.get('/api/assets/:sha', async (ctx) => {
    auth.requireUser(ctx.req)
    const sha = assertSha(ctx.params.sha)
    const row = q.get.get(sha)
    if (!row) throw notFound('No such asset.')

    const file = blobPath(config, sha)
    let size
    try {
      size = (await stat(file)).size
    } catch {
      log.error('blob row without a file', { sha })
      throw notFound('That asset is recorded but its bytes are missing.')
    }

    ctx.res.writeHead(200, {
      'Content-Type': row.mime || 'application/octet-stream',
      'Content-Length': size,
      // Immutable by construction: the name *is* the content.
      'Cache-Control': 'private, max-age=31536000, immutable',
      ETag: `"${sha}"`,
      // These are author uploads, served back to the author. Never let a
      // response be interpreted as a document in our own origin.
      'Content-Disposition': 'attachment',
      'X-Content-Type-Options': 'nosniff',
    })

    const stream = createReadStream(file)
    await new Promise((resolve) => {
      stream.on('error', () => { ctx.res.destroy(); resolve() })
      stream.on('close', resolve)
      ctx.res.on('close', () => stream.destroy())
      stream.pipe(ctx.res)
    })
  })
}
