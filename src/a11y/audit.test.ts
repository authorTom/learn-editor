import { describe, expect, it } from 'vitest'
import { auditCourse, schemeContrastWarnings } from './audit'
import type { Block } from '../types'
import { contrastRatio } from '../theme'
import { SCHEMES } from '../types'
import { course, imageBlock, lesson, textBlock } from '../test/fixtures'

/**
 * The audit's whole claim is that it judges the *authored course*, not the
 * player — so these tests feed it courses with the specific authoring mistakes
 * it exists to catch, and check it neither misses them nor invents them.
 *
 * A false positive here is worse than a miss: an author who learns the panel
 * cries wolf stops reading it, and then the real 1.1.1 error ships.
 */

function findingsFor(blocks: Block[]) {
  return auditCourse(course({ lessons: [lesson('One', blocks, 'les-1')] })).findings
}

describe('images — 1.1.1', () => {
  it('errors on an image with no alt text', () => {
    const f = findingsFor([imageBlock({ alt: '' })])
    expect(f.some((x) => x.criterion === '1.1.1' && x.severity === 'error')).toBe(true)
  })

  it('errors on placeholder alt text a camera would have produced', () => {
    for (const alt of ['image', 'DSC_0421', 'photo 2', 'screenshot', 'IMG-3184.jpg']) {
      const f = findingsFor([imageBlock({ alt })])
      expect(
        f.some((x) => x.criterion === '1.1.1' && x.severity === 'error'),
        `expected "${alt}" to be rejected as placeholder alt text`
      ).toBe(true)
    }
  })

  it('accepts an explicit "decorative" as a real answer', () => {
    expect(findingsFor([imageBlock({ alt: 'decorative' })]).filter((x) => x.criterion === '1.1.1'))
      .toHaveLength(0)
  })

  it('accepts a genuine description without complaint', () => {
    expect(
      findingsFor([imageBlock({ alt: 'A nurse placing a V4 electrode in the fifth intercostal space' })])
        .filter((x) => x.criterion === '1.1.1' && x.severity === 'error')
    ).toHaveLength(0)
  })

  it('warns — but does not error — on alt text long enough to be a paragraph', () => {
    const f = findingsFor([imageBlock({ alt: 'x'.repeat(240) })])
    const one = f.find((x) => x.criterion === '1.1.1')
    expect(one?.severity).toBe('warning')
  })

  it('says nothing about an image block with no image in it yet', () => {
    expect(findingsFor([imageBlock({ src: '', alt: '' })]).filter((x) => x.criterion === '1.1.1'))
      .toHaveLength(0)
  })
})

describe('links — 2.4.4', () => {
  it('flags link text that says nothing out of context', () => {
    const f = findingsFor([textBlock('<p>For the policy, <a href="https://example.com">click here</a>.</p>')])
    expect(f.some((x) => x.criterion === '2.4.4')).toBe(true)
  })

  it('leaves a descriptive link alone', () => {
    const f = findingsFor([
      textBlock('<p>Read the <a href="https://example.com">2026 resuscitation guidelines</a>.</p>'),
    ])
    expect(f.filter((x) => x.criterion === '2.4.4' && x.severity === 'error')).toHaveLength(0)
  })
})

describe('theme contrast — 1.4.3 / 1.4.11', () => {
  it('warns under 1.4.11 when a pale accent cannot carry a rule or a progress bar', () => {
    // #ffe066 is 1.3:1 on white — below the 3:1 needed for a perceivable boundary.
    const c = course({ theme: { ...course().theme, primaryColor: '#ffe066', scheme: 'light' } })
    const f = auditCourse(c).findings
    expect(f.some((x) => x.criterion === '1.4.11' && x.severity === 'warning')).toBe(true)
  })

  it('downgrades a mid-contrast accent to review, because the player darkens it for text', () => {
    // 4.12:1 — fine as a fill, short of 4.5:1 as text, and theme.ts derives a
    // readable --accent-ink for links. Conformant output, so not a failure.
    const c = course({ theme: { ...course().theme, primaryColor: '#7d7d7d', scheme: 'light' } })
    const f = auditCourse(c).findings.filter((x) => x.criterion === '1.4.3')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('review')
    expect(auditCourse(c).failing.has('1.4.3')).toBe(false)
  })

  it('errors on a custom block background that the theme cannot contrast-pair', () => {
    const dim = { ...textBlock('<p>Text on a bad background</p>', 'blk-bg'), bg: '#8a8a8a' }
    const c = course({ lessons: [lesson('One', [dim], 'les-1')] })
    const f = auditCourse(c).findings.find((x) => x.criterion === '1.4.3' && x.blockId === 'blk-bg')
    expect(f?.severity).toBe('error')
  })

  it('every shipped colour scheme passes body-text contrast on its own', () => {
    // If this fails, the product ships a scheme no author can use accessibly.
    expect(schemeContrastWarnings()).toEqual([])
    for (const s of SCHEMES) {
      expect(contrastRatio(s.ink, s.bg), `${s.id} ink on bg`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('auditCourse — the result as a whole', () => {
  it('counts each severity and lists only criteria that actually error', () => {
    const r = auditCourse(course({ lessons: [lesson('One', [imageBlock({ alt: '' })], 'les-1')] }))
    expect(r.errors).toBeGreaterThan(0)
    expect(r.failing.has('1.1.1')).toBe(true)
    expect(r.errors + r.warnings + r.reviews).toBe(r.findings.length)
  })

  it('sorts errors ahead of warnings, so the panel opens on what blocks a release', () => {
    const r = auditCourse(course({
      lessons: [lesson('One', [imageBlock({ alt: '' }), imageBlock({ alt: 'y'.repeat(240) })], 'les-1')],
    }))
    const severities = r.findings.map((f) => f.severity)
    expect(severities.indexOf('error')).toBeLessThan(severities.lastIndexOf('warning'))
  })

  it('points every finding at the block that has to be fixed', () => {
    const r = auditCourse(course({
      lessons: [lesson('Lesson one', [imageBlock({ alt: '' }, 'blk-img')], 'les-1')],
    }))
    const f = r.findings.find((x) => x.criterion === '1.1.1')!
    expect(f).toMatchObject({ lessonId: 'les-1', lessonTitle: 'Lesson one', blockId: 'blk-img' })
  })

  it('gives a clean course a clean bill of health', () => {
    const c = course({
      title: 'Recording a 12-lead ECG',
      lessons: [lesson('One', [
        textBlock('<p>An ordinary paragraph with no links in it at all.</p>'),
        imageBlock({ alt: 'A twelve-lead ECG trace showing normal sinus rhythm' }),
      ], 'les-1')],
    })
    expect(auditCourse(c).errors).toBe(0)
  })
})
