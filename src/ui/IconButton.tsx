import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import Tooltip from './Tooltip'

type Variant = 'default' | 'danger' | 'accent' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'children'> {
  /**
   * Required. Becomes both the accessible name and the tooltip.
   *
   * This is the whole point of the component: the app previously had 73 icon
   * buttons whose only label was a `title` attribute, which screen readers
   * treat as optional and touch devices never surface at all. Making the prop
   * mandatory means an unlabelled icon button is a type error, not a review
   * finding.
   */
  label: string
  icon: ReactNode
  variant?: Variant
  size?: Size
  /** Suppress the tooltip where one would be noisy (e.g. inside a menu row). */
  hideTooltip?: boolean
  /** Renders a pressed/active state and exposes it as aria-pressed. */
  pressed?: boolean
  /** Keyboard hint appended to the tooltip, e.g. "⌘Z". */
  shortcut?: string
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = 'default',
    size = 'md',
    hideTooltip,
    pressed,
    shortcut,
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={`ui-iconbtn ui-iconbtn--${variant} ui-iconbtn--${size}${
        pressed ? ' is-pressed' : ''
      } ${className}`.trim()}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )

  if (hideTooltip || rest.disabled) return button
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  )
})

export default IconButton
