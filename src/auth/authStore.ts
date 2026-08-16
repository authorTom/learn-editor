import { create } from 'zustand'
import {
  ApiError, fetchConfig, fetchMe, signIn as apiSignIn, signOut as apiSignOut,
  type AccountUser, type ServerConfig,
} from './api'

/**
 * Who is signed in, and — first — whether that question even applies.
 *
 * The app has two shapes and picks one at boot:
 *
 *   local   there is no server (or it runs with accounts off). Courses live in
 *           this browser, nothing is uploaded, and no sign-in is shown. This is
 *           the original product and still the default for `npm run dev`.
 *   server  accounts are on. The app gates on sign-in, and courses sync.
 *
 * `mode` starts as 'unknown' and the shell shows nothing until it resolves,
 * which takes one request. Rendering the dashboard first and then throwing a
 * sign-in screen over it would show an author their courses and snatch them
 * away, which reads as data loss even though nothing was lost.
 */

export type AuthMode = 'unknown' | 'local' | 'server'

interface AuthState {
  mode: AuthMode
  /** Null in local mode, or when signed out. */
  user: AccountUser | null
  /** What the server said about itself; null in local mode. */
  server: ServerConfig | null
  /** No accounts exist yet — show first-run setup rather than sign-in. */
  setupNeeded: boolean
  /** True while the boot request is in flight. */
  loading: boolean
  /** Set when signing in fails, cleared on the next attempt. */
  error: string | null

  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  /** Adopt a user returned by setup or invite acceptance, which sign in too. */
  adopt: (user: AccountUser) => void
  setUser: (user: AccountUser) => void
  clearError: () => void
  /** Called by the API layer when a request 401s, so one place handles expiry. */
  sessionExpired: () => void
}

export const useAuth = create<AuthState>((set, get) => ({
  mode: 'unknown',
  user: null,
  server: null,
  setupNeeded: false,
  loading: true,
  error: null,

  init: async () => {
    const config = await fetchConfig()

    // No server, or a server deliberately running without accounts. Either way
    // this is the local-first app, and nothing else here applies.
    if (!config || !config.auth.required) {
      set({ mode: 'local', server: config, user: null, loading: false, setupNeeded: false })
      return
    }

    if (config.auth.setupNeeded) {
      set({ mode: 'server', server: config, user: null, setupNeeded: true, loading: false })
      return
    }

    try {
      const { user } = await fetchMe()
      set({ mode: 'server', server: config, user, setupNeeded: false, loading: false })
    } catch (err) {
      // A 401 here is the ordinary signed-out case, not a failure worth
      // reporting: the sign-in screen is the answer to it.
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.warn('Could not read the current session.', err)
      }
      set({ mode: 'server', server: config, user: null, setupNeeded: false, loading: false })
    }
  },

  signIn: async (email, password) => {
    set({ error: null })
    try {
      const { user } = await apiSignIn(email, password)
      set({ user, error: null })
      return true
    } catch (err) {
      set({
        error:
          err instanceof ApiError
            ? err.message
            : 'Could not reach the server. Check your connection and try again.',
      })
      return false
    }
  },

  signOut: async () => {
    try {
      await apiSignOut()
    } catch {
      // Even if the server never heard us, drop the local session: the author
      // asked to be signed out, and appearing not to be is worse than a
      // server-side row outliving its cookie.
    }
    set({ user: null, error: null })
  },

  adopt: (user) => set({ user, setupNeeded: false, error: null }),
  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
  sessionExpired: () => {
    if (get().user) set({ user: null, error: 'Your session expired. Sign in again to carry on.' })
  },
}))

/** True when courses should sync — i.e. a server is present and someone is on it. */
export function syncEnabled(state: AuthState): boolean {
  return state.mode === 'server' && !!state.user
}
