import { useState } from 'react'
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
import { GripVertical, Plus, Copy, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, IconButton, useConfirm } from '../ui'
import { dragInstructions, makeAnnouncements } from '../dndA11y'
import type { Lesson } from '../types'

const LESSON_EMOJI = [
  '📄', '📚', '🎯', '💡', '🧭', '🔍', '🛠️', '⚙️',
  '🧪', '📊', '📈', '🗂️', '🎬', '🖼️', '🔒', '🛡️',
  '❤️', '⭐', '✅', '🚀', '🌍', '💬', '🧠', '🏆',
]

function OutlineItem({ lesson, index }: { lesson: Lesson; index: number }) {
  const { lessonId, selectLesson, updateLesson, deleteLesson, duplicateLesson, course } = useStore()
  const confirm = useConfirm()
  const [renaming, setRenaming] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  })

  const canDelete = (course?.lessons.length ?? 0) > 1

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={'outline-item' + (lesson.id === lessonId ? ' active' : '')}
      onClick={() => selectLesson(lesson.id)}
    >
      <button
        type="button"
        className="grip"
        aria-label={`Reorder ${lesson.title}`}
        data-dnd-id={lesson.id}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="o-icon"
        aria-label={`Change icon for ${lesson.title}`}
        aria-expanded={showEmoji}
        onClick={(e) => {
          e.stopPropagation()
          setShowEmoji((v) => !v)
        }}
      >
        {lesson.icon}
      </button>
      {renaming ? (
        <input
          className="o-rename"
          autoFocus
          defaultValue={lesson.title}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            updateLesson(lesson.id, { title: e.target.value.trim() || 'Untitled lesson' })
            setRenaming(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <span className="o-title" onDoubleClick={() => setRenaming(true)} title={lesson.title}>
          {index + 1}. {lesson.title}
        </span>
      )}
      <span className="o-actions" onClick={(e) => e.stopPropagation()}>
        <IconButton
          label={`Duplicate ${lesson.title}`}
          size="sm"
          icon={<Copy size={13} />}
          onClick={() => duplicateLesson(lesson.id)}
        />
        <IconButton
          label={`Delete ${lesson.title}`}
          size="sm"
          variant="danger"
          icon={<Trash2 size={13} />}
          disabled={!canDelete}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete "${lesson.title}"?`,
              message: `This removes the lesson and its ${lesson.blocks.length} block${
                lesson.blocks.length === 1 ? '' : 's'
              }. You can undo it with ⌘Z.`,
              confirmLabel: 'Delete lesson',
              destructive: true,
            })
            if (ok) deleteLesson(lesson.id)
          }}
        />
      </span>
      {showEmoji && (
        <div className="emoji-pop" onClick={(e) => e.stopPropagation()}>
          {LESSON_EMOJI.map((em) => (
            <button
              key={em}
              type="button"
              aria-label={`Use ${em} as the lesson icon`}
              onClick={() => {
                updateLesson(lesson.id, { icon: em })
                setShowEmoji(false)
              }}
            >
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OutlineSidebar() {
  const course = useStore((s) => s.course)!
  const addLesson = useStore((s) => s.addLesson)
  const moveLesson = useStore((s) => s.moveLesson)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Lessons were mouse-only to reorder before this — WCAG 2.1.1.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = course.lessons.findIndex((l) => l.id === active.id)
    const to = course.lessons.findIndex((l) => l.id === over.id)
    if (from >= 0 && to >= 0) moveLesson(from, to)
  }

  return (
    <aside className="outline">
      <div className="outline-head">
        <span>Course outline</span>
        <span>{course.lessons.length}</span>
      </div>
      <div className="outline-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: makeAnnouncements('Lesson'),
            screenReaderInstructions: dragInstructions,
          }}
        >
          <SortableContext
            items={course.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {course.lessons.map((l, i) => (
              <OutlineItem key={l.id} lesson={l} index={i} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="outline-foot">
        <Button variant="ghost" block icon={<Plus size={15} />} onClick={addLesson}>
          Add lesson
        </Button>
      </div>
    </aside>
  )
}
