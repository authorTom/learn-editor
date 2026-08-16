// Quoin's optional server.
//
// "Optional" is the design, not a hedge. The app is local-first and works with
// no server at all — that is what `npm run dev` and the static image do, and it
// is a promise the README makes. This process adds three things to that: it
// serves the built SPA, it holds accounts, and it syncs courses between an
// author's machines. The client asks `GET /api/config` what it is talking to
// and behaves accordingly, so one build of the SPA covers both deployments.
//
// Start it with `npm run serve`, or run the container, which does the same.

import http from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { ConfigError, loadConfig } from './config.mjs'
import { openDatabase } from './db.mjs'
import { log, setLogLevel, startRequest } from './log.mjs'
import { createStaticHandler } from './static.mjs'
import { HttpError, createRouter, sendJson } from './routes.mjs'
import { VERSION } from './version.mjs'
import { registerAuthRoutes, createAuthService } from './auth.mjs'
import { registerUserRoutes } from './users.mjs'
import { registerCourseRoutes } from './courses.mjs'
import { registerAssetRoutes } from './assets.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(here, '..', 'dist')

/**
 * Content Security Policy.
 *
 * Read the `script-src` line before changing anything: `'unsafe-inline'` is
 * there deliberately, and removing it breaks four shipped features.
 *
 * Quoin previews a course by rendering the *real exported player* into
 * an iframe via `srcdoc` — that shared renderer is the product's central claim,
 * and it is how preview, the SCORM flight recorder, the version diff and the
 * Custom HTML block all work. A `srcdoc` iframe inherits its parent document's
 * CSP, and the player is a self-contained page of inline script and style. So
 * a strict `script-src 'self'` on this response does not merely harden the
 * editor: it blanks the preview.
 *
 * What the policy still buys, which is most of the value for a self-hosted app:
 * no script may be *loaded* from another origin, `connect-src 'self'` means
 * nothing can be exfiltrated to one, `object-src 'none'` kills plugin content,
 * `base-uri 'none'` blocks base-tag hijacking, and `frame-ancestors 'none'`
 * prevents clickjacking.
 *
 * The way to close the gap properly is to nonce the player's own script tags
 * and pass the nonce through buildPlayerHtml — worth doing, and a change to the
 * exporter rather than to this header.
 */
function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    // React writes style attributes; the player ships a stylesheet inline.
    "style-src 'self' 'unsafe-inline'",
    // Authors paste external image URLs, and uploads are data: URLs.
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    // Self-hosted now, so no third-party font origin is needed at all.
    "font-src 'self'",
    // The app talks only to its own API.
    "connect-src 'self'",
    // Video blocks embed YouTube and Vimeo; Custom HTML can embed anything.
    "frame-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

const CSP = contentSecurityPolicy()

function securityHeaders(res, config) {
  // Applied to everything, API and app alike.
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // frame-ancestors supersedes this for modern browsers; kept for old ones.
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (config.secureCookies) {
    // Only when TLS is actually in front; sending HSTS over plain http tells a
    // browser to refuse a deployment that has no https to fall back to.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

export function createApp(config) {
  const db = openDatabase(config)
  const auth = createAuthService(db, config)
  const router = createRouter()
  const serveStatic = createStaticHandler(DIST)

  // ---- what the client needs to know before it renders anything ----
  //
  // The SPA calls this once at boot. A failure to reach it is not an error: it
  // means there is no server, which is a supported way to run the app.
  router.get('/api/config', (ctx) => {
    sendJson(ctx.res, 200, {
      version: VERSION,
      auth: {
        required: config.authRequired,
        // With no users yet, the app shows first-run setup instead of sign-in.
        setupNeeded: config.authRequired && auth.userCount() === 0,
      },
      sync: config.authRequired,
    })
  })

  router.get('/api/version', (ctx) => sendJson(ctx.res, 200, { version: VERSION }))

  // Liveness for compose/orchestrators. Deliberately touches the database: a
  // process that is up but cannot read its own library is not healthy, and a
  // health check that only proves the event loop is turning would not notice.
  router.get('/healthz', (ctx) => {
    try {
      db.prepare('SELECT 1').get()
      sendJson(ctx.res, 200, { ok: true, version: VERSION })
    } catch (err) {
      log.error('health check failed', { error: err.message })
      sendJson(ctx.res, 503, { ok: false })
    }
  })

  registerAuthRoutes(router, { db, config, auth })
  registerUserRoutes(router, { db, config, auth })
  registerCourseRoutes(router, { db, config, auth })
  registerAssetRoutes(router, { db, config, auth })

  async function handle(req, res) {
    const done = startRequest(req)
    res.on('finish', () => done(res))
    securityHeaders(res, config)

    let pathname
    try {
      pathname = new URL(req.url, 'http://localhost').pathname
    } catch {
      sendJson(res, 400, { error: 'Malformed URL.' })
      return
    }

    const route = router.match(req.method, pathname)

    if (route?.handler) {
      try {
        await route.handler({ req, res, params: route.params, config, db, auth })
      } catch (err) {
        if (err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message, code: err.code })
        } else {
          // Log the detail, return none: an internal message can name a table,
          // a path, or a query, and none of that belongs in a client response.
          log.error('unhandled error', { path: pathname, error: err.message, stack: err.stack })
          sendJson(res, 500, { error: 'Something went wrong on the server.' })
        }
      }
      return
    }

    if (route?.status === 405) {
      sendJson(res, 405, { error: `${req.method} is not allowed on this endpoint.` })
      return
    }

    // Never fall through to the SPA shell for an unmatched /api path — a JSON
    // client should get JSON, not a page of HTML with a 200 on it.
    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'No such endpoint.' })
      return
    }

    if (await serveStatic(req, res, pathname)) return

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }

  return { handle, db, auth }
}

export function startServer(config) {
  const app = createApp(config)
  const server = http.createServer((req, res) => {
    app.handle(req, res).catch((err) => {
      log.error('request handler rejected', { error: err.message })
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })

  // A slow-loris client should not be able to hold a connection open forever.
  // Generous, because a course push carrying media is genuinely a large upload
  // on a slow connection.
  server.requestTimeout = 120_000
  server.headersTimeout = 30_000
  server.keepAliveTimeout = 65_000

  server.listen(config.port, config.host, () => {
    log.info('Quoin listening', {
      version: VERSION,
      url: `http://${config.host}:${config.port}`,
      auth: config.authRequired ? 'on' : 'off',
      data: config.dataDir,
    })
    if (config.authRequired && app.auth.userCount() === 0) {
      log.info('first run — no accounts yet', { setupToken: app.auth.setupToken() })
      log.info('open the app and use that token to create the first administrator')
    }
  })

  // Graceful shutdown: stop accepting, let in-flight requests finish, close the
  // database so WAL is checkpointed rather than left for recovery on next boot.
  let closing = false
  const shutdown = (signal) => {
    if (closing) return
    closing = true
    log.info('shutting down', { signal })
    server.close(() => {
      try {
        app.db.close()
      } catch (err) {
        log.warn('database did not close cleanly', { error: err.message })
      }
      process.exit(0)
    })
    // Don't hang forever on a stuck connection.
    setTimeout(() => {
      log.warn('shutdown timed out — exiting anyway')
      process.exit(1)
    }, 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

// Only start when run directly, so the tests can import `createApp`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = loadConfig()
    setLogLevel(config.logLevel)
    startServer(config)
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message)
      process.exit(78) // EX_CONFIG
    }
    throw err
  }
}
