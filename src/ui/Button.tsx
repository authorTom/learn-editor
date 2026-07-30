import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Leading icon. Decorative — the button's text is the accessible name. */
  icon?: ReactNode
  /** Trailing element, e.g. a count badge or chevron. */
  trailing?: ReactNode
  /** Stretch to the width of the container. */
  block?: boolean
  /** Renders a pressed state and exposes it as aria-pressed. */
  pressed?: boolean
}

/**
 * The one button. `type` defaults to "button" because these live inside forms
 * often enough that an accidental submit is a real bug.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    trailing,
    block,
    pressed,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size}${block ? ' ui-btn--block' : ''}${
        pressed ? ' is-pressed' : ''
      } ${className}`.trim()}
      aria-pressed={pressed}
      {...rest}
    >
      {icon && (
        <span className="ui-btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children != null && <span className="ui-btn__label">{children}</span>}
      {trailing && <span className="ui-btn__trailing">{trailing}</span>}
    </button>
  )
})

export default Button
