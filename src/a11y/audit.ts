import type { Block, Course, Lesson } from '../types'
import { SCHEMES, normalizeTheme, resolveAssetSrc } from '../types'
import { contrastRatio, schemeOf } from '../theme'

/**
 * Accessibility audit of the *authored course*.
 *
 * The distinction matters. Authoring tools generally make their own interface
 * accessible and then ship whatever the author typed — so a perfectly
 * accessible editor happily exports a course with no alt text, headings that
 * skip two levels, four links all called "click here", and an accent colour
 * that fails contrast on every link in the package. None of that is the
 * player's fault and none of it is detectable by testing the player alone.
 *
 * Everything here is derived from the course model rather than from a rendered
 * DOM. That is a deliberate trade: model analysis cannot see computed styles,
 * but it can point at the exact block that needs fixing, it is deterministic,
 * and it runs on every keystroke without a layout pass.
 */

export type Severity = 'error' | 'warning' | 'review'

export interface Finding {
  id: string
  /** WCAG 2.2 success criterion, e.g. '1.1.1'. */
  criterion: string
  severity: Severity
  /** One line, in the author's language, saying what is wrong. */
  message: string
  /** What to do about it. */
  fix: string
  lessonId?: string
  lessonTitle?: string
  blockId?: string
  blockType?: string
}

interface Ctx {
  course: Course
  findings: Finding[]
  seq: number
}

function add(ctx: Ctx, f: Omit<Finding, 'id'>) {
  ctx.findings.push({ ...f, id: 'f' + ++ctx.seq })
}

/** Strip tags and collapse whitespace, the way a reader would see the text. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const PLACEHOLDER_ALT = /^(image|img|photo|picture|graphic|screenshot|untitled|dsc[_-]?\d+|img[_-]?\d+)([ _-]?\d+)?(\.\w+)?$/i
const VAGUE_LINK = /^(click here|here|read more|more|link|this|learn more|find out more|details|download)\.?$/i

/** Anchors inside rich text: [href, inner text]. */
function links(html: string): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = []
  const re = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push({ href: m[1], label: text(m[2]) })
  return out
}

/** Every rich-text field on a block, so link and colour rules see all of it. */
function richFields(b: Block): string[] {
  const out: string[] = []
  const push = (s?: string) => { if (s) out.push(s) }
  const anyB = b as unknown as Record<string, unknown>
  push(anyB.html as string | undefined)
  if (Array.isArray(anyB.items)) {
    ;(anyB.items as Record<string, unknown>[]).forEach((it) => {
      if (typeof it === 'string') out.push(it)
      else push(it.html as string | undefined)
    })
  }
  if (Array.isArray(anyB.columns)) {
    ;(anyB.columns as Record<string, unknown>[]).forEach((c) => push(c.html as string | undefined))
  }
  if (Array.isArray(anyB.cards)) {
    ;(anyB.cards as Record<string, unknown>[]).forEach((c) => {
      push(c.front as string | undefined)
      push(c.back as string | undefined)
    })
  }
  if (Array.isArray(anyB.spots)) {
    ;(anyB.spots as Record<string, unknown>[]).forEach((s) => push(s.html as string | undefined))
  }
  return out
}

// ---------- individual checks ----------

