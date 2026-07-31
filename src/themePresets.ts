import type { CourseTheme } from './types'
import { defaultTheme } from './types'

/**
 * Curated whole-theme starting points.
 *
 * The individual theme controls are all still there, but eleven of them is a lot
 * of decisions to make before you have written a word — and the combinations
 * that actually look considered are a small subset of the ~30,000 available.
 * A preset sets every visual field at once so an author can pick a look, start
 * writing, and adjust later.
 *
 * Deliberately *not* included in a preset: `logo`, `titlePage`, `progress`,
 * `lessonNumbers` and `nav`. Those are decisions about how the course works
 * rather than how it looks, and silently flipping them when someone tries on a
 * new palette would be a nasty surprise.
 */
export type PresetPatch = Omit<
  CourseTheme,
  'logo' | 'titlePage' | 'progress' | 'lessonNumbers' | 'nav'
>

export interface ThemePreset {
  id: string
  name: string
  description: string
  theme: PresetPatch
}

/** Listed field by field rather than by stripping keys off a spread, so adding a
    theme field is a type error here — a prompt to decide whether a preset owns
    it — instead of silently leaking a `logo` into every preset. */
function preset(over: Partial<PresetPatch>): PresetPatch {
  const m = { ...defaultTheme, ...over }
  return {
    primaryColor: m.primaryColor,
    scheme: m.scheme,
    fontPack: m.fontPack,
    hero: m.hero,
    width: m.width,
    corners: m.corners,
    headingWeight: m.headingWeight,
    fontScale: m.fontScale,
    spacing: m.spacing,
    typeScale: m.typeScale,
    elevation: m.elevation,
  }
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Restrained blue, generous whitespace, soft cards',
    theme: preset({
      primaryColor: '#1d4ed8',
      scheme: 'cool',
      fontPack: 'corporate',
      hero: 'solid',
      width: 'normal',
      corners: 'soft',
      headingWeight: 'bold',
      typeScale: 'balanced',
      elevation: 'soft',
      spacing: 'normal',
    }),
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Serif headlines at scale, narrow measure, flat surfaces',
    theme: preset({
      primaryColor: '#b91c1c',
      scheme: 'warm',
      fontPack: 'editorial',
      hero: 'minimal',
      width: 'narrow',
      corners: 'sharp',
      headingWeight: 'bold',
      typeScale: 'dramatic',
      elevation: 'flat',
      spacing: 'airy',
    }),
  },
  {
    id: 'academic',
    name: 'Academic',
    description: 'Long-form reading, quiet accent, compact headings',
    theme: preset({
      primaryColor: '#155e75',
      scheme: 'mist',
      fontPack: 'academic',
      hero: 'minimal',
      width: 'normal',
      corners: 'sharp',
      headingWeight: 'bold',
      typeScale: 'compact',
      elevation: 'flat',
      fontScale: 'large',
      spacing: 'normal',
    }),
  },
  {
    id: 'vivid',
    name: 'Vivid',
    description: 'Full-bleed gradient headers and lifted cards',
    theme: preset({
      primaryColor: '#7c3aed',
      scheme: 'lavender',
      fontPack: 'modern',
      hero: 'gradient',
      width: 'normal',
      corners: 'soft',
      headingWeight: 'extrabold',
      typeScale: 'dramatic',
      elevation: 'raised',
      spacing: 'normal',
    }),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'No chrome at all — type, rules and one accent',
    theme: preset({
      primaryColor: '#334155',
      scheme: 'light',
      fontPack: 'modern',
      hero: 'minimal',
      width: 'narrow',
      corners: 'sharp',
      headingWeight: 'bold',
      typeScale: 'compact',
      elevation: 'flat',
      spacing: 'airy',
    }),
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Warm and rounded, wide measure, roomy spacing',
    theme: preset({
      primaryColor: '#ea580c',
      scheme: 'sand',
      fontPack: 'friendly',
      hero: 'split',
      width: 'wide',
      corners: 'soft',
      headingWeight: 'extrabold',
      typeScale: 'balanced',
      elevation: 'soft',
      spacing: 'airy',
    }),
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Dark surfaces, tight rhythm, high-contrast accent',
    theme: preset({
      primaryColor: '#22d3ee',
      scheme: 'midnight',
      fontPack: 'technical',
      hero: 'split',
      width: 'wide',
      corners: 'sharp',
      headingWeight: 'bold',
      typeScale: 'compact',
      elevation: 'flat',
      spacing: 'compact',
    }),
  },
  {
    id: 'immersive',
    name: 'Immersive',
    description: 'Photographic headers over a deep, quiet palette',
    theme: preset({
      primaryColor: '#f59e0b',
      scheme: 'charcoal',
      fontPack: 'elegant',
      hero: 'image',
      width: 'normal',
      corners: 'soft',
      headingWeight: 'extrabold',
      typeScale: 'dramatic',
      elevation: 'raised',
      spacing: 'normal',
    }),
  },
]

/** Which preset, if any, the current theme still matches exactly. Lets the
    picker show a selected state that disappears the moment you hand-tune. */
export function matchingPreset(theme: CourseTheme): string | null {
  const found = THEME_PRESETS.find((p) =>
    (Object.keys(p.theme) as (keyof PresetPatch)[]).every((k) => theme[k] === p.theme[k])
  )
  return found ? found.id : null
}
