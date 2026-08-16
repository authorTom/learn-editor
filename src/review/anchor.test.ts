import { describe, expect, it } from 'vitest'
import { applyBlocker, applySuggestionToBlock, canApply, findQuote, resolveTarget } from './anchor'
import { blockPlainText } from './blockText'
import type { Block, Course, HtmlBlock } from '../types'
import type { ReviewComment, TextSelector } from './types'
import { accordionBlock, course, headingBlock, lesson, textBlock } from '../test/fixtures'

/**
 * Comment re-anchoring is the trickiest code in the repo, and the one whose
 * failures are worst: a wrong answer either loses a reviewer's comment or
 * silently overwrites an author's later edit. These tests cover the three
 * outcomes the design promises — anchored, drifted, and refused.
 */

function sel(quote: string, prefix = '', suffix = ''): TextSelector {
  return { quote, prefix, suffix }
}

describe('findQuote', () => {
  it('finds a unique quote', () => {
    expect(findQuote('the cat sat on the mat', sel('cat'))).toBe(4)
  })

  it('returns -1 when the quote is gone', () => {
    expect(findQuote('the dog sat on the mat', sel('cat'))).toBe(-1)
    expect(findQuote('anything', sel(''))).toBe(-1)
  })

  it('uses the remembered context to pick between repeated occurrences', () => {
    const text = 'press the button to start, then press the button to stop'
    // Both occurrences of "the button" are identical; only the suffix separates them.
    expect(findQuote(text, sel('the button', 'press ', ' to stop'))).toBe(38)
    expect(findQuote(text, sel('the button', 'press ', ' to start'))).toBe(6)
  })

  it('falls back to the first occurrence when the context matches nothing', () => {
    const text = 'alpha beta alpha beta'
    expect(findQuote(text, sel('alpha', 'zzzz', 'zzzz'))).toBe(0)
  })
})

describe('applySuggestionToBlock', () => {
  it('replaces the quoted text and keeps the surrounding markup intact', () => {
    const b = textBlock('<p>The <strong>quick</strong> brown fox</p>')
    const out = applySuggestionToBlock(b, sel('brown'), 'red') as Block & { html: string }
    expect(out.html).toContain('<strong>quick</strong>')
    expect(out.html).toContain('red')
    expect(out.html).not.toContain('brown')
  })

  it('rewrites text that runs across an inline tag boundary without duplicating it', () => {
    const b = textBlock('<p>The <strong>quick brown</strong> fox</p>')
    const out = applySuggestionToBlock(b, sel('quick brown'), 'slow') as Block & { html: string }
    expect(blockPlainText(out)).toBe('The slow fox')
  })

  it('escapes a reviewer who types markup, rather than injecting it', () => {
    const b = textBlock('<p>Hello world</p>')
    const out = applySuggestionToBlock(b, sel('world'), '<b>everyone</b>') as Block & { html: string }
    expect(out.html).not.toContain('<b>')
    expect(out.html).toContain('&lt;b&gt;')
  })

  it('returns null when the quote is no longer anywhere in the block', () => {
    const b = textBlock('<p>The author rewrote this entirely</p>')
    expect(applySuggestionToBlock(b, sel('brown fox'), 'red fox')).toBeNull()
  })

  it('edits only the first field that contains the quote', () => {
    const b = accordionBlock([
      { id: 'i1', title: 'Repeat', html: '<p>one</p>' },
      { id: 'i2', title: 'Repeat', html: '<p>two</p>' },
    ], 'blk-acc')
    const out = applySuggestionToBlock(b, sel('Repeat'), 'Changed') as Block & {
      items: { title: string }[]
    }
    expect(out.items[0].title).toBe('Changed')
    expect(out.items[1].title).toBe('Repeat')
  })

  it('refuses a plain-text field it cannot find the quote in, leaving the block alone', () => {
    expect(applySuggestionToBlock(headingBlock('A title', 'blk-h'), sel('not here'), 'x')).toBeNull()
  })

  it('will not touch a Custom HTML block, whose field is source rather than prose', () => {
    const b: HtmlBlock = { id: 'blk-x', type: 'html', code: '<p>raw source</p>' }
    expect(applySuggestionToBlock(b, sel('raw source'), 'edited')).toBeNull()
  })
})

