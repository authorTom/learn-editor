import type { Block, Course, Lesson } from '../types'
import type { AnchorState, CommentTarget, ReviewComment, TextSelector } from './types'
import { blockPlainText, htmlToText, mapBlockText } from './blockText'

// Re-anchoring a comment to text the author may have edited since.
//
// The selector stores the quoted text plus a little context either side, not a
// character offset — offsets rot the moment anything above them changes. To
// re-anchor we look for the quote and, if it appears more than once, pick the
// occurrence whose surroundings best match the remembered context. This is the
// W3C Web Annotation TextQuoteSelector approach, and it degrades the way you'd
// want: an edited-away quote becomes a block-level comment rather than vanishing.

const CONTEXT = 32

function commonSuffixLen(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

function commonPrefixLen(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** Index of the occurrence of `sel.quote` in `text` that best matches the
    remembered context, or -1 if the quote is gone. */
export function findQuote(text: string, sel: TextSelector): number {
  if (!sel.quote) return -1
  const hits: number[] = []
  for (let i = text.indexOf(sel.quote); i !== -1; i = text.indexOf(sel.quote, i + 1)) {
    hits.push(i)
  }
  if (hits.length <= 1) return hits.length ? hits[0] : -1

  let best = hits[0]
  let bestScore = -1
  for (const i of hits) {
    const before = text.slice(Math.max(0, i - CONTEXT), i)
    const after = text.slice(i + sel.quote.length, i + sel.quote.length + CONTEXT)
    const score =
      commonSuffixLen(before, sel.prefix) + commonPrefixLen(after, sel.suffix)
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** Replace the selected range inside an HTML field, editing through its text
    nodes so surrounding markup (bold, links, list structure) survives intact.
    Returns null if the quote isn't in this field. */
function replaceInHtml(html: string, sel: TextSelector, replacement: string): string | null {
  const host = document.createElement('div')
  host.innerHTML = html

  const nodes: Text[] = []
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)

  const full = nodes.map((n) => n.data).join('')
  const start = findQuote(full, sel)
  if (start < 0) return null
  const end = start + sel.quote.length

  let pos = 0
  let done = false
  for (const node of nodes) {
    const from = pos
    const to = pos + node.data.length
    pos = to
    if (to <= start || from >= end) continue
    const cut0 = Math.max(start, from) - from
    const cut1 = Math.min(end, to) - from
    const head = node.data.slice(0, cut0)
    const tail = node.data.slice(cut1)
    // The whole replacement goes into the first node the range touches; later
    // nodes just lose their slice of it. Assigning `.data` escapes the text for
    // us, so a reviewer typing "<b>" can't inject markup.
    node.data = done ? head + tail : head + replacement + tail
    done = true
  }
  return host.innerHTML
}

function replaceInText(value: string, sel: TextSelector, replacement: string): string | null {
  const start = findQuote(value, sel)
  if (start < 0) return null
  return value.slice(0, start) + replacement + value.slice(start + sel.quote.length)
}

/** Apply a suggested edit to a block: swap the reviewer's quoted text for their
    replacement, in the first field that still contains it. Returns null if the
    quote no longer appears anywhere in the block — the author changed it since,
    so applying blind would clobber their work. */
export function applySuggestionToBlock(
  block: Block,
  sel: TextSelector,
  suggestion: string
): Block | null {
  let hit = false
  const next = mapBlockText(block, (value, kind) => {
    if (hit || !value) return value
    if (kind === 'html') {
      const out = replaceInHtml(value, sel, suggestion)
      if (out === null) return value
      hit = true
      return out
    }
    const out = replaceInText(value, sel, suggestion)
    if (out === null) return value
    hit = true
    return out
  })
  return hit ? next : null
}

// ---------- resolving a comment against the live course ----------

export interface Resolved {
  state: AnchorState
  lesson?: Lesson
  block?: Block
  /** The block's current text, for showing what the quote drifted away from. */
  currentText?: string
}

export function resolveTarget(course: Course, target: CommentTarget): Resolved {
  const lesson = course.lessons.find((l) => l.id === target.lessonId)
  if (!lesson) return { state: 'orphaned' }
  if (!target.blockId) return { state: 'anchored', lesson }

  const block = lesson.blocks.find((b) => b.id === target.blockId)
  if (!block) return { state: 'orphaned', lesson }
  if (!target.text) return { state: 'anchored', lesson, block }

  const text = blockPlainText(block)
  const found = findQuote(text, target.text) >= 0
  return { state: found ? 'anchored' : 'drifted', lesson, block, currentText: text }
}

/** Can this comment's suggestion still be applied cleanly?
 *
 *  A dry run of the real thing, not just an anchor check: a quote can be present
 *  in the block's text as a whole yet still span two separate fields (two
 *  accordion items, say), which no single-field replacement can rewrite. Asking
 *  the same code that does the work keeps the Apply button honest. */
export function canApply(course: Course, c: ReviewComment): boolean {
  if (!c.suggestion || !c.target.text || !c.target.blockId) return false
  const r = resolveTarget(course, c.target)
  if (r.state !== 'anchored' || !r.block) return false
  return applySuggestionToBlock(r.block, c.target.text, c.suggestion) !== null
}

/** Is a suggestion's replacement text actually in the course right now?
 *
 *  Applying a suggestion is an ordinary undoable edit, so ⌘Z can take the text
 *  back out while the comment still says "Applied". Checking the course itself,
 *  rather than trusting the stored status, keeps the inbox honest about what is
 *  really in the course. */
export function suggestionIsInCourse(course: Course, c: ReviewComment): boolean {
  if (!c.suggestion || !c.target.blockId) return false
  const r = resolveTarget(course, c.target)
  if (!r.block) return false
  return blockPlainText(r.block).includes(c.suggestion)
}

/** Why a suggestion's Apply button is disabled — so the author is told the truth
    rather than a guess. `spans-fields` is the case where the quoted text is still
    there but runs across two separate fields (two list items, an accordion's
    title into its body), which no single-field replacement can safely rewrite. */
export type ApplyBlocker = 'none' | 'not-a-suggestion' | 'orphaned' | 'drifted' | 'spans-fields'

export function applyBlocker(course: Course, c: ReviewComment): ApplyBlocker {
  if (!c.suggestion || !c.target.text || !c.target.blockId) return 'not-a-suggestion'
  const r = resolveTarget(course, c.target)
  if (r.state === 'orphaned' || !r.block) return 'orphaned'
  if (r.state === 'drifted') return 'drifted'
  return applySuggestionToBlock(r.block, c.target.text, c.suggestion) === null
    ? 'spans-fields'
    : 'none'
}

/** Short label for where a comment points, e.g. "Lesson 2 · Quiz". */
export function targetLabel(course: Course, target: CommentTarget): string {
  const idx = course.lessons.findIndex((l) => l.id === target.lessonId)
  const lesson = course.lessons[idx]
  if (!lesson) return 'Deleted lesson'
  const head = `Lesson ${idx + 1}`
  if (!target.blockId) return head
  const block = lesson.blocks.find((b) => b.id === target.blockId)
  if (!block) return `${head} · deleted block`
  return `${head} · ${BLOCK_LABEL[block.type] ?? block.type}`
}

const BLOCK_LABEL: Partial<Record<Block['type'], string>> = {
  text: 'Text',
  heading: 'Heading',
  statement: 'Statement',
  quote: 'Quote',
  list: 'List',
  image: 'Image',
  imageText: 'Image + text',
  gallery: 'Gallery',
  video: 'Video',
  embed: 'Embed',
  audio: 'Audio',
  divider: 'Divider',
  button: 'Button',
  note: 'Callout',
  columns: 'Columns',
  accordion: 'Accordion',
  tabs: 'Tabs',
  flashcards: 'Flashcards',
  sorting: 'Sequence',
  matching: 'Matching',
  hotspot: 'Hotspots',
  quiz: 'Quiz',
  html: 'Custom HTML',
}

/** Preview of a suggestion's effect, for the diff shown next to Apply. */
export function suggestionPreview(c: ReviewComment): { before: string; after: string } | null {
  if (!c.suggestion || !c.target.text) return null
  return { before: c.target.text.quote, after: c.suggestion }
}

export { htmlToText }
