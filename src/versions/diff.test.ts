import { describe, expect, it } from 'vitest'
import { diffCourses, highlightMap } from './diff'
import { course, headingBlock, lesson, textBlock } from '../test/fixtures'

/**
 * The claim this module makes is that it can tell an *edit* apart from a
 * delete-plus-add, because it keys on ids rather than positions. That is the
 * difference between a change list a compliance reviewer can use and a wall of
 * noise, so it is what these tests pin down.
 */

describe('diffCourses — blocks', () => {
  it('reports an edited block as changed, not as removed plus added', () => {
    const a = textBlock('<p>Original</p>', 'blk-a')
    const before = course({ lessons: [lesson('One', [a], 'les-1')] })
    const after = course({
      id: before.id,
      lessons: [lesson('One', [{ ...a, html: '<p>Rewritten</p>' }], 'les-1')],
    })

    const d = diffCourses(before, after)
    expect(d.changed).toBe(1)
    expect(d.added).toBe(0)
    expect(d.removed).toBe(0)
    expect(d.lessons[0].blocks[0]).toMatchObject({
      kind: 'changed', blockId: 'blk-a', before: 'Original', after: 'Rewritten',
    })
  })

  it('separates a reorder from a rewrite', () => {
    const a = textBlock('<p>First</p>', 'blk-a')
    const b = textBlock('<p>Second</p>', 'blk-b')
    const before = course({ lessons: [lesson('One', [a, b], 'les-1')] })
    const after = course({ id: before.id, lessons: [lesson('One', [b, a], 'les-1')] })

    const d = diffCourses(before, after)
    expect(d.moved).toBe(2)
    expect(d.changed).toBe(0)
    expect(d.lessons[0].blocks.map((x) => x.kind)).toEqual(['moved', 'moved'])
  })

  it('notices a change no reader-visible text would reveal, such as a background', () => {
    const a = textBlock('<p>Same words</p>', 'blk-a')
    const before = course({ lessons: [lesson('One', [a], 'les-1')] })
    const after = course({
      id: before.id,
      lessons: [lesson('One', [{ ...a, bg: '#ffeeee' }], 'les-1')],
    })
    expect(diffCourses(before, after).changed).toBe(1)
  })

  it('orders block changes by their position in the new version', () => {
    const a = textBlock('<p>A</p>', 'blk-a')
    const b = textBlock('<p>B</p>', 'blk-b')
    const c = textBlock('<p>C</p>', 'blk-c')
    const before = course({ lessons: [lesson('One', [a, b], 'les-1')] })
    const after = course({
      id: before.id,
      lessons: [lesson('One', [{ ...a, html: '<p>A!</p>' }, c, { ...b, html: '<p>B!</p>' }], 'les-1')],
    })
    expect(diffCourses(before, after).lessons[0].blocks.map((x) => x.blockId)).toEqual([
      'blk-a', 'blk-c', 'blk-b',
    ])
  })

  it('truncates a long summary rather than carrying the whole block into the list', () => {
    const long = 'word '.repeat(80)
    const a = textBlock(`<p>${long}</p>`, 'blk-a')
    const before = course({ lessons: [lesson('One', [a], 'les-1')] })
    const after = course({ id: before.id, lessons: [lesson('One', [textBlock('<p>short</p>', 'blk-a')], 'les-1')] })
    const summary = diffCourses(before, after).lessons[0].blocks[0].before!
    expect(summary.length).toBeLessThanOrEqual(141)
    expect(summary.endsWith('…')).toBe(true)
  })
})

describe('diffCourses — lessons', () => {
  it('reports an added lesson with all of its blocks', () => {
    const before = course({ lessons: [lesson('One', [], 'les-1')] })
    const after = course({
      id: before.id,
      lessons: [lesson('One', [], 'les-1'), lesson('Two', [textBlock('<p>New</p>', 'blk-n')], 'les-2')],
    })
    const d = diffCourses(before, after)
    expect(d.lessons).toHaveLength(1)
    expect(d.lessons[0]).toMatchObject({ kind: 'added', lessonId: 'les-2' })
    expect(d.added).toBe(1)
  })

  it('records a retitled lesson and what it was called before', () => {
    const before = course({ lessons: [lesson('Old name', [], 'les-1')] })
    const after = course({ id: before.id, lessons: [lesson('New name', [], 'les-1')] })
    const d = diffCourses(before, after)
    expect(d.lessons[0]).toMatchObject({ kind: 'changed', previousTitle: 'Old name' })
    expect(d.lessonsChanged).toBe(1)
  })

  it('says nothing at all about an untouched course', () => {
    const before = course({ lessons: [lesson('One', [textBlock('<p>Hi</p>', 'blk-a')], 'les-1')] })
    const d = diffCourses(before, structuredClone(before))
    expect(d.lessons).toHaveLength(0)
    expect(d.total).toBe(0)
  })

  it('points at a lesson that still exists, never at a deleted one', () => {
    const before = course({
      lessons: [lesson('Gone', [], 'les-1'), lesson('Kept', [headingBlock('New', 'blk-h')], 'les-2')],
    })
    const after = course({
      id: before.id,
      lessons: [lesson('Kept', [headingBlock('Edited', 'blk-h')], 'les-2')],
    })
    expect(diffCourses(before, after).firstChangedLessonId).toBe('les-2')
  })
})

describe('diffCourses — settings', () => {
  it('names changed course and theme settings in words a reviewer can read', () => {
    const before = course()
    const after = course({
      id: before.id,
      title: 'Renamed',
      theme: { ...before.theme, scheme: 'midnight', primaryColor: '#ff0000' },
    })
    const labels = diffCourses(before, after).settings.map((s) => s.label)
    expect(labels).toContain('Course title')
    expect(labels).toContain('Colour scheme')
    expect(labels).toContain('Accent colour')
  })

  it('reports that the logo changed without printing a data URL into the list', () => {
    const before = course()
    const after = course({ id: before.id, theme: { ...before.theme, logo: 'data:image/png;base64,AAAA' } })
    const logo = diffCourses(before, after).settings.find((s) => s.label === 'Logo')!
    expect(logo).toEqual({ label: 'Logo', before: '(none)', after: 'set' })
  })

  it('counts settings changes in the total', () => {
    const before = course({ lessons: [lesson('One', [], 'les-1')] })
    const after = { ...structuredClone(before), title: 'Renamed' }
    expect(diffCourses(before, after).total).toBe(1)
  })
})

describe('highlightMap', () => {
  it('maps every block id to its change kind for painting a rendered player', () => {
    const a = textBlock('<p>A</p>', 'blk-a')
    const before = course({ lessons: [lesson('One', [a], 'les-1')] })
    const after = course({
      id: before.id,
      lessons: [lesson('One', [{ ...a, html: '<p>A!</p>' }, textBlock('<p>B</p>', 'blk-b')], 'les-1')],
    })
    expect(highlightMap(diffCourses(before, after))).toEqual({ 'blk-a': 'changed', 'blk-b': 'added' })
  })
})