function checkImages(ctx: Ctx, b: Block, l: Lesson) {
  const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }

  const imageAlt = (src: string, alt: string, label: string) => {
    if (!src) return
    const a = alt.trim()
    if (!a) {
      add(ctx, {
        criterion: '1.1.1', severity: 'error',
        message: `${label} has no alternative text.`,
        fix: 'Describe what the image conveys in the Alt text field. If it is purely decorative, say so explicitly by writing "decorative".',
        ...where,
      })
    } else if (a.toLowerCase() !== 'decorative' && PLACEHOLDER_ALT.test(a)) {
      add(ctx, {
        criterion: '1.1.1', severity: 'error',
        message: `${label} has placeholder alternative text (“${a}”).`,
        fix: 'Replace it with a description of what the image shows or means in this context.',
        ...where,
      })
    } else if (a.length > 200) {
      add(ctx, {
        criterion: '1.1.1', severity: 'warning',
        message: `${label} has very long alternative text (${a.length} characters).`,
        fix: 'Keep alt text to a sentence or two. Move longer explanation into a caption or a paragraph, where everyone can read it.',
        ...where,
      })
    }
  }

  switch (b.type) {
    case 'image':
      imageAlt(b.src, b.alt, 'Image')
      break
    case 'imageText':
      imageAlt(b.src, b.alt, 'Image')
      break
    case 'hotspot':
      imageAlt(b.src, b.alt, 'Hotspot image')
      b.spots.forEach((s, i) => {
        if (!s.label.trim()) {
          add(ctx, {
            criterion: '4.1.2', severity: 'error',
            message: `Hotspot ${i + 1} has no label.`,
            fix: 'Give every marker a short label. It is the only accessible name a screen reader has for the button.',
            ...where,
          })
        }
      })
      break
    case 'gallery':
      b.images.forEach((im, i) => imageAlt(im.src, im.alt, `Gallery image ${i + 1}`))
      break
    case 'cards':
      b.items.forEach((c, i) => {
        // A card image is decorative when the card also has a title: the title
        // already carries the meaning. Flag only image-only cards.
        if (c.src && !c.title.trim() && !text(c.html)) {
          add(ctx, {
            criterion: '1.1.1', severity: 'warning',
            message: `Card ${i + 1} is an image with no title or text.`,
            fix: 'Add a title or description. The card image is rendered as decorative, so an image-only card conveys nothing to a screen reader.',
            ...where,
          })
        }
      })
      break
  }
}

function checkMedia(ctx: Ctx, b: Block, l: Lesson) {
  const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }
  if (b.type === 'video') {
    add(ctx, {
      criterion: '1.2.2', severity: 'review',
      message: 'Video needs captions — confirm the hosted video has them.',
      fix: 'Captions live with the video on YouTube or Vimeo, not in this course. Check the video has a real caption track, not auto-generated captions alone.',
      ...where,
    })
    if (!b.caption.trim()) {
      add(ctx, {
        criterion: '1.2.3', severity: 'warning',
        message: 'Video has no caption or summary in the course.',
        fix: 'Add a caption describing what the video covers, so learners who cannot watch it know what they are missing.',
        ...where,
      })
    }
  }
  if (b.type === 'audio') {
    add(ctx, {
      criterion: '1.2.1', severity: 'error',
      message: 'Audio clip has no transcript.',
      fix: 'Add a text block with a transcript directly after the audio. Audio-only content needs a full text alternative.',
      ...where,
    })
  }
  if (b.type === 'embed') {
    add(ctx, {
      criterion: '1.1.1', severity: 'review',
      message: 'Embedded page — its accessibility is outside this course.',
      fix: 'Confirm the embedded site meets your conformance target, or provide the same information in the course itself.',
      ...where,
    })
  }
  if (b.type === 'html') {
    add(ctx, {
      criterion: '4.1.2', severity: 'review',
      message: 'Custom HTML block — not analysable by this tool.',
      fix: 'Check by hand that any controls in this markup have accessible names, are keyboard operable, and that images carry alt text.',
      ...where,
    })
  }
}

function checkLinks(ctx: Ctx, b: Block, l: Lesson) {
  const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }
  richFields(b).forEach((html) => {
    links(html).forEach(({ href, label }) => {
      if (!label) {
        add(ctx, {
          criterion: '2.4.4', severity: 'error',
          message: 'A link has no text.',
          fix: 'Give the link visible text that says where it goes.',
          ...where,
        })
      } else if (VAGUE_LINK.test(label)) {
        add(ctx, {
          criterion: '2.4.4', severity: 'warning',
          message: `Link text “${label}” does not say where it goes.`,
          fix: 'Rewrite it to name the destination — “the data retention policy” rather than “click here”.',
          ...where,
        })
      } else if (/^https?:\/\//i.test(label)) {
        add(ctx, {
          criterion: '2.4.4', severity: 'warning',
          message: 'A raw URL is being used as link text.',
          fix: 'Replace the URL with a description. Screen readers read the whole address out character by character.',
          ...where,
        })
      }
      if (href && /^https?:\/\//i.test(href) === false && !href.startsWith('#') && !href.startsWith('mailto:')) {
        add(ctx, {
          criterion: '2.4.4', severity: 'warning',
          message: `Link “${label}” points at “${href}”, which is not an absolute address.`,
          fix: 'Use a full https:// address. A course runs from inside an LMS, where relative links resolve against the LMS, not your site.',
          ...where,
        })
      }
    })
  })
  if (b.type === 'button') {
    if (!b.label.trim()) {
      add(ctx, {
        criterion: '2.4.4', severity: 'error',
        message: 'Button has no label.',
        fix: 'Give the button text describing what it does.',
        ...where,
      })
    } else if (VAGUE_LINK.test(b.label.trim())) {
      add(ctx, {
        criterion: '2.4.4', severity: 'warning',
        message: `Button text “${b.label}” does not say where it goes.`,
        fix: 'Name the destination in the button label.',
        ...where,
      })
    }
    if (!b.url.trim()) {
      add(ctx, {
        criterion: '4.1.2', severity: 'warning',
        message: `Button “${b.label}” has no address.`,
        fix: 'Add a URL, or remove the button. It currently renders as a link to nowhere.',
        ...where,
      })
    }
  }
}

