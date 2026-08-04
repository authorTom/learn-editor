import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Trash2, ArrowUp, ArrowDown, BookmarkPlus, SlidersHorizontal,
  Palette, ClipboardPaste,
} from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { lessonIsDark, lessonVars } from '../theme'
import { Button, IconButton, Popover, useClickOutside, useEscape } from '../ui'
import type { Asset, Block } from '../types'
import BlockPicker from './BlockPicker'
import SaveTemplateDialog from './SaveTemplateDialog'
import ImportContentDialog from './ImportContentDialog'
import LessonStyleDialog from './LessonStyleDialog'
import BlockEditor from './blocks/BlockEditor'
import { SpaceHandle, WidthHandles } from './BlockHandles'
import { blockDefs } from '../blockDefaults'
import { dragInstructions, makeAnnouncements } from '../dndA11y'

/**
 * Resolve a block background to a real colour.
 *
 * 'panel' and 'tint' are theme-relative, and now resolve against the course's
 * own tokens — which the canvas element supplies — instead of the hardcoded
 * #ffffff the previous `editorBg()` used. That single change is why a Midnight
 * or Sand course finally looks like itself while you author it.
 */
function blockBg(bg: string | undefined): string | undefined {
  if (!bg) return undefined
  if (bg === 'panel') return 'var(--bg)'
  if (bg === 'tint') return 'var(--accent-soft)'
  return bg
}

/** The backgrounds worth reaching for without opening the inspector: the two
    theme-relative fills, plus the pastels. Deliberately the same values the
    inspector offers, so the two controls can never disagree — the inspector
    additionally does custom colour, which needs a picker and a contrast
    readout and so stays there. */
const BG_QUICK: { v: string; label: string }[] = [
  { v: '', label: 'No background' },
  { v: 'panel', label: 'Panel' },
  { v: 'tint', label: 'Accent tint' },
  { v: '#fef9c3', label: 'Yellow' },
  { v: '#ffedd5', label: 'Orange' },
  { v: '#fee2e2', label: 'Red' },
  { v: '#fce7f3', label: 'Pink' },
  { v: '#ede9fe', label: 'Violet' },
  { v: '#dbeafe', label: 'Blue' },
  { v: '#dcfce7', label: 'Green' },
  { v: '#f1f5f9', label: 'Slate' },
]

