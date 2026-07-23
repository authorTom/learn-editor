import type { Block } from '../types'

/** Whether a text field holds rich HTML or a plain string. Replacements have to
    know: HTML fields are edited through their text nodes so markup survives. */
export type TextKind = 'html' | 'text'

export type TextVisitor = (value: string, kind: TextKind) => string

/** Visit every author-facing text field on a block, replacing each with `fn`'s
    return value. The text twin of `mapBlockSrc` — one place to teach new block
    types about their prose, rather than scattering it through the review code.

    `html` blocks are deliberately skipped: their field is source code, and the
    text a reviewer selects is the *rendered* output, so a textual replacement
    could not be applied back safely. Reviewers can still comment on them. */
export function mapBlockText(block: Block, fn: TextVisitor): Block {
  const b = block
  const h = (s: string) => fn(s, 'html')
  const t = (s: string) => fn(s, 'text')

  switch (b.type) {
    case 'text':
      return { ...b, html: h(b.html) }
    case 'heading':
      return { ...b, text: t(b.text) }
    case 'statement':
      return { ...b, html: h(b.html) }
    case 'quote':
      return { ...b, html: h(b.html), attribution: t(b.attribution) }
    case 'list':
      return { ...b, items: b.items.map(h) }
    case 'image':
      return { ...b, caption: t(b.caption), alt: t(b.alt) }
    case 'imageText':
      return { ...b, html: h(b.html), alt: t(b.alt) }
    case 'gallery':
      return {
        ...b,
        images: b.images.map((im) => ({ ...im, caption: t(im.caption), alt: t(im.alt) })),
      }
    case 'video':
    case 'embed':
      return { ...b, caption: t(b.caption) }
    case 'audio':
      return { ...b, title: t(b.title) }
    case 'button':
      return { ...b, label: t(b.label) }
    case 'note':
      return { ...b, title: t(b.title), html: h(b.html) }
    case 'columns':
      return { ...b, columns: b.columns.map((c) => ({ ...c, html: h(c.html) })) }
    case 'accordion':
    case 'tabs':
      return { ...b, items: b.items.map((it) => ({ ...it, title: t(it.title), html: h(it.html) })) }
    case 'flashcards':
      return { ...b, cards: b.cards.map((c) => ({ ...c, front: h(c.front), back: h(c.back) })) }
    case 'sorting':
      return {
        ...b,
        title: t(b.title),
        items: b.items.map((it) => ({ ...it, text: t(it.text) })),
        feedbackCorrect: t(b.feedbackCorrect),
        feedbackIncorrect: t(b.feedbackIncorrect),
      }
    case 'matching':
      return {
        ...b,
        title: t(b.title),
        pairs: b.pairs.map((p) => ({ ...p, left: t(p.left), right: t(p.right) })),
        feedbackCorrect: t(b.feedbackCorrect),
        feedbackIncorrect: t(b.feedbackIncorrect),
      }
    case 'hotspot':
      return {
        ...b,
        title: t(b.title),
        alt: t(b.alt),
        spots: b.spots.map((s) => ({ ...s, label: t(s.label), html: h(s.html) })),
      }
    case 'quiz':
      return {
        ...b,
        title: t(b.title),
        questions: b.questions.map((q) => ({
          ...q,
          text: t(q.text),
          choices: q.choices.map((c) => ({ ...c, text: t(c.text) })),
          answers: q.answers.map(t),
          feedbackCorrect: t(q.feedbackCorrect),
          feedbackIncorrect: t(q.feedbackIncorrect),
        })),
      }
    default:
      // divider, html — nothing a suggestion can safely rewrite
      return b
  }
}

/** Strip tags from an HTML field, the way the player would render it to text. */
export function htmlToText(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.textContent ?? ''
}

/** Everything a reader would see in this block, as one string. Used to test
    whether a reviewer's quoted text still exists in the live course.

    The fields are joined with *nothing* between them, because that is what the
    reviewer's browser did: their quote was sliced out of the block's rendered
    text nodes, which run straight into one another. Joining with a separator
    here would put a character inside any quote that spans two fields — two list
    items, an accordion's title and its body — so the quote could never be found
    again, and the author would be told they had edited text they had not
    touched. Mirror the DOM exactly and the comparison stays honest. */
export function blockPlainText(block: Block): string {
  const parts: string[] = []
  mapBlockText(block, (value, kind) => {
    const s = kind === 'html' ? htmlToText(value) : value
    if (s) parts.push(s)
    return value
  })
  return parts.join('')
}
