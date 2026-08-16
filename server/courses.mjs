// Course sync.
//
// The client is the source of truth for its own edits; this is durable shared
// storage that several of an author's machines can agree on. So the protocol is
// deliberately small: list what changed, pull one, push one.
//
// The part worth understanding is the conflict rule. Every accepted push bumps
// `rev`. A client sends the rev it last saw as `baseRev`, and if the server has
// moved on since, the push is refused with 409 and the server's current copy
// comes back in the response body. The client then shows the author what
// differs — using diffCourses, the same code the version panel uses — and lets
// them choose. Last-write-wins would be less code and would quietly destroy an
// afternoon's work on the other laptop; for regulated training content that is
// not an acceptable default.
//
// Media never travels in these documents. The course JSON stored here has its
// asset bytes stripped, exactly as courseStorage.ts already writes it in the
// browser; the bytes go through assets.mjs and are referenced by hash.

import { badRequest, conflict, forbidden, notFound } from './routes.mjs'
import { readJson, sendEmpty, sendJson } from './routes.mjs'
import { transaction } from './db.mjs'
import { collectOrphanBlobs, releaseCourseBlobs, setCourseBlobs } from './assets.mjs'

/** Reject anything that is not recognisably a course before it reaches storage. */
function validateDoc(doc, id) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw badRequest('Course document must be an object.')
  }
  if (doc.id !== id) {
    throw badRequest('Course document id does not match the URL.')
  }
  if (!Array.isArray(doc.lessons)) {
    throw badRequest('Course document has no lessons array.')
  }
  return doc
}

function shaList(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw badRequest('assets must be an array of hashes.')
  for (const sha of value) {
    if (typeof sha !== 'string' || !/^[a-f0-9]{64}$/.test(sha)) {
      throw badRequest('assets must be lowercase hex SHA-256 hashes.')
    }
  }
  return value
}

