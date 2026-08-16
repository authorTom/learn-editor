// Vendor the font packs into public/fonts/, so the app serves its own type.
//
// Why this exists rather than a <link> to fonts.googleapis.com:
//
//   • Privacy and law. Loading the stylesheet sends every visitor's IP to
//     Google on every page view. A German court has held that doing so without
//     consent breaches the GDPR, and this tool's users are in-house L&D teams
//     inside organisations that have to answer that question.
//   • Deployment. Learn Editor is self-hosted, routinely on an internal network
//     with no route to the outside. A third-party stylesheet turns "the fonts
//     are wrong" into a support ticket nobody can act on.
//   • Performance. It was two extra connections and a render-blocking request
//     on the critical path, for fonts we could serve from the same origin.
//   • CSP. A strict style-src is impossible while an external stylesheet has to
//     be allowed.
//
// Only the `latin` and `latin-ext` subsets are kept. The full set includes
// Cyrillic, Greek and Vietnamese cuts of all six families, which is several
// megabytes for glyphs this product's interface never renders. If that changes,
// widen SUBSETS.
//
// Run: npm run fonts:fetch

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, '..', 'public', 'fonts')

/** A modern desktop UA, or Google serves the legacy TTF stylesheet instead. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SUBSETS = new Set(['latin', 'latin-ext'])

/**
 * Every family the app can render: the editor's own UI face (Inter) plus every
 * family named by a pack in FONT_PACKS (src/types.ts), at the union of the
 * weights those packs ask for.
 *
 * Keep this in step with FONT_PACKS. A pack whose family is missing here still
 * renders — the stacks all end in a system font — but it renders as the
 * fallback, which is a theme quietly not doing what it says.
 */
const FAMILIES = [
  'family=Inter:wght@400;500;600;700;800',
  'family=Playfair+Display:wght@600;700;800',
  'family=Source+Sans+3:wght@400;600;700',
  'family=Nunito:wght@400;600;700;800',
  'family=IBM+Plex+Sans:wght@400;500;600;700',
  'family=Space+Grotesk:wght@500;600;700',
  'family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800',
  'family=Manrope:wght@400;500;600;700;800',
  'family=Lora:wght@500;600;700',
]

const FACE = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g

function field(block, name) {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(block)
  return m ? m[1].trim() : ''
}

/** inter-400-normal.woff2 — readable in devtools, stable across refetches. */
function fileNameFor(family, weight, style) {
  const slug = family.replace(/['"]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${slug}-${weight}-${style}.woff2`
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const rules = []
  let downloaded = 0

  for (const family of FAMILIES) {
    const url = `https://fonts.googleapis.com/css2?${family}&display=swap`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${family}: stylesheet request returned ${res.status}`)
    const css = await res.text()

    let kept = 0
    for (const [, subset, block] of css.matchAll(FACE)) {
      if (!SUBSETS.has(subset)) continue

      const name = field(block, 'font-family').replace(/^['"]|['"]$/g, '')
      const weight = field(block, 'font-weight') || '400'
      const style = field(block, 'font-style') || 'normal'
      const unicodeRange = field(block, 'unicode-range')
      const src = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1]
      if (!src || !name) continue

      const file = fileNameFor(name, weight, style)
      // latin and latin-ext are separate files for the same weight; both are
      // wanted, so the subset goes in the name when they would collide.
      const finalName = subset === 'latin' ? file : file.replace('.woff2', '-ext.woff2')

      const bytes = await fetch(src, { headers: { 'User-Agent': UA } })
      if (!bytes.ok) throw new Error(`${name} ${weight}: font file returned ${bytes.status}`)
      await writeFile(path.join(OUT, finalName), Buffer.from(await bytes.arrayBuffer()))
      downloaded++
      kept++

      rules.push(
        `@font-face {\n` +
          `  font-family: '${name}';\n` +
          `  font-style: ${style};\n` +
          `  font-weight: ${weight};\n` +
          // swap: text is readable in a fallback immediately and reflows when
          // the face lands. The alternative is invisible text on a slow disk.
          `  font-display: swap;\n` +
          `  src: url('/fonts/${finalName}') format('woff2');\n` +
          (unicodeRange ? `  unicode-range: ${unicodeRange};\n` : '') +
          `}`
      )
    }
    if (!kept) throw new Error(`${family}: no latin faces found — did the API change?`)
    console.log(`  ${family.replace('family=', '')} — ${kept} faces`)
  }

  const header =
    `/* Generated by scripts/fetch-fonts.mjs — do not edit by hand.\n` +
    `   Fonts are served from this origin rather than fonts.googleapis.com; see\n` +
    `   that script for why. Refresh with: npm run fonts:fetch */\n\n`

  await writeFile(path.join(OUT, 'fonts.css'), header + rules.join('\n\n') + '\n')

  const files = await readdir(OUT)
  console.log(`\n${downloaded} font files + fonts.css written to public/fonts (${files.length} total)`)
}

main().catch((err) => {
  console.error(`Could not fetch fonts: ${err.message}`)
  process.exit(1)
})
