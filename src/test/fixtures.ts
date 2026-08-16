import type {
  AccordionBlock, Course, HeadingBlock, ImageBlock, Lesson, QuizBlock, TextBlock,
} from '../types'
import { defaultCompletion, defaultTheme } from '../types'

/**
 * Minimal, explicit course fixtures for the unit suite.
 *
 * Deliberately hand-built rather than derived from `newCourse()` or the ECG
 * exemplar: a test that shares its fixture factory with the code under test
 * stops noticing when the factory itself changes, and a test built on the
 * example course fails for reasons that have nothing to do with the assertion.
 *
 * Each factory returns its *concrete* block type rather than `Block`. Spreading
 * a discriminated union drops the discriminant, so `{ ...textBlock(), html }`
 * would stop type-checking — and these fixtures exist to be spread.
 */

let n = 0
/** Stable, readable ids — `blk-1`, not a uuid, so a failure message is legible. */
export function testId(prefix = 'id'): string {
  n += 1
  return `${prefix}-${n}`
}

export function textBlock(html: string, id = testId('blk')): TextBlock {
  return { id, type: 'text', html }
}

export function headingBlock(text: string, id = testId('blk')): HeadingBlock {
  return { id, type: 'heading', text, level: 2, align: 'left' }
}

export function imageBlock(
  opts: { alt?: string; caption?: string; src?: string } = {},
  id = testId('blk')
): ImageBlock {
  return {
    id,
    type: 'image',
    src: opts.src ?? 'data:image/png;base64,iVBORw0KGgo=',
    alt: opts.alt ?? 'A meaningful description',
    caption: opts.caption ?? '',
    width: 'normal',
  }
}

export function accordionBlock(
  items: { id: string; title: string; html: string }[],
  id = testId('blk')
): AccordionBlock {
  return { id, type: 'accordion', items }
}

export function quizBlock(passingScore: number, id = testId('blk')): QuizBlock {
  return {
    id,
    type: 'quiz',
    title: 'Check your understanding',
    passingScore,
    shuffle: false,
    showFeedback: true,
    questions: [
      {
        id: 'q1',
        type: 'choice',
        text: 'Which lead goes in the fourth intercostal space?',
        choices: [
          { id: 'c1', text: 'V1', correct: true },
          { id: 'c2', text: 'V6', correct: false },
        ],
        answers: [],
        feedbackCorrect: '',
        feedbackIncorrect: '',
      },
    ],
  }
}

export function lesson(title: string, blocks: Lesson['blocks'] = [], id = testId('les')): Lesson {
  return { id, title, icon: '📄', blocks }
}

export function course(overrides: Partial<Course> = {}): Course {
  const now = 1_700_000_000_000
  return {
    id: testId('crs'),
    title: 'Test course',
    description: '',
    author: '',
    coverImage: '',
    lessons: [lesson('Introduction', [textBlock('<p>Hello</p>')])],
    theme: { ...defaultTheme },
    assets: [],
    completion: { ...defaultCompletion },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
