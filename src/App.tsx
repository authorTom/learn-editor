import { Suspense, lazy, useEffect } from 'react'
import { useStore } from './store'
import { useAuth } from './auth/authStore'
import { ConfirmProvider, ToastProvider } from './ui'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'
import AuthScreen from './components/auth/AuthScreen'
import ConflictDialog from './components/ConflictDialog'

/**
 * The editor is the other half of the app, and it carries TipTap and
 * ProseMirror with it — around 375kB that the dashboard, which is where every
 * session starts, has no use for. Splitting here means the first screen loads
 * the dashboard alone and the editor arrives while a course is being opened,
 * which is already an asynchronous read from IndexedDB.
 */
const CourseEditor = lazy(() => import('./components/CourseEditor'))
import { startSync } from './sync/syncStore'

function Editor() {
  const course = useStore((s) => s.course)
  const loadCourseList = useStore((s) => s.loadCourseList)
  const seedExamples = useStore((s) => s.seedExamples)
  const closeCourse = useStore((s) => s.closeCourse)

  useEffect(() => {
    // Load the library first, then (on builds that opt in, e.g. the Docker
    // image) seed a fresh install with the exemplar course and templates.
    loadCourseList().then(() => {
      if (import.meta.env.VITE_SEED_EXAMPLES === 'true') seedExamples()
    })
  }, [loadCourseList, seedExamples])

  // Keyed on the course id so that opening a different course clears a crash
  // the previous one caused, rather than leaving the author stuck on the
  // error screen. `closeCourse` flushes the pending save before it unmounts,
  // which is what makes "Back to my courses" safe to offer.
  return (
    <>
      {course ? (
        <ErrorBoundary key={course.id} label="The course editor" onReset={closeCourse}>
          <Suspense fallback={<div className="boot" aria-busy="true" />}>
            <CourseEditor />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary label="The dashboard">
          <Dashboard />
        </ErrorBoundary>
      )}
      {/* Outside both boundaries: a conflict must still be answerable even if
          the screen behind it has crashed. */}
      <ConflictDialog />
    </>
  )
}

/**
 * Which app is this?
 *
 * `mode` is 'unknown' for exactly one request at boot, and nothing renders
 * until it resolves. That blank moment is deliberate: painting the dashboard
 * first and then covering it with a sign-in screen shows an author their
 * courses and takes them away again, which reads as data loss even though
 * nothing was lost.
 *
 * In 'local' mode — no server, or a server running with accounts off — the
 * editor renders directly and no account UI exists anywhere. That is the
 * original product, unchanged.
 */
function AppContent() {
  const mode = useAuth((s) => s.mode)
  const user = useAuth((s) => s.user)
  const init = useAuth((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  // Subscriptions only — safe to run once, and a no-op until someone signs in.
  useEffect(() => startSync(), [])

  if (mode === 'unknown') return <div className="boot" aria-busy="true" />
  if (mode === 'server' && !user) return <AuthScreen />
  return <Editor />
}

export default function App() {
  return (
    // Outside the providers as well as in: a crash inside ToastProvider or
    // ConfirmProvider would otherwise take the inner boundary down with it.
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
