// Accounts, sessions, and the checks that guard every other endpoint.
//
// Deckle gets away with a stateless signed token because it has one shared
// password and no users. Quoin has real accounts, and that changes the
// requirement: suspending or deleting someone has to end their session *now*,
// and an author needs to be able to sign out a laptop they no longer have. Both
// need a session the server can revoke, so sessions are rows.
//
// Three things are worth knowing before changing anything here:
//
//   • The database stores a SHA-256 of the session token, never the token. A
//     leaked backup then yields no usable cookies.
//   • Passwords are scrypt with a per-user salt. It is what Node ships, so the
//     server keeps its zero-dependency promise; argon2id would mean a native
//     build in the image.
//   • Mutating requests must carry `X-Quoin`. A browser will not attach
//     a custom header cross-origin without a successful preflight, and we send
//     no permissive CORS headers, so this plus SameSite=Lax is the CSRF story.

import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError, badRequest, forbidden, unauthorized } from './routes.mjs'
import { clientIp, readJson, sendEmpty, sendJson } from './routes.mjs'
import { log } from './log.mjs'

const scrypt = promisify(crypto.scrypt)

const COOKIE = 'quoin_session'
const APP_HEADER = 'x-quoin'

// scrypt parameters. N=2^15 costs roughly 100ms per hash on a modern server —
// slow enough to make offline guessing expensive, fast enough that a sign-in
// does not feel broken. maxmem must be raised to match: 128 * N * r is ~33MB,
// just over Node's 32MB default, and without this every hash throws.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }
const KEYLEN = 32

const LOCKOUT_WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS_PER_IP = 20
const MAX_ATTEMPTS_PER_ACCOUNT = 10

const MIN_PASSWORD_LENGTH = 10
/** Rejecting only what is genuinely weak. Length is the honest lever; a
    composition rule mostly teaches people to write "Password1!". */
const MAX_PASSWORD_LENGTH = 512

const INVITE_TTL_MS = 7 * 86_400_000

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  return scrypt(password, salt, KEYLEN, SCRYPT).then(
    (derived) =>
      `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`
  )
}

