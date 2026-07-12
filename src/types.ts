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
  | 'quiz'

export interface BlockBase {
  id: string
  type: BlockType
}

export interface TextBlock extends BlockBase {
  type: 'text'
  html: string
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
  | QuizBlock

export interface Lesson {
  id: string
  title: string
  icon: string // emoji or short label shown in outline
  blocks: Block[]
}

export type FontPackId = 'modern' | 'elegant' | 'friendly' | 'classic' | 'technical'
export type SchemeId = 'light' | 'warm' | 'cool' | 'dark'

export interface CourseTheme {
  primaryColor: string
  scheme: SchemeId
  fontPack: FontPackId
  nav: 'side' | 'top'
  hero: 'gradient' | 'solid' | 'minimal'
  width: 'narrow' | 'normal' | 'wide'
  corners: 'soft' | 'sharp'
  headingWeight: 'bold' | 'extrabold'
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
}

export const SCHEMES: ColorScheme[] = [
  { id: 'light', label: 'Light', bg: '#ffffff', bgSoft: '#f6f7fb', ink: '#1f2437', inkSoft: '#5b6178', line: '#e6e8f0' },
  { id: 'warm', label: 'Warm', bg: '#fffdf8', bgSoft: '#f7f2e7', ink: '#2e2921', inkSoft: '#6f665a', line: '#eae2d0' },
  { id: 'cool', label: 'Cool', bg: '#fafbfe', bgSoft: '#ecf0f8', ink: '#182035', inkSoft: '#56607a', line: '#dde4f0' },
  { id: 'dark', label: 'Dark', bg: '#1a1d2e', bgSoft: '#111320', ink: '#e9ebf8', inkSoft: '#9ba0bd', line: '#2d3150' },
]

/** Fill in defaults and migrate the legacy `font` field from early saves. */
export function normalizeTheme(t?: Partial<CourseTheme> & { font?: string }): CourseTheme {
  const merged = { ...defaultTheme, ...(t ?? {}) }
  if (t && !('fontPack' in t) && t.font) {
    merged.fontPack = t.font === 'serif' ? 'classic' : 'modern'
  }
  delete (merged as Partial<CourseTheme> & { font?: string }).font
  return merged
}

export interface Course {
  id: string
  title: string
  description: string
  author: string
  coverImage: string // data URL, optional ''
  lessons: Lesson[]
  theme: CourseTheme
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

export const defaultTheme: CourseTheme = {
  primaryColor: '#4f46e5',
  scheme: 'light',
  fontPack: 'modern',
  nav: 'side',
  hero: 'gradient',
  width: 'normal',
  corners: 'soft',
  headingWeight: 'extrabold',
}
