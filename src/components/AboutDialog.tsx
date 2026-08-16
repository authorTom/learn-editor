import { useEffect, useState } from 'react'
import { Dialog } from '../ui'
import { useAuth } from '../auth/authStore'

/**
 * Which Learn Editor this is, and where the work is being kept.
 *
 * The second half is the reason this exists rather than being a version number
 * in a corner. The app runs two ways — everything in this browser, or synced to
 * a server — and an author is entitled to a straight answer about which one
 * they are in before they decide whether their only copy is safe.
 *
 * The bundle's version is baked in from package.json at build time; the
 * server's comes from the same field at boot. They are shown separately, so a
 * half-finished deploy (new bundle, old container, or a stale cached shell) is
 * visible here rather than being a mystery about which fix landed.
 */

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const mode = useAuth((s) => s.mode)
  const server = useAuth((s) => s.server)
  const user = useAuth((s) => s.user)

  const [usage, setUsage] = useState<string | null>(null)
  useEffect(() => {
    if (!navigator.storage?.estimate) return
    let live = true
    navigator.storage.estimate().then((e) => {
      if (!live || e.usage == null) return
      const mb = e.usage / 1024 / 1024
      setUsage(mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`)
    })
    return () => { live = false }
  }, [])

  const appVersion = __APP_VERSION__
  const serverVersion = server?.version
  const mismatch = !!serverVersion && serverVersion !== appVersion

  return (
    <Dialog open onClose={onClose} title="About Learn Editor" size="sm">
      <dl className="about">
        <dt>Version</dt>
        <dd>{appVersion}</dd>

        {serverVersion && (
          <>
            <dt>Server</dt>
            <dd>
              {serverVersion}
              {mismatch && (
                <span className="about__warn">
                  {' '}
                  — different from this page. Reload to pick up the new build.
                </span>
              )}
            </dd>
          </>
        )}

        <dt>Courses are kept</dt>
        <dd>
          {mode === 'server' && user
            ? 'in this browser, and synced to the server signed in below'
            : 'in this browser only — nothing is uploaded anywhere'}
        </dd>

        {mode === 'server' && user && (
          <>
            <dt>Signed in as</dt>
            <dd>
              {user.email} ({user.role === 'admin' ? 'administrator' : 'author'})
            </dd>
          </>
        )}

        {usage && (
          <>
            <dt>Used in this browser</dt>
            <dd>{usage}</dd>
          </>
        )}
      </dl>

      <p className="about__foot">
        SCORM 1.2 and 2004 (4th Ed.) authoring. The preview, the exported package and this editor's
        canvas all share one renderer, so what you see here is what the LMS shows.
      </p>
    </Dialog>
  )
}
