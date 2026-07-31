import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ChevronRight, Download, Gauge, RotateCcw, ScrollText, Table2, X,
} from 'lucide-react'
import type { Course } from '../types'
import { buildPlayerHtml } from '../scorm/buildPlayerHtml'
import { FakeLms, formatTranscript, type LmsSnapshot } from '../scorm/lms/fakeLms'
import { LMS_PROFILES, limitsFor, profileById, type ScormRuntimeVersion } from '../scorm/lms/profiles'
import { Button, Segmented, useToast } from '../ui'
import { downloadBlob, slugify } from '../utils/file'

/**
 * The flight recorder: the course running against a simulated LMS, with every
 * runtime call captured.
 *
 * Preview answers "does it look right". This answers "does it *report* right",
 * which is the question that actually costs people days — because the only
 * other way to find out is to upload the package to a real LMS, click through
 * it, and then interpret silence.
 *
 * The course is not modified or instrumented. It finds `window.API` by walking
 * up from its iframe exactly as it would inside an LMS, and what it finds is a
 * conformant runtime that happens to be writing everything down.
 */

type Tab = 'log' | 'data'

/** Rows the CMI table shows first — the ones that decide whether a course
    "worked" as far as an administrator is concerned. */
const HEADLINE: Record<ScormRuntimeVersion, string[]> = {
  '1.2': [
    'cmi.core.lesson_status', 'cmi.core.score.raw', 'cmi.core.lesson_location',
    'cmi.core.session_time', 'cmi.suspend_data',
  ],
  '2004': [
    'cmi.completion_status', 'cmi.success_status', 'cmi.score.scaled', 'cmi.score.raw',
    'cmi.location', 'cmi.session_time', 'cmi.suspend_data',
  ],
}

function SuspendMeter({ snap }: { snap: LmsSnapshot }) {
  const pct = snap.suspendLimit ? Math.min(100, (snap.suspendUsed / snap.suspendLimit) * 100) : 0
  const level = snap.suspendLost ? 'over' : pct > 80 ? 'near' : 'ok'
  return (
    <div className={'fr-meter is-' + level}>
      <div className="fr-meter__head">
        <Gauge size={14} aria-hidden="true" />
        <span>Suspend data</span>
        <span className="fr-meter__num">
          {snap.suspendUsed.toLocaleString()} / {snap.suspendLimit.toLocaleString()} chars
        </span>
      </div>
      <div
        className="fr-meter__bar"
        role="meter"
        aria-valuenow={snap.suspendUsed}
        aria-valuemin={0}
        aria-valuemax={snap.suspendLimit}
        aria-label="Suspend data used"
      >
        <span style={{ width: pct + '%' }} />
      </div>
      {snap.suspendLost && (
        <p className="fr-meter__warn">
          <AlertTriangle size={13} aria-hidden="true" />
          Bookmarking is broken at this size. The learner's place and quiz results will not
          survive closing the course.
        </p>
      )}
    </div>
  )
}

