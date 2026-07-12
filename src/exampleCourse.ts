import type { Course } from './types'

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
