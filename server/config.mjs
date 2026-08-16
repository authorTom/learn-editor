// Every knob the server has, read once at boot and validated together.
//
// The rule here is fail fast and fail loudly. A misread environment variable in
// a self-hosted deployment is not a runtime inconvenience — `LE_AUTH=flase`
// silently falling back to "off" is an unauthenticated course library on the
// public internet. So anything unparseable stops the process with a message
// naming the variable, rather than being coerced into a default.
//
// Names are prefixed `LE_` throughout.

import path from 'node:path'

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])
const FALSEY = new Set(['0', 'false', 'no', 'off'])

class ConfigError extends Error {}

function bool(env, key, fallback, errors) {
  const raw = env[key]
  if (raw == null || raw === '') return fallback
  const v = String(raw).trim().toLowerCase()
  if (TRUTHY.has(v)) return true
  if (FALSEY.has(v)) return false
  errors.push(`${key}: expected a boolean (on/off, true/false, 1/0), got "${raw}"`)
  return fallback
}

function int(env, key, fallback, { min, max }, errors) {
  const raw = env[key]
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n)) {
    errors.push(`${key}: expected a whole number, got "${raw}"`)
    return fallback
  }
  if (n < min || n > max) {
    errors.push(`${key}: must be between ${min} and ${max}, got ${n}`)
    return fallback
  }
  return n
}

/**
 * Read and validate the environment.
 *
 * Throws a single error listing everything wrong, rather than one per restart —
 * fixing a bad `.env` should not be a guessing game played one boot at a time.
 */
export function loadConfig(env = process.env) {
  const errors = []

  const port = int(env, 'LE_PORT', 8080, { min: 1, max: 65535 }, errors)
  const host = env.LE_HOST?.trim() || '0.0.0.0'
  const dataDir = path.resolve(env.LE_DATA_DIR?.trim() || '/data')

  // Auth defaults ON. Someone who has gone to the trouble of running the server
  // wants accounts; the person who wants the old static behaviour is the one
  // who should have to say so explicitly.
  const authRequired = bool(env, 'LE_AUTH', true, errors)

  const sessionTtlDays = int(env, 'LE_SESSION_TTL_DAYS', 30, { min: 1, max: 365 }, errors)
  const maxBodyMb = int(env, 'LE_MAX_BODY_MB', 32, { min: 1, max: 512 }, errors)

  // Trusting X-Forwarded-For when nothing sets it lets any client forge its own
  // address and walk straight through the login rate limiter. Off by default;
  // turn it on only when a reverse proxy in front is rewriting the header.
  const trustProxy = bool(env, 'LE_TRUST_PROXY', false, errors)

  // Secure cookies are correct behind TLS and fatal without it: a Secure cookie
  // is never sent over plain http, so an author on http://localhost could never
  // stay signed in. Default follows trustProxy, which is the closest thing the
  // server has to "there is a real deployment in front of me".
  const secureCookies = bool(env, 'LE_SECURE_COOKIES', trustProxy, errors)

  const setupToken = env.LE_SETUP_TOKEN?.trim() || ''

  const logLevel = (env.LE_LOG_LEVEL?.trim() || 'info').toLowerCase()
  if (!['debug', 'info', 'warn', 'error', 'silent'].includes(logLevel)) {
    errors.push(`LE_LOG_LEVEL: expected debug|info|warn|error|silent, got "${logLevel}"`)
  }

  if (errors.length) {
    throw new ConfigError(
      `Learn Editor cannot start — the environment is not valid:\n` +
        errors.map((e) => `  • ${e}`).join('\n')
    )
  }

  return {
    port,
    host,
    dataDir,
    dbPath: path.join(dataDir, 'learn-editor.db'),
    blobDir: path.join(dataDir, 'blobs'),
    authRequired,
    sessionTtlMs: sessionTtlDays * 86_400_000,
    maxBodyBytes: maxBodyMb * 1024 * 1024,
    trustProxy,
    secureCookies,
    setupToken,
    logLevel,
  }
}

export { ConfigError }
