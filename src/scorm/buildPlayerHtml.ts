import playerCss from './player/player.css?raw'
import playerJs from './player/player.js?raw'
import type { Course } from '../types'
import { escapeHtml } from '../utils/file'

export type ScormVersion = '1.2' | '2004' | 'preview'

/** Build the fully self-contained player page (used for preview iframes and SCORM export). */
export function buildPlayerHtml(course: Course, version: ScormVersion): string {
  // </script> inside the JSON payload would terminate the script tag early
  const courseJson = JSON.stringify(course).replace(/<\//g, '<\\/')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(course.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${playerCss}
</style>
</head>
<body>
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
