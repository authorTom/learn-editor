// ---------- Course data model ----------

export type BlockType =
  | 'text'
  | 'heading'
  | 'statement'
  | 'quote'
  | 'list'
  | 'image'
  | 'imageText'
  | 'gallery'
  | 'video'
  | 'embed'
  | 'audio'
  | 'divider'
  | 'button'
  | 'note'
  | 'columns'
  | 'accordion'
  | 'tabs'
  | 'flashcards'
  | 'sorting'
  | 'matching'
  | 'hotspot'
  | 'quiz'
  | 'cards'
  | 'steps'
  | 'html'

/** How wide a block runs against the lesson's measure. 'normal' stays inside
    the content column; 'wide' breaks out of it; 'full' runs edge to edge. */
export type BlockWidth = 'normal' | 'wide' | 'full'

/** Per-block vertical rhythm, multiplying the course's own spacing setting. */
export type BlockSpace = 'tight' | 'normal' | 'loose'

/** Block background: '' or undefined = none, 'panel' = card surface,
    'tint' = accent tint, otherwise any CSS colour (e.g. '#fde68a'). */
export interface BlockBase {
  id: string
  type: BlockType
  bg?: string
  width?: BlockWidth // undefined = 'normal' (pre-existing saves)
  space?: BlockSpace // undefined = 'normal'
  /** Id of the library block this one is a live copy of. Set only when the
      block was inserted as *linked* rather than as an independent copy; editing
      the library entry then offers to update every course that uses it. */
  linkedTo?: string
  /** The library revision this copy was last synced to. Behind the library's
      current `rev` means an update is waiting. */
  linkedRev?: number
}

export type TextLayout = 'normal' | 'lead' | 'columns' | 'boxed'

export interface TextBlock extends BlockBase {
  type: 'text'
  html: string
  layout?: TextLayout // undefined = 'normal' (pre-existing saves)
}

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  text: string
  level: 1 | 2 | 3
  align: 'left' | 'center'
}

export interface StatementBlock extends BlockBase {
  type: 'statement'
  html: string
  style: 'a' | 'b' | 'c' // visual variants
}

export interface QuoteBlock extends BlockBase {
  type: 'quote'
  html: string
  attribution: string
}

export interface ListBlock extends BlockBase {
  type: 'list'
  style: 'bullet' | 'number' | 'check'
  items: string[] // html per item
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  src: string // data URL or external URL
  alt: string
  caption: string
  width: 'normal' | 'wide' | 'full'
}

export interface ImageTextBlock extends BlockBase {
  type: 'imageText'
  src: string
  alt: string
  html: string
  imageSide: 'left' | 'right'
}

export interface GalleryBlock extends BlockBase {
  type: 'gallery'
  images: { id: string; src: string; alt: string; caption: string }[]
  columns: 2 | 3 | 4
}

export interface VideoBlock extends BlockBase {
  type: 'video'
  url: string // original URL pasted by author
  embedUrl: string // resolved iframe src
  provider: 'youtube' | 'vimeo' | 'other'
  caption: string
}

export interface EmbedBlock extends BlockBase {
  type: 'embed'
  url: string
  height: number
  caption: string
}

export interface AudioBlock extends BlockBase {
  type: 'audio'
  src: string
  title: string
}

export interface DividerBlock extends BlockBase {
  type: 'divider'
  style: 'line' | 'space' | 'numbered'
  number?: number
}

export interface ButtonBlock extends BlockBase {
  type: 'button'
  label: string
  url: string
  align: 'left' | 'center'
  variant: 'solid' | 'outline'
}

export interface NoteBlock extends BlockBase {
  type: 'note'
  html: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  title: string
}

/** Relative column widths. Only meaningful for exactly two columns — three or
    more always divide evenly, and the player ignores the setting there. */
export type ColumnRatio = 'equal' | 'wide-left' | 'wide-right'

export interface ColumnsBlock extends BlockBase {
  type: 'columns'
  columns: { id: string; html: string }[] // 2-4 columns
  ratio?: ColumnRatio // undefined = 'equal'
  valign?: 'top' | 'center' // undefined = 'top'
  gap?: 'sm' | 'md' | 'lg' // undefined = 'md'
}

/** A grid of cards — the standard way to present features, roles, options or
    key takeaways side by side rather than as another bulleted list. */
