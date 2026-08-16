import { useState } from 'react'
import { Info, LogOut, Settings2, Users } from 'lucide-react'
import { Popover } from '../../ui'
import { useAuth } from '../../auth/authStore'
import AccountSheet from './AccountSheet'
import UsersPanel from './UsersPanel'
import AboutDialog from '../AboutDialog'

/**
 * The signed-in author's corner of the chrome: an initials button that opens
 * account settings, people (administrators only), About, and sign out.
 *
 * Renders nothing at all in local mode. That is the point of the whole
 * arrangement — with no server there is no account, and the interface should
 * not carry a disabled hint of one.
 */

function initials(name: string, email: string): string {
  const source = name.trim() || email
  const words = source.split(/[\s@._-]+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function UserMenu({ topInset = 0 }: { topInset?: number }) {
  const mode = useAuth((s) => s.mode)
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)

  const [showAccount, setShowAccount] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  if (mode !== 'server' || !user) return null

  const label = user.name || user.email

  return (
    <>
      <Popover
        topInset={topInset}
        align="end"
        label="Account menu"
        trigger={
          <button
            type="button"
            className="usermenu__trigger"
            aria-label={`Account: ${label}`}
            title={label}
          >
            <span aria-hidden="true">{initials(user.name, user.email)}</span>
          </button>
        }
      >
        {({ close }) => (
          <div className="usermenu">
            <div className="usermenu__head">
              <p className="usermenu__name">{label}</p>
              <p className="usermenu__email">{user.email}</p>
              <p className="usermenu__role">
                {user.role === 'admin' ? 'Administrator' : 'Author'}
              </p>
            </div>

            <button
              type="button"
              className="usermenu__item"
              onClick={() => { close(); setShowAccount(true) }}
            >
              <Settings2 size={15} aria-hidden="true" /> Your account
            </button>

            {user.role === 'admin' && (
              <button
                type="button"
                className="usermenu__item"
                onClick={() => { close(); setShowUsers(true) }}
              >
                <Users size={15} aria-hidden="true" /> People
              </button>
            )}

            <button
              type="button"
              className="usermenu__item"
              onClick={() => { close(); setShowAbout(true) }}
            >
              <Info size={15} aria-hidden="true" /> About Learn Editor
            </button>

            <button
              type="button"
              className="usermenu__item usermenu__item--danger"
              onClick={() => { close(); void signOut() }}
            >
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        )}
      </Popover>

      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      {showUsers && <UsersPanel onClose={() => setShowUsers(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </>
  )
}
