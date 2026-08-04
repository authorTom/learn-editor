import { useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X } from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { resolveAssetSrc, type Block, type Course, type Lesson } from '../types'
import { blockPlainText } from '../review/blockText'
import { Button, IconButton, useEscape } from '../ui'
import { dragInstructions, makeAnnouncements } from '../dndA11y'

/**
 * The whole course at once.
 *
 * The outline lists lesson titles in a 260px column, which answers "what is
 * lesson 6 called" and nothing else. It cannot answer the questions you
 * actually have about a course of any size: where the quizzes fall, which
 * lessons are thin, whether the modules are balanced, what order things should
 * go in. Reordering meant dragging rows in a narrow strip, one position at a
 * time, with no view of where the row was heading.
 *
 * So: a light table. Every lesson as a card carrying a miniature of its blocks,
 * grouped under its module heading, draggable anywhere. Structural editing at
 * the scale the structure actually lives at.
 *
 * The miniature is deliberately a wireframe rather than a rendering. A real
 * render at this size is an illegible grey smear; a wireframe shows the *shape*
 * of a lesson — how much prose, where the media is, whether it ends in a quiz —
 * which is what you are scanning for.
 */

/** What a block looks like from six feet away. */
type Glyph = 'text' | 'media' | 'interactive' | 'quiz' | 'rule'

const GLYPHS: Record<string, Glyph> = {
  text: 'text', heading: 'text', statement: 'text', quote: 'text', list: 'text',
  note: 'text', cards: 'text', steps: 'text', columns: 'text', button: 'text',
  image: 'media', imageText: 'media', gallery: 'media', video: 'media',
  audio: 'media', embed: 'media', html: 'media', hotspot: 'media',
  accordion: 'interactive', tabs: 'interactive', flashcards: 'interactive',
  sorting: 'interactive', matching: 'interactive',
  quiz: 'quiz',
  divider: 'rule',
}

function glyphFor(block: Block): Glyph {
  return GLYPHS[block.type] ?? 'text'
}

/** First image in a lesson, used as the card's own thumbnail. */
function lessonImage(lesson: Lesson, course: Course): string {
  if (lesson.theme?.heroImage) return resolveAssetSrc(lesson.theme.heroImage, course.assets)
  for (const b of lesson.blocks) {
    const src = (b as { src?: string }).src
    if (src) {
      const resolved = resolveAssetSrc(src, course.assets)
      if (resolved) return resolved
    }
  }
  return ''
}

function lessonWords(lesson: Lesson): number {
  let n = 0
  for (const b of lesson.blocks) {
    const t = blockPlainText(b).trim()
    if (t) n += t.split(/\s+/).length
  }
  return n
}

export default function CourseBoard({ onClose }: { onClose: () => void }) {
  const course = useStore((s) => s.course)
  const moveLesson = useStore((s) => s.moveLesson)
  const addLesson = useStore((s) => s.addLesson)
  const selectLesson = useStore((s) => s.selectLesson)
  const currentId = useStore((s) => s.lessonId)
  const setOutlineOpen = useUi((s) => s.setOutlineOpen)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEscape(onClose)
  useEffect(() => { closeRef.current?.focus() }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const lessons = course?.lessons ?? []

  /** Module runs, so the board can show section headings the way the outline
      and the learner's menu both do — consecutive lessons sharing a name. */
  const groups = useMemo(() => {
    const out: { section: string | undefined; lessons: { lesson: Lesson; index: number }[] }[] = []
    lessons.forEach((lesson, index) => {
      const last = out[out.length - 1]
      if (last && last.section === lesson.section) last.lessons.push({ lesson, index })
      else out.push({ section: lesson.section, lessons: [{ lesson, index }] })
    })
    return out
  }, [lessons])

  if (!course) return null

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = lessons.findIndex((l) => l.id === active.id)
    const to = lessons.findIndex((l) => l.id === over.id)
    if (from >= 0 && to >= 0) moveLesson(from, to)
  }

  function open(id: string) {
    selectLesson(id)
    setOutlineOpen(true)
    onClose()
  }

  return (
    <div className="cb" role="dialog" aria-modal="true" aria-label="Course board">
      <header className="cb__bar">
        <div>
          <strong className="cb__title">{course.title || 'Untitled course'}</strong>
          <span className="cb__sub">
            {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} ·{' '}
            {lessons.reduce((n, l) => n + l.blocks.length, 0)} blocks ·{' '}
            {lessons.reduce((n, l) => n + l.blocks.filter((b) => b.type === 'quiz').length, 0)}{' '}
            quizzes
          </span>
        </div>
        <span className="cb__spacer" />
        <Button icon={<Plus size={15} />} onClick={() => { addLesson(); onClose() }}>
          Add lesson
        </Button>
        <IconButton ref={closeRef} label="Close board" icon={<X size={17} />} onClick={onClose} />
      </header>

      <p className="cb__hint">{dragInstructions.draggable}</p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: makeAnnouncements('Lesson') }}
      >
        <SortableContext items={lessons.map((l) => l.id)} strategy={rectSortingStrategy}>
          <div className="cb__scroll">
            {groups.map((g, gi) => (
              <section key={gi} className="cb__group">
                {g.section && <h2 className="cb__section">{g.section}</h2>}
                <div className="cb__grid">
                  {g.lessons.map(({ lesson, index }) => (
                    <BoardCard
                      key={lesson.id}
                      lesson={lesson}
                      index={index}
                      course={course}
                      current={lesson.id === currentId}
                      onOpen={() => open(lesson.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function BoardCard({
  lesson, index, course, current, onOpen,
}: {
  lesson: Lesson
  index: number
  course: Course
  current: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  })
  const image = lessonImage(lesson, course)
  const quizzes = lesson.blocks.filter((b) => b.type === 'quiz').length
  const words = lessonWords(lesson)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'cb-card' + (current ? ' is-current' : '') + (isDragging ? ' is-dragging' : '')
      }
    >
      <div className="cb-card__head">
        <button
          className="cb-card__grip"
          aria-label={`Reorder ${lesson.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>
        <span className="cb-card__n">{index + 1}</span>
        <span className="cb-card__icon" aria-hidden="true">{lesson.icon}</span>
      </div>

      {/* The card is a button so the whole thumbnail opens the lesson; the grip
          above sits outside it, because a drag handle nested in a button is
          both a pointer-target conflict and an ambiguous tab stop. */}
      <button type="button" className="cb-card__open" onClick={onOpen}>
        <span className="cb-card__mini" aria-hidden="true">
          {image && <img className="cb-card__shot" src={image} alt="" loading="lazy" />}
          <span className="cb-card__wire">
            {lesson.blocks.length === 0 && <span className="cb-wire cb-wire--empty" />}
            {lesson.blocks.slice(0, 14).map((b) => (
              <span key={b.id} className={'cb-wire cb-wire--' + glyphFor(b)} />
            ))}
          </span>
        </span>
        <span className="cb-card__title">{lesson.title || 'Untitled lesson'}</span>
        <span className="cb-card__meta">
          {lesson.blocks.length} {lesson.blocks.length === 1 ? 'block' : 'blocks'}
          {words > 0 && ` · ${words} words`}
          {quizzes > 0 && ` · ${quizzes} quiz${quizzes > 1 ? 'zes' : ''}`}
        </span>
      </button>
    </div>
  )
}
