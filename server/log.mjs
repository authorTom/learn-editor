// Logging, deliberately small.
//
// One line per event, structured enough to grep and plain enough to read over
// someone's shoulder during a deploy. No dependency, no transport, no rotation:
// this writes to stdout and lets Docker, journald or whatever is in front own
// the rest — which is what those tools are for.
//
// Nothing here ever logs a request body, a cookie, a password or a token. The
// server handles course content that its own README promises stays private, and
// the fastest way to break that promise is a debug line someone left in.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

let threshold = LEVELS.info

export function setLogLevel(level) {
  threshold = LEVELS[level] ?? LEVELS.info
}

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return
  const parts = [new Date().toISOString(), level.toUpperCase().padEnd(5), msg]
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue
      parts.push(`${k}=${typeof v === 'string' && v.includes(' ') ? JSON.stringify(v) : v}`)
    }
  }
  const line = parts.join(' ')
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const log = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
}

/**
 * Request logger. Returns a function to call when the response is done.
 *
 * Logs the path only — never the query string, which is where an id or a token
 * would end up if one ever got put there.
 */
export function startRequest(req) {
  const at = process.hrtime.bigint()
  return (res) => {
    const ms = Number(process.hrtime.bigint() - at) / 1e6
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug'
    emit(level, 'request', {
      method: req.method,
      path: (req.url || '').split('?')[0],
      status: res.statusCode,
      ms: ms.toFixed(1),
    })
  }
}
