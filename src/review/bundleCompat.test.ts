import { describe, expect, it } from 'vitest'
import { LEGACY_REVIEW_BUNDLE_KIND, REVIEW_BUNDLE_KIND, sanitizeBundle } from './types'
import { LEGACY_TEMPLATE_LIBRARY_KIND } from '../types'

/**
 * Backward compatibility across the rename from Learn Editor to Quoin.
 *
 * These markers are the only brand strings that ever left the machine: they
 * are written into files that live outside the app — a reviewer's returned
 * feedback, an author's exported template library — and can come back weeks
 * later. Renaming the product must not turn those files into "bad format".
 *
 * The rule in both directions: read either marker, write only the new one.
 */

function bundle(kind: string) {
  return {
    kind,
    version: 1,
    reviewId: 'r1',
    courseId: 'c1',
    courseTitle: 'Recording a 12-lead ECG',
    reviewer: 'Sam',
    submittedAt: 1_700_000_000_000,
    comments: [
      {
        id: 'c1',
        roundId: 'r1',
        author: 'Sam',
        body: 'This paragraph contradicts lesson 2.',
        createdAt: 1_700_000_000_000,
        status: 'open',
        target: { lessonId: 'les-1', blockId: 'blk-1' },
      },
    ],
  }
}

describe('review bundles across the rename', () => {
  it('accepts a bundle a reviewer returns under the current marker', () => {
    const out = sanitizeBundle(bundle(REVIEW_BUNDLE_KIND))
    expect(out).not.toBeNull()
    expect(out!.comments).toHaveLength(1)
  })

  it('still accepts a round that was sent out before the rename', () => {
    // The reviewer had the HTML file for a fortnight. Their feedback is not
    // stale just because the tool changed its name while they read it.
    const out = sanitizeBundle(bundle(LEGACY_REVIEW_BUNDLE_KIND))
    expect(out).not.toBeNull()
    expect(out!.reviewer).toBe('Sam')
    expect(out!.comments).toHaveLength(1)
  })

  it('keeps rejecting a file that is not a review bundle at all', () => {
    expect(sanitizeBundle(bundle('something-else'))).toBeNull()
    expect(sanitizeBundle({ kind: REVIEW_BUNDLE_KIND })).toBeNull()
    expect(sanitizeBundle(null)).toBeNull()
    expect(sanitizeBundle('not an object')).toBeNull()
  })

  it('names the two markers distinctly, so the new one is what gets written', () => {
    expect(REVIEW_BUNDLE_KIND).toBe('quoin-review')
    expect(LEGACY_REVIEW_BUNDLE_KIND).toBe('learn-editor-review')
    expect(REVIEW_BUNDLE_KIND).not.toBe(LEGACY_REVIEW_BUNDLE_KIND)
  })
})

describe('template library across the rename', () => {
  it('remembers the pre-rename marker so an old library still imports', () => {
    expect(LEGACY_TEMPLATE_LIBRARY_KIND).toBe('learn-editor-templates')
  })
})
