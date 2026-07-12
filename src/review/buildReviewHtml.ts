import reviewCss from './player/review.css?raw'
import reviewJs from './player/review.js?raw'
import { buildPlayerHtml } from '../scorm/buildPlayerHtml'
import { downloadBlob, slugify } from '../utils/file'
import { getSnapshot } from './reviewStore'
import type { Review, ReviewSnapshot } from './types'

/** The reviewable course: the real exported player, plus the review layer.
 *
 *  Built from the round's frozen snapshot, not the live course, so a reviewer
 *  always sees the version they were sent even if the author keeps editing.
 *  It's one self-contained file — host it anywhere, or email it. There is no
 *  server: feedback comes back as a small JSON file the reviewer downloads. */
export function buildReviewHtml(review: Review, course: ReviewSnapshot): string {
  const base = buildPlayerHtml(course, 'preview')

  const config = JSON.stringify({
    reviewId: review.id,
    courseId: review.courseId,
    courseTitle: course.title,
    reviewName: review.name,
  }).replace(/<\//g, '<\\/')

  const layer = `<style>
${reviewCss}
</style>
<script>
window.REVIEW = ${config};
</script>
<script>
${reviewJs}
</script>
</body>`

  // The layer goes last, so it initialises after the player has defined the DOM
  // it decorates. Everything stays in the one file.
  return base.replace('</body>', layer)
}

/** Rebuild the file for a round. The snapshot is fetched on demand — it is the
    only time a round's full course copy is needed. */
export async function downloadReviewHtml(review: Review): Promise<boolean> {
  const course = await getSnapshot(review.id)
  if (!course) return false
  const blob = new Blob([buildReviewHtml(review, course)], { type: 'text/html' })
  downloadBlob(blob, `${slugify(course.title)}-review.html`)
  return true
}
