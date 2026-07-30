import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import IconButton from './IconButton'

type ToastTone = 'info' | 'success' | 'error'

interface Toast {
  id: number
  tone: ToastTone
  message: ReactNode
  /** Optional single action, e.g. Undo. */
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: ReactNode, opts?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void
  success: (message: ReactNode) => void
  error: (message: ReactNode) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DEFAULT_DURATION = 5000
const ERROR_DURATION = 9000

const ICONS: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const tone = opts?.tone ?? 'info'
      const id = nextId.current++
      setToasts((list) => [...list, { id, tone, message, action: opts?.action }])
      const duration = opts?.duration ?? (tone === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), duration)
      )
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, { tone: 'success' }),
      error: (m) => show(m, { tone: 'error' }),
    }),
    [show]
  )

  const timersRef = timers
  useEffect(() => {
    const map = timersRef.current
    return () => map.forEach((t) => window.clearTimeout(t))
  }, [timersRef])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        // role="status" + aria-live polite: announced without stealing focus
        // or interrupting. Errors get assertive via the per-toast role below.
        <div className="ui-toasts" role="region" aria-label="Notifications">
          {toasts.map((t) => {
            const Icon = ICONS[t.tone]
            return (
              <div
                key={t.id}
                className={`ui-toast ui-toast--${t.tone}`}
                role={t.tone === 'error' ? 'alert' : 'status'}
                aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              >
                <Icon size={16} className="ui-toast__icon" aria-hidden="true" />
                <div className="ui-toast__message">{t.message}</div>
                {t.action && (
                  <button
                    type="button"
                    className="ui-toast__action"
                    onClick={() => {
                      t.action!.onClick()
                      dismiss(t.id)
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <IconButton
                  label="Dismiss"
                  icon={<X size={14} />}
                  size="sm"
                  variant="ghost"
                  hideTooltip
                  onClick={() => dismiss(t.id)}
                />
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