export interface CardsBlock extends BlockBase {
  type: 'cards'
  items: { id: string; src: string; icon: string; title: string; html: string }[]
  columns: 2 | 3 | 4
  style: 'bordered' | 'filled' | 'elevated'
  align: 'left' | 'center'
}

/** A numbered process — vertical timeline or horizontal track. */
export interface StepsBlock extends BlockBase {
  type: 'steps'
  items: { id: string; title: string; html: string }[]
  layout: 'vertical' | 'horizontal'
  marker: 'number' | 'dot'
}

export interface AccordionBlock extends BlockBase {
  type: 'accordion'
  items: { id: string; title: string; html: string }[]
}

export interface TabsBlock extends BlockBase {
  type: 'tabs'
  items: { id: string; title: string; html: string }[]
}

export interface FlashcardsBlock extends BlockBase {
  type: 'flashcards'
  cards: { id: string; front: string; back: string; frontImage?: string }[]
}

/** Put the steps in the right order. `items` is stored in the correct order;
    the player shuffles for display. */
export interface SortingBlock extends BlockBase {
  type: 'sorting'
  title: string
  items: { id: string; text: string }[]
  feedbackCorrect: string
  feedbackIncorrect: string
}

/** Match each prompt to its partner. The player shuffles the right-hand column. */
export interface MatchingBlock extends BlockBase {
  type: 'matching'
  title: string
  pairs: { id: string; left: string; right: string }[]
  feedbackCorrect: string
  feedbackIncorrect: string
}

/** Explore an image: markers positioned as percentages of the image box. */
export interface HotspotBlock extends BlockBase {
  type: 'hotspot'
  src: string
  alt: string
  title: string
  spots: { id: string; x: number; y: number; label: string; html: string }[]
}

export type QuestionType = 'choice' | 'multiple' | 'truefalse' | 'fillin'

export interface QuizQuestion {
  id: string
  type: QuestionType
  text: string
  choices: { id: string; text: string; correct: boolean }[] // for choice/multiple/truefalse
  answers: string[] // accepted answers for fillin
  feedbackCorrect: string
  feedbackIncorrect: string
}

export interface HtmlBlock extends BlockBase {
  type: 'html'
  code: string
}

export interface QuizBlock extends BlockBase {
  type: 'quiz'
  title: string
  questions: QuizQuestion[]
  passingScore: number // percent 0-100
  shuffle: boolean
  showFeedback: boolean
}

export type Block =
  | TextBlock
  | HeadingBlock
  | StatementBlock
  | QuoteBlock
  | ListBlock
  | ImageBlock
  | ImageTextBlock
  | GalleryBlock
  | VideoBlock
  | EmbedBlock
  | AudioBlock
  | DividerBlock
  | ButtonBlock
  | NoteBlock
  | ColumnsBlock
  | AccordionBlock
  | TabsBlock
  | FlashcardsBlock
  | SortingBlock
  | MatchingBlock
  | HotspotBlock
  | QuizBlock
  | CardsBlock
  | StepsBlock
  | HtmlBlock

/** Lesson header treatments. 'image' needs a picture to sit behind the title —
    the lesson's own `heroImage`, falling back to the course cover. 'split' sets
    the title against an accent panel without needing artwork. */
export type HeroStyle = 'gradient' | 'solid' | 'minimal' | 'image' | 'split'

/** Per-lesson look overrides. Any field left out inherits the course theme. */
export interface LessonTheme {
  primaryColor?: string
  scheme?: SchemeId
  hero?: HeroStyle
  heroImage?: string // asset ref or data URL, used by the 'image' hero
}

export interface Lesson {
  id: string
  title: string
  icon: string // emoji or short label shown in outline
  blocks: Block[]
  theme?: LessonTheme
  /** Optional module name. Consecutive lessons sharing one are grouped under a
      heading in the course outline and the player's navigation. */
  section?: string
}

export type FontPackId =
  | 'modern' | 'elegant' | 'friendly' | 'classic' | 'technical'
  | 'editorial' | 'corporate' | 'academic'
export type SchemeId =
  | 'light' | 'warm' | 'cool' | 'sand' | 'sage' | 'rose' | 'lavender' | 'sky' | 'mist'
  | 'dark' | 'midnight' | 'forest' | 'plum' | 'charcoal'

/** Course navigation. 'none' hides the menu entirely, so learners can only move
    with Previous / Continue — the usual shape for compliance training. */
export type NavStyle = 'side' | 'top' | 'none'

/** How far apart the heading sizes sit. Compact suits dense reference material,
    dramatic suits short marketing-led courses. */
