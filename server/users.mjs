// Account management: the administrator's view of who can use this instance,
// and each person's view of themselves.
//
// There is no public sign-up. An administrator creates the account and hands
// over a one-time invitation link, which the new author exchanges for a
// password. That keeps the deployment closed by default and means the server
// needs no SMTP — the link is copied out of the admin screen, so nothing has to
// be configured before the first colleague can be added.
//
// The rule that shapes most of this file: an instance must never end up with no
// administrator. Every operation that could remove the last one is refused,
// with a message saying why rather than a bare 403.

import crypto from 'node:crypto'
import { badRequest, conflict, forbidden, notFound } from './routes.mjs'
import { readJson, sendEmpty, sendJson } from './routes.mjs'
import { normaliseEmail, publicUser, validateEmail } from './auth.mjs'
import { collectOrphanBlobs } from './assets.mjs'
import { log } from './log.mjs'

const ROLES = new Set(['admin', 'author'])
const STATUSES = new Set(['active', 'suspended'])

export function registerUserRoutes(router, { db, config, auth }) {
  const q = {
    all: db.prepare('SELECT * FROM users ORDER BY created_at'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    adminCount: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'"),
    insert: db.prepare(
      `INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 'active', ?, ?)`
    ),
    del: db.prepare('DELETE FROM users WHERE id = ?'),
    insertInvite: db.prepare(
      'INSERT INTO invites (id, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)'
    ),
    clearInvites: db.prepare('DELETE FROM invites WHERE user_id = ?'),
    pendingInvite: db.prepare(
      'SELECT expires_at FROM invites WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC'
    ),
  }

  /** Would this change leave the instance with no active administrator? */
  function lastAdmin(userId, { toRole, toStatus } = {}) {
    const user = q.byId.get(userId)
    if (!user || user.role !== 'admin' || user.status !== 'active') return false
    const stillAdmin = (toRole ?? user.role) === 'admin' && (toStatus ?? user.status) === 'active'
    if (stillAdmin) return false
    return q.adminCount.get().n <= 1
  }

  function issueInvite(userId) {
    const raw = auth.token()
    const now = Date.now()
    // One live invitation per account: re-inviting invalidates the old link,
    // which is what someone expects when they click "send a new link" after a
    // link goes astray.
    q.clearInvites.run(userId)
    q.insertInvite.run(auth.sha256(raw), userId, now, now + auth.inviteTtlMs)
    return { token: raw, expiresAt: now + auth.inviteTtlMs }
  }

  function withInviteState(row) {
    const invite = q.pendingInvite.get(row.id, Date.now())
    return {
      ...publicUser(row),
      // Distinguishes "has never signed in" from "is set up and just quiet",
      // which is the difference between chasing someone and leaving them alone.
      pending: row.password_hash === null,
      inviteExpiresAt: invite?.expires_at ?? null,
    }
  }

  // ---- admin: list ----
  router.get('/api/users', (ctx) => {
    auth.requireAdmin(ctx.req)
    sendJson(ctx.res, 200, { users: q.all.all().map(withInviteState) })
  })

  // ---- admin: create, and hand back the invitation link ----
  router.post('/api/users', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    auth.requireAdmin(ctx.req)

    const body = await readJson(ctx.req, 64 * 1024)
    const email = normaliseEmail(body.email)
    validateEmail(email)
    const role = body.role ?? 'author'
    if (!ROLES.has(role)) throw badRequest('Role must be admin or author.')
    if (q.byEmail.get(email)) throw conflict('Someone with that email already has an account.', 'email_taken')

    const now = Date.now()
    const id = crypto.randomUUID()
    q.insert.run(id, email, String(body.name ?? '').slice(0, 120), role, now, now)
    const invite = issueInvite(id)

    log.info('user created', { email, role })
    sendJson(ctx.res, 201, {
      user: withInviteState(q.byId.get(id)),
      // Returned once, here. The token's hash is all the server keeps, so this
      // is the only moment the link can be shown — the UI says so.
      invite,
    })
  })

  // ---- admin: re-issue an invitation ----
  router.post('/api/users/:id/invite', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    auth.requireAdmin(ctx.req)
    const user = q.byId.get(ctx.params.id)
    if (!user) throw notFound('No such user.')
    if (user.password_hash !== null) {
      throw conflict('That account already has a password — send a reset instead.', 'already_active')
    }
    sendJson(ctx.res, 200, { invite: issueInvite(user.id) })
  })

  // ---- admin: reset someone's password by invitation ----
  //
  // Deliberately not "set a new password for them": an administrator who can
  // read a colleague's password is a worse position than one who can only
  // hand them a link to choose their own.
  router.post('/api/users/:id/reset', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const admin = auth.requireAdmin(ctx.req)
    const user = q.byId.get(ctx.params.id)
    if (!user) throw notFound('No such user.')

    db.prepare('UPDATE users SET password_hash = NULL, updated_at = ? WHERE id = ?').run(Date.now(), user.id)
    // A password reset is usually a response to a lost or compromised device.
    auth.queries.deleteUserSessions.run(user.id)
    log.info('password reset issued', { by: admin.email, for: user.email })
    sendJson(ctx.res, 200, { invite: issueInvite(user.id) })
  })

  // ---- admin: change role, status or name ----
  router.patch('/api/users/:id', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const admin = auth.requireAdmin(ctx.req)
    const user = q.byId.get(ctx.params.id)
    if (!user) throw notFound('No such user.')

    const body = await readJson(ctx.req, 64 * 1024)
    const patch = {}
    if (body.name !== undefined) patch.name = String(body.name).slice(0, 120)
    if (body.role !== undefined) {
      if (!ROLES.has(body.role)) throw badRequest('Role must be admin or author.')
      patch.role = body.role
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) throw badRequest('Status must be active or suspended.')
      patch.status = body.status
    }
    if (!Object.keys(patch).length) throw badRequest('Nothing to change.')

    if (lastAdmin(user.id, { toRole: patch.role, toStatus: patch.status })) {
      throw conflict(
        'This is the only administrator. Promote someone else first, or the instance would be left with no way to manage it.',
        'last_admin'
      )
    }

    const now = Date.now()
    db.prepare('UPDATE users SET name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?').run(
      patch.name ?? user.name,
      patch.role ?? user.role,
      patch.status ?? user.status,
      now,
      user.id
    )
    // Suspension must take effect immediately, not at the next sign-in.
    if (patch.status === 'suspended') auth.queries.deleteUserSessions.run(user.id)

    log.info('user updated', { by: admin.email, user: user.email, ...patch })
    sendJson(ctx.res, 200, { user: withInviteState(q.byId.get(user.id)) })
  })

  // ---- admin: delete ----
  router.delete('/api/users/:id', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const admin = auth.requireAdmin(ctx.req)
    const user = q.byId.get(ctx.params.id)
    if (!user) throw notFound('No such user.')
    if (user.id === admin.id) {
      throw conflict('You cannot delete your own account. Ask another administrator.', 'self_delete')
    }
    if (lastAdmin(user.id, { toStatus: 'suspended' })) {
      throw conflict('This is the only administrator, so the account cannot be deleted.', 'last_admin')
    }

    // ON DELETE CASCADE takes the sessions, invites, courses and version
    // history with it. Blobs are reference-counted, so they are collected
    // separately — see assets.mjs.
    q.del.run(user.id)
    // The cascade takes their courses and the rows pointing at media, but not
    // the media itself — that is reference-counted and swept here.
    collectOrphanBlobs(db, config)
    log.info('user deleted', { by: admin.email, user: user.email })
    sendEmpty(ctx.res, 204)
  })

  // ---- anyone: my own profile ----
  router.patch('/api/account', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const user = auth.requireUser(ctx.req)
    const body = await readJson(ctx.req, 64 * 1024)

    const name = body.name === undefined ? user.name : String(body.name).slice(0, 120)
    let email = user.email
    if (body.email !== undefined) {
      email = normaliseEmail(body.email)
      validateEmail(email)
      const clash = q.byEmail.get(email)
      if (clash && clash.id !== user.id) {
        throw conflict('Another account already uses that email.', 'email_taken')
      }
    }

    db.prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?').run(
      name, email, Date.now(), user.id
    )
    sendJson(ctx.res, 200, { user: publicUser(q.byId.get(user.id)) })
  })

  // ---- anyone: sign out everywhere else ----
  router.post('/api/account/sessions/revoke-others', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const user = auth.requireUser(ctx.req)
    auth.queries.deleteOtherSessions.run(user.id, user.sessionId)
    sendEmpty(ctx.res, 204)
  })
}
