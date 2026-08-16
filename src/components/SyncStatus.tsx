import { AlertTriangle, Check, CloudOff, RefreshCw } from 'lucide-react'
import { useSync } from '../sync/syncStore'
import { useAuth } from '../auth/authStore'

/**
 * One line telling the author where their work currently exists.
 *
 * The dashboard has always said "stored in this browser", because that was the
 * whole truth. With a server it is half of it, and the half that is missing is
 * the reassuring half. This says the rest — and, more importantly, says when it
 * is *not* true: an author who has been offline for an hour should be able to
 * find that out by looking, not by losing a laptop.
 */

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export default function SyncStatus() {
  const mode = useAuth((s) => s.mode)
  const user = useAuth((s) => s.user)
  const status = useSync((s) => s.status)
  const lastSyncedAt = useSync((s) => s.lastSyncedAt)
  const message = useSync((s) => s.message)
  const syncAll = useSync((s) => s.syncAll)

  // Local mode has nothing to report that the dashboard does not already say.
  if (mode !== 'server' || !user) return null

  const view = {
    syncing: {
      icon: <RefreshCw size={12} className="syncstatus__spin" aria-hidden="true" />,
      text: 'Syncing…',
      tone: '',
    },
    offline: {
      icon: <CloudOff size={12} aria-hidden="true" />,
      text: lastSyncedAt ? `Offline · last synced ${ago(lastSyncedAt)}` : 'Offline · saved here',
      tone: ' is-warn',
    },
    error: {
      icon: <AlertTriangle size={12} aria-hidden="true" />,
      text: message ?? 'Sync problem',
      tone: ' is-warn',
    },
    idle: {
      icon: <Check size={12} aria-hidden="true" />,
      text: lastSyncedAt ? `Synced ${ago(lastSyncedAt)}` : 'Synced',
      tone: '',
    },
    off: { icon: null, text: '', tone: '' },
  }[status]

  if (!view.text) return null

  return (
    <button
      type="button"
      className={`syncstatus${view.tone}`}
      onClick={() => void syncAll()}
      title="Sync now"
    >
      {view.icon}
      <span>{view.text}</span>
    </button>
  )
}