export async function verifyPassword(password, stored) {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltB64, hashB64] = parts
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  let derived
  try {
    derived = await scrypt(password, salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
    })
  } catch {
    return false
  }
  // Both buffers are derived keys of the same length, so this cannot throw and
  // leaks nothing about the stored value.
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`, 'weak_password')
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw badRequest('That password is unreasonably long.', 'weak_password')
  }
}

export function normaliseEmail(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

export function validateEmail(email) {
  // Deliberately permissive. Email validation by regex is a famous way to
  // reject valid addresses; this only rejects what is obviously not one.
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('That does not look like an email address.', 'bad_email')
  }
}

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
const token = () => crypto.randomBytes(32).toString('base64url')

export function createAuthService(db, config) {
  // Failed attempts, per IP and per account. In memory and lost on restart,
  // which is the accepted trade: persisting them would let an attacker fill the
  // database with junk keys by trying a fresh address every time.
  const attempts = new Map()

  // Generated once if the operator did not supply one. Printed at boot, and
  // only useful while there are no accounts.
  const generatedSetupToken = config.setupToken || crypto.randomBytes(24).toString('base64url')

  const q = {
    userCount: db.prepare('SELECT COUNT(*) AS n FROM users'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    insertSession: db.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`
    ),
    sessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    deleteOtherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?'),
    listSessions: db.prepare(
      'SELECT id, created_at, last_seen_at, expires_at, user_agent FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC'
    ),
    purgeExpired: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
    touchUser: db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?'),
  }

  function userCount() {
    return q.userCount.get().n
  }

  // ---- throttling ----

  function key(kind, value) {
    return `${kind}:${value}`
  }

  function throttled(kind, value, max) {
    const entry = attempts.get(key(kind, value))
    if (!entry) return false
    if (Date.now() > entry.resetAt) {
      attempts.delete(key(kind, value))
      return false
    }
    return entry.count >= max
  }

  function recordFailure(kind, value) {
    const k = key(kind, value)
    const entry = attempts.get(k)
    if (!entry || Date.now() > entry.resetAt) {
      attempts.set(k, { count: 1, resetAt: Date.now() + LOCKOUT_WINDOW_MS })
      return
    }
    entry.count += 1
  }

  function clearFailures(kind, value) {
    attempts.delete(key(kind, value))
  }

  /** Both limits, checked together. Per-account as well as per-IP, so a
      botnet spread across addresses still cannot grind one account down. */
  function assertNotThrottled(ip, email) {
    if (
      throttled('ip', ip, MAX_ATTEMPTS_PER_IP) ||
      (email && throttled('account', email, MAX_ATTEMPTS_PER_ACCOUNT))
    ) {
      throw new HttpError(429, 'Too many attempts. Wait fifteen minutes and try again.', 'throttled')
    }
  }

  // ---- sessions ----

  function issueSession(userId, userAgent) {
    const raw = token()
    const now = Date.now()
    q.insertSession.run(
      sha256(raw), userId, now, now + config.sessionTtlMs, now, (userAgent || '').slice(0, 200)
    )
    // Opportunistic cleanup — cheap, indexed, and it keeps the table from
    // growing forever without needing a scheduled job.
    q.purgeExpired.run(now)
    return raw
  }

  function cookieHeader(raw, { clear = false } = {}) {
    const bits = [
      `${COOKIE}=${clear ? '' : raw}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      clear ? 'Max-Age=0' : `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
    ]
    if (config.secureCookies) bits.push('Secure')
    return bits.join('; ')
  }

  function readCookie(req) {
    const header = req.headers.cookie
    if (!header) return null
    for (const part of header.split(';')) {
      const eq = part.indexOf('=')
      if (eq === -1) continue
      if (part.slice(0, eq).trim() === COOKIE) return part.slice(eq + 1).trim()
    }
    return null
  }

  /** The signed-in user, or null. Never throws — callers decide what absence means. */
  function currentUser(req) {
    if (!config.authRequired) return null
    const raw = readCookie(req)
    if (!raw) return null
    const row = q.sessionById.get(sha256(raw))
    if (!row) return null
    if (row.expires_at < Date.now()) {
      q.deleteSession.run(row.id)
      return null
    }
    const user = q.userById.get(row.user_id)
    // A suspended account's existing sessions stop working on the next request
    // rather than at their next sign-in, which is the point of storing them.
    if (!user || user.status !== 'active') {
      q.deleteUserSessions.run(row.user_id)
      return null
    }
    const now = Date.now()
    // Only write once a minute: this is on every request, and a write per
    // request would put an fsync in the path of every keystroke's sync.
    if (now - row.last_seen_at > 60_000) {
      q.touchSession.run(now, row.id)
      q.touchUser.run(now, user.id)
    }
    return { ...user, sessionId: row.id }
  }

  function requireUser(req) {
    if (!config.authRequired) {
      throw forbidden('This deployment runs without accounts, so there is nothing to sign in to.')
    }
    const user = currentUser(req)
    if (!user) throw unauthorized()
    return user
  }

  function requireAdmin(req) {
    const user = requireUser(req)
    if (user.role !== 'admin') throw forbidden('That needs an administrator account.')
    return user
  }

  /**
   * CSRF guard for anything that changes state.
   *
   * A form posted from another site cannot set a custom header, and we publish
   * no CORS policy that would let a script do it either — so requiring the
   * header is sufficient, and it costs the client one line. The Origin check on
   * top is belt and braces for browsers that send it.
   */
  function assertSameOrigin(req) {
    if (req.headers[APP_HEADER] === undefined) {
      throw forbidden('Missing application header. This request did not come from the app.')
    }
    const origin = req.headers.origin
    if (origin) {
      const host = req.headers.host
      let originHost
      try {
        originHost = new URL(origin).host
      } catch {
        throw forbidden('Malformed Origin header.')
      }
      if (host && originHost !== host) {
        throw forbidden('Cross-origin request refused.')
      }
    }
  }

  return {
    userCount,
    setupToken: () => generatedSetupToken,
    currentUser,
    requireUser,
    requireAdmin,
    assertSameOrigin,
    assertNotThrottled,
    recordFailure,
    clearFailures,
    issueSession,
    cookieHeader,
    readCookie,
    sha256,
    token,
    queries: q,
    inviteTtlMs: INVITE_TTL_MS,
  }
}