function BlockShell({
  block,
  index,
  count,
  selected,
  onSelect,
  onSlashInsert,
}: {
  block: Block
  index: number
  count: number
  selected: boolean
  onSelect: () => void
  onSlashInsert: (block: Block, at: number, assets?: Asset[]) => void
}) {
  const deleteBlock = useStore((s) => s.deleteBlock)
  const moveBlock = useStore((s) => s.moveBlock)
  const updateBlock = useStore((s) => s.updateBlock)
  const saveBlockTemplate = useStore((s) => s.saveBlockTemplate)
  const openDock = useUi((s) => s.openDock)
  const slashFor = useUi((s) => s.slashPickerFor)
  const closeSlashPicker = useUi((s) => s.closeSlashPicker)
  const [savingTpl, setSavingTpl] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const label = blockDefs.find((d) => d.type === block.type)?.label ?? block.type

  return (
    <div
      ref={setNodeRef}
      id={'blk-' + block.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Width and space are echoed on the canvas, not just applied in the
      // player: choosing "full" and seeing nothing move until you open Preview
      // is how you end up with a lesson full of settings you never verified.
      className={
        'block' +
        (block.width && block.width !== 'normal' ? ' w-' + block.width : '') +
        (block.space && block.space !== 'normal' ? ' sp-' + block.space : '') +
        (selected ? ' is-selected' : '') +
        (isDragging ? ' is-dragging' : '')
      }
      // A group, not a button: the block contains its own controls and text
      // fields, so it must not swallow their semantics.
      role="group"
      aria-label={`${label} block, ${index + 1} of ${count}`}
      // Must stop here: the canvas clears the selection on click, so without
      // this the block's own click bubbles up and immediately deselects it.
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onFocusCapture={onSelect}
    >
      <div className="block__tools" onClick={(e) => e.stopPropagation()}>
        <button
          className="block__grip"
          aria-label={`Reorder ${label} block`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="block__type">{label}</span>
        {/* Background is one tap from the block itself, not just four sections
            down the inspector — it is the setting authors reach for most and
            the one whose result is instantly obvious, so it earns its place. */}
        <Popover
          side="bottom"
          align="center"
          label="Block background"
          noAutoFocus
          trigger={
            <IconButton
              label="Block background"
              size="sm"
              icon={
                <span
                  className="blk-bg-dot"
                  style={{ background: blockBg(block.bg) ?? 'transparent' }}
                  aria-hidden="true"
                />
              }
            />
          }
        >
          <div className="blk-bg-menu">
            {BG_QUICK.map((o) => (
              <button
                key={o.v}
                type="button"
                className={'blk-bg-opt' + ((block.bg ?? '') === o.v ? ' sel' : '')}
                aria-label={o.label}
                aria-pressed={(block.bg ?? '') === o.v}
                title={o.label}
                onClick={() => updateBlock(block.id, { bg: o.v })}
              >
                <span
                  className="blk-bg-dot"
                  style={{ background: blockBg(o.v) ?? 'transparent' }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </Popover>
        <span className="block__tools-spacer" />
        <IconButton
          label="Move up"
          size="sm"
          icon={<ArrowUp size={14} />}
          disabled={index === 0}
          onClick={() => moveBlock(index, index - 1)}
        />
        <IconButton
          label="Move down"
          size="sm"
          icon={<ArrowDown size={14} />}
          disabled={index === count - 1}
          onClick={() => moveBlock(index, index + 1)}
        />
        {/* Background, duplicate and delete now live in the inspector, which is
            where every other per-block setting moved. The toolbar keeps only
            what is about position in the lesson, plus saving to the library. */}
        <IconButton
          label="Save to block library"
          size="sm"
          icon={<BookmarkPlus size={14} />}
          onClick={() => setSavingTpl(true)}
        />
        <IconButton
          label="Block options"
          size="sm"
          icon={<SlidersHorizontal size={14} />}
          onClick={() => {
            onSelect()
            openDock('inspector')
          }}
        />
        <IconButton
          label="Delete block"
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={() => deleteBlock(block.id)}
        />
      </div>

      <div className="block__body" style={{ background: blockBg(block.bg) }}>
        <BlockEditor block={block} />
        {selected && (
          <WidthHandles width={block.width} onChange={(width) => updateBlock(block.id, { width })} />
        )}
      </div>
      {selected && (
        <SpaceHandle space={block.space} onChange={(space) => updateBlock(block.id, { space })} />
      )}

      {/* Slash-command picker, anchored under the block that triggered it. */}
      {slashFor === block.id && (
        <SlashPicker
          onClose={closeSlashPicker}
          onInsert={(newBlock, assets) => onSlashInsert(newBlock, index + 1, assets)}
        />
      )}

      {savingTpl && (
        <div onClick={(e) => e.stopPropagation()}>
          <SaveTemplateDialog
            heading={`Save ${label.toLowerCase()} to library`}
            hint="Saved blocks appear at the top of the Add-a-block menu in every course, content and styling included."
            defaultName={label}
            onSave={(name) => saveBlockTemplate(name, block)}
            onClose={() => setSavingTpl(false)}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The "/" picker. Rendered in flow beneath its block rather than portalled, so
 * it tracks the block as the canvas scrolls — which means it has to bring its
 * own dismissal behaviour, since it is not inside a Popover.
 */
function SlashPicker({
  onClose,
  onInsert,
}: {
  onClose: () => void
  onInsert: (block: Block, assets?: Asset[]) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose)
  useClickOutside(ref, onClose)

  return (
    <div className="slash-anchor" onClick={(e) => e.stopPropagation()}>
      <div className="ui-popover slash-pop" ref={ref}>
        <BlockPicker onClose={onClose} onInsert={onInsert} />
      </div>
    </div>
  )
}

/** Anchored insert affordance. The block picker opens as a popover attached to
    this point rather than a full-screen modal, so you keep sight of where the
    block is about to land. */
function InsertPoint({
  index,
  onInsert,
}: {
  index: number
  onInsert: (block: Block, at: number, assets?: Asset[]) => void
}) {
  return (
    <div className="insert-point">
      <span className="insert-point__line" aria-hidden="true" />
      <Popover
        label="Add a block"
        align="center"
        className="picker-pop"
        trigger={
          <button
            className="insert-point__btn"
            aria-label={`Insert a block before block ${index + 1}`}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        }
      >
        {({ close }) => (
          <BlockPicker
            onClose={close}
            onInsert={(block, assets) => onInsert(block, index, assets)}
          />
        )}
      </Popover>
    </div>
  )
}

export default function LessonEditor() {
  const course = useStore((s) => s.course)!
  const lessonId = useStore((s) => s.lessonId)
  const updateLesson = useStore((s) => s.updateLesson)
  const addBlock = useStore((s) => s.addBlock)
  const moveBlock = useStore((s) => s.moveBlock)
  const duplicateBlock = useStore((s) => s.duplicateBlock)
  const deleteBlock = useStore((s) => s.deleteBlock)

  const selectedId = useUi((s) => s.selectedBlockId)
  const selectBlock = useUi((s) => s.selectBlock)

  const [showImport, setShowImport] = useState(false)
  const [showStyle, setShowStyle] = useState(false)
  const canvasRef = useRef<HTMLElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Without this, reordering was mouse-only — a WCAG 2.1.1 failure. The grip
    // is now a real button: focus it, Space to lift, arrows to move, Space to drop.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const lesson = course.lessons.find((l) => l.id === lessonId)

  const blocks = lesson?.blocks ?? []
  const selectedIndex = blocks.findIndex((b) => b.id === selectedId)

  /**
   * Block-level keyboard commands.
   *
   * Bound to the window rather than the canvas element: selecting a block does
   * not move DOM focus (doing so would yank the caret out of a rich-text field
   * the moment you clicked into it), so there is no focused element inside the
   * canvas for the event to bubble from.
   *
   * Two guards keep it out of the way: nothing fires while the caret is in a
   * field, and nothing fires while a modal layer is open.
   */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (document.querySelector('[role="dialog"]')) return

      const el = document.activeElement as HTMLElement | null
      const typing =
        !!el &&
        (el.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
          !!el.closest('.tiptap'))

      // Progressive escape: the first Escape leaves the field but keeps the
      // block selected, the second clears the selection. Without the first
      // step there is no keyboard route out of a rich-text block back to
      // block-level commands.
      if (e.key === 'Escape') {
        if (typing) el?.blur()
        else selectBlock(null)
        return
      }
      if (typing || selectedIndex < 0) return

      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'ArrowDown' && !mod) {
        e.preventDefault()
        selectBlock(blocks[Math.min(selectedIndex + 1, blocks.length - 1)]?.id ?? null)
      } else if (e.key === 'ArrowUp' && !mod) {
        e.preventDefault()
        selectBlock(blocks[Math.max(selectedIndex - 1, 0)]?.id ?? null)
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateBlock(blocks[selectedIndex].id)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const next = blocks[selectedIndex + 1]?.id ?? blocks[selectedIndex - 1]?.id ?? null
        deleteBlock(blocks[selectedIndex].id)
        selectBlock(next)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocks, selectedIndex, selectBlock, duplicateBlock, deleteBlock])

  // Keep the selected block in view when it changes by keyboard.
  useEffect(() => {
    if (!selectedId) return
    document
      .getElementById('blk-' + selectedId)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  if (!lesson) return <main className="canvas" />

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !lesson) return
    const from = lesson.blocks.findIndex((b) => b.id === active.id)
    const to = lesson.blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) moveBlock(from, to)
  }

  function handleInsert(block: Block, at: number, assets?: Asset[]) {
    addBlock(block, at, assets)
    selectBlock(block.id)
  }

  const styled = !!lesson.theme && Object.keys(lesson.theme).length > 0

  return (
    <main
      className="canvas"
      ref={canvasRef}
      tabIndex={-1}
      onClick={() => selectBlock(null)}
      // The course's own theme, from the same derivation the exported player
      // uses. `data-dark` lets editor affordances flip without reading colours.
      style={lessonVars(course, lesson) as React.CSSProperties}
      data-dark={lessonIsDark(course, lesson) || undefined}
    >
      <div className="canvas-inner">
        <div className="lesson-head">
          <input
            className="lesson-title"
            value={lesson.title}
            aria-label="Lesson title"
            placeholder="Lesson title"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLesson(lesson.id, { title: e.target.value })}
          />
          <div className="lesson-head__actions" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={styled ? 'subtle' : 'secondary'}
              icon={<Palette size={13} />}
              onClick={() => setShowStyle(true)}
            >
              {styled ? 'Styled' : 'Lesson style'}
            </Button>
            <Button
              size="sm"
              icon={<ClipboardPaste size={13} />}
              onClick={() => setShowImport(true)}
            >
              Import content
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: makeAnnouncements('Block'),
            screenReaderInstructions: dragInstructions,
          }}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((b, i) => (
              <div key={b.id}>
                <InsertPoint index={i} onInsert={handleInsert} />
                <BlockShell
                  block={b}
                  index={i}
                  count={blocks.length}
                  selected={selectedId === b.id}
                  onSelect={() => selectBlock(b.id)}
                  onSlashInsert={handleInsert}
                />
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <div onClick={(e) => e.stopPropagation()}>
          <Popover
            label="Add a block"
            align="center"
            className="picker-pop"
            trigger={
              <button className="add-block">
                <Plus size={17} aria-hidden="true" />
                {blocks.length === 0 ? 'Add your first block' : 'Add block'}
              </button>
            }
          >
            {({ close }) => (
              <BlockPicker
                onClose={close}
                onInsert={(block, assets) => handleInsert(block, blocks.length, assets)}
              />
            )}
          </Popover>
        </div>
      </div>

      {showImport && (
        <div onClick={(e) => e.stopPropagation()}>
          <ImportContentDialog onClose={() => setShowImport(false)} />
        </div>
      )}
      {showStyle && (
        <div onClick={(e) => e.stopPropagation()}>
          <LessonStyleDialog lesson={lesson} onClose={() => setShowStyle(false)} />
        </div>
      )}
    </main>
  )
}
