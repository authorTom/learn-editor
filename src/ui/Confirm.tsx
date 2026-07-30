import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Button from './Button'
import { Dialog } from './Dialog'

interface ConfirmOptions {
  title: string
  /** What actually happens, in plain language. Say what is irreversible. */
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, for destructive actions. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Promise-based replacement for window.confirm().
 *
 * The native dialog was used for all ten destructive actions in the app. It
 * can't be styled, ignores the app's theme entirely, is announced as a browser
 * chrome prompt rather than part of the page, blocks the main thread, and on
 * some platforms offers a "prevent this page from creating more dialogs"
 * checkbox that permanently disables the app's confirmations.
 *
 * Usage mirrors the old call site closely:
 *   if (await confirm({ title: 'Delete lesson?', destructive: true })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Dialog
          size="sm"
          title={options.title}
          onClose={() => settle(false)}
          footer={
            <>
              <Button onClick={() => settle(false)}>{options.cancelLabel ?? 'Cancel'}</Button>
              <Button
                variant={options.destructive ? 'danger' : 'primary'}
                // Focus lands here, but Escape and the scrim both cancel, so
                // the safe path stays the cheap one.
                data-autofocus
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          {options.message && <p className="ui-confirm__message">{options.message}</p>}
        </Dialog>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
