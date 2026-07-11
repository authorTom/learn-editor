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
import { GripVertical, Plus, Copy, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import type { Block, BlockType } from '../types'
import InsertMenu, { createBlock } from './InsertMenu'
import BlockEditor from './blocks/BlockEditor'
import { blockDefs } from '../blockDefaults'

function BlockShell({
  block,
  selected,
  onSelect,
}: {
  block: Block
  selected: boolean
  onSelect: () => void
}) {
  const deleteBlock = useStore((s) => s.deleteBlock)
  const duplicateBlock = useStore((s) => s.duplicateBlock)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const label = blockDefs.find((d) => d.type === block.type)?.label ?? block.type

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={'block-shell' + (selected ? ' selected' : '') + (isDragging ? ' dragging' : '')}
      onClick={onSelect}
    >
      <span className="block-type-tag">{label}</span>
      <div className="block-tools" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn grip" title="Drag to reorder" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        <button className="icon-btn" title="Duplicate" onClick={() => duplicateBlock(block.id)}>
          <Copy size={14} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete block"
          onClick={() => deleteBlock(block.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="block-inner">
        <BlockEditor block={block} />
      </div>
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

  function handleInsert(type: BlockType) {
    const block = createBlock(type)
    addBlock(block, insertAt ?? undefined)
    setInsertAt(null)
    setSelectedId(block.id)
  }

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
    </main>
  )
}