describe('resolveTarget', () => {
  const block = textBlock('<p>The quick brown fox</p>', 'blk-a')
  const c: Course = course({ lessons: [lesson('One', [block], 'les-1')] })

  it('anchors a quote that is still present', () => {
    const r = resolveTarget(c, { lessonId: 'les-1', blockId: 'blk-a', text: sel('quick brown') })
    expect(r.state).toBe('anchored')
    expect(r.block?.id).toBe('blk-a')
  })

  it('reports drifted — not orphaned — when the block survives but the quote does not', () => {
    const r = resolveTarget(c, { lessonId: 'les-1', blockId: 'blk-a', text: sel('slow green turtle') })
    expect(r.state).toBe('drifted')
    expect(r.currentText).toBe('The quick brown fox')
  })

  it('orphans a comment whose lesson or block is gone', () => {
    expect(resolveTarget(c, { lessonId: 'les-missing' }).state).toBe('orphaned')
    expect(resolveTarget(c, { lessonId: 'les-1', blockId: 'blk-missing' }).state).toBe('orphaned')
  })

  it('anchors a whole-block or whole-lesson comment with no quote at all', () => {
    expect(resolveTarget(c, { lessonId: 'les-1' }).state).toBe('anchored')
    expect(resolveTarget(c, { lessonId: 'les-1', blockId: 'blk-a' }).state).toBe('anchored')
  })
})

describe('canApply / applyBlocker', () => {
  const block = textBlock('<p>The quick brown fox</p>', 'blk-a')
  const c: Course = course({ lessons: [lesson('One', [block], 'les-1')] })

  function comment(over: Partial<ReviewComment> = {}): ReviewComment {
    return {
      id: 'c1', roundId: 'r1', author: 'Reviewer', body: 'Try this',
      suggestion: 'slow red', createdAt: 0, status: 'open',
      target: { lessonId: 'les-1', blockId: 'blk-a', text: sel('quick brown') },
      ...over,
    } as ReviewComment
  }

  it('allows a suggestion whose quote is still there', () => {
    expect(canApply(c, comment())).toBe(true)
    expect(applyBlocker(c, comment())).toBe('none')
  })

  it('refuses a comment that carries no suggestion', () => {
    const plain = comment({ suggestion: undefined })
    expect(canApply(c, plain)).toBe(false)
    expect(applyBlocker(c, plain)).toBe('not-a-suggestion')
  })

  it('distinguishes drifted from orphaned so the author is told the truth', () => {
    expect(applyBlocker(c, comment({
      target: { lessonId: 'les-1', blockId: 'blk-a', text: sel('long gone') },
    }))).toBe('drifted')
    expect(applyBlocker(c, comment({
      target: { lessonId: 'les-1', blockId: 'blk-missing', text: sel('quick brown') },
    }))).toBe('orphaned')
  })

  it('reports spans-fields for a quote that exists but crosses two fields', () => {
    // blockPlainText joins fields with nothing, so "onetwo" reads as present in
    // the block's text yet belongs to no single field — exactly the case the
    // Apply button must not offer.
    const spanning: Block = accordionBlock([
      { id: 'i1', title: 'A', html: '<p>one</p>' },
      { id: 'i2', title: 'B', html: '<p>two</p>' },
    ], 'blk-acc')
    const c2 = course({ lessons: [lesson('One', [spanning], 'les-2')] })
    const spanningComment = comment({
      target: { lessonId: 'les-2', blockId: 'blk-acc', text: sel('oneB') },
    })
    expect(blockPlainText(spanning)).toContain('oneB')
    expect(applyBlocker(c2, spanningComment)).toBe('spans-fields')
    expect(canApply(c2, spanningComment)).toBe(false)
  })
})
