import type { Course, Lesson } from './types'
import { FONT_PACKS, FONT_SCALES, SCHEMES, SPACING_SCALES, normalizeTheme } from './types'

/**
 * Single source of truth for the CSS custom properties a course theme produces.
 *
 * Both consumers read from here:
 *   - the exported player / preview  (scorm/buildPlayerHtml.ts)
 *   - the editor's lesson canvas     (components/LessonEditor.tsx)
 *
 * That shared derivation is the whole reason the canvas can look like the
 * finished course: the editor is not approximating the player's colours, it is
 * computing the same values from the same inputs. The previous `editorBg()`
 * helper in LessonEditor hardcoded `#ffffff` and guessed at the accent tint,
 * so a Sand or Midnight course looked nothing like itself while authoring.
 */

export type ThemeVars = Record<string, string>

export const CONTENT_WIDTH = { narrow: '640px', normal: '760px', wide: '920px' } as const

type Scheme = (typeof SCHEMES)[number]

export function schemeOf(id: string | undefined): Scheme {
  return SCHEMES.find((s) => s.id === id) ?? SCHEMES[0]
}

/** Colour properties produced by a scheme + accent pairing. */
export function schemeVars(scheme: Scheme, accent: string): ThemeVars {
  return {
    '--accent': accent,
    // Dark schemes need a stronger mix for the tint to be visible at all.
    '--accent-soft': `color-mix(in srgb, ${accent} ${scheme.dark ? '22%' : '10%'}, ${scheme.bg})`,
    '--bg': scheme.bg,
    '--bg-soft': scheme.bgSoft,
    '--ink': scheme.ink,
    '--ink-soft': scheme.inkSoft,
    '--line': scheme.line,
  }
}

/** Typography and metrics — course-level only, never overridden per lesson. */
export function typographyVars(course: Course): ThemeVars {
  const theme = normalizeTheme(course.theme)
  const pack = FONT_PACKS.find((p) => p.id === theme.fontPack) ?? FONT_PACKS[0]
  return {
    '--font': pack.body,
    '--font-heading': pack.heading,
    '--heading-weight': theme.headingWeight === 'bold' ? '700' : '800',
    '--radius': theme.corners === 'sharp' ? '4px' : '14px',
    '--content-max': CONTENT_WIDTH[theme.width],
    '--font-size': `${FONT_SCALES[theme.fontScale]}px`,
    '--space': String(SPACING_SCALES[theme.spacing]),
  }
}

/** Everything the course theme contributes, before per-lesson overrides. */
export function courseVars(course: Course): ThemeVars {
  const theme = normalizeTheme(course.theme)
  return {
    ...schemeVars(schemeOf(theme.scheme), theme.primaryColor),
    ...typographyVars(course),
  }
}

/** Course vars with this lesson's overrides applied. */
export function lessonVars(course: Course, lesson: Lesson | undefined): ThemeVars {
  const base = courseVars(course)
  const t = lesson?.theme
  if (!t || Object.keys(t).length === 0) return base
  const theme = normalizeTheme(course.theme)
  // Matches the exporter: an unrecognised override id falls back to the
  // course scheme rather than to the first scheme in the list.
  const scheme = SCHEMES.find((s) => s.id === t.scheme) ?? schemeOf(theme.scheme)
  return { ...base, ...schemeVars(scheme, t.primaryColor ?? theme.primaryColor) }
}

/** Whether the effective scheme for a lesson is a dark one — the editor needs
    this to flip its own chrome-on-canvas affordances. */
export function lessonIsDark(course: Course, lesson: Lesson | undefined): boolean {
  const theme = normalizeTheme(course.theme)
  const id = lesson?.theme?.scheme ?? theme.scheme
  return !!schemeOf(id).dark
}

/** The hero style in force for a lesson. */
export function lessonHero(course: Course, lesson: Lesson | undefined): string {
  const theme = normalizeTheme(course.theme)
  return lesson?.theme?.hero ?? theme.hero
}
