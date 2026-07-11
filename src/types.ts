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

export interface CourseTheme {
  primaryColor: string
  font: 'inter' | 'serif' | 'system'
  headingWeight: 'bold' | 'extrabold'
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
  font: 'inter',
  headingWeight: 'extrabold',
}