function checkHeadings(ctx: Ctx, l: Lesson) {
  // The lesson title renders as the page h2, so the first heading block inside
  // a lesson may be h2 or h3 but not h1.
  let previous = 2
  l.blocks.forEach((b) => {
    if (b.type !== 'heading') return
    const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }
    if (!b.text.trim()) {
      add(ctx, {
        criterion: '2.4.6', severity: 'error',
        message: 'Empty heading.',
        fix: 'Give the heading text, or delete it. An empty heading is announced as a heading with no name.',
        ...where,
      })
      return
    }
    const level = b.level === 1 ? 1 : b.level
    if (level === 1) {
      add(ctx, {
        criterion: '1.3.1', severity: 'warning',
        message: `Heading “${b.text}” is level 1, but the lesson title is already the page's top heading.`,
        fix: 'Use Heading 2 for sections within a lesson, so the outline has no two competing top levels.',
        ...where,
      })
    } else if (level > previous + 1) {
      add(ctx, {
        criterion: '1.3.1', severity: 'error',
        message: `Heading “${b.text}” jumps from level ${previous} to level ${level}.`,
        fix: `Use level ${previous + 1} here. Screen reader users navigate by heading level, and a skipped level reads as missing content.`,
        ...where,
      })
    }
    previous = level
  })
}

function checkInteractions(ctx: Ctx, b: Block, l: Lesson) {
  const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }
  if (b.type === 'quiz') {
    b.questions.forEach((q, i) => {
      if (!q.text.trim()) {
        add(ctx, {
          criterion: '3.3.2', severity: 'error',
          message: `Question ${i + 1} has no text.`,
          fix: 'Write the question. An unlabelled input has nothing for a screen reader to announce.',
          ...where,
        })
      }
      if (q.type !== 'fillin' && q.choices.some((c) => !c.text.trim())) {
        add(ctx, {
          criterion: '4.1.2', severity: 'error',
          message: `Question ${i + 1} has a blank answer option.`,
          fix: 'Fill in or remove empty options — a radio button with no label cannot be identified.',
          ...where,
        })
      }
      if (q.type !== 'fillin' && !q.choices.some((c) => c.correct)) {
        add(ctx, {
          criterion: '3.3.1', severity: 'error',
          message: `Question ${i + 1} has no correct answer marked.`,
          fix: 'Mark at least one option correct, or the question can never be answered right.',
          ...where,
        })
      }
      if (q.type === 'fillin' && !q.answers.some((a) => a.trim())) {
        add(ctx, {
          criterion: '3.3.1', severity: 'error',
          message: `Question ${i + 1} accepts no answers.`,
          fix: 'Add at least one accepted answer.',
          ...where,
        })
      }
    })
  }
  if (b.type === 'sorting' || b.type === 'matching') {
    // The player provides button-based alternatives to dragging; the risk here
    // is instructions that assume a mouse.
    const title = b.title.toLowerCase()
    if (/\bdrag\b|\bdrop\b/.test(title)) {
      add(ctx, {
        criterion: '2.5.7', severity: 'warning',
        message: 'Instructions mention dragging.',
        fix: 'This interaction is operated with buttons and the keyboard, not by dragging. Reword the instruction so it matches — e.g. “Put these in the right order”.',
        ...where,
      })
    }
  }
  if (b.type === 'flashcards') {
    b.cards.forEach((c, i) => {
      if (!text(c.front) && !c.frontImage) {
        add(ctx, {
          criterion: '4.1.2', severity: 'error',
          message: `Flashcard ${i + 1} has no front text.`,
          fix: 'Add text to the front of the card, so it has an accessible name before it is flipped.',
          ...where,
        })
      }
    })
  }
  if (b.type === 'accordion' || b.type === 'tabs') {
    b.items.forEach((it, i) => {
      if (!it.title.trim()) {
        add(ctx, {
          criterion: '2.4.6', severity: 'error',
          message: `${b.type === 'tabs' ? 'Tab' : 'Section'} ${i + 1} has no title.`,
          fix: 'Every panel needs a name — it is the control a learner has to operate to reach the content.',
          ...where,
        })
      }
    })
  }
}

