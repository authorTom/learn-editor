import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Link2, Trash2, UserPlus } from 'lucide-react'
import { Button, Field, Input, Select, Sheet, useConfirm, useToast } from '../../ui'
import { useAuth } from '../../auth/authStore'
import {
  ApiError, createUser, deleteUser, listUsers, reinvite, resetUserPassword, updateUser,
  type Invite, type ManagedUser,
} from '../../auth/api'

/**
 * Administration: who can use this instance.
 *
 * The invitation link is the thing to get right. The server keeps only a hash
 * of the token, so the link can be shown exactly once — at the moment it is
 * created. That is a genuine constraint, not a UI preference, so the panel says
 * so plainly and keeps the link on screen until it is dismissed rather than
 * flashing it in a toast that a distracted admin will miss.
 */

function inviteUrl(token: string): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(token)}`
}

function InviteLink({ invite, email, onDone }: { invite: Invite; email: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()
  const url = inviteUrl(invite.token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The
      // link is selectable on screen, so say that rather than failing silently.
      toast.error('Could not copy — select the link and copy it manually')
    }
  }

  return (
    <div className="users__invite" role="status">
      <p className="users__invite-title">
        <Link2 size={15} aria-hidden="true" /> Invitation for {email}
      </p>
      <p className="users__invite-note">
        Send this to them. <strong>It is shown once</strong> — the server keeps only a hash of it,
        so it cannot be displayed again. It expires{' '}
        {new Date(invite.expiresAt).toLocaleDateString([], { day: 'numeric', month: 'long' })}.
      </p>
      <div className="users__invite-row">
        <input className="ui-input users__invite-url" readOnly value={url} onFocus={(e) => e.target.select()} />
        <Button
          variant="secondary"
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          onClick={copy}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}

export default function UsersPanel({ onClose }: { onClose: () => void }) {
  const me = useAuth((s) => s.user)!
  const toast = useToast()
  const confirm = useConfirm()

  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'author'>('author')
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState<{ invite: Invite; email: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUsers((await listUsers()).users)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load the user list')
      setUsers([])
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function add() {
    setBusy(true)
    try {
      const res = await createUser({ email: email.trim(), name: name.trim(), role })
      setInvite({ invite: res.invite, email: res.user.email })
      setEmail('')
      setName('')
      setRole('author')
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create that account')
    } finally {
      setBusy(false)
    }
  }

  async function patch(u: ManagedUser, change: Parameters<typeof updateUser>[1], describe: string) {
    try {
      await updateUser(u.id, change)
      await refresh()
      toast.success(describe)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not make that change')
    }
  }

  async function remove(u: ManagedUser) {
    const ok = await confirm({
      title: `Delete ${u.email}?`,
      message:
        'Their account, their sessions and every course they have synced to this server are removed. Courses still held in their own browser are not affected. This cannot be undone.',
      confirmLabel: 'Delete the account',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteUser(u.id)
      await refresh()
      toast.success(`${u.email} was deleted`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete that account')
    }
  }

  async function resend(u: ManagedUser) {
    try {
      const { invite: fresh } = await reinvite(u.id)
      setInvite({ invite: fresh, email: u.email })
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a new invitation')
    }
  }

  async function resetPassword(u: ManagedUser) {
    const ok = await confirm({
      title: `Reset the password for ${u.email}?`,
      message:
        'Their current password stops working and they are signed out everywhere. You will get a link to send them so they can choose a new one — you never see their password.',
      confirmLabel: 'Reset and create a link',
      destructive: true,
    })
    if (!ok) return
    try {
      const { invite: fresh } = await resetUserPassword(u.id)
      setInvite({ invite: fresh, email: u.email })
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reset that password')
    }
  }

  return (
    <Sheet open onClose={onClose} title="People" size="lg">
      <div className="users">
        <section className="users__add">
          <h3 className="account__heading">
            <UserPlus size={16} aria-hidden="true" /> Invite someone
          </h3>
          <p className="account__meta">
            Learn Editor has no public sign-up. Create the account here and send them the link.
          </p>
          <div className="users__add-grid">
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Role" hint="Administrators can manage people. Authors cannot.">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'author')}>
                <option value="author">Author</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
          </div>
          <Button variant="primary" onClick={add} disabled={!email.trim() || busy}>
            {busy ? 'Creating…' : 'Create account and invitation'}
          </Button>
        </section>

        {invite && (
          <InviteLink invite={invite.invite} email={invite.email} onDone={() => setInvite(null)} />
        )}

        <section>
          <h3 className="account__heading">Everyone ({users?.length ?? 0})</h3>
          <ul className="users__list">
            {(users ?? []).map((u) => (
              <li key={u.id} className={`users__row${u.status === 'suspended' ? ' is-suspended' : ''}`}>
                <div className="users__identity">
                  <p className="users__name">
                    {u.name || u.email}
                    {u.id === me.id && <span className="account__badge">You</span>}
                    {u.pending && <span className="account__badge">Invited</span>}
                    {u.status === 'suspended' && (
                      <span className="account__badge account__badge--warn">Suspended</span>
                    )}
                  </p>
                  <p className="account__meta">
                    {u.name ? `${u.email} · ` : ''}
                    {u.role === 'admin' ? 'Administrator' : 'Author'}
                    {u.lastSeenAt
                      ? ` · last seen ${new Date(u.lastSeenAt).toLocaleDateString([], {
                          day: 'numeric', month: 'short',
                        })}`
                      : u.pending
                        ? ' · has not signed in yet'
                        : ''}
                  </p>
                </div>

                <div className="users__actions">
                  {u.pending ? (
                    <Button variant="ghost" size="sm" icon={<Link2 size={15} />} onClick={() => resend(u)}>
                      New link
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<KeyRound size={15} />}
                      onClick={() => resetPassword(u)}
                    >
                      Reset
                    </Button>
                  )}

                  {/* Every one of these can be refused by the server's
                      last-administrator rule; the toast repeats its reason. */}
                  <Select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    onChange={(e) =>
                      patch(u, { role: e.target.value as 'admin' | 'author' }, 'Role changed')
                    }
                  >
                    <option value="author">Author</option>
                    <option value="admin">Administrator</option>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      patch(
                        u,
                        { status: u.status === 'active' ? 'suspended' : 'active' },
                        u.status === 'active' ? 'Account suspended' : 'Account restored'
                      )
                    }
                  >
                    {u.status === 'active' ? 'Suspend' : 'Restore'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} />}
                    onClick={() => remove(u)}
                    disabled={u.id === me.id}
                    aria-label={`Delete ${u.email}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Sheet>
  )
}
