import { useEffect, useRef, useState, type FormEvent } from 'react'
import { GraduationCap, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { Button, Field, Input } from '../../ui'
import { useAuth } from '../../auth/authStore'
import { ApiError, acceptInvite, createFirstAdmin } from '../../auth/api'

/**
 * The screen shown before anyone is signed in. One component covers three
 * states because they are the same form wearing different labels, and a user
 * only ever meets one of them:
 *
 *   setup    no accounts exist yet — create the founding administrator
 *   invite   arrived on an invitation link — choose a password
 *   sign in  everything else
 *
 * Chrome palette throughout. This renders before any course is open, so there
 * is no course theme to wear even if it wanted to.
 */

type Mode = 'signin' | 'setup' | 'invite'

/**
 * An invitation link is `/?invite=<token>`.
 *
 * Reading and clearing are deliberately separate. A `useState` initializer must
 * be pure: React's StrictMode calls it twice in development, and doing the
 * `replaceState` there meant the second call found a URL its own first call had
 * already stripped, returned an empty token, and dropped the invited user onto
 * a sign-in form for an account that has no password yet. Read in the
 * initializer, clear in an effect.
 */
function readInviteToken(): string {
  return new URLSearchParams(window.location.search).get('invite') ?? ''
}

/** Take the token out of the address bar, so it is not left in history, in a
    bookmark, or on screen during a screen share. */
function clearInviteFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('invite')) return
  params.delete('invite')
  const qs = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
}

export default function AuthScreen() {
  const setupNeeded = useAuth((s) => s.setupNeeded)
  const error = useAuth((s) => s.error)
  const storeSignIn = useAuth((s) => s.signIn)
  const adopt = useAuth((s) => s.adopt)
  const clearError = useAuth((s) => s.clearError)

  const [inviteToken] = useState(readInviteToken)
  const mode: Mode = inviteToken ? 'invite' : setupNeeded ? 'setup' : 'signin'

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const firstFieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // The token is held in state above; the address bar no longer needs it.
  useEffect(() => {
    if (inviteToken) clearInviteFromUrl()
  }, [inviteToken])

  const message = localError ?? error

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setLocalError(null)
    clearError()

    if (mode !== 'signin' && password !== confirm) {
      setLocalError('Those two passwords are not the same.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        await storeSignIn(email.trim(), password)
      } else if (mode === 'setup') {
        const { user } = await createFirstAdmin({
          setupToken: setupToken.trim(),
          email: email.trim(),
          name: name.trim(),
          password,
        })
        adopt(user)
      } else {
        const { user } = await acceptInvite(inviteToken, password)
        adopt(user)
      }
    } catch (err) {
      setLocalError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    signin: {
      icon: <GraduationCap aria-hidden="true" />,
      title: 'Sign in to Quoin',
      blurb: 'Your courses are waiting where you left them.',
      action: 'Sign in',
    },
    setup: {
      icon: <ShieldCheck aria-hidden="true" />,
      title: 'Set up Quoin',
      blurb:
        'Nobody has an account on this instance yet. Create the first administrator — they can invite everyone else.',
      action: 'Create administrator',
    },
    invite: {
      icon: <KeyRound aria-hidden="true" />,
      title: 'Choose a password',
      blurb: 'You have been invited to Quoin. Pick a password and you are in.',
      action: 'Set password and sign in',
    },
  }[mode]

  return (
    <div className="auth chrome-island">
      <main className="auth__card">
        <div className="auth__mark">{copy.icon}</div>
        <h1 className="auth__title">{copy.title}</h1>
        <p className="auth__blurb">{copy.blurb}</p>

        <form className="auth__form" onSubmit={submit} noValidate>
          {mode === 'setup' && (
            <Field
              label="Setup token"
              required
              hint="Printed in the server log when it started — look for “setupToken=”."
            >
              <Input
                ref={firstFieldRef}
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </Field>
          )}

          {mode !== 'invite' && (
            <Field label="Email" required>
              <Input
                ref={mode === 'signin' ? firstFieldRef : undefined}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>
          )}

          {mode === 'setup' && (
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
          )}

          <Field
            label={mode === 'signin' ? 'Password' : 'New password'}
            required
            hint={mode === 'signin' ? undefined : 'At least 10 characters. Length beats punctuation.'}
          >
            <Input
              ref={mode === 'invite' ? firstFieldRef : undefined}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
            />
          </Field>

          {mode !== 'signin' && (
            <Field label="Confirm password" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
          )}

          {message && (
            <p className="auth__error" role="alert">
              {message}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="auth__spinner" size={16} aria-hidden="true" /> Working…
              </>
            ) : (
              copy.action
            )}
          </Button>
        </form>

        {mode === 'signin' && (
          <p className="auth__foot">
            No account? Quoin has no public sign-up — ask an administrator of this instance
            to invite you.
          </p>
        )}
      </main>
    </div>
  )
}
