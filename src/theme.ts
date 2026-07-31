import type { Course, HeroStyle, Lesson } from './types'
import {
  ELEVATIONS, FONT_PACKS, FONT_SCALES, SCHEMES, SPACING_SCALES, TYPE_SCALES,
  normalizeTheme, resolveAssetSrc,
} from './types'

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

// ---------- contrast ----------
//
// The accent is author-chosen and lands on two jobs the picker cannot police on
// its own: it fills buttons, quiz headers and hotspot markers (so something has
// to be legible *on* it), and it tints links, kickers and active nav items (so
// it has to be legible *against* the page). A mid-amber accent satisfied
// neither before this: the player hardcoded `color: #fff` on every accent fill,
// giving white-on-amber at about 1.9:1.

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1–21. Unparseable colours return 21 so a custom CSS
    colour never trips a warning we cannot actually evaluate. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a)
  const rb = parseHex(b)
  if (!ra || !rb) return 21
  const [l1, l2] = [luminance(ra), luminance(rb)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Black or white — whichever reads better as text on this fill. */
export function onColor(fill: string): string {
  return contrastRatio(fill, '#ffffff') >= contrastRatio(fill, '#111318') ? '#ffffff' : '#111318'
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

/**
 * The accent, darkened (or lightened, on dark schemes) just far enough to clear
 * 4.5:1 as body-size text on `bg`. Used for links, kickers and small accent
 * labels; the untouched accent stays in charge of fills and rules, so the brand
 * colour is still what the learner sees at size.
 */
export function readableAccent(accent: string, bg: string): string {
  const rgb = parseHex(accent)
  const bgRgb = parseHex(bg)
  if (!rgb || !bgRgb) return accent
  const towardsWhite = luminance(bgRgb) < 0.5
  let cur = rgb
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(toHex(cur), bg) >= 4.5) break
    cur = cur.map((v) => (towardsWhite ? v + (255 - v) * 0.12 : v * 0.88)) as [number, number, number]
  }
  return toHex(cur)
}

/** Colour properties produced by a scheme + accent pairing. */
export function schemeVars(scheme: Scheme, accent: string): ThemeVars {
  return {
    '--accent': accent,
    // Dark schemes need a stronger mix for the tint to be visible at all.
    '--accent-soft': `color-mix(in srgb, ${accent} ${scheme.dark ? '22%' : '10%'}, ${scheme.bg})`,
    // Text drawn *on* an accent fill, and the accent used *as* text.
    '--on-accent': onColor(accent),
    '--accent-ink': readableAccent(accent, scheme.bg),
    // Second stop of the gradient hero. It shades *away* from whatever the
    // legible ink turned out to be, so both ends of the gradient stay on the
    // same side of the contrast line: a dark accent darkens further and carries
    // white, a pale accent lightens and carries near-black. Shading everything
    // toward navy — as this did — put white text on pale yellow.
    '--hero-shade': onColor(accent) === '#ffffff' ? '#0f172a' : '#fbfbfd',
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
  const type = TYPE_SCALES[theme.typeScale]
  const shadow = ELEVATIONS[theme.elevation]
  return {
    '--font': pack.body,
    '--font-heading': pack.heading,
    '--heading-weight': theme.headingWeight === 'bold' ? '700' : '800',
    '--radius': theme.corners === 'sharp' ? '4px' : '14px',
    // Pill controls have to follow the corner setting too. They were fixed at
    // 999px, so a "Square corners" course still shipped lozenge buttons — the
    // one obviously rounded thing left on an otherwise squared-off page.
    '--radius-pill': theme.corners === 'sharp' ? '4px' : '999px',
    '--content-max': CONTENT_WIDTH[theme.width],
    '--font-size': `${FONT_SCALES[theme.fontScale]}px`,
    '--space': String(SPACING_SCALES[theme.spacing]),
    // Heading ramp. The hero is clamped so a dramatic scale still fits a phone.
    '--h1': `${type.h1}px`,
    '--h2': `${type.h2}px`,
    '--h3': `${type.h3}px`,
    '--lead': `${type.lead}px`,
    '--hero-size': `clamp(28px, 5vw, ${type.hero}px)`,
    '--shadow-sm': shadow.sm,
    '--shadow-md': shadow.md,
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
export function lessonHero(course: Course, lesson: Lesson | undefined): HeroStyle {
  const theme = normalizeTheme(course.theme)
  return lesson?.theme?.hero ?? theme.hero
}

/** The picture behind an `image` hero: the lesson's own, else the course cover.
    Returns '' when there is nothing to show — callers fall back to `gradient`,
    which is what keeps an image hero from rendering as a bare grey band. */
export function lessonHeroImage(course: Course, lesson: Lesson | undefined): string {
  return resolveAssetSrc(lesson?.theme?.heroImage ?? '', course.assets) || course.coverImage || ''
}
