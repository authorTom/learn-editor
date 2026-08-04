import { useRef, useState } from 'react'
import type { BlockSpace, BlockWidth } from '../types'

/**
 * Direct manipulation for the two block settings that are purely spatial.
 *
 * Width and spacing were inspector-only: pick a word in a side panel, then look
 * back at the canvas to find out what it did. They are the settings where that
 * gap hurts most, because both are *about* size — the control and its result
 * were in different places and different units.
 *
 * So the block grows its own handles when selected: pull the edge to widen,
 * pull the bar underneath to open up the gap. Both snap to the same three stops
 * the inspector offers, and both report the stop they are on while dragging, so
 * the discrete vocabulary is never in doubt.
 *
 * The inspector keeps both controls. This is an addition, not a replacement:
 * dragging is faster once you know it is there, and a named radio group is
 * still the thing that is discoverable, screen-readable and precise. The
 * handles carry `role="slider"` and answer to arrow keys for the same reason —
 * a drag affordance that only works with a mouse would be a step backwards from
 * what the inspector already does properly.
 */

const WIDTHS: BlockWidth[] = ['normal', 'wide', 'full']
const SPACES: BlockSpace[] = ['tight', 'normal', 'loose']

const WIDTH_LABEL: Record<BlockWidth, string> = {
  normal: 'Column',
  wide: 'Wide',
  full: 'Full bleed',
}
const SPACE_LABEL: Record<BlockSpace, string> = {
  tight: 'Tight',
  normal: 'Normal',
  loose: 'Loose',
}

/** Pointer travel per step. Wide enough that a twitch doesn't change anything,
    short enough that the full range is one comfortable gesture. */
const WIDTH_STEP_PX = 70
const SPACE_STEP_PX = 34

interface DragState {
  origin: number
  startIndex: number
}

function useStepDrag<T>(
  steps: readonly T[],
  current: T,
  fallback: T,
  stepPx: number,
  axis: 'x' | 'y',
  sign: 1 | -1,
  onChange: (v: T) => void
) {
  const drag = useRef<DragState | null>(null)
  const [live, setLive] = useState<T | null>(null)

  const index = Math.max(0, steps.indexOf(current ?? fallback))

  function clampTo(next: number): T {
    return steps[Math.min(steps.length - 1, Math.max(0, next))]
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { origin: axis === 'x' ? e.clientX : e.clientY, startIndex: index }
    setLive(steps[index])
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return
    const delta = (axis === 'x' ? e.clientX : e.clientY) - drag.current.origin
    const next = clampTo(drag.current.startIndex + Math.round((delta * sign) / stepPx))
    setLive(next)
    if (next !== current) onChange(next)
  }

  function end(e: React.PointerEvent<HTMLElement>) {
    if (!drag.current) return
    drag.current = null
    setLive(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const fwd = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    let next: T | null = null
    if (e.key === fwd) next = clampTo(index + 1)
    else if (e.key === back) next = clampTo(index - 1)
    else if (e.key === 'Home') next = steps[0]
    else if (e.key === 'End') next = steps[steps.length - 1]
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    if (next !== current) onChange(next)
  }

  return {
    index,
    dragging: live !== null,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
  }
}

export function WidthHandles({
  width,
  onChange,
}: {
  width: BlockWidth | undefined
  onChange: (w: BlockWidth) => void
}) {
  const current = width ?? 'normal'
  const left = useStepDrag(WIDTHS, current, 'normal', WIDTH_STEP_PX, 'x', -1, onChange)
  const right = useStepDrag(WIDTHS, current, 'normal', WIDTH_STEP_PX, 'x', 1, onChange)
  const dragging = left.dragging || right.dragging

  const common = {
    role: 'slider' as const,
    tabIndex: 0,
    'aria-valuemin': 0,
    'aria-valuemax': WIDTHS.length - 1,
    'aria-valuenow': WIDTHS.indexOf(current),
    'aria-valuetext': WIDTH_LABEL[current],
  }

  return (
    <>
      <span
        {...common}
        {...left.handlers}
        aria-label="Block width"
        className={'blk-handle blk-handle--w blk-handle--left' + (dragging ? ' is-dragging' : '')}
      />
      <span
        {...common}
        {...right.handlers}
        aria-label="Block width"
        className={'blk-handle blk-handle--w blk-handle--right' + (dragging ? ' is-dragging' : '')}
      />
      {dragging && <span className="blk-readout blk-readout--w">{WIDTH_LABEL[current]}</span>}
    </>
  )
}

export function SpaceHandle({
  space,
  onChange,
}: {
  space: BlockSpace | undefined
  onChange: (s: BlockSpace) => void
}) {
  const current = space ?? 'normal'
  const drag = useStepDrag(SPACES, current, 'normal', SPACE_STEP_PX, 'y', 1, onChange)

  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label="Space after block"
      aria-valuemin={0}
      aria-valuemax={SPACES.length - 1}
      aria-valuenow={SPACES.indexOf(current)}
      aria-valuetext={SPACE_LABEL[current]}
      {...drag.handlers}
      className={'blk-handle blk-handle--space' + (drag.dragging ? ' is-dragging' : '')}
    >
      {drag.dragging && <span className="blk-readout">{SPACE_LABEL[current]}</span>}
    </span>
  )
}
