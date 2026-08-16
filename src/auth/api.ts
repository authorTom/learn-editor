/**
 * The one place the app talks to a server.
 *
 * Everything here has to cope with there being no server at all. That is not an
 * error path — it is how `npm run dev` and the static deployment run, and the
 * app is fully usable in it. So `fetchConfig` treats a failed request as a
 * definitive answer ("local-only") rather than something to retry or report.
 *
 * Two rules for every call:
 *   • `credentials: 'same-origin'` so the session cookie travels.
 *   • the `X-Quoin` header on writes, which is what the server's CSRF
 *     check looks for. A cross-site form post cannot set it.
 */

export interface ServerConfig {
  version: string
  auth: { required: boolean; setupNeeded: boolean }
  sync: boolean
}

export interface AccountUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'author'
  status: 'active' | 'suspended'
  createdAt: number
  lastSeenAt: number | null
}

export interface ManagedUser extends AccountUser {
  /** Invited but has never set a password. */
  pending: boolean
  inviteExpiresAt: number | null
}

export interface SessionInfo {
  id: string
  current: boolean
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  userAgent: string
}

export interface Invite {
  token: string
  expiresAt: number
}

/** An error carrying the server's status and machine-readable code. */
export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Thrown when there is no server to talk to. Callers treat this as "local-only". */
export class OfflineError extends Error {
  constructor() {
    super('No server is reachable.')
  }
}

const APP_HEADER = 'X-Quoin'

async function request<T>(
  path: string,
  { method = 'GET', body, raw, headers = {} }: {
    method?: string
    body?: unknown
    raw?: BodyInit
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        // Sent on reads too. It costs nothing and means a handler can never be
        // reached without it by accident.
        [APP_HEADER]: '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    // A network-level failure. Either there is no server, or it is down; the
    // caller cannot usefully tell the difference and behaves the same way.
    throw new OfflineError()
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    const detail = payload as { error?: string; code?: string } | null
    throw new ApiError(
      res.status,
      detail?.error || `The server returned ${res.status}.`,
      detail?.code
    )
  }
  return payload as T
}

// ---------- session and identity ----------

/**
 * Ask the server what it is. A failure means there isn't one, which is a
 * supported way to run — so this resolves to null rather than rejecting.
 */
export async function fetchConfig(): Promise<ServerConfig | null> {
  try {
    return await request<ServerConfig>('/api/config')
  } catch {
    return null
  }
}

export const fetchMe = () => request<{ user: AccountUser }>('/api/auth/me')

export const signIn = (email: string, password: string) =>
  request<{ user: AccountUser }>('/api/auth/login', { method: 'POST', body: { email, password } })

export const signOut = () => request<void>('/api/auth/logout', { method: 'POST' })

export const createFirstAdmin = (input: {
  setupToken: string
  email: string
  name: string
  password: string
}) => request<{ user: AccountUser }>('/api/auth/setup', { method: 'POST', body: input })

export const acceptInvite = (token: string, password: string) =>
  request<{ user: AccountUser }>('/api/auth/accept-invite', { method: 'POST', body: { token, password } })

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } })

export const updateAccount = (patch: { name?: string; email?: string }) =>
  request<{ user: AccountUser }>('/api/account', { method: 'PATCH', body: patch })

export const listSessions = () => request<{ sessions: SessionInfo[] }>('/api/auth/sessions')

export const revokeSession = (id: string) =>
  request<void>(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const revokeOtherSessions = () =>
  request<void>('/api/account/sessions/revoke-others', { method: 'POST' })

// ---------- administration ----------

export const listUsers = () => request<{ users: ManagedUser[] }>('/api/users')

export const createUser = (input: { email: string; name: string; role: 'admin' | 'author' }) =>
  request<{ user: ManagedUser; invite: Invite }>('/api/users', { method: 'POST', body: input })

export const updateUser = (
  id: string,
  patch: { name?: string; role?: 'admin' | 'author'; status?: 'active' | 'suspended' }
) => request<{ user: ManagedUser }>(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })

export const deleteUser = (id: string) =>
  request<void>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const reinvite = (id: string) =>
  request<{ invite: Invite }>(`/api/users/${encodeURIComponent(id)}/invite`, { method: 'POST' })

export const resetUserPassword = (id: string) =>
  request<{ invite: Invite }>(`/api/users/${encodeURIComponent(id)}/reset`, { method: 'POST' })

// ---------- course sync ----------

export interface RemoteCourseMeta {
  id: string
  title: string
  rev: number
  updatedAt: number
  deletedAt: number | null
}

export const listRemoteCourses = () => request<{ courses: RemoteCourseMeta[] }>('/api/courses')

export const pullCourse = (id: string) =>
  request<{ id: string; rev: number; updatedAt: number; doc: unknown }>(
    `/api/courses/${encodeURIComponent(id)}`
  )

export const pullServerCopy = (id: string) =>
  request<{ id: string; rev: number; updatedAt: number; deletedAt: number | null; doc: unknown }>(
    `/api/courses/${encodeURIComponent(id)}/server-copy`
  )

export const pushCourse = (
  id: string,
  body: { doc: unknown; baseRev: number; assets: string[]; force?: boolean }
) => request<{ id: string; rev: number; updatedAt: number }>(
  `/api/courses/${encodeURIComponent(id)}`,
  { method: 'PUT', body }
)

export const deleteRemoteCourse = (id: string) =>
  request<void>(`/api/courses/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const missingAssets = (shas: string[]) =>
  request<{ missing: string[] }>('/api/assets/missing', { method: 'POST', body: { shas } })

export const uploadAsset = (sha: string, bytes: Blob, mime: string) =>
  request<void>(`/api/assets/${sha}`, {
    method: 'PUT',
    raw: bytes,
    headers: { 'Content-Type': mime || 'application/octet-stream' },
  })

export const downloadAsset = async (sha: string): Promise<Blob> => {
  const res = await fetch(`/api/assets/${sha}`, {
    credentials: 'same-origin',
    headers: { [APP_HEADER]: '1' },
  })
  if (!res.ok) throw new ApiError(res.status, `Could not fetch asset ${sha.slice(0, 8)}.`)
  return res.blob()
}

export const listRemoteVersions = (courseId: string) =>
  request<{ versions: RemoteVersion[] }>(`/api/courses/${encodeURIComponent(courseId)}/versions`)

export interface RemoteVersion {
  id: string
  name: string
  note: string
  createdAt: number
  lessonCount: number
  blockCount: number
  auto: boolean
}

export const pushVersion = (
  courseId: string,
  versionId: string,
  body: {
    doc: unknown
    name: string
    note: string
    createdAt: number
    lessonCount: number
    blockCount: number
    auto: boolean
  }
) => request<void>(
  `/api/courses/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}`,
  { method: 'PUT', body }
)

export const pullVersion = (courseId: string, versionId: string) =>
  request<{ id: string; createdAt: number; doc: unknown }>(
    `/api/courses/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}`
  )

export const deleteRemoteVersion = (courseId: string, versionId: string) =>
  request<void>(
    `/api/courses/${encodeURIComponent(courseId)}/versions/${encodeURIComponent(versionId)}`,
    { method: 'DELETE' }
  )
