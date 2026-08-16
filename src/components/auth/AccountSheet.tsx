import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, Monitor, ShieldAlert } from 'lucide-react'
import { Button, Field, Input, Sheet, useConfirm, useToast } from '../../ui'
import { useAuth } from '../../auth/authStore'
import {
  ApiError, changePassword, listSessions, revokeOtherSessions, revokeSession, updateAccount,
  type SessionInfo,
} from '../../auth/api'

/**
 * A person's own account: who they are, their password, and every device
 * currently signed in as them.
 *
 * The session list is the part that earns its place. It is the only way an
 * author can answer "is anyone else in my account?", and the only way to do
 * something about it without an administrator — which matters because the
 * courses behind that session may be the compliance training the organisation
 * is relying on.
 */

function when(ts: number): string {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return today ? `Today ${time}` : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`
}

/** A user-agent string is unreadable; this is the honest gist of one. */
function describeDevice(ua: string): string {
  if (!ua) return 'Unknown device'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Browser'
  const platform =
    /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  return platform ? `${browser} on ${platform}` : browser
}

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user)!
  const setUser = useAuth((s) => s.setUser)
  const doSignOut = useAuth((s) => s.signOut)
  const toast = useToast()
  const confirm = useConfirm()

  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [savingProfile, setSavingProfile] = useState(false)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)

  const refreshSessions = useCallback(async () => {
    try {
      setSessions((await listSessions()).sessions)
    } catch {
      setSessions([])
    }
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const profileDirty = name !== user.name || email !== user.email

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const { user: updated } = await updateAccount({ name, email })
      setUser(updated)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save your profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (next !== confirmPw) {
      toast.error('Those two passwords are not the same')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirmPw('')
      await refreshSessions()
      // The server ends every other session on a password change; say so,
      // because otherwise being signed out on another machine is a mystery.
      toast.success('Password changed. Every other device has been signed out.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change your password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function endSession(id: string) {
    try {
      await revokeSession(id)
      await refreshSessions()
      toast.success('That device was signed out')
    } catch {
      toast.error('Could not sign that device out')
    }
  }

  async function endOthers() {
    const ok = await confirm({
      title: 'Sign out every other device?',
      message: 'Anyone signed in as you anywhere else will have to sign in again. This device stays signed in.',
      confirmLabel: 'Sign the others out',
    })
    if (!ok) return
    try {
      await revokeOtherSessions()
      await refreshSessions()
      toast.success('Every other device has been signed out')
    } catch {
      toast.error('Could not sign the other devices out')
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current)

  return (
    <Sheet open onClose={onClose} title="Your account" size="md">
      <div className="account">
        <section className="account__section">
          <h3 className="account__heading">Profile</h3>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Email" hint="You sign in with this.">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <p className="account__meta">
            {user.role === 'admin' ? 'Administrator' : 'Author'} · joined{' '}
            {new Date(user.createdAt).toLocaleDateString([], {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <Button variant="primary" onClick={saveProfile} disabled={!profileDirty || savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </section>

        <section className="account__section">
          <h3 className="account__heading">Password</h3>
          <Field label="Current password">
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" hint="At least 10 characters.">
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Button
            variant="primary"
            onClick={savePassword}
            disabled={!current || next.length < 10 || savingPassword}
          >
            {savingPassword ? 'Changing…' : 'Change password'}
          </Button>
        </section>

        <section className="account__section">
          <h3 className="account__heading">Signed in on</h3>
          {sessions === null ? (
            <p className="account__meta">
              <Loader2 className="auth__spinner" size={14} aria-hidden="true" /> Loading…
            </p>
          ) : (
            <ul className="account__sessions">
              {sessions.map((s) => (
                <li key={s.id} className="account__session">
                  <Monitor size={16} aria-hidden="true" className="account__session-icon" />
                  <div className="account__session-body">
                    <p className="account__session-name">
                      {describeDevice(s.userAgent)}
                      {s.current && <span className="account__badge">This device</span>}
                    </p>
                    <p className="account__meta">Last used {when(s.lastSeenAt)}</p>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" onClick={() => endSession(s.id)}>
                      Sign out
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {others.length > 0 && (
            <Button variant="secondary" icon={<ShieldAlert size={16} />} onClick={endOthers}>
              Sign out every other device
            </Button>
          )}
        </section>

        <section className="account__section">
          <Button
            variant="danger"
            icon={<LogOut size={16} />}
            onClick={async () => {
              await doSignOut()
              onClose()
            }}
          >
            Sign out
          </Button>
        </section>
      </div>
    </Sheet>
  )
}
