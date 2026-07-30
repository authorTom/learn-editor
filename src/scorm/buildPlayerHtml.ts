import playerCss from './player/player.css?raw'
import playerJs from './player/player.js?raw'
import type { Course, Lesson } from '../types'
import { FONT_PACKS, SCHEMES, normalizeTheme } from '../types'
import { courseVars, schemeOf, schemeVars } from '../theme'
import { escapeHtml } from '../utils/file'

export type ScormVersion = '1.2' | '2004' | 'preview'

/** The CSS custom properties a scheme + accent produce, plus the `dark` flag
    the player uses to toggle its body class. Colours come from the shared
    derivation in theme.ts, which the editor canvas reads from too. */
function themeVars(scheme: (typeof SCHEMES)[number], accent: string) {
  return { ...schemeVars(scheme, accent), dark: !!scheme.dark }
}

/** Only the lessons that actually override something get an entry. */
function lessonThemes(course: Course) {
  const theme = normalizeTheme(course.theme)
  const baseScheme = schemeOf(theme.scheme)
  const map: Record<string, unknown> = {
    __base: { ...themeVars(baseScheme, theme.primaryColor), hero: theme.hero },
  }
  course.lessons.forEach((l: Lesson) => {
    const t = l.theme
    if (!t || Object.keys(t).length === 0) return
    // An unrecognised id must fall back to the *course* scheme, not to light.
    const scheme = SCHEMES.find((s) => s.id === t.scheme) ?? baseScheme
    map[l.id] = {
      ...themeVars(scheme, t.primaryColor ?? theme.primaryColor),
      hero: t.hero ?? theme.hero,
    }
  })
  return map
}

/** Build the fully self-contained player page (used for preview iframes and SCORM export). */
export function buildPlayerHtml(course: Course, version: ScormVersion): string {
  // </script> inside the JSON payload would terminate the script tag early
  const esc = (o: unknown) => JSON.stringify(o).replace(/<\//g, '<\\/')
  const courseJson = esc(course)
  const lessonThemesJson = esc(lessonThemes(course))

  const theme = normalizeTheme(course.theme)
  const pack = FONT_PACKS.find((p) => p.id === theme.fontPack) ?? FONT_PACKS[0]
  const scheme = SCHEMES.find((s) => s.id === theme.scheme) ?? SCHEMES[0]
  const fontsLink = pack.google
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${pack.google}&display=swap" rel="stylesheet">`
    : ''
  // Same derivation the editor canvas uses, serialised. Key order is fixed so
  // the emitted stylesheet stays stable across builds.
  const vars = courseVars(course)
  const themeCss = `:root {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}`
  const bodyClass = [
    `hero-${theme.hero}`,
    theme.nav === 'top' ? 'nav-top' : '',
    scheme.dark ? 'theme-dark' : '',
  ].join(' ').trim()

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(course.title)}</title>
${fontsLink}
<style>
${playerCss}
${themeCss}
</style>
</head>
<body class="${bodyClass}">
<div id="app"></div>
<script>
window.COURSE = ${courseJson};
window.LESSON_THEMES = ${lessonThemesJson};
window.SCORM_VERSION = ${JSON.stringify(version)};
</script>
<script>
${playerJs}
</script>
</body>
</html>`
}
