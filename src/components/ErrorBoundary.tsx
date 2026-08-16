import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '../ui'

/**
 * The last line of defence between a thrown render error and a white screen.
 *
 * This matters more here than in most apps. The course lives in the browser, so
 * an author who sees the interface vanish has no server-side copy to reassure
 * themselves with, and their honest reading of a blank page is "I have lost the
 * morning's work". They have not: autosave commits 400ms after a keystroke, and
 * the crash is in the *rendering*, not in what was written. Saying so, on the
 * screen, at the moment it happens, is the whole job.
 *
 * Deliberately a class component — `componentDidCatch` has no hook equivalent.
 */

interface Props {
  children: ReactNode
  /** Shown above the message, e.g. "The lesson canvas". */
  label?: string
  /** Lets the shell recover to a known-good screen instead of only reloading. */
  onReset?: () => void
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry to send it to — by design, nothing leaves the machine — so
    // the console is the record. Keep the component stack: it names the block
    // type that failed, which is the first thing a bug report needs.
    console.error('Learn Editor crashed while rendering.', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash chrome-island" role="alert">
        <div className="crash__card">
          <AlertTriangle className="crash__icon" aria-hidden="true" />
          <h1 className="crash__title">
            {this.props.label ?? 'Learn Editor'} stopped responding
          </h1>
          <p className="crash__body">
            Your course is safe. Everything you typed was saved to this browser as you
            worked — this is a display fault, not a lost draft.
          </p>
          <pre className="crash__detail">{error.message || String(error)}</pre>
          <div className="crash__actions">
            {this.props.onReset && (
              <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={this.reset}>
                Back to my courses
              </Button>
            )}
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload the editor
            </Button>
          </div>
          <p className="crash__hint">
            If it happens again, the browser console holds the details worth reporting.
          </p>
        </div>
      </div>
    )
  }
}
