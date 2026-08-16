import { describe, expect, it } from 'vitest'
import {
  contrastRatio, courseVars, lessonIsDark, lessonVars, onColor, readableAccent, schemeOf,
} from './theme'
import { SCHEMES } from './types'
import { course, lesson } from './test/fixtures'

/**
 * `theme.ts` is the one function the editor canvas and the exported player both
 * call, which is what stops the two drifting apart. These tests pin the
 * contrast guarantees it exists to provide — the failures they catch are
 * invisible to a type check and only show up as unreadable text in a shipped
 * SCORM package.
 */

describe('contrastRatio', () => {
  it('returns the WCAG extremes for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('is symmetric — order of arguments cannot change a ratio', () => {
    expect(contrastRatio('#3b5bdb', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#3b5bdb'), 10)
  })

  it('accepts three-digit hex and a missing leading #', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5)
    expect(contrastRatio('fff', '000')).toBeCloseTo(21, 5)
  })

  it('returns 21 for colours it cannot parse, so an unevaluable custom colour never trips a warning', () => {
    expect(contrastRatio('color-mix(in srgb, red, blue)', '#ffffff')).toBe(21)
    expect(contrastRatio('', '#ffffff')).toBe(21)
  })
})

describe('onColor', () => {
  it('picks white on a dark fill and near-black on a light one', () => {
    expect(onColor('#1a1d2e')).toBe('#ffffff')
    expect(onColor('#ffd43b')).toBe('#111318')
  })

  it('always returns a colour that clears 4.5:1 on its own fill', () => {
    // The mid-amber case is the one that shipped broken: white on amber at 1.9:1.
    for (const fill of ['#ffd43b', '#f59f00', '#3b5bdb', '#0b7285', '#e64980', '#495057']) {
      expect(contrastRatio(fill, onColor(fill))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('readableAccent', () => {
  it('darkens a pale accent until it is legible as text on a light background', () => {
    const out = readableAccent('#ffd43b', '#ffffff')
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(out).not.toBe('#ffd43b')
  })

  it('lightens rather than darkens against a dark background', () => {
    const dark = SCHEMES.find((s) => s.id === 'midnight')!
    const out = readableAccent('#1c3d6b', dark.bg)
    expect(contrastRatio(out, dark.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves an accent that already passes alone', () => {
    expect(readableAccent('#1f2437', '#ffffff')).toBe('#1f2437')
  })

  it('returns the input unchanged when it cannot parse it', () => {
    expect(readableAccent('var(--brand)', '#ffffff')).toBe('var(--brand)')
  })

  it('produces a legible accent for every shipped scheme', () => {
    // The guarantee the picker cannot police on its own: whatever the author
    // chooses, links and kickers stay readable on every background we ship.
    for (const scheme of SCHEMES) {
      for (const accent of ['#ffd43b', '#3b5bdb', '#e64980', '#0b7285']) {
        const ink = readableAccent(accent, scheme.bg)
        expect(
          contrastRatio(ink, scheme.bg),
          `${accent} on ${scheme.id}`
        ).toBeGreaterThanOrEqual(4.4) // 4.4: the search steps in 12% increments
      }
    }
  })
})

describe('schemeOf', () => {
  it('falls back to the first scheme for an unknown or missing id', () => {
    expect(schemeOf(undefined).id).toBe('light')
    expect(schemeOf('no-such-scheme').id).toBe('light')
  })
})

describe('courseVars / lessonVars', () => {
  it('derives the accent and background from the course theme', () => {
    const c = course({ theme: { ...course().theme, primaryColor: '#3b5bdb', scheme: 'sand' } })
    const vars = courseVars(c)
    expect(vars['--accent']).toBe('#3b5bdb')
    expect(vars['--bg']).toBe(SCHEMES.find((s) => s.id === 'sand')!.bg)
  })

  it('applies a per-lesson scheme override', () => {
    const l = { ...lesson('Dark one'), theme: { scheme: 'midnight' as const } }
    const c = course({ lessons: [l] })
    expect(lessonVars(c, l)['--bg']).toBe(SCHEMES.find((s) => s.id === 'midnight')!.bg)
    expect(courseVars(c)['--bg']).toBe('#ffffff')
  })

  it('falls back to the course scheme — not the first scheme — for an unknown override', () => {
    const l = { ...lesson('Odd'), theme: { scheme: 'no-such-scheme' as never } }
    const c = course({ lessons: [l], theme: { ...course().theme, scheme: 'sand' } })
    expect(lessonVars(c, l)['--bg']).toBe(SCHEMES.find((s) => s.id === 'sand')!.bg)
  })

  it('returns the course vars untouched when a lesson has an empty theme object', () => {
    const l = { ...lesson('Plain'), theme: {} }
    const c = course({ lessons: [l] })
    expect(lessonVars(c, l)).toEqual(courseVars(c))
  })

  it('reports lesson darkness from the effective scheme, so editor chrome can flip', () => {
    const l = { ...lesson('Dark one'), theme: { scheme: 'forest' as const } }
    const c = course({ lessons: [l] })
    expect(lessonIsDark(c, l)).toBe(true)
    expect(lessonIsDark(c, undefined)).toBe(false)
  })
})