export type TypeScaleId = 'compact' | 'balanced' | 'dramatic'

/** Shadow depth on panels, cards, quizzes and callouts. */
export type ElevationId = 'flat' | 'soft' | 'raised'

/** How the learner's position through the course is shown in the navigation. */
export type ProgressStyle = 'bar' | 'steps' | 'none'

export interface CourseTheme {
  primaryColor: string
  scheme: SchemeId
  fontPack: FontPackId
  nav: NavStyle
  hero: HeroStyle
  width: 'narrow' | 'normal' | 'wide'
  corners: 'soft' | 'sharp'
  headingWeight: 'bold' | 'extrabold'
  fontScale: 'small' | 'normal' | 'large'
  spacing: 'compact' | 'normal' | 'airy'
  typeScale: TypeScaleId
  elevation: ElevationId
  progress: ProgressStyle
  /** Number the lessons in the navigation and the lesson header kicker. */
  lessonNumbers: boolean
  /** Open the course on a title page — cover, description, author, contents —
      instead of dropping the learner straight into lesson 1. */
  titlePage: boolean
  logo: string // asset ref or data URL, shown in the player's course header
}

export interface FontPack {
  id: FontPackId
  label: string
  description: string
  body: string // CSS font-family stack
  heading: string
  google?: string // css2 family query, when webfonts are needed
}

export const FONT_PACKS: FontPack[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Inter — crisp and neutral',
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    google: 'family=Inter:wght@400;500;600;700;800',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Playfair Display + Source Sans',
    body: "'Source Sans 3', 'Segoe UI', sans-serif",
    heading: "'Playfair Display', Georgia, serif",
    google: 'family=Playfair+Display:wght@600;700;800&family=Source+Sans+3:wght@400;600;700',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Nunito — soft and rounded',
    body: "'Nunito', 'Segoe UI', sans-serif",
    heading: "'Nunito', 'Segoe UI', sans-serif",
    google: 'family=Nunito:wght@400;600;700;800',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Georgia — traditional serif',
    body: "Georgia, 'Times New Roman', serif",
    heading: "Georgia, 'Times New Roman', serif",
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Space Grotesk + IBM Plex Sans',
    body: "'IBM Plex Sans', 'Segoe UI', sans-serif",
    heading: "'Space Grotesk', 'Segoe UI', sans-serif",
    google: 'family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Fraunces + Inter — magazine weight',
    body: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    heading: "'Fraunces', Georgia, serif",
    google: 'family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Manrope — clean and confident',
    body: "'Manrope', 'Segoe UI', sans-serif",
    heading: "'Manrope', 'Segoe UI', sans-serif",
    google: 'family=Manrope:wght@400;500;600;700;800',
  },
  {
    id: 'academic',
    label: 'Academic',
    description: 'Lora + Inter — long-form reading',
    body: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    heading: "'Lora', Georgia, serif",
    google: 'family=Lora:wght@500;600;700&family=Inter:wght@400;500;600;700',
  },
]

export interface ColorScheme {
  id: SchemeId
  label: string
  bg: string // panels: sidebar, cards, quiz
  bgSoft: string // page background
  ink: string
  inkSoft: string
  line: string
  dark?: boolean // dark-surface scheme: player harmonises callouts, quiz states, etc.
}

/** Each scheme keeps its five surfaces in one hue family so panels, page
    background, text and rules always harmonise. Light schemes first, then dark. */