/** The user object the client is allowed to see. Never the password hash. */
export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at ?? null,
  }
}

export function registerAuthRoutes(router, { db, config, auth }) {
  const q = auth.queries

  // ---- first run: create the founding administrator ----
  router.post('/api/auth/setup', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    if (!config.authRequired) throw forbidden('Accounts are disabled on this deployment.')
    if (auth.userCount() > 0) throw forbidden('This instance already has accounts.')

    const ip = clientIp(ctx.req, config.trustProxy)
    auth.assertNotThrottled(ip, null)

    const body = await readJson(ctx.req, 64 * 1024)
    const supplied = typeof body.setupToken === 'string' ? body.setupToken : ''
    const expected = auth.setupToken()
    // Compare digests, not the strings. A length check on *characters* does not
    // guarantee equal *bytes* — one non-ASCII character in the supplied token
    // makes the two buffers different lengths, and `timingSafeEqual` throws a
    // RangeError, turning a wrong token into a 500 instead of a clean refusal.
    // Digests are always 32 bytes, so the comparison is total and constant-time.
    const ok = crypto.timingSafeEqual(
      crypto.createHash('sha256').update(supplied, 'utf8').digest(),
      crypto.createHash('sha256').update(expected, 'utf8').digest()
    )
    if (!ok) {
      auth.recordFailure('ip', ip)
      log.warn('rejected setup attempt with a bad token', { ip })
      throw forbidden('That setup token is not right. It is printed in the server log at startup.')
    }

    const email = normaliseEmail(body.email)
    validateEmail(email)
    validatePassword(body.password)

    const now = Date.now()
    const id = crypto.randomUUID()
    db.prepare(
      `INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, 'active', ?, ?)`
    ).run(id, email, String(body.name ?? '').slice(0, 120), await hashPassword(body.password), now, now)

    auth.clearFailures('ip', ip)
    const raw = auth.issueSession(id, ctx.req.headers['user-agent'])
    log.info('first administrator created', { email })
    sendJson(ctx.res, 201, { user: publicUser(q.userById.get(id)) }, {
      'Set-Cookie': auth.cookieHeader(raw),
    })
  })

  // ---- sign in ----
  router.post('/api/auth/login', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    if (!config.authRequired) throw forbidden('Accounts are disabled on this deployment.')

    const ip = clientIp(ctx.req, config.trustProxy)
    const body = await readJson(ctx.req, 64 * 1024)
    const email = normaliseEmail(body.email)
    auth.assertNotThrottled(ip, email)

    const user = q.userByEmail.get(email)
    const password = typeof body.password === 'string' ? body.password : ''

    // Verify even when the account does not exist, against a hash that cannot
    // match, so a missing account and a wrong password take the same time and
    // an attacker cannot enumerate who has an account here.
    const stored = user?.password_hash ?? null
    const ok = stored ? await verifyPassword(password, stored) : await decoy(password)

    if (!ok || !user || user.status !== 'active') {
      auth.recordFailure('ip', ip)
      if (email) auth.recordFailure('account', email)
      log.warn('failed sign-in', { ip })
      throw unauthorized('That email and password do not match an account.')
    }

    auth.clearFailures('ip', ip)
    auth.clearFailures('account', email)
    const raw = auth.issueSession(user.id, ctx.req.headers['user-agent'])
    sendJson(ctx.res, 200, { user: publicUser(user) }, { 'Set-Cookie': auth.cookieHeader(raw) })
  })

  // ---- sign out ----
  router.post('/api/auth/logout', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const raw = auth.readCookie(ctx.req)
    if (raw) q.deleteSession.run(auth.sha256(raw))
    sendEmpty(ctx.res, 204, { 'Set-Cookie': auth.cookieHeader('', { clear: true }) })
  })

  // ---- who am I ----
  router.get('/api/auth/me', (ctx) => {
    const user = auth.currentUser(ctx.req)
    if (!user) throw unauthorized()
    sendJson(ctx.res, 200, { user: publicUser(user) })
  })

  // ---- accept an invitation and choose a password ----
  router.post('/api/auth/accept-invite', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const ip = clientIp(ctx.req, config.trustProxy)
    auth.assertNotThrottled(ip, null)

    const body = await readJson(ctx.req, 64 * 1024)
    const raw = typeof body.token === 'string' ? body.token : ''
    validatePassword(body.password)

    const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(auth.sha256(raw))
    if (!invite || invite.used_at || invite.expires_at < Date.now()) {
      auth.recordFailure('ip', ip)
      throw forbidden('That invitation link is not valid any more. Ask an administrator for a new one.')
    }

    const user = q.userById.get(invite.user_id)
    if (!user || user.status !== 'active') throw forbidden('That account is no longer active.')

    const now = Date.now()
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      await hashPassword(body.password), now, user.id
    )
    db.prepare('UPDATE invites SET used_at = ? WHERE id = ?').run(now, invite.id)

    auth.clearFailures('ip', ip)
    const session = auth.issueSession(user.id, ctx.req.headers['user-agent'])
    sendJson(ctx.res, 200, { user: publicUser(q.userById.get(user.id)) }, {
      'Set-Cookie': auth.cookieHeader(session),
    })
  })

  // ---- change my own password ----
  router.post('/api/auth/password', async (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const user = auth.requireUser(ctx.req)
    const body = await readJson(ctx.req, 64 * 1024)

    const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!(await verifyPassword(current, user.password_hash))) {
      // Deliberately *not* fed into the sign-in throttle. The caller already
      // holds a valid session, so this is not a route to guessing an unknown
      // password — and counting it there meant a few mistyped confirmations
      // locked someone out of signing in at all, which is a denial of service
      // you can inflict on yourself by being careless.
      throw badRequest('Your current password is not right.', 'bad_password')
    }
    validatePassword(body.newPassword)

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      await hashPassword(body.newPassword), Date.now(), user.id
    )
    // Changing a password is also how someone reacts to a suspected compromise,
    // so every *other* session goes with it. Keep this one, or they would be
    // signed out by their own precaution.
    q.deleteOtherSessions.run(user.id, user.sessionId)
    sendEmpty(ctx.res, 204)
  })

  // ---- my sessions ----
  router.get('/api/auth/sessions', (ctx) => {
    const user = auth.requireUser(ctx.req)
    const rows = q.listSessions.all(user.id).map((s) => ({
      id: s.id,
      current: s.id === user.sessionId,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      expiresAt: s.expires_at,
      userAgent: s.user_agent,
    }))
    sendJson(ctx.res, 200, { sessions: rows })
  })

  router.delete('/api/auth/sessions/:id', (ctx) => {
    auth.assertSameOrigin(ctx.req)
    const user = auth.requireUser(ctx.req)
    // Scoped to this user's own sessions: an id from elsewhere matches nothing
    // rather than revoking someone else's.
    const row = q.sessionById.get(ctx.params.id)
    if (!row || row.user_id !== user.id) throw new HttpError(404, 'No such session.')
    q.deleteSession.run(ctx.params.id)
    sendEmpty(ctx.res, 204)
  })
}

/**
 * Burn the same time a real verification would, for an account that does not
 * exist. The salt is fixed and the result discarded — the only purpose is that
 * the response takes as long either way.
 */
const DECOY_SALT = crypto.randomBytes(16)
async function decoy(password) {
  try {
    await scrypt(String(password ?? ''), DECOY_SALT, KEYLEN, SCRYPT)
  } catch {
    /* ignore */
  }
  return false
}