/** Instructions that lean on colour, shape or position alone. */
const SENSORY = /\b(the (red|green|blue|yellow|orange|purple) (button|box|panel|text|section)|click the (round|square) |on the (left|right)\b|below the|above the)\b/i

function checkSensory(ctx: Ctx, b: Block, l: Lesson) {
  const where = { lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type }
  richFields(b).forEach((html) => {
    const t = text(html)
    const m = SENSORY.exec(t)
    if (m) {
      add(ctx, {
        criterion: '1.3.3', severity: 'review',
        message: `Instruction may rely on colour or position: “${m[0]}”.`,
        fix: 'Name the thing as well as describing where or what colour it is — “the Submit button (on the right)” rather than “the button on the right”.',
        ...where,
      })
    }
  })
}

function checkTheme(ctx: Ctx) {
  const course = ctx.course
  const theme = normalizeTheme(course.theme)

  // Every scheme in play: the course's, plus anything a lesson overrides to.
  const combos: { scheme: string; accent: string; where: string }[] = [
    { scheme: theme.scheme, accent: theme.primaryColor, where: 'the course theme' },
  ]
  course.lessons.forEach((l) => {
    const t = l.theme
    if (!t || (!t.scheme && !t.primaryColor)) return
    combos.push({
      scheme: t.scheme ?? theme.scheme,
      accent: t.primaryColor ?? theme.primaryColor,
      where: `“${l.title}”`,
    })
  })

  combos.forEach(({ scheme, accent, where }) => {
    const s = schemeOf(scheme)
    const bodyRatio = contrastRatio(s.ink, s.bg)
    const mutedRatio = contrastRatio(s.inkSoft, s.bg)
    const accentRatio = contrastRatio(accent, s.bg)

    if (bodyRatio < 4.5) {
      add(ctx, {
        criterion: '1.4.3', severity: 'error',
        message: `Body text in ${where} contrasts ${bodyRatio.toFixed(1)}:1 with the page, below the 4.5:1 minimum.`,
        fix: 'Choose a different colour scheme in Course settings → Theme.',
      })
    }
    if (mutedRatio < 4.5) {
      add(ctx, {
        criterion: '1.4.3', severity: 'warning',
        message: `Secondary text in ${where} contrasts ${mutedRatio.toFixed(1)}:1 with the page.`,
        fix: 'Captions and hints use this colour. Pick a scheme with a stronger secondary tone.',
      })
    }
    // The player derives a darkened --accent-ink for accent *text*, so this is
    // reported at review level: the output is compliant, but the brand colour
    // the author picked is not the one learners will see on links.
    if (accentRatio < 3) {
      add(ctx, {
        criterion: '1.4.11', severity: 'warning',
        message: `The accent in ${where} contrasts only ${accentRatio.toFixed(1)}:1 with the page.`,
        fix: 'Accent-coloured rules, borders and progress bars need 3:1 to be perceivable. Choose a stronger accent, or accept that these boundaries will be hard to see.',
      })
    } else if (accentRatio < 4.5) {
      add(ctx, {
        criterion: '1.4.3', severity: 'review',
        message: `The accent in ${where} contrasts ${accentRatio.toFixed(1)}:1 — the player will darken it for links and small labels.`,
        fix: 'No action needed for conformance. Pick a darker accent if you would rather learners saw your exact brand colour in link text.',
      })
    }
  })

  // Author-set block backgrounds bypass the theme's contrast pairing entirely.
  course.lessons.forEach((l) => {
    const s = schemeOf(l.theme?.scheme ?? theme.scheme)
    l.blocks.forEach((b) => {
      if (!b.bg || !b.bg.startsWith('#')) return
      const r = contrastRatio(s.ink, b.bg)
      if (r < 4.5) {
        add(ctx, {
          criterion: '1.4.3', severity: 'error',
          message: `Custom block background contrasts ${r.toFixed(1)}:1 with the text on it.`,
          fix: 'Pick a lighter or darker background, or use the theme-aware Panel or Tint fills, which are contrast-paired with the scheme by construction.',
          lessonId: l.id, lessonTitle: l.title, blockId: b.id, blockType: b.type,
        })
      }
    })
  })
}

