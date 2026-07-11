import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Copy, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import type { Lesson } from '../types'

const LESSON_EMOJI = [
  '📄', '📚', '🎯', '💡', '🧭', '🔍', '🛠️', '⚙️',
  '🧪', '📊', '📈', '🗂️', '🎬', '🖼️', '🔒', '🛡️',
  '❤️', '⭐', '✅', '🚀', '🌍', '💬', '🧠', '🏆',
]

function OutlineItem({ lesson, index }: { lesson: Lesson; index: number }) {
  const { lessonId, selectLesson, updateLesson, deleteLesson, duplicateLesson, course } = useStore()
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
      <span className="grip" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical size={14} />
      </span>
      <span
        className="o-icon"
        title="Change icon"
        onClick={(e) => {
          e.stopPropagation()
          setShowEmoji((v) => !v)
        }}
      >
        {lesson.icon}
      </span>
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
        <button className="icon-btn" title="Duplicate lesson" onClick={() => duplicateLesson(lesson.id)}>
          <Copy size={13} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete lesson"
          disabled={!canDelete}
          onClick={() => {
            if (confirm(`Delete lesson "${lesson.title}"?`)) deleteLesson(lesson.id)
          }}
        >
          <Trash2 size={13} />
        </button>
      </span>
      {showEmoji && (
        <div className="emoji-pop" onClick={(e) => e.stopPropagation()}>
          {LESSON_EMOJI.map((em) => (
            <button
              key={em}
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
        <button className="btn ghost" style={{ width: '100%' }} onClick={addLesson}>
          <Plus size={15} /> Add lesson
        </button>
      </div>
    </aside>
  )
}
