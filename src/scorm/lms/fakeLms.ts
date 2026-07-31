import type { LmsProfile, ScormRuntimeVersion } from './profiles'
import { limitsFor } from './profiles'

/**
 * A SCORM runtime that records everything.
 *
 * This is the object the course finds by walking `window.parent` looking for
 * `API` (1.2) or `API_1484_11` (2004) — exactly what a real LMS exposes, so the
 * course under test is not modified or aware of it in any way.
 *
 * It exists because SCORM is otherwise unobservable. The only feedback loop an
 * author has today is "upload it and click around", and when something doesn't
 * report there is nothing to look at: no log, no data model, no error codes.
 * Every call in and out is captured here with its arguments, its return value
 * and the error state it left behind.
 */

export interface LmsCall {
  seq: number
  /** Milliseconds since the attempt started. */
  t: number
  method: string
  key: string
  value: string
  result: string
  errorCode: string
  errorText: string
  /** Simulator commentary — why a call was rejected, or what was lost. */
  note?: string
  level: 'ok' | 'warn' | 'error'
}

export interface LmsSnapshot {
  calls: LmsCall[]
  data: Record<string, string>
  committed: Record<string, string>
  initialized: boolean
  terminated: boolean
  /** Bytes of suspend_data actually retained, and the budget. */
  suspendUsed: number
  suspendLimit: number
  suspendLost: boolean
}

// ---------- data model ----------

const RO_12 = new Set([
  'cmi.core.student_id', 'cmi.core.student_name', 'cmi.core.credit', 'cmi.core.entry',
  'cmi.core.total_time', 'cmi.core.lesson_mode', 'cmi.launch_data', 'cmi.comments_from_lms',
  'cmi.student_data.mastery_score', 'cmi.student_data.max_time_allowed',
  'cmi.student_data.time_limit_action', 'cmi._version',
])
const WO_12 = new Set(['cmi.core.exit', 'cmi.core.session_time'])

const RO_2004 = new Set([
  'cmi.learner_id', 'cmi.learner_name', 'cmi.credit', 'cmi.entry', 'cmi.total_time',
  'cmi.mode', 'cmi.launch_data', 'cmi.max_time_allowed', 'cmi.time_limit_action',
  'cmi.scaled_passing_score', 'cmi.completion_threshold', 'cmi._version',
])
const WO_2004 = new Set(['cmi.exit', 'cmi.session_time'])

/** Vocabularies the spec constrains. Anything else is free text. */
const VOCAB: Record<string, string[]> = {
  'cmi.core.lesson_status': ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'],
  'cmi.core.exit': ['time-out', 'suspend', 'logout', ''],
  'cmi.completion_status': ['completed', 'incomplete', 'not attempted', 'unknown'],
  'cmi.success_status': ['passed', 'failed', 'unknown'],
  'cmi.exit': ['time-out', 'suspend', 'logout', 'normal', ''],
}

const ERR_12: Record<string, string> = {
  '0': 'No error',
  '101': 'General exception',
  '201': 'Invalid argument error',
  '202': 'Element cannot have children',
  '203': 'Element not an array — cannot have count',
  '301': 'Not initialized',
  '401': 'Not implemented error',
  '402': 'Invalid set value, element is a keyword',
  '403': 'Element is read only',
  '404': 'Element is write only',
  '405': 'Incorrect data type',
}

const ERR_2004: Record<string, string> = {
  '0': 'No error',
  '101': 'General exception',
  '102': 'General initialization failure',
  '103': 'Already initialized',
  '104': 'Content instance terminated',
  '111': 'General termination failure',
  '112': 'Termination before initialization',
  '113': 'Termination after termination',
  '122': 'Retrieve data before initialization',
  '123': 'Retrieve data after termination',
  '132': 'Store data before initialization',
  '133': 'Store data after termination',
  '142': 'Commit before initialization',
  '143': 'Commit after termination',
  '201': 'General argument error',
  '301': 'General get failure',
  '351': 'General set failure',
  '391': 'General commit failure',
  '401': 'Undefined data model element',
  '402': 'Unimplemented data model element',
  '403': 'Data model element value not initialized',
  '404': 'Data model element is read only',
  '405': 'Data model element is write only',
  '406': 'Data model element type mismatch',
  '407': 'Data model element value out of range',
  '408': 'Data model dependency not established',
}

/** Elements the simulator knows about, beyond the indexed collections. */
const KNOWN_12 = new Set([
  ...RO_12, ...WO_12,
  'cmi.core.lesson_location', 'cmi.core.lesson_status', 'cmi.core.score.raw',
  'cmi.core.score.min', 'cmi.core.score.max', 'cmi.suspend_data', 'cmi.comments',
  'cmi.interactions._count', 'cmi.objectives._count',
])
const KNOWN_2004 = new Set([
  ...RO_2004, ...WO_2004,
  'cmi.location', 'cmi.completion_status', 'cmi.success_status', 'cmi.score.raw',
  'cmi.score.min', 'cmi.score.max', 'cmi.score.scaled', 'cmi.suspend_data',
  'cmi.progress_measure', 'cmi.interactions._count', 'cmi.objectives._count',
])

