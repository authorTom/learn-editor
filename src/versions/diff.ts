import type { Block, Course, Lesson } from '../types'
import { blockPlainText } from '../review/blockText'

/**
 * Structural diff between two versions of a course.
 *
 * Keyed on ids, not positions. Blocks and lessons keep stable ids for their
 * whole life — that is what makes it possible to tell "this paragraph was
 * edited" apart from "this paragraph was deleted and a different one added two
 * rows down", which a positional diff cannot do and which is the difference
 * between a useful change list and noise.
 */

export type ChangeKind = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged'

export interface BlockChange {
  kind: ChangeKind
  blockId: string
  blockType: string
  /** Reader-visible text before and after, for the summary line. */
  before?: string
  after?: string
  fromIndex?: number
  toIndex?: number
}

export interface LessonChange {
  kind: ChangeKind
  lessonId: string
  title: string
  /** Set when the title itself changed. */
  previousTitle?: string
  blocks: BlockChange[]
  fromIndex?: number
  toIndex?: number
}

export interface CourseDiff {
  lessons: LessonChange[]
  /** Course-level fields that differ, as human-readable labels. */
  settings: { label: string; before: string; after: string }[]
  added: number
  removed: number
  changed: number
  moved: number
  /** Lessons added, removed, retitled or restyled — changes that are not
      attributable to any single block, and would otherwise go uncounted. */
  lessonsChanged: number
  /** The lesson a reader should be shown first: the earliest one that differs. */
  firstChangedLessonId?: string
  get total(): number
}

function summarise(b: Block): string {
  const t = blockPlainText(b).replace(/\s+/g, ' ').trim()
  return t.length > 140 ? t.slice(0, 140) + '…' : t
}

/** Deep equality that ignores nothing — a background colour change is a change. */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function diffBlocks(before: Block[], after: Block[]): BlockChange[] {
  const beforeById = new Map(before.map((b, i) => [b.id, { b, i }]))
  const afterById = new Map(after.map((b, i) => [b.id, { b, i }]))
  const out: BlockChange[] = []

  before.forEach((b, i) => {
    if (afterById.has(b.id)) return
    out.push({ kind: 'removed', blockId: b.id, blockType: b.type, before: summarise(b), fromIndex: i })
  })

  after.forEach((b, i) => {
    const prev = beforeById.get(b.id)
    if (!prev) {
      out.push({ kind: 'added', blockId: b.id, blockType: b.type, after: summarise(b), toIndex: i })
      return
    }
    if (!same(prev.b, b)) {
      out.push({
        kind: 'changed', blockId: b.id, blockType: b.type,
        before: summarise(prev.b), after: summarise(b),
        fromIndex: prev.i, toIndex: i,
      })
    } else if (prev.i !== i) {
      // Position-only. Reported separately so a reordered lesson does not read
      // as a lesson that was rewritten.
      out.push({
        kind: 'moved', blockId: b.id, blockType: b.type,
        after: summarise(b), fromIndex: prev.i, toIndex: i,
      })
    }
  })

  return out.sort((x, y) => (x.toIndex ?? x.fromIndex ?? 0) - (y.toIndex ?? y.fromIndex ?? 0))
}

const SETTING_LABELS: Record<string, string> = {
  title: 'Course title',
  description: 'Description',
  author: 'Author',
}

const THEME_LABELS: Record<string, string> = {
  primaryColor: 'Accent colour', scheme: 'Colour scheme', fontPack: 'Font pack',
  nav: 'Navigation', hero: 'Lesson header', width: 'Content width', corners: 'Corners',
  headingWeight: 'Heading weight', fontScale: 'Text size', spacing: 'Spacing',
  typeScale: 'Heading scale', elevation: 'Depth', progress: 'Progress',
  lessonNumbers: 'Lesson numbering', titlePage: 'Title page', logo: 'Logo',
}

const COMPLETION_LABELS: Record<string, string> = {
  allLessons: 'Rule: finish every lesson',
  quizPass: 'Rule: pass every quiz',
  minScore: 'Rule: minimum average score',
  minMinutes: 'Rule: minimum time',
}

