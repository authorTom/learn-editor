import type { Course, TemplateLibraryFile } from './types'

/** The exemplar course shipped with the app. It lives in `public/` and is fetched
    on demand, so its ~110 KB of embedded diagrams never enter the JS bundle. */
export const EXAMPLE_COURSE = {
  title: 'Recording a 12-Lead ECG',
  blurb:
    'A finished UK clinical course — 9 lessons, hotspots, sequence and matching interactions, quizzes and per-lesson theming. A good place to see what the editor can do.',
  file: 'examples/recording-a-12-lead-ecg-uk.json',
}

export async function fetchExampleCourse(): Promise<Course> {
  const res = await fetch(import.meta.env.BASE_URL + EXAMPLE_COURSE.file)
  if (!res.ok) throw new Error(`Could not load the example course (${res.status})`)
  return (await res.json()) as Course
}

/** The template library a fresh install is seeded with. Generated from the
    exemplar by `scripts/build-seed-templates.mjs`; also lives in `public/`. */
export const SEED_TEMPLATES_FILE = 'examples/seed-templates.json'

export async function fetchSeedTemplates(): Promise<TemplateLibraryFile> {
  const res = await fetch(import.meta.env.BASE_URL + SEED_TEMPLATES_FILE)
  if (!res.ok) throw new Error(`Could not load seed templates (${res.status})`)
  return (await res.json()) as TemplateLibraryFile
}