export function registerCourseRoutes(router, { db, config, auth }) {
  const q = {
    list: db.prepare(
      'SELECT id, title, rev, updated_at, deleted_at FROM courses WHERE owner_id = ? ORDER BY updated_at DESC'
    ),
    get: db.prepare('SELECT * FROM courses WHERE id = ?'),
    insert: db.prepare(
      `INSERT INTO courses (id, owner_id, title, doc, rev, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, 1, ?, NULL)`
    ),
    update: db.prepare(
      'UPDATE courses SET title = ?, doc = ?, rev = ?, updated_at = ?, deleted_at = NULL WHERE id = ?'
    ),
    tombstone: db.prepare('UPDATE courses SET deleted_at = ?, rev = ?, updated_at = ?, doc = ? WHERE id = ?'),
    versions: db.prepare(
      `SELECT id, name, note, created_at, lesson_count, block_count, auto
       FROM course_versions WHERE course_id = ? ORDER BY created_at DESC`
    ),
    versionDoc: db.prepare('SELECT * FROM course_versions WHERE id = ?'),
    insertVersion: db.prepare(
      `INSERT INTO course_versions (id, course_id, name, note, created_at, lesson_count, block_count, auto, doc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    deleteVersion: db.prepare('DELETE FROM course_versions WHERE id = ?'),
  }

  /** Load a course this user is allowed to touch, or throw. */
  function owned(req, id) {
    const user = auth.requireUser(req)
    const row = q.get.get(id)
    if (!row) return { user, row: null }
    // An author sees only their own. Admins deliberately get no back door into
    // course content: managing accounts is not the same as reading their work.
    if (row.owner_id !== user.id) throw forbidden('That course belongs to someone else.')
    return { user, row }
  }

  // ---- what has changed ----
  router.get('/api/courses', (ctx) => {
    const user = auth.requireUser(ctx.req)
    const courses = q.list.all(user.id).map((r) => ({
      id: r.id,
      title: r.title,
      rev: r.rev,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    }))
    sendJson(ctx.res, 200, { courses })
  })

  // ---- pull one ----
  router.get('/api/courses/:id', (ctx) => {
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    if (row.deleted_at) {
      // 410, not 404: "it was here and is now gone" is a different instruction
      // to a syncing client than "I have never heard of it".
      sendJson(ctx.res, 410, { id: row.id, rev: row.rev, deletedAt: row.deleted_at })
      return
    }
    sendJson(ctx.res, 200, { id: row.id, rev: row.rev, updatedAt: row.updated_at, doc: JSON.parse(row.doc) })
  })

  // ---- push one ----
  router.put('/api/courses/:id', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const { user, row } = owned(ctx.req, ctx.params.id)

    const body = await readJson(ctx.req, config.maxBodyBytes)
    const doc = validateDoc(body.doc, ctx.params.id)
    const assets = shaList(body.assets)
    const baseRev = Number.isInteger(body.baseRev) ? body.baseRev : 0
    const force = body.force === true

    const title = typeof doc.title === 'string' ? doc.title.slice(0, 300) : ''
    const now = Date.now()
    const serialised = JSON.stringify(doc)

    if (!row) {
      const created = transaction(db, () => {
        q.insert.run(ctx.params.id, user.id, title, serialised, now)
        setCourseBlobs(db, ctx.params.id, assets)
        return q.get.get(ctx.params.id)
      })
      sendJson(ctx.res, 201, { id: created.id, rev: created.rev, updatedAt: created.updated_at })
      return
    }

    if (!force && row.rev !== baseRev) {
      throw conflict(
        'This course changed elsewhere since you last synced.',
        'rev_conflict'
      )
    }

    const rev = row.rev + 1
    transaction(db, () => {
      q.update.run(title, serialised, rev, now, ctx.params.id)
      setCourseBlobs(db, ctx.params.id, assets)
      // An edit that removed an image leaves its bytes referenced by nothing.
      collectOrphanBlobs(db, config)
    })
    sendJson(ctx.res, 200, { id: ctx.params.id, rev, updatedAt: now })
  })

  // A conflict needs the other side's copy to be resolvable, but a 409 body is
  // the wrong place for a multi-megabyte document — a client that only wants to
  // retry should not have to download it. It is fetched explicitly instead.
  router.get('/api/courses/:id/server-copy', (ctx) => {
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    sendJson(ctx.res, 200, {
      id: row.id, rev: row.rev, updatedAt: row.updated_at,
      deletedAt: row.deleted_at, doc: JSON.parse(row.doc),
    })
  })

  // ---- delete (tombstone) ----
  router.delete('/api/courses/:id', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    if (row.deleted_at) {
      sendEmpty(ctx.res, 204)
      return
    }
    const now = Date.now()
    transaction(db, () => {
      // The document is emptied on the way out. The tombstone exists so other
      // devices learn the course is gone; keeping its content would mean a
      // "deleted" course still sat on the server in full.
      q.tombstone.run(now, row.rev + 1, now, JSON.stringify({ id: row.id, lessons: [] }), row.id)
      db.prepare('DELETE FROM course_versions WHERE course_id = ?').run(row.id)
      releaseCourseBlobs(db, config, row.id)
    })
    sendEmpty(ctx.res, 204)
  })

  // ---- version snapshots ----
  //
  // These sync too. PRODUCT.md leans on them for the compliance question — what
  // changed between the version we approved and the one that shipped — and an
  // answer that only exists on one laptop is not an answer.

  router.get('/api/courses/:id/versions', (ctx) => {
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    const versions = q.versions.all(row.id).map((v) => ({
      id: v.id, name: v.name, note: v.note, createdAt: v.created_at,
      lessonCount: v.lesson_count, blockCount: v.block_count, auto: !!v.auto,
    }))
    sendJson(ctx.res, 200, { versions })
  })

  router.get('/api/courses/:id/versions/:versionId', (ctx) => {
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    const v = q.versionDoc.get(ctx.params.versionId)
    if (!v || v.course_id !== row.id) throw notFound('No such version.')
    sendJson(ctx.res, 200, { id: v.id, createdAt: v.created_at, doc: JSON.parse(v.doc) })
  })

  router.put('/api/courses/:id/versions/:versionId', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('Sync the course before its history.')

    const existing = q.versionDoc.get(ctx.params.versionId)
    if (existing) {
      // Snapshots are immutable by definition, so re-pushing one is a no-op
      // rather than an error — which makes the client's sync loop idempotent.
      sendEmpty(ctx.res, 204)
      return
    }

    const body = await readJson(ctx.req, config.maxBodyBytes)
    const doc = validateDoc(body.doc, ctx.params.id)
    q.insertVersion.run(
      ctx.params.versionId,
      row.id,
      String(body.name ?? '').slice(0, 200),
      String(body.note ?? '').slice(0, 2000),
      Number.isInteger(body.createdAt) ? body.createdAt : Date.now(),
      Number.isInteger(body.lessonCount) ? body.lessonCount : doc.lessons.length,
      Number.isInteger(body.blockCount) ? body.blockCount : 0,
      body.auto ? 1 : 0,
      JSON.stringify(doc)
    )
    sendEmpty(ctx.res, 201)
  })

  router.delete('/api/courses/:id/versions/:versionId', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const { row } = owned(ctx.req, ctx.params.id)
    if (!row) throw notFound('No such course.')
    const v = q.versionDoc.get(ctx.params.versionId)
    if (v && v.course_id === row.id) q.deleteVersion.run(v.id)
    sendEmpty(ctx.res, 204)
  })
}
