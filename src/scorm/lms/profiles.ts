/**
 * Behaviour profiles for the LMS simulator.
 *
 * Deliberately named after *behaviours*, not vendors. Real LMSs are moving
 * targets and version-dependent, and a profile labelled "Cornerstone" would be
 * claiming a fidelity nobody can honestly promise. What is stable — and what
 * actually breaks courses — is the small set of behaviours below, each of which
 * some real LMS somewhere exhibits.
 *
 * The one that matters most is `suspendLimit`. SCORM 1.2 sets the smallest
 * permitted maximum ("SPM") for `cmi.suspend_data` at 4096 characters, and an
 * LMS is entirely within its rights to keep only that much. Courses that exceed
 * it lose bookmarking — usually silently, because the failure surfaces as a
 * successful `LMSSetValue` followed by a short string coming back next session.
 */

export type ScormRuntimeVersion = '1.2' | '2004'

export interface LmsProfile {
  id: string
  label: string
  summary: string
  /** Characters accepted in cmi.suspend_data. */
  suspendLimit: number
  /** Characters accepted in cmi.core.lesson_location / cmi.location. */
  locationLimit: number
  /** What happens past the limit. `truncate` is the silent, nasty one. */
  onOverflow: 'truncate' | 'reject'
  /** Reject SetValue against elements outside the data model (error 401). */
  strictDataModel: boolean
  /** Values only survive to the next session if Commit was called after them. */
  commitRequired: boolean
  /** Round cmi.core.score.raw to a whole number on the way in. */
  integerScoreOnly: boolean
  /** Reject a session_time that isn't a well-formed duration. */
  strictTimeFormat: boolean
}

/** Spec minimums, per version. A profile may allow more, never less. */
export const SPEC_LIMITS: Record<ScormRuntimeVersion, { suspend: number; location: number }> = {
  '1.2': { suspend: 4096, location: 255 },
  '2004': { suspend: 64000, location: 1000 },
}

export const LMS_PROFILES: LmsProfile[] = [
  {
    id: 'spec',
    label: 'Specification',
    summary:
      'Enforces the standard exactly: smallest permitted field sizes, unknown data model elements rejected, nothing durable until Commit. The strictest environment your package can meet — pass here and you should pass anywhere.',
    suspendLimit: 0, // 0 = use the version's spec minimum
    locationLimit: 0,
    onOverflow: 'reject',
    strictDataModel: true,
    commitRequired: true,
    integerScoreOnly: false,
    strictTimeFormat: true,
  },
  {
    id: 'lenient',
    label: 'Lenient',
    summary:
      'Generous field sizes, unknown elements accepted and stored, values durable immediately. Typical of modern cloud platforms — a course can pass here and still fail elsewhere, so it is the weakest test.',
    suspendLimit: 64000,
    locationLimit: 4000,
    onOverflow: 'truncate',
    strictDataModel: false,
    commitRequired: false,
    integerScoreOnly: false,
    strictTimeFormat: false,
  },
  {
    id: 'truncating',
    label: 'Silently truncating',
    summary:
      'Accepts oversized suspend data and then quietly keeps only the first 4096 characters. Reproduces the single most common "bookmarking randomly stopped working" report: every call returns success and the data is lost anyway.',
    suspendLimit: 4096,
    locationLimit: 255,
    onOverflow: 'truncate',
    strictDataModel: false,
    commitRequired: false,
    integerScoreOnly: false,
    strictTimeFormat: false,
  },
  {
    id: 'legacy',
    label: 'Legacy / strict scoring',
    summary:
      'Small suspend budget, whole-number scores only, strict duration formats, Commit required. Models older on-premise installations, where a decimal score or a malformed time is rejected outright.',
    suspendLimit: 4096,
    locationLimit: 255,
    onOverflow: 'reject',
    strictDataModel: true,
    commitRequired: true,
    integerScoreOnly: true,
    strictTimeFormat: true,
  },
]

export function profileById(id: string): LmsProfile {
  return LMS_PROFILES.find((p) => p.id === id) ?? LMS_PROFILES[0]
}

/** The effective limits for a profile at a given SCORM version. */
export function limitsFor(profile: LmsProfile, version: ScormRuntimeVersion) {
  const spec = SPEC_LIMITS[version]
  return {
    suspend: profile.suspendLimit || spec.suspend,
    location: profile.locationLimit || spec.location,
  }
}
