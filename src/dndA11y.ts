import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'

/**
 * Screen-reader support for keyboard drag-and-drop.
 *
 * dnd-kit ships defaults, but they announce opaque ids ("Draggable item
 * a1b2c3 was moved"). These read the item's accessible name and its 1-based
 * position instead, which is the only form that means anything to someone who
 * cannot see the list reorder.
 */

function nameOf(id: string | number): string {
  const el = document.getElementById('blk-' + id) ?? document.querySelector(`[data-dnd-id="${id}"]`)
  return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? 'item'
}

export function makeAnnouncements(itemNoun: string): Announcements {
  return {
    onDragStart: ({ active }) =>
      `Picked up ${itemNoun} ${nameOf(active.id)}. Use the arrow keys to move it, space to drop, escape to cancel.`,
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? `${itemNoun} ${nameOf(active.id)} is now over ${nameOf(over.id)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${itemNoun} ${nameOf(active.id)} was dropped onto ${nameOf(over.id)}.`
        : `${itemNoun} ${nameOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Moving ${itemNoun} ${nameOf(active.id)} was cancelled. It returned to its original position.`,
  }
}

export const dragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder, press space or enter to pick this up, use the arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.',
}