function checkStructure(ctx: Ctx) {
  const course = ctx.course
  if (!course.title.trim()) {
    add(ctx, {
      criterion: '2.4.2', severity: 'error',
      message: 'The course has no title.',
      fix: 'Give the course a title. It becomes the page title of the exported package.',
    })
  }
  const seen = new Map<string, number>()
  course.lessons.forEach((l) => {
    if (!l.title.trim()) {
      add(ctx, {
        criterion: '2.4.6', severity: 'error',
        message: 'A lesson has no title.',
        fix: 'Name the lesson — the title is its heading and its entry in the course menu.',
        lessonId: l.id, lessonTitle: l.title,
      })
    }
    const k = l.title.trim().toLowerCase()
    if (k) seen.set(k, (seen.get(k) ?? 0) + 1)
    if (l.blocks.length === 0) {
      add(ctx, {
        criterion: '1.3.1', severity: 'warning',
        message: `Lesson “${l.title}” is empty.`,
        fix: 'Add content or remove the lesson. An empty lesson still appears in the menu and still has to be completed.',
        lessonId: l.id, lessonTitle: l.title,
      })
    }
  })
  seen.forEach((n, title) => {
    if (n > 1) {
      add(ctx, {
        criterion: '2.4.6', severity: 'warning',
        message: `${n} lessons are called “${title}”.`,
        fix: 'Give each lesson a distinct name so the course menu can be navigated by name alone.',
      })
    }
  })

  const theme = normalizeTheme(course.theme)
  if (theme.nav === 'none' && course.lessons.length > 3) {
    add(ctx, {
      criterion: '2.4.5', severity: 'warning',
      message: `Navigation is set to Linear, so there is only one way to reach any of the ${course.lessons.length} lessons.`,
      fix: 'Turn the menu back on in Course settings → Layout, or accept this as a documented exception where the sequence is a deliberate requirement.',
    })
  }
  if (theme.logo && !resolveAssetSrc(theme.logo, course.assets)) {
    add(ctx, {
      criterion: '1.1.1', severity: 'warning',
      message: 'The course logo points at media that is no longer in the library.',
      fix: 'Re-upload the logo in Course settings → Layout, or clear it.',
    })
  }
}

// ---------- entry point ----------

export interface AuditResult {
  findings: Finding[]
  errors: number
  warnings: number
  reviews: number
  /** Criteria with at least one error — the ones a report must not claim. */
  failing: Set<string>
}

export function auditCourse(course: Course): AuditResult {
  const ctx: Ctx = { course, findings: [], seq: 0 }

  checkStructure(ctx)
  checkTheme(ctx)
  course.lessons.forEach((l) => {
    checkHeadings(ctx, l)
    l.blocks.forEach((b) => {
      checkImages(ctx, b, l)
      checkMedia(ctx, b, l)
      checkLinks(ctx, b, l)
      checkInteractions(ctx, b, l)
      checkSensory(ctx, b, l)
    })
  })

  const order: Record<Severity, number> = { error: 0, warning: 1, review: 2 }
  ctx.findings.sort((a, b) => order[a.severity] - order[b.severity] || a.criterion.localeCompare(b.criterion))

  const failing = new Set<string>()
  ctx.findings.forEach((f) => { if (f.severity === 'error') failing.add(f.criterion) })

  return {
    findings: ctx.findings,
    errors: ctx.findings.filter((f) => f.severity === 'error').length,
    warnings: ctx.findings.filter((f) => f.severity === 'warning').length,
    reviews: ctx.findings.filter((f) => f.severity === 'review').length,
    failing,
  }
}

/** Scheme ids that fail on their own, shown in Settings as a hint. */
export function schemeContrastWarnings(): string[] {
  return SCHEMES.filter((s) => contrastRatio(s.ink, s.bg) < 4.5).map((s) => s.id)
}