export const SCHEMES: ColorScheme[] = [
  { id: 'light', label: 'Light', bg: '#ffffff', bgSoft: '#f6f7fb', ink: '#1f2437', inkSoft: '#5b6178', line: '#e6e8f0' },
  { id: 'warm', label: 'Warm', bg: '#fffdf8', bgSoft: '#f7f2e7', ink: '#2e2921', inkSoft: '#6f665a', line: '#eae2d0' },
  { id: 'cool', label: 'Cool', bg: '#fafbfe', bgSoft: '#ecf0f8', ink: '#182035', inkSoft: '#56607a', line: '#dde4f0' },
  { id: 'sand', label: 'Sand', bg: '#fffcf4', bgSoft: '#f1e8d7', ink: '#33291a', inkSoft: '#7a6c55', line: '#e5dac2' },
  { id: 'sage', label: 'Sage', bg: '#fbfdfa', bgSoft: '#e9f0e4', ink: '#212b1e', inkSoft: '#5f6f5a', line: '#d8e3d1' },
  { id: 'rose', label: 'Rose', bg: '#fffbfc', bgSoft: '#f7eaee', ink: '#33202a', inkSoft: '#7a5f6b', line: '#ecd5dc' },
  { id: 'lavender', label: 'Lavender', bg: '#fdfcff', bgSoft: '#edeaf7', ink: '#251f36', inkSoft: '#635d7d', line: '#dcd6ed' },
  { id: 'sky', label: 'Sky', bg: '#fafdff', bgSoft: '#e5f0f8', ink: '#14273a', inkSoft: '#4f6579', line: '#d1e2ef' },
  { id: 'mist', label: 'Mist', bg: '#fcfcfd', bgSoft: '#edeff1', ink: '#22262b', inkSoft: '#5f666e', line: '#dce0e5' },
  { id: 'dark', label: 'Dark', bg: '#1a1d2e', bgSoft: '#111320', ink: '#e9ebf8', inkSoft: '#9ba0bd', line: '#2d3150', dark: true },
  { id: 'midnight', label: 'Midnight', bg: '#142138', bgSoft: '#0c1524', ink: '#e6edf8', inkSoft: '#93a4c3', line: '#243556', dark: true },
  { id: 'forest', label: 'Forest', bg: '#17251d', bgSoft: '#0e1813', ink: '#e4f0e8', inkSoft: '#91a89a', line: '#28392f', dark: true },
  { id: 'plum', label: 'Plum', bg: '#261b30', bgSoft: '#181021', ink: '#f0e8f6', inkSoft: '#a793b8', line: '#3a2c49', dark: true },
  { id: 'charcoal', label: 'Charcoal', bg: '#1f2124', bgSoft: '#151719', ink: '#ececee', inkSoft: '#9a9ea5', line: '#33363b', dark: true },
]

/** Fill in defaults and migrate the legacy `font` field from early saves.
 *
 * Every enumerated field is checked against its allowed values, not merely
 * defaulted when absent: a course saved by a newer build, hand-edited JSON or a
 * shared template can carry an id this build has never heard of, and an
 * unrecognised `hero` or `nav` would otherwise reach the exporter and emit a
 * body class that styles nothing. */
export function normalizeTheme(t?: Partial<CourseTheme> & { font?: string }): CourseTheme {
  const merged = { ...defaultTheme, ...(t ?? {}) }
  if (t && !('fontPack' in t) && t.font) {
    merged.fontPack = t.font === 'serif' ? 'classic' : 'modern'
  }
  delete (merged as Partial<CourseTheme> & { font?: string }).font

  const oneOf = <K extends keyof CourseTheme>(key: K, allowed: readonly CourseTheme[K][]) => {
    if (!allowed.includes(merged[key])) merged[key] = defaultTheme[key]
  }
  if (!SCHEMES.some((s) => s.id === merged.scheme)) merged.scheme = 'light'
  if (!FONT_PACKS.some((p) => p.id === merged.fontPack)) merged.fontPack = 'modern'
  oneOf('nav', ['side', 'top', 'none'])
  oneOf('hero', ['gradient', 'solid', 'minimal', 'image', 'split'])
  oneOf('width', ['narrow', 'normal', 'wide'])
  oneOf('corners', ['soft', 'sharp'])
  oneOf('headingWeight', ['bold', 'extrabold'])
  oneOf('fontScale', ['small', 'normal', 'large'])
  oneOf('spacing', ['compact', 'normal', 'airy'])
  oneOf('typeScale', ['compact', 'balanced', 'dramatic'])
  oneOf('elevation', ['flat', 'soft', 'raised'])
  oneOf('progress', ['bar', 'steps', 'none'])
  merged.lessonNumbers = merged.lessonNumbers !== false
  merged.titlePage = merged.titlePage === true
  return merged
}

// ---------- Media assets ----------

/** An uploaded file, stored once per course and referenced by blocks as
    `asset:<id>` — so reusing an image doesn't re-embed its bytes. */
export interface Asset {
  id: string
  name: string
  kind: 'image' | 'audio'
  src: string // data URL
  size: number // bytes of the data URL payload
  createdAt: number
}

export const ASSET_REF = 'asset:'

/** Resolve a block's src, which may be an `asset:<id>` reference or a plain URL. */
export function resolveAssetSrc(src: string, assets: Asset[] | undefined): string {
  if (!src || !src.startsWith(ASSET_REF)) return src
  const a = (assets ?? []).find((x) => x.id === src.slice(ASSET_REF.length))
  return a ? a.src : ''
}

