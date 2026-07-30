import type { ReactNode } from 'react'
import { Checkbox, Input, Segmented, type SegmentedOption } from '../../ui'

/**
 * Field primitives for the block inspector.
 *
 * The inspector lives in the dock, which keeps chrome tokens, so these render
 * as normal editor UI rather than adopting the course theme like the canvas
 * does.
 *
 * Everything here is stacked label-above-control rather than the old inline
 * `.blk-options` row: a 320px column has no room for a horizontal label + a
 * four-way segmented control, and stacking is what lets these be real
 * <label for> pairs instead of loose <span>s.
 */

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="insp-group">
      <h3 className="insp-group__title">{title}</h3>
      {children}
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="insp-row">
      <span className="insp-row__label">{label}</span>
      {children}
      {hint && <p className="insp-row__hint">{hint}</p>}
    </div>
  )
}

export function SegRow<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  hint?: ReactNode
}) {
  return (
    <Row label={label} hint={hint}>
      <Segmented label={label} size="sm" block value={value} options={options} onChange={onChange} />
    </Row>
  )
}

export function TextRow({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: ReactNode
}) {
  return (
    <label className="insp-row">
      <span className="insp-row__label">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="insp-row__hint">{hint}</p>}
    </label>
  )
}

export function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  hint?: ReactNode
}) {
  return (
    <label className="insp-row">
      <span className="insp-row__label">{label}</span>
      <span className="insp-row__inline">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isNaN(n)) return
            onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
          }}
        />
        {suffix && <span className="insp-row__suffix">{suffix}</span>}
      </span>
      {hint && <p className="insp-row__hint">{hint}</p>}
    </label>
  )
}

export function CheckRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Checkbox
      label={label}
      hint={hint}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

/** Shown for blocks whose every setting is content, edited on the canvas. */
export function NoOptions({ what }: { what: string }) {
  return <p className="insp-empty">{what} is edited directly on the canvas — it has no extra options.</p>
}