function diffSettings(a: Course, b: Course) {
  const out: { label: string; before: string; after: string }[] = []
  const show = (v: unknown) =>
    v === '' || v == null ? '(none)' : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v)

  Object.keys(SETTING_LABELS).forEach((k) => {
    const x = (a as unknown as Record<string, unknown>)[k]
    const y = (b as unknown as Record<string, unknown>)[k]
    if (x !== y) out.push({ label: SETTING_LABELS[k], before: show(x), after: show(y) })
  })
  Object.keys(THEME_LABELS).forEach((k) => {
    const x = (a.theme as unknown as Record<string, unknown>)?.[k]
    const y = (b.theme as unknown as Record<string, unknown>)?.[k]
    // The logo is a data URL or asset ref — report that it changed, not what to.
    if (x !== y) {
      out.push(
        k === 'logo'
          ? { label: THEME_LABELS[k], before: x ? 'set' : '(none)', after: y ? 'set' : '(none)' }
          : { label: THEME_LABELS[k], before: show(x), after: show(y) }
      )
    }
  })
  Object.keys(COMPLETION_LABELS).forEach((k) => {
    const x = (a.completion as unknown as Record<string, unknown>)?.[k]
    const y = (b.completion as unknown as Record<string, unknown>)?.[k]
    if (x !== y) out.push({ label: COMPLETION_LABELS[k], before: show(x), after: show(y) })
  })
  return out
}

export function diffCourses(before: Course, after: Course): CourseDiff {
  const beforeById = new Map(before.lessons.map((l, i) => [l.id, { l, i }]))
  const afterById = new Map(after.lessons.map((l, i) => [l.id, { l, i }]))
  const lessons: LessonChange[] = []

  before.lessons.forEach((l: Lesson, i) => {
    if (afterById.has(l.id)) return
    lessons.push({
      kind: 'removed', lessonId: l.id, title: l.title, fromIndex: i,
      blocks: l.blocks.map((b) => ({
        kind: 'removed' as const, blockId: b.id, blockType: b.type, before: summarise(b),
      })),
    })
  })

  after.lessons.forEach((l: Lesson, i) => {
    const prev = beforeById.get(l.id)
    if (!prev) {
      lessons.push({
        kind: 'added', lessonId: l.id, title: l.title, toIndex: i,
        blocks: l.blocks.map((b) => ({
          kind: 'added' as const, blockId: b.id, blockType: b.type, after: summarise(b),
        })),
      })
      return
    }
    const blocks = diffBlocks(prev.l.blocks, l.blocks)
    const titleChanged = prev.l.title !== l.title
    const metaChanged =
      !same(prev.l.theme, l.theme) || prev.l.icon !== l.icon || prev.l.section !== l.section
    const moved = prev.i !== i
    const touched = blocks.some((b) => b.kind !== 'unchanged')

    if (!touched && !titleChanged && !metaChanged && !moved) return
    lessons.push({
      kind: touched || titleChanged || metaChanged ? 'changed' : 'moved',
      lessonId: l.id,
      title: l.title,
      previousTitle: titleChanged ? prev.l.title : undefined,
      blocks,
      fromIndex: prev.i,
      toIndex: i,
    })
  })

  lessons.sort((a, b) => (a.toIndex ?? a.fromIndex ?? 0) - (b.toIndex ?? b.fromIndex ?? 0))

  const all = lessons.flatMap((l) => l.blocks)
  const count = (k: ChangeKind) => all.filter((b) => b.kind === k).length
  const added = count('added')
  const removed = count('removed')
  const changed = count('changed')
  const moved = count('moved')
  // A lesson counts here when something about the lesson itself moved — its
  // title, icon, section or style — rather than one of its blocks.
  const lessonsChanged = lessons.filter(
    (l) => l.kind === 'added' || l.kind === 'removed' || l.previousTitle || l.blocks.length === 0
  ).length
  // Prefer a lesson that still exists in `after`; a removed one cannot be shown.
  const firstChangedLessonId = lessons.find((l) => l.kind !== 'removed')?.lessonId

  return {
    lessons,
    settings: diffSettings(before, after),
    added, removed, changed, moved, lessonsChanged, firstChangedLessonId,
    get total() {
      return added + removed + changed + moved + lessonsChanged + this.settings.length
    },
  }
}

/** Block ids by change kind, for painting them in a rendered player. */
export function highlightMap(diff: CourseDiff): Record<string, ChangeKind> {
  const map: Record<string, ChangeKind> = {}
  diff.lessons.forEach((l) => l.blocks.forEach((b) => { map[b.blockId] = b.kind }))
  return map
}
