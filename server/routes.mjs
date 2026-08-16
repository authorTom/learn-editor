// A router small enough to read in one sitting, plus the request/response
// helpers every handler needs.
//
// There is no framework here on purpose. The API is a couple of dozen endpoints
// with one shape — read JSON, check who you are, touch SQLite, write JSON — and
// the dependency-free version of that is shorter than the configuration a
// framework would need.

const PARAM = /:([A-Za-z_][A-Za-z0-9_]*)/g

/** An error a handler can throw to produce a specific status. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (m, code) => new HttpError(400, m, code)
export const unauthorized = (m = 'Sign in to continue.') => new HttpError(401, m)
export const forbidden = (m = 'You do not have access to that.') => new HttpError(403, m)
export const notFound = (m = 'Not found.') => new HttpError(404, m)
export const conflict = (m, code) => new HttpError(409, m, code)

function compile(pattern) {
  const names = []
  const source = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
    .replace(PARAM, (_, name) => {
      names.push(name)
      return '([^/]+)'
    })
  return { re: new RegExp(`^${source}$`), names }
}

export function createRouter() {
  const routes = []

  function add(method, pattern, handler) {
    const { re, names } = compile(pattern)
    routes.push({ method, re, names, handler })
  }

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    patch: (p, h) => add('PATCH', p, h),
    put: (p, h) => add('PUT', p, h),
    delete: (p, h) => add('DELETE', p, h),
    head: (p, h) => add('HEAD', p, h),

    /**
     * Find a handler for this request.
     *
     * Returns `{ handler, params }`, or `{ status: 405 }` when the path exists
     * but not for this method — a 404 there would send a client hunting for a
     * typo in a URL that is perfectly correct.
     */
    match(method, pathname) {
      let pathExists = false
      for (const route of routes) {
        const m = route.re.exec(pathname)
        if (!m) continue
        pathExists = true
        if (route.method !== method) continue
        const params = {}
        route.names.forEach((name, i) => {
          params[name] = decodeURIComponent(m[i + 1])
        })
        return { handler: route.handler, params }
      }
      return pathExists ? { status: 405 } : null
    },
  }
}

// ---------- responses ----------

export function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // API responses are per-user and must never land in a shared cache.
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(payload)
}

export function sendEmpty(res, status, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers })
  res.end()
}

// ---------- requests ----------

/**
 * Read and parse a JSON body, refusing anything over `maxBytes`.
 *
 * The limit is enforced as the bytes arrive, not after: a course with embedded
 * media is legitimately megabytes, so the ceiling is generous, and a generous
 * ceiling that is only checked at the end is a way to be held open until memory
 * runs out.
 */
export function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false

    const fail = (err) => {
      if (settled) return
      settled = true
      // Stop reading, and make sure the socket is not left half-drained.
      req.destroy()
      reject(err)
    }

    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > maxBytes) {
        fail(new HttpError(413, `Request body is larger than the ${maxBytes} byte limit.`))
        return
      }
      chunks.push(chunk)
    })

    req.on('error', () => fail(new HttpError(400, 'The request ended unexpectedly.')))

    req.on('end', () => {
      if (settled) return
      settled = true
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(badRequest('Body is not valid JSON.'))
      }
    })
  })
}

/** Read a raw body (used for asset uploads), with the same streaming limit. */
export function readBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = (err) => {
      if (settled) return
      settled = true
      req.destroy()
      reject(err)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > maxBytes) {
        fail(new HttpError(413, `Upload is larger than the ${maxBytes} byte limit.`))
        return
      }
      chunks.push(chunk)
    })
    req.on('error', () => fail(new HttpError(400, 'The upload ended unexpectedly.')))
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
  })
}

/**
 * The client's address, for rate limiting.
 *
 * X-Forwarded-For is only consulted when the operator has said a proxy is in
 * front (QUOIN_TRUST_PROXY). Otherwise any client could set the header itself and
 * give every failed login attempt a fresh identity.
 */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for']
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim()
  }
  return req.socket.remoteAddress || 'unknown'
}
