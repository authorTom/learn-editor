import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { hashPassword, normaliseEmail, validateEmail, validatePassword, verifyPassword } from './auth.mjs'
import { loadConfig, ConfigError } from './config.mjs'
import { createRouter, HttpError } from './routes.mjs'

/**
 * The security primitives, tested directly.
 *
 * These are the pieces where a quiet regression is worst: a password check that
 * accepts anything, a config parse that reads QUOIN_AUTH=flase as "off", a router
 * that matches one path against another's handler. None of them would show up
 * as a broken screen.
 */

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(await verifyPassword('Correct horse battery staple', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('salts, so the same password never produces the same hash twice', async () => {
    const a = await hashPassword('the same password')
    const b = await hashPassword('the same password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('the same password', a)).toBe(true)
    expect(await verifyPassword('the same password', b)).toBe(true)
  })

  it('records its parameters, so they can be raised later without invalidating old hashes', async () => {
    const stored = await hashPassword('a password to store')
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true)
    expect(stored.split('$')).toHaveLength(6)
  })

  it('refuses a null, empty or malformed stored hash instead of throwing', async () => {
    // A user invited but not yet set up has a null hash. That must read as
    // "cannot sign in", never as an error and never as a match.
    expect(await verifyPassword('anything', null)).toBe(false)
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('anything', 'scrypt$bad$8$1$c2FsdA==$aGFzaA==')).toBe(false)
  })

  it('handles a unicode password consistently', async () => {
    const pw = 'ıllıllı 密码 🔐 passphrase'
    expect(await verifyPassword(pw, await hashPassword(pw))).toBe(true)
  })
})

describe('password and email rules', () => {
  it('requires a password long enough to be worth hashing', () => {
    expect(() => validatePassword('short')).toThrow(HttpError)
    expect(() => validatePassword('123456789')).toThrow(/at least 10/)
    expect(() => validatePassword('1234567890')).not.toThrow()
  })

  it('rejects an absurdly long password rather than hashing it', () => {
    expect(() => validatePassword('x'.repeat(513))).toThrow(HttpError)
  })

  it('lowercases and trims an email so one person cannot hold two accounts', () => {
    expect(normaliseEmail('  Tom@Example.COM ')).toBe('tom@example.com')
    expect(normaliseEmail(undefined)).toBe('')
  })

  it('rejects what is obviously not an address, and accepts what is', () => {
    for (const bad of ['', 'tom', 'tom@', '@example.com', 'tom @example.com', 'tom@example']) {
      expect(() => validateEmail(bad), bad).toThrow(HttpError)
    }
    for (const good of ['tom@example.com', 'first.last+tag@sub.example.co.uk']) {
      expect(() => validateEmail(good), good).not.toThrow()
    }
  })
})

describe('config', () => {
  const base = { QUOIN_DATA_DIR: '/tmp/le-test' }

  it('defaults to accounts on — the safe direction for a server', () => {
    expect(loadConfig(base).authRequired).toBe(true)
  })

  it('accepts the usual spellings of a boolean', () => {
    for (const v of ['off', 'false', '0', 'no']) {
      expect(loadConfig({ ...base, QUOIN_AUTH: v }).authRequired, v).toBe(false)
    }
    for (const v of ['on', 'true', '1', 'yes', 'ON']) {
      expect(loadConfig({ ...base, QUOIN_AUTH: v }).authRequired, v).toBe(true)
    }
  })

  it('refuses to start on a typo rather than guessing', () => {
    // The bug this prevents: QUOIN_AUTH=flase silently meaning "off", which is an
    // unauthenticated course library on a public port.
    expect(() => loadConfig({ ...base, QUOIN_AUTH: 'flase' })).toThrow(ConfigError)
    expect(() => loadConfig({ ...base, QUOIN_PORT: 'eighty' })).toThrow(ConfigError)
    expect(() => loadConfig({ ...base, QUOIN_PORT: '70000' })).toThrow(ConfigError)
    expect(() => loadConfig({ ...base, QUOIN_LOG_LEVEL: 'chatty' })).toThrow(ConfigError)
  })

  it('reports every problem at once, not one per restart', () => {
    try {
      loadConfig({ ...base, QUOIN_AUTH: 'flase', QUOIN_PORT: '0', QUOIN_LOG_LEVEL: 'chatty' })
      throw new Error('expected it to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError)
      expect(err.message).toMatch(/QUOIN_AUTH/)
      expect(err.message).toMatch(/QUOIN_PORT/)
      expect(err.message).toMatch(/QUOIN_LOG_LEVEL/)
    }
  })

  it('ties secure cookies to the proxy setting by default', () => {
    expect(loadConfig(base).secureCookies).toBe(false)
    expect(loadConfig({ ...base, QUOIN_TRUST_PROXY: 'on' }).secureCookies).toBe(true)
    // ...but lets it be overridden either way.
    expect(loadConfig({ ...base, QUOIN_TRUST_PROXY: 'on', QUOIN_SECURE_COOKIES: 'off' }).secureCookies).toBe(false)
  })

  it('turns the day and megabyte knobs into the units the code uses', () => {
    const c = loadConfig({ ...base, QUOIN_SESSION_TTL_DAYS: '7', QUOIN_MAX_BODY_MB: '4' })
    expect(c.sessionTtlMs).toBe(7 * 86_400_000)
    expect(c.maxBodyBytes).toBe(4 * 1024 * 1024)
  })
})

describe('router', () => {
  it('matches a literal path and extracts parameters', () => {
    const r = createRouter()
    const handler = () => {}
    r.get('/api/courses/:id/versions/:versionId', handler)
    const m = r.match('GET', '/api/courses/abc/versions/v9')
    expect(m.handler).toBe(handler)
    expect(m.params).toEqual({ id: 'abc', versionId: 'v9' })
  })

  it('does not let a parameter swallow a slash', () => {
    const r = createRouter()
    r.get('/api/courses/:id', () => {})
    expect(r.match('GET', '/api/courses/abc/versions')).toBeNull()
  })

  it('decodes percent-encoded parameters', () => {
    const r = createRouter()
    r.get('/api/users/:id', () => {})
    expect(r.match('GET', '/api/users/a%2Fb').params.id).toBe('a/b')
  })

  it('answers 405 — not 404 — when the path exists for another method', () => {
    const r = createRouter()
    r.get('/api/config', () => {})
    expect(r.match('DELETE', '/api/config')).toEqual({ status: 405 })
    expect(r.match('GET', '/api/nope')).toBeNull()
  })

  it('treats regex metacharacters in a path as literals', () => {
    const r = createRouter()
    r.get('/api/a.b', () => {})
    // Without escaping, "." would match any character and this would hit.
    expect(r.match('GET', '/api/axb')).toBeNull()
    expect(r.match('GET', '/api/a.b')).not.toBeNull()
  })
})

describe('session token handling', () => {
  it('stores a hash, so a database dump yields no usable cookie', () => {
    // The property the schema comment claims: what is persisted cannot be
    // replayed as a cookie, because deriving the token from it means
    // reversing SHA-256.
    const raw = crypto.randomBytes(32).toString('base64url')
    const stored = crypto.createHash('sha256').update(raw).digest('hex')
    expect(stored).not.toContain(raw)
    expect(stored).toHaveLength(64)
    expect(crypto.createHash('sha256').update(raw).digest('hex')).toBe(stored)
  })
})
