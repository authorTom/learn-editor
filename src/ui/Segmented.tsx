import { useId, useRef, type ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when `label` is an icon or otherwise not plain text. */
  srLabel?: string
}

interface Props<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  block?: boolean
  className?: string
}

/**
 * Segmented control implemented as a real radiogroup.
 *
 * The previous `.seg` was a row of plain buttons with an `.active` class:
 * nothing told assistive tech the options were mutually exclusive, which one
 * was chosen, or that they formed a group, and arrow keys did nothing. This
 * follows the APG radiogroup pattern — one tab stop, arrows move *and* select.
 */
export default function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  block,
  className = '',
}: Props<T>) {
  const groupId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function move(delta: number) {
    const current = options.findIndex((o) => o.value === value)
    const next = (current + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        onChange(options[0].value)
        refs.current[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        onChange(options[options.length - 1].value)
        refs.current[options.length - 1]?.focus()
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      id={groupId}
      onKeyDown={onKeyDown}
      className={`ui-seg ui-seg--${size}${block ? ' ui-seg--block' : ''} ${className}`.trim()}
    >
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.srLabel}
            // Roving tabindex: the group is a single stop in the page order.
            tabIndex={selected ? 0 : -1}
            className={`ui-seg__opt${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
