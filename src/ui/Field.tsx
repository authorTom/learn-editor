import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
}
const FieldContext = createContext<FieldContextValue | null>(null)

interface FieldProps {
  label: ReactNode
  /** Helper text under the control. Wired to the control via aria-describedby. */
  hint?: ReactNode
  /** Error text. Replaces the hint and sets aria-invalid on the control. */
  error?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}

/**
 * Label + control + hint/error, with the plumbing that makes them one thing to
 * assistive tech: a real <label for>, and aria-describedby pointing at whichever
 * of hint/error is showing.
 *
 * The app previously wrote `<label>Foo</label>` as a *sibling* of its input in
 * every dialog, which associates nothing — clicking the label didn't focus the
 * field and a screen reader announced the input unlabelled.
 */
export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={`ui-field ${className}`.trim()}>
        <label className="ui-field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="ui-field__error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="ui-field__hint">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

/** Pull id/describedby/invalid off the surrounding Field, if there is one. */
function useFieldProps() {
  const ctx = useContext(FieldContext)
  if (!ctx) return {}
  return {
    id: ctx.id,
    'aria-describedby': ctx.describedBy,
    'aria-invalid': ctx.invalid || undefined,
  }
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`ui-input ${className}`.trim()} {...useFieldProps()} {...rest} />
  }
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea ref={ref} className={`ui-input ui-textarea ${className}`.trim()} {...useFieldProps()} {...rest} />
    )
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select ref={ref} className={`ui-input ui-select ${className}`.trim()} {...useFieldProps()} {...rest}>
        {children}
      </select>
    )
  }
)

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: ReactNode
}

/** Checkbox with its label and hint inside the <label>, so the whole row is
    one hit target rather than a 13px box. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className = '', ...rest },
  ref
) {
  const hintId = useId()
  return (
    <label className={`ui-checkbox ${className}`.trim()}>
      <input
        ref={ref}
        type="checkbox"
        className="ui-checkbox__input"
        aria-describedby={hint ? hintId : undefined}
        {...rest}
      />
      <span className="ui-checkbox__text">
        <span className="ui-checkbox__label">{label}</span>
        {hint && (
          <span id={hintId} className="ui-checkbox__hint">
            {hint}
          </span>
        )}
      </span>
    </label>
  )
})

export default Field
