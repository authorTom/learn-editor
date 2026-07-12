import playerCss from './player/player.css?raw'
import playerJs from './player/player.js?raw'
import type { Course } from '../types'
import { FONT_PACKS, SCHEMES, normalizeTheme } from '../types'
import { escapeHtml } from '../utils/file'

export type ScormVersion = '1.2' | '2004' | 'preview'

const CONTENT_WIDTH = { narrow: '640px', normal: '760px', wide: '920px' } as const

/** Build the fully self-contained player page (used for preview iframes and SCORM export). */
export function buildPlayerHtml(course: Course, version: ScormVersion): string {
  // </script> inside the JSON payload would terminate the script tag early
  const courseJson = JSON.stringify(course).replace(/<\//g, '<\\/')

  const theme = normalizeTheme(course.theme)
  const pack = FONT_PACKS.find((p) => p.id === theme.fontPack) ?? FONT_PACKS[0]
  const scheme = SCHEMES.find((s) => s.id === theme.scheme) ?? SCHEMES[0]
  const fontsLink = pack.google
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${pack.google}&display=swap" rel="stylesheet">`
    : ''
  const themeCss = `:root {
  --accent: ${theme.primaryColor};
  --accent-soft: color-mix(in srgb, ${theme.primaryColor} ${scheme.id === 'dark' ? '22%' : '10%'}, ${scheme.bg});
  --bg: ${scheme.bg};
  --bg-soft: ${scheme.bgSoft};
  --ink: ${scheme.ink};
  --ink-soft: ${scheme.inkSoft};
  --line: ${scheme.line};
  --font: ${pack.body};
  --font-heading: ${pack.heading};
  --heading-weight: ${theme.headingWeight === 'bold' ? 700 : 800};
  --radius: ${theme.corners === 'sharp' ? '4px' : '14px'};
  --content-max: ${CONTENT_WIDTH[theme.width]};
}`
  const bodyClass = [`hero-${theme.hero}`, theme.nav === 'top' ? 'nav-top' : ''].join(' ').trim()

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
window.SCORM_VERSION = ${JSON.stringify(version)};
</script>
<script>
${playerJs}
</script>
</body>
</html>`
}
