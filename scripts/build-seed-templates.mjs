// Generates public/examples/seed-templates.json — the template library a fresh
// install is seeded with. Content is extracted from the shipped ECG exemplar so
// every template is real, valid, and renders on its own (referenced media is
// carried with each block). Re-run after the exemplar changes:
//
//   node scripts/build-seed-templates.mjs
//
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const COURSE = resolve(root, 'public/examples/recording-a-12-lead-ecg-uk.json')
const OUT = resolve(root, 'public/examples/seed-templates.json')

const course = JSON.parse(readFileSync(COURSE, 'utf8'))
const now = Date.now()

/** Assets a block refers to via `asset:<id>`, so a lifted block still renders. */
function assetsFor(block) {
  const refs = new Set(
    [...JSON.stringify(block).matchAll(/asset:([a-zA-Z0-9_-]+)/g)].map((m) => m[1]),
  )
  return (course.assets ?? []).filter((a) => refs.has(a.id))
}

function firstBlock(type) {
  for (const lesson of course.lessons) {
    const b = lesson.blocks.find((x) => x.type === type)
    if (b) return b
  }
  return null
}

// Representative, self-contained blocks worth reusing across courses.
const picks = [
  ['note', 'Callout / note panel'],
  ['statement', 'Big statement'],
  ['quiz', 'Knowledge check (quiz)'],
  ['matching', 'Matching pairs'],
  ['sorting', 'Sequence — put in order'],
  ['flashcards', 'Flashcards'],
  ['accordion', 'Accordion'],
  ['tabs', 'Tabbed panel'],
  ['hotspot', 'Image hotspots'],
]

const blockTemplates = []
for (const [type, name] of picks) {
  const block = firstBlock(type)
  if (!block) {
    console.warn(`  (skipped: no "${type}" block found in the exemplar)`)
    continue
  }
  blockTemplates.push({
    id: `seed-btpl-${type}`,
    name,
    blockType: type,
    block: structuredClone(block),
    assets: assetsFor(block),
    createdAt: now,
  })
}

// The whole exemplar as a course template, so a new course can start from it.
const courseTemplates = [
  {
    id: 'seed-ctpl-ecg',
    name: 'Clinical skill course (ECG exemplar)',
    description:
      course.description ||
      'A complete 9-lesson clinical course to start from: interactions, quizzes and per-lesson theming.',
    coverImage: course.coverImage ?? '',
    theme: course.theme,
    lessons: structuredClone(course.lessons),
    assets: structuredClone(course.assets ?? []),
    completion: course.completion,
    createdAt: now,
  },
]

const library = {
  kind: 'quoin-templates',
  version: 1,
  blockTemplates,
  courseTemplates,
}

writeFileSync(OUT, JSON.stringify(library, null, 2) + '\n')
console.log(
  `Wrote ${OUT}\n  ${blockTemplates.length} block templates: ${blockTemplates
    .map((b) => b.blockType)
    .join(', ')}\n  ${courseTemplates.length} course template`,
)