const TIME_12 = /^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/
const TIME_2004 = /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d{1,2})?S)?)?$/

function isIndexed(key: string): boolean {
  return /^cmi\.(interactions|objectives)\.\d+\./.test(key)
}

/** Learner identity the simulated LMS reports. Fixed, so transcripts diff cleanly. */
const LEARNER = { id: 'sim-learner-01', name: 'Simulated, Learner' }

export interface FakeLmsOptions {
  version: ScormRuntimeVersion
  profile: LmsProfile
  /** Suspend data and status carried in from a previous attempt, for resume. */
  resumeFrom?: Record<string, string>
  onChange?: () => void
}

export class FakeLms {
  readonly version: ScormRuntimeVersion
  private profile: LmsProfile
  private data: Record<string, string> = {}
  /** What a real LMS would have persisted — only what survived a Commit. */
  private committed: Record<string, string> = {}
  private calls: LmsCall[] = []
  private lastError = '0'
  private initialized = false
  private terminated = false
  private startedAt = Date.now()
  private seq = 0
  private onChange?: () => void
  private suspendLost = false

  constructor(opts: FakeLmsOptions) {
    this.version = opts.version
    this.profile = opts.profile
    this.onChange = opts.onChange

    const is12 = this.version === '1.2'
    const resumed = opts.resumeFrom && Object.keys(opts.resumeFrom).length > 0
    this.data = {
      [is12 ? 'cmi.core.student_id' : 'cmi.learner_id']: LEARNER.id,
      [is12 ? 'cmi.core.student_name' : 'cmi.learner_name']: LEARNER.name,
      [is12 ? 'cmi.core.credit' : 'cmi.credit']: 'credit',
      [is12 ? 'cmi.core.lesson_mode' : 'cmi.mode']: 'normal',
      [is12 ? 'cmi.core.entry' : 'cmi.entry']: resumed ? 'resume' : 'ab-initio',
      [is12 ? 'cmi.core.total_time' : 'cmi.total_time']: is12 ? '00:00:00' : 'PT0H0M0S',
      [is12 ? 'cmi.core.lesson_status' : 'cmi.completion_status']: is12 ? 'not attempted' : 'not attempted',
      'cmi.suspend_data': '',
      'cmi.launch_data': '',
      'cmi._version': is12 ? '3.4' : '1.0',
      ...(opts.resumeFrom ?? {}),
    }
    this.committed = { ...this.data }
  }

  // ---------- observation ----------

  snapshot(): LmsSnapshot {
    const limit = limitsFor(this.profile, this.version).suspend
    return {
      calls: this.calls,
      data: { ...this.data },
      committed: { ...this.committed },
      initialized: this.initialized,
      terminated: this.terminated,
      suspendUsed: (this.data['cmi.suspend_data'] ?? '').length,
      suspendLimit: limit,
      suspendLost: this.suspendLost,
    }
  }

  /** What a real LMS would hand back on the next launch. */
  persistedState(): Record<string, string> {
    const src = this.profile.commitRequired ? this.committed : this.data
    const is12 = this.version === '1.2'
    const keep = [
      'cmi.suspend_data',
      is12 ? 'cmi.core.lesson_location' : 'cmi.location',
      is12 ? 'cmi.core.lesson_status' : 'cmi.completion_status',
      is12 ? 'cmi.core.score.raw' : 'cmi.score.raw',
      'cmi.success_status',
    ]
    const out: Record<string, string> = {}
    keep.forEach((k) => {
      if (src[k] !== undefined && src[k] !== '') out[k] = src[k]
    })
    return out
  }

  private errText(code: string): string {
    return (this.version === '1.2' ? ERR_12 : ERR_2004)[code] ?? 'Unknown error'
  }

  private log(
    method: string, key: string, value: string, result: string,
    code: string, note?: string
  ) {
    this.lastError = code
    this.calls.push({
      seq: ++this.seq,
      t: Date.now() - this.startedAt,
      method, key, value, result,
      errorCode: code,
      errorText: this.errText(code),
      note,
      level: code !== '0' ? 'error' : note ? 'warn' : 'ok',
    })
    this.onChange?.()
  }

  // ---------- lifecycle ----------

