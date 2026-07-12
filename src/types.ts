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
  | 'html'

/** Block background: '' or undefined = none, 'panel' = card surface,
    'tint' = accent tint, otherwise any CSS colour (e.g. '#fde68a'). */
export interface BlockBase {
  id: string
  type: BlockType
  bg?: string
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

export interface ColumnsBlock extends BlockBase {
  type: 'columns'
  columns: { id: string; html: string }[] // 2-4 columns
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
  | HtmlBlock

/** Per-lesson look overrides. Any field left out inherits the course theme. */
export interface LessonTheme {
  primaryColor?: string
  scheme?: SchemeId
  hero?: 'gradient' | 'solid' | 'minimal'
}

export interface Lesson {
  id: string
  title: string
  icon: string // emoji or short label shown in outline
  blocks: Block[]
  theme?: LessonTheme
}

export type FontPackId = 'modern' | 'elegant' | 'friendly' | 'classic' | 'technical'
export type SchemeId =
  | 'light' | 'warm' | 'cool' | 'sand' | 'sage' | 'rose' | 'lavender' | 'sky' | 'mist'
  | 'dark' | 'midnight' | 'forest' | 'plum' | 'charcoal'

export interface CourseTheme {
  primaryColor: string
  scheme: SchemeId
  fontPack: FontPackId
  nav: 'side' | 'top'
  hero: 'gradient' | 'solid' | 'minimal'
  width: 'narrow' | 'normal' | 'wide'
  corners: 'soft' | 'sharp'
  headingWeight: 'bold' | 'extrabold'
  fontScale: 'small' | 'normal' | 'large'
  spacing: 'compact' | 'normal' | 'airy'
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

/** Fill in defaults and migrate the legacy `font` field from early saves. */
export function normalizeTheme(t?: Partial<CourseTheme> & { font?: string }): CourseTheme {
  const merged = { ...defaultTheme, ...(t ?? {}) }
  if (t && !('fontPack' in t) && t.font) {
    merged.fontPack = t.font === 'serif' ? 'classic' : 'modern'
  }
  delete (merged as Partial<CourseTheme> & { font?: string }).font
  if (!SCHEMES.some((s) => s.id === merged.scheme)) merged.scheme = 'light'
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
  logo: '',
}

export const FONT_SCALES = { small: 15, normal: 16.5, large: 18.5 } as const
export const SPACING_SCALES = { compact: 0.75, normal: 1, airy: 1.35 } as const