export default function FlightRecorder({ course, onClose }: { course: Course; onClose: () => void }) {
  const [version, setVersion] = useState<ScormRuntimeVersion>('1.2')
  const [profileId, setProfileId] = useState('spec')
  const [tab, setTab] = useState<Tab>('log')
  const [snap, setSnap] = useState<LmsSnapshot | null>(null)
  const [runId, setRunId] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const [autoScroll, setAutoScroll] = useState(true)

  const lmsRef = useRef<FakeLms | null>(null)
  const resumeRef = useRef<Record<string, string>>({})
  const logRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const profile = profileById(profileId)
  const html = useMemo(() => buildPlayerHtml(course, version), [course, version])

  /**
   * Install the runtime on `window` before the frame loads.
   *
   * It has to be a real global on this window: the course walks `window.parent`
   * looking for the API, and anything cleverer (postMessage, an injected shim)
   * would be testing a different integration from the one an LMS provides.
   */
  useEffect(() => {
    let raf = 0
    const lms = new FakeLms({
      version,
      profile,
      resumeFrom: resumeRef.current,
      onChange: () => {
        // Coalesce to one render per frame — a quiz submit fires a dozen
        // SetValue calls in a row and each would otherwise re-render the log.
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          setSnap(lms.snapshot())
        })
      },
    })
    lmsRef.current = lms
    const w = window as unknown as Record<string, unknown>
    if (version === '1.2') w.API = lms.api12()
    else w.API_1484_11 = lms.api2004()
    setSnap(lms.snapshot())

    return () => {
      if (raf) cancelAnimationFrame(raf)
      delete w.API
      delete w.API_1484_11
    }
  }, [version, profile, runId])

  useEffect(() => {
    if (autoScroll && tab === 'log' && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [snap, autoScroll, tab])

  /** Close the attempt the way an LMS would, then relaunch carrying whatever
      the LMS actually retained — which is how resume bugs surface. */
  const relaunch = useCallback((resume: boolean) => {
    resumeRef.current = resume ? (lmsRef.current?.persistedState() ?? {}) : {}
    setAttempt((n) => (resume ? n + 1 : 1))
    setRunId((n) => n + 1)
  }, [])

  const limits = limitsFor(profile, version)
  const errors = snap?.calls.filter((c) => c.level === 'error').length ?? 0
  const warnings = snap?.calls.filter((c) => c.level === 'warn').length ?? 0

  function saveTranscript() {
    if (!snap) return
    const text = formatTranscript(snap, {
      course: course.title || 'Untitled course',
      version,
      profile: profile.label,
    })
    downloadBlob(
      new Blob([text], { type: 'text/plain' }),
      `${slugify(course.title || 'course')}-scorm-transcript.txt`
    )
    toast.success('Transcript downloaded.')
  }

  const dataKeys = snap
    ? [
        ...HEADLINE[version].filter((k) => snap.data[k] !== undefined),
        ...Object.keys(snap.data).filter((k) => !HEADLINE[version].includes(k)).sort(),
      ]
    : []

  return (
    <div className="fr-scrim" role="dialog" aria-modal="true" aria-label="SCORM flight recorder">
      <div className="fr-topbar">
        <span className="fr-title">
          <ScrollText size={15} aria-hidden="true" />
          Flight recorder — {course.title || 'Untitled course'}
        </span>
        <Segmented
          label="SCORM version"
          size="sm"
          value={version}
          options={[
            { value: '1.2', label: 'SCORM 1.2' },
            { value: '2004', label: 'SCORM 2004' },
          ]}
          onChange={(v) => {
            resumeRef.current = {}
            setAttempt(1)
            setVersion(v)
          }}
        />
        <label className="fr-profile">
          <span>LMS behaviour</span>
          <select value={profileId} onChange={(e) => { resumeRef.current = {}; setAttempt(1); setProfileId(e.target.value) }}>
            {LMS_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => relaunch(true)}>
          Relaunch &amp; resume
        </Button>
        <Button size="sm" onClick={() => relaunch(false)}>
          Restart clean
        </Button>
        <Button size="sm" icon={<Download size={14} />} onClick={saveTranscript}>
          Transcript
        </Button>
        <Button size="sm" icon={<X size={14} />} onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="fr-body">
        <div className="fr-stage">
          {/* key forces a fresh document on relaunch, so the course runs its
              whole startup path against the new runtime. */}
          <iframe
            key={runId}
            title="Course under test"
            srcDoc={html}
            sandbox="allow-scripts allow-popups allow-same-origin"
          />
        </div>

        <aside className="fr-side">
          <p className="fr-profile-note">{profile.summary}</p>

          <div className="fr-stats">
            <span className="fr-stat">
              <b>{attempt}</b> attempt{attempt === 1 ? '' : 's'}
            </span>
            <span className="fr-stat">
              <b>{snap?.calls.length ?? 0}</b> calls
            </span>
            <span className={'fr-stat' + (warnings ? ' is-warn' : '')}>
              <b>{warnings}</b> warning{warnings === 1 ? '' : 's'}
            </span>
            <span className={'fr-stat' + (errors ? ' is-error' : '')}>
              <b>{errors}</b> error{errors === 1 ? '' : 's'}
            </span>
          </div>

          {snap && <SuspendMeter snap={snap} />}

          <div className="fr-tabs" role="tablist" aria-label="Runtime detail">
            <button
              role="tab" aria-selected={tab === 'log'}
              className={'fr-tab' + (tab === 'log' ? ' is-active' : '')}
              onClick={() => setTab('log')}
            >
              <ScrollText size={14} aria-hidden="true" /> Call log
            </button>
            <button
              role="tab" aria-selected={tab === 'data'}
              className={'fr-tab' + (tab === 'data' ? ' is-active' : '')}
              onClick={() => setTab('data')}
            >
              <Table2 size={14} aria-hidden="true" /> Data model
            </button>
          </div>

          {tab === 'log' ? (
            <>
              <label className="fr-autoscroll">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Follow new calls
              </label>
              <div className="fr-log" ref={logRef}>
                {!snap?.calls.length && (
                  <p className="fr-empty">
                    Nothing yet. Move through the course on the left and every runtime call it
                    makes will appear here.
                  </p>
                )}
                {snap?.calls.map((c) => (
                  <div key={c.seq} className={'fr-call is-' + c.level}>
                    <span className="fr-call__t">+{(c.t / 1000).toFixed(1)}s</span>
                    <span className="fr-call__m">{c.method}</span>
                    {c.key && <span className="fr-call__k">{c.key}</span>}
                    {c.value !== '' && (
                      <span className="fr-call__v" title={c.value}>
                        {c.value.length > 60 ? c.value.slice(0, 60) + '…' : c.value}
                      </span>
                    )}
                    <span className="fr-call__r">
                      <ChevronRight size={11} aria-hidden="true" />
                      {c.result || '—'}
                    </span>
                    {c.errorCode !== '0' && (
                      <span className="fr-call__err">
                        {c.errorCode} {c.errorText}
                      </span>
                    )}
                    {c.note && <span className="fr-call__note">{c.note}</span>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="fr-data">
              <p className="fr-empty" style={{ marginBottom: 8 }}>
                Field limits for this profile: suspend_data {limits.suspend.toLocaleString()},
                location {limits.location.toLocaleString()} characters.
              </p>
              <table>
                <thead>
                  <tr><th>Element</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {dataKeys.map((k) => (
                    <tr key={k} className={HEADLINE[version].includes(k) ? 'is-headline' : undefined}>
                      <td>{k}</td>
                      <td title={snap?.data[k]}>
                        {(snap?.data[k] ?? '').length > 90
                          ? (snap?.data[k] ?? '').slice(0, 90) + `… (${snap?.data[k].length})`
                          : snap?.data[k] || <em>empty</em>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