  private doInit(method: string): string {
    if (this.initialized) {
      this.log(method, '', '', 'false', this.version === '1.2' ? '101' : '103',
        'Initialize called twice. A course must call it exactly once, before anything else.')
      return 'false'
    }
    if (this.terminated) {
      this.log(method, '', '', 'false', this.version === '1.2' ? '101' : '104')
      return 'false'
    }
    this.initialized = true
    this.startedAt = Date.now()
    this.log(method, '', '', 'true', '0')
    return 'true'
  }

  private doTerminate(method: string): string {
    if (!this.initialized) {
      this.log(method, '', '', 'false', this.version === '1.2' ? '301' : '112')
      return 'false'
    }
    if (this.terminated) {
      this.log(method, '', '', 'false', this.version === '1.2' ? '101' : '113')
      return 'false'
    }
    // A real LMS rolls the session into total_time at termination.
    this.terminated = true
    this.initialized = false
    this.log(method, '', '', 'true', '0',
      this.profile.commitRequired && this.dirty()
        ? 'Terminated with uncommitted values — this profile discards them.'
        : undefined)
    return 'true'
  }

  private dirty(): boolean {
    return Object.keys(this.data).some((k) => this.data[k] !== this.committed[k])
  }

  private doCommit(method: string): string {
    if (!this.initialized) {
      this.log(method, '', '', 'false', this.version === '1.2' ? '301' : '142')
      return 'false'
    }
    this.committed = { ...this.data }
    this.log(method, '', '', 'true', '0')
    return 'true'
  }

  // ---------- get / set ----------

  private doGet(method: string, key: string): string {
    if (!this.initialized) {
      this.log(method, key, '', '', this.version === '1.2' ? '301' : (this.terminated ? '123' : '122'))
      return ''
    }
    const is12 = this.version === '1.2'
    const wo = is12 ? WO_12 : WO_2004
    if (wo.has(key)) {
      this.log(method, key, '', '', is12 ? '404' : '405',
        'Write-only element — a course must not read this back.')
      return ''
    }
    if (key.endsWith('._count')) {
      const prefix = key.slice(0, -'._count'.length)
      const n = this.countOf(prefix)
      this.log(method, key, '', String(n), '0')
      return String(n)
    }
    const known = is12 ? KNOWN_12 : KNOWN_2004
    if (this.profile.strictDataModel && !known.has(key) && !isIndexed(key)) {
      this.log(method, key, '', '', is12 ? '401' : '401',
        'Not part of the data model this profile implements.')
      return ''
    }
    const v = this.data[key] ?? ''
    this.log(method, key, '', v, '0')
    return v
  }

  private countOf(prefix: string): number {
    let n = 0
    const re = new RegExp('^' + prefix.replace(/\./g, '\\.') + '\\.(\\d+)\\.')
    Object.keys(this.data).forEach((k) => {
      const m = re.exec(k)
      if (m) n = Math.max(n, Number(m[1]) + 1)
    })
    return n
  }

  private doSet(method: string, key: string, raw: string): string {
    const is12 = this.version === '1.2'
    if (!this.initialized) {
      this.log(method, key, raw, 'false', is12 ? '301' : (this.terminated ? '133' : '132'))
      return 'false'
    }
    const ro = is12 ? RO_12 : RO_2004
    if (ro.has(key)) {
      this.log(method, key, raw, 'false', is12 ? '403' : '404',
        'Read-only element — the LMS owns this value.')
      return 'false'
    }
    const known = is12 ? KNOWN_12 : KNOWN_2004
    if (this.profile.strictDataModel && !known.has(key) && !isIndexed(key)) {
      this.log(method, key, raw, 'false', '401',
        'Undefined data model element. A lenient LMS would store it; this one refuses.')
      return 'false'
    }

    let value = raw
    let note: string | undefined

    // vocabulary
    const vocab = VOCAB[key]
    if (vocab && !vocab.includes(value)) {
      this.log(method, key, raw, 'false', is12 ? '405' : '406',
        `Not a permitted value. Expected one of: ${vocab.join(', ')}.`)
      return 'false'
    }

    // numeric fields
    if (/score\.(raw|min|max|scaled)$/.test(key)) {
      const n = Number(value)
      if (value !== '' && !Number.isFinite(n)) {
        this.log(method, key, raw, 'false', is12 ? '405' : '406', 'Not a number.')
        return 'false'
      }
      if (key.endsWith('score.scaled') && (n < -1 || n > 1)) {
        this.log(method, key, raw, 'false', '407', 'cmi.score.scaled must be between -1 and 1.')
        return 'false'
      }
      if (this.profile.integerScoreOnly && key.endsWith('score.raw') && !Number.isInteger(n)) {
        this.log(method, key, raw, 'false', is12 ? '405' : '406',
          'This profile accepts whole-number scores only.')
        return 'false'
      }
    }

    // durations
    if (this.profile.strictTimeFormat && /session_time$/.test(key)) {
      const ok = is12 ? TIME_12.test(value) : TIME_2004.test(value)
      if (!ok) {
        this.log(method, key, raw, 'false', is12 ? '405' : '406',
          is12 ? 'Expected HHHH:MM:SS.SS.' : 'Expected an ISO 8601 duration, e.g. PT1H30M0S.')
        return 'false'
      }
    }

    // The interesting one: field length.
    const limits = limitsFor(this.profile, this.version)
    const cap =
      key === 'cmi.suspend_data' ? limits.suspend
      : (key === 'cmi.core.lesson_location' || key === 'cmi.location') ? limits.location
      : 0
    if (cap && value.length > cap) {
      if (this.profile.onOverflow === 'reject') {
        this.log(method, key, raw, 'false', is12 ? '405' : '407',
          `${value.length} characters exceeds this LMS's ${cap}-character limit; the whole value was rejected.`)
        if (key === 'cmi.suspend_data') this.suspendLost = true
        return 'false'
      }
      value = value.slice(0, cap)
      note = `Accepted and silently truncated: ${raw.length} characters in, ${cap} kept. ` +
        'The call returned success — the course has no way to know it lost data.'
      if (key === 'cmi.suspend_data') this.suspendLost = true
    }

    this.data[key] = value
    if (!this.profile.commitRequired) this.committed[key] = value
    this.log(method, key, raw, 'true', '0', note)
    return 'true'
  }

