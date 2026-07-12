import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Plus, Copy, Trash2, ArrowUp, ArrowDown, PaintBucket, BookmarkPlus,
  Palette, ClipboardPaste,
} from 'lucide-react'
import { useStore } from '../store'
import type { Asset, Block } from '../types'
import InsertMenu from './InsertMenu'
import SaveTemplateDialog from './SaveTemplateDialog'
import ImportContentDialog from './ImportContentDialog'
import LessonStyleDialog from './LessonStyleDialog'
import BlockEditor from './blocks/BlockEditor'
import { blockDefs } from '../blockDefaults'

const BG_PRESETS = [
  '#fef9c3', '#ffedd5', '#fee2e2', '#fce7f3', '#ede9fe', '#dbeafe', '#dcfce7', '#f1f5f9',
]

/** Approximate the player's background tokens inside the (always-light) editor canvas. */
function editorBg(bg: string | undefined, accent: string): string | undefined {
  if (!bg) return undefined
  if (bg === 'panel') return '#ffffff'
  if (bg === 'tint') return `color-mix(in srgb, ${accent} 10%, #ffffff)`
  return bg
}

function BgPicker({ block, onClose }: { block: Block; onClose: () => void }) {
  const updateBlock = useStore((s) => s.updateBlock)
  const accent = useStore((s) => s.course!.theme.primaryColor)

  function pick(bg: string) {
    updateBlock(block.id, { bg })
    onClose()
  }

  return (
    <div className="bg-pop" onClick={(e) => e.stopPropagation()}>
      <div className="bg-pop-row">
        <button className={'bg-swatch none' + (!block.bg ? ' sel' : '')} title="None" onClick={() => pick('')} />
        <button
          className={'bg-swatch' + (block.bg === 'panel' ? ' sel' : '')}
          style={{ background: '#ffffff' }}
          title="Panel — follows the theme's card colour"
          onClick={() => pick('panel')}
        />
        <button
          className={'bg-swatch' + (block.bg === 'tint' ? ' sel' : '')}
          style={{ background: `color-mix(in srgb, ${accent} 14%, #ffffff)` }}
          title="Accent tint — follows the theme's accent colour"
          onClick={() => pick('tint')}
        />
      </div>
      <div className="bg-pop-row">
        {BG_PRESETS.map((c) => (
          <button
            key={c}
            className={'bg-swatch' + (block.bg === c ? ' sel' : '')}
            style={{ background: c }}
            title={c}
            onClick={() => pick(c)}
          />
        ))}
        <input
          type="color"
          className="bg-custom"
          title="Custom colour"
          value={block.bg && block.bg.startsWith('#') ? block.bg : '#ffffff'}
          onChange={(e) => updateBlock(block.id, { bg: e.target.value })}
        />
      </div>
    </div>
  )
}

function BlockShell({
  block,
  index,
  count,
  selected,
  onSelect,
}: {
  block: Block
  index: number
  count: number
  selected: boolean
  onSelect: () => void
}) {
  const deleteBlock = useStore((s) => s.deleteBlock)
  const duplicateBlock = useStore((s) => s.duplicateBlock)
  const moveBlock = useStore((s) => s.moveBlock)
  const saveBlockTemplate = useStore((s) => s.saveBlockTemplate)
  const accent = useStore((s) => s.course!.theme.primaryColor)
  const [bgOpen, setBgOpen] = useState(false)
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
      className={'block-shell' + (selected ? ' selected' : '') + (isDragging ? ' dragging' : '')}
      onClick={onSelect}
    >
      <span className="block-type-tag">{label}</span>
      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn grip" title="Drag to reorder" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        <button
          className="icon-btn"
          title="Move up"
          disabled={index === 0}
          onClick={() => moveBlock(index, index - 1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="icon-btn"
          title="Move down"
          disabled={index === count - 1}
          onClick={() => moveBlock(index, index + 1)}
        >
          <ArrowDown size={14} />
        </button>
        <button
          className={'icon-btn' + (block.bg ? ' active' : '')}
          title="Background colour"
          onClick={() => setBgOpen((v) => !v)}
        >
          <PaintBucket size={14} />
        </button>
        <button className="icon-btn" title="Duplicate" onClick={() => duplicateBlock(block.id)}>
          <Copy size={14} />
        </button>
        <button
          className="icon-btn"
          title="Save to block library"
          onClick={() => setSavingTpl(true)}
        >
          <BookmarkPlus size={14} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete block"
          onClick={() => deleteBlock(block.id)}
        >
          <Trash2 size={14} />
        </button>
        {bgOpen && <BgPicker block={block} onClose={() => setBgOpen(false)} />}
      </div>
      <div className="block-inner" style={{ background: editorBg(block.bg, accent) }}>
        <BlockEditor block={block} />
      </div>
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

function InsertPoint({ onClick }: { onClick: () => void }) {
  return (
    <div className="insert-point">
      <span className="ip-line" />
      <button title="Insert block here" onClick={onClick}>
        <Plus size={14} />
      </button>
    </div>
  )
}

export default function LessonEditor() {
  const course = useStore((s) => s.course)!
  const lessonId = useStore((s) => s.lessonId)
  const updateLesson = useStore((s) => s.updateLesson)
  const addBlock = useStore((s) => s.addBlock)
  const moveBlock = useStore((s) => s.moveBlock)
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showStyle, setShowStyle] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const lesson = course.lessons.find((l) => l.id === lessonId)
  if (!lesson) return <main className="canvas" />

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !lesson) return
    const from = lesson.blocks.findIndex((b) => b.id === active.id)
    const to = lesson.blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) moveBlock(from, to)
  }

  function handleInsert(block: Block, assets?: Asset[]) {
    addBlock(block, insertAt ?? undefined, assets)
    setInsertAt(null)
    setSelectedId(block.id)
  }

  const styled = !!lesson.theme && Object.keys(lesson.theme).length > 0

  return (
    <main className="canvas" onClick={() => setSelectedId(null)}>
      <div className="canvas-inner">
        <div className="lesson-title-row">
          <input
            className="lesson-title-input"
            value={lesson.title}
            placeholder="Lesson title"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLesson(lesson.id, { title: e.target.value })}
          />
          <button
            className={'btn sm' + (styled ? ' primary' : '')}
            title="Style overrides for this lesson"
            onClick={(e) => {
              e.stopPropagation()
              setShowStyle(true)
            }}
          >
            <Palette size={13} /> {styled ? 'Styled' : 'Lesson style'}
          </button>
          <button
            className="btn sm"
            title="Paste Markdown or HTML and turn it into blocks"
            onClick={(e) => {
              e.stopPropagation()
              setShowImport(true)
            }}
          >
            <ClipboardPaste size={13} /> Import content
          </button>
        </div>
        <p className="canvas-hint">
          {lesson.blocks.length === 0
            ? 'This lesson is empty — add your first block below.'
            : 'Hover between blocks to insert · drag the handle to reorder'}
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={lesson.blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {lesson.blocks.map((b, i) => (
              <div key={b.id}>
                <InsertPoint onClick={() => setInsertAt(i)} />
                <BlockShell
                  block={b}
                  index={i}
                  count={lesson.blocks.length}
                  selected={selectedId === b.id}
                  onSelect={() => setSelectedId(b.id)}
                />
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <button className="add-block-cta" onClick={(e) => { e.stopPropagation(); setInsertAt(lesson.blocks.length) }}>
          <Plus size={17} /> Add block
        </button>
      </div>

      {insertAt !== null && (
        <InsertMenu onInsert={handleInsert} onClose={() => setInsertAt(null)} />
      )}
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