// ---------- Completion ----------

/** What the player must see before it reports the course complete to the LMS. */
export interface CompletionRules {
  allLessons: boolean // every lesson finished
  quizPass: boolean // every quiz passed at its own pass mark
  minScore: number // 0 = off; otherwise average quiz score must reach this
  minMinutes: number // 0 = off; otherwise time in the course must reach this
}

export const defaultCompletion: CompletionRules = {
  allLessons: true,
  quizPass: false,
  minScore: 0,
  minMinutes: 0,
}

export function normalizeCompletion(c?: Partial<CompletionRules>): CompletionRules {
  return { ...defaultCompletion, ...(c ?? {}) }
}

export interface Course {
  id: string
  title: string
  description: string
  author: string
  coverImage: string // data URL, optional ''
  lessons: Lesson[]
  theme: CourseTheme
  assets: Asset[]
  completion: CompletionRules
  createdAt: number
  updatedAt: number
}

export interface CourseMeta {
  id: string
  title: string
  description: string
  coverImage: string
  lessonCount: number
  /** Counted when the course is written, so the dashboard can describe a course
      without loading it. Absent on records written before this existed. */
  blockCount?: number
  quizCount?: number
  updatedAt: number
}

// ---------- Reusable templates ----------

/** A single block saved to the library, reusable in any course. It carries the
    media it references, so it still renders in a course that never had them. */
export interface BlockTemplate {
  id: string
  name: string
  blockType: BlockType
  block: Block
  assets: Asset[]
  /** Bumped every time the entry is republished. Linked copies compare against
      it to decide whether they are stale. Absent on entries saved before
      linking existed, which are treated as revision 1. */
  rev?: number
  createdAt: number
}

/** A course skeleton — lessons, blocks, media and theme — used to start new courses. */
export interface CourseTemplate {
  id: string
  name: string
  description: string
  coverImage: string
  theme: CourseTheme
  lessons: Lesson[]
  assets: Asset[]
  completion: CompletionRules
  createdAt: number
}

/** Shape of an exported/imported template library file. */
export interface TemplateLibraryFile {
  kind: 'learn-editor-templates'
  version: 1
  blockTemplates: BlockTemplate[]
  courseTemplates: CourseTemplate[]
}

export const defaultTheme: CourseTheme = {
  primaryColor: '#4f46e5',
  scheme: 'light',
  fontPack: 'modern',
  nav: 'side',
  hero: 'gradient',
  width: 'normal',
  corners: 'soft',
  headingWeight: 'extrabold',
  fontScale: 'normal',
  spacing: 'normal',
  typeScale: 'balanced',
  elevation: 'flat',
  progress: 'bar',
  lessonNumbers: true,
  titlePage: false,
  logo: '',
}

export const FONT_SCALES = { small: 15, normal: 16.5, large: 18.5 } as const
export const SPACING_SCALES = { compact: 0.75, normal: 1, airy: 1.35 } as const

/**
 * Heading ramp per type scale, in px, as [h1, h2, h3, lead].
 *
 * These are the *block* heading sizes; the lesson hero derives from them so a
 * dramatic course gets a dramatic header without a second setting. Kept as a
 * fixed table rather than a computed modular scale because a table is what a
 * designer can actually review — and the small end has to stay legible rather
 * than land wherever `1.2^n` puts it.
 */
export const TYPE_SCALES = {
  compact: { h1: 29, h2: 24, h3: 19, lead: 19, hero: 34 },
  balanced: { h1: 34, h2: 27, h3: 21, lead: 21, hero: 42 },
  dramatic: { h1: 44, h2: 33, h3: 24, lead: 23, hero: 56 },
} as const

/** Shadow pairs per elevation: [resting panel, lifted card]. */
export const ELEVATIONS = {
  flat: { sm: 'none', md: 'none' },
  soft: {
    sm: '0 1px 2px rgba(16, 20, 40, 0.05)',
    md: '0 4px 14px rgba(16, 20, 40, 0.08)',
  },
  raised: {
    sm: '0 2px 6px rgba(16, 20, 40, 0.08)',
    md: '0 12px 32px rgba(16, 20, 40, 0.14)',
  },
} as const

/** Block-space multipliers, applied on top of the course spacing setting. */
export const BLOCK_SPACES = { tight: 0.4, normal: 1, loose: 1.8 } as const