  private doGetLastError(method: string): string {
    // Not logged: a course polls this after every call, and logging it would
    // bury the calls that matter under twice as many that don't.
    void method
    return this.lastError
  }

  // ---------- the objects the course actually finds ----------

  /** SCORM 1.2: `window.API`. */
  api12() {
    return {
      LMSInitialize: (s: string) => { void s; return this.doInit('LMSInitialize') },
      LMSFinish: (s: string) => { void s; return this.doTerminate('LMSFinish') },
      LMSGetValue: (k: string) => this.doGet('LMSGetValue', k),
      LMSSetValue: (k: string, v: string) => this.doSet('LMSSetValue', k, String(v)),
      LMSCommit: (s: string) => { void s; return this.doCommit('LMSCommit') },
      LMSGetLastError: () => this.doGetLastError('LMSGetLastError'),
      LMSGetErrorString: (c: string) => ERR_12[c] ?? '',
      LMSGetDiagnostic: (c: string) => ERR_12[c] ?? '',
    }
  }

  /** SCORM 2004: `window.API_1484_11`. */
  api2004() {
    return {
      Initialize: (s: string) => { void s; return this.doInit('Initialize') },
      Terminate: (s: string) => { void s; return this.doTerminate('Terminate') },
      GetValue: (k: string) => this.doGet('GetValue', k),
      SetValue: (k: string, v: string) => this.doSet('SetValue', k, String(v)),
      Commit: (s: string) => { void s; return this.doCommit('Commit') },
      GetLastError: () => this.doGetLastError('GetLastError'),
      GetErrorString: (c: string) => ERR_2004[c] ?? '',
      GetDiagnostic: (c: string) => ERR_2004[c] ?? '',
    }
  }
}

/** A plain-text transcript to hand to an LMS administrator. */
export function formatTranscript(
  snap: LmsSnapshot,
  meta: { course: string; version: string; profile: string }
): string {
  const lines: string[] = [
    'SCORM runtime transcript',
    '========================',
    `Course:   ${meta.course}`,
    `Standard: SCORM ${meta.version}`,
    `Profile:  ${meta.profile}`,
    `Captured: ${new Date().toISOString()}`,
    `Calls:    ${snap.calls.length}`,
    `Suspend:  ${snap.suspendUsed} / ${snap.suspendLimit} characters${snap.suspendLost ? '  ** DATA LOST **' : ''}`,
    '',
    'Call log',
    '--------',
  ]
  snap.calls.forEach((c) => {
    const arg = c.key ? ` ${c.key}` : ''
    const val = c.value !== '' ? ` = ${JSON.stringify(c.value)}` : ''
    lines.push(
      `[${String(c.seq).padStart(4, ' ')}] +${String(c.t).padStart(6, ' ')}ms  ` +
      `${c.method}${arg}${val} -> ${JSON.stringify(c.result)}` +
      (c.errorCode !== '0' ? `  ERROR ${c.errorCode} ${c.errorText}` : '')
    )
    if (c.note) lines.push(`         note: ${c.note}`)
  })
  lines.push('', 'Final data model', '----------------')
  Object.keys(snap.data).sort().forEach((k) => {
    const v = snap.data[k]
    lines.push(`${k} = ${v.length > 120 ? v.slice(0, 120) + `… (${v.length} chars)` : v}`)
  })
  return lines.join('\n')
}
