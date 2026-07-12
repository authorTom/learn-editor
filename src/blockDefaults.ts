import type { Block, BlockType, QuizQuestion } from './types'
import { uid } from './utils/id'

export interface BlockDef {
  type: BlockType
  label: string
  description: string
  category: 'Text' | 'Media' | 'Layout' | 'Interactive' | 'Assessment'
  icon: string // lucide icon name resolved in InsertMenu
}

export const blockDefs: BlockDef[] = [
  { type: 'text', label: 'Paragraph', description: 'Rich text with formatting', category: 'Text', icon: 'Type' },
  { type: 'heading', label: 'Heading', description: 'Section title', category: 'Text', icon: 'Heading1' },
  { type: 'statement', label: 'Statement', description: 'Emphasized key point', category: 'Text', icon: 'MessageSquareQuote' },
  { type: 'quote', label: 'Quote', description: 'Quotation with attribution', category: 'Text', icon: 'Quote' },
  { type: 'list', label: 'List', description: 'Bulleted, numbered or checklist', category: 'Text', icon: 'List' },
  { type: 'note', label: 'Callout', description: 'Info, tip or warning panel', category: 'Text', icon: 'Info' },
  { type: 'image', label: 'Image', description: 'Upload or link an image', category: 'Media', icon: 'Image' },
  { type: 'imageText', label: 'Image & text', description: 'Image beside rich text', category: 'Media', icon: 'LayoutPanelLeft' },
  { type: 'gallery', label: 'Gallery', description: 'Grid of images', category: 'Media', icon: 'LayoutGrid' },
  { type: 'video', label: 'Video', description: 'YouTube, Vimeo or embed URL', category: 'Media', icon: 'Play' },
  { type: 'embed', label: 'Embed', description: 'Any web page in an iframe', category: 'Media', icon: 'Globe' },
  { type: 'html', label: 'HTML', description: 'Custom HTML or embed code', category: 'Media', icon: 'Code' },
  { type: 'audio', label: 'Audio', description: 'Upload an audio clip', category: 'Media', icon: 'Volume2' },
  { type: 'divider', label: 'Divider', description: 'Line, spacer or number', category: 'Layout', icon: 'Minus' },
  { type: 'button', label: 'Button', description: 'Link styled as a button', category: 'Layout', icon: 'MousePointerClick' },
  { type: 'columns', label: 'Columns', description: 'Side-by-side text columns', category: 'Layout', icon: 'Columns2' },
  { type: 'accordion', label: 'Accordion', description: 'Expandable sections', category: 'Interactive', icon: 'ChevronsUpDown' },
  { type: 'tabs', label: 'Tabs', description: 'Tabbed panels', category: 'Interactive', icon: 'PanelTop' },
  { type: 'flashcards', label: 'Flashcards', description: 'Flip cards to reveal answers', category: 'Interactive', icon: 'GalleryHorizontalEnd' },
  { type: 'sorting', label: 'Sequence', description: 'Put the steps in the right order', category: 'Interactive', icon: 'ArrowDownUp' },
  { type: 'matching', label: 'Matching', description: 'Match each prompt to its pair', category: 'Interactive', icon: 'Shuffle' },
  { type: 'hotspot', label: 'Hotspots', description: 'Clickable markers on an image', category: 'Interactive', icon: 'MapPin' },
  { type: 'quiz', label: 'Quiz', description: 'Graded knowledge check', category: 'Assessment', icon: 'CircleCheckBig' },
]

export function newQuestion(type: QuizQuestion['type'] = 'choice'): QuizQuestion {
  const base: QuizQuestion = {
    id: uid(),
    type,
    text: '',
    choices: [],
    answers: [],
    feedbackCorrect: "That's right!",
    feedbackIncorrect: 'Not quite — review the material and try again.',
  }
  if (type === 'choice' || type === 'multiple') {
    base.choices = [
      { id: uid(), text: '', correct: true },
      { id: uid(), text: '', correct: false },
      { id: uid(), text: '', correct: false },
    ]
  } else if (type === 'truefalse') {
    base.choices = [
      { id: uid(), text: 'True', correct: true },
      { id: uid(), text: 'False', correct: false },
    ]
  } else if (type === 'fillin') {
    base.answers = ['']
  }
  return base
}

/** Copy a block, giving it — and everything nested inside it — fresh ids, so the
    copy can live alongside the original (duplicate, or insert from the library). */
export function cloneBlock(block: Block): Block {
  const b = structuredClone(block)
  b.id = uid()
  switch (b.type) {
    case 'gallery':
      b.images = b.images.map((i) => ({ ...i, id: uid() }))
      break
    case 'columns':
      b.columns = b.columns.map((c) => ({ ...c, id: uid() }))
      break
    case 'accordion':
    case 'tabs':
      b.items = b.items.map((i) => ({ ...i, id: uid() }))
      break
    case 'flashcards':
      b.cards = b.cards.map((c) => ({ ...c, id: uid() }))
      break
    case 'sorting':
      b.items = b.items.map((i) => ({ ...i, id: uid() }))
      break
    case 'matching':
      b.pairs = b.pairs.map((p) => ({ ...p, id: uid() }))
      break
    case 'hotspot':
      b.spots = b.spots.map((s) => ({ ...s, id: uid() }))
      break
    case 'quiz':
      b.questions = b.questions.map((q) => ({
        ...q,
        id: uid(),
        choices: q.choices.map((c) => ({ ...c, id: uid() })),
      }))
      break
  }
  return b
}

export function createBlock(type: BlockType): Block {
  const id = uid()
  switch (type) {
    case 'text':
      return { id, type, html: '', layout: 'normal' }
    case 'html':
      return { id, type, code: '' }
    case 'heading':
      return { id, type, text: '', level: 2, align: 'left' }
    case 'statement':
      return { id, type, html: '', style: 'a' }
    case 'quote':
      return { id, type, html: '', attribution: '' }
    case 'list':
      return { id, type, style: 'bullet', items: ['', ''] }
    case 'image':
      return { id, type, src: '', alt: '', caption: '', width: 'normal' }
    case 'imageText':
      return { id, type, src: '', alt: '', html: '', imageSide: 'left' }
    case 'gallery':
      return { id, type, images: [], columns: 2 }
    case 'video':
      return { id, type, url: '', embedUrl: '', provider: 'other', caption: '' }
    case 'embed':
      return { id, type, url: '', height: 480, caption: '' }
    case 'audio':
      return { id, type, src: '', title: '' }
    case 'divider':
      return { id, type, style: 'line' }
    case 'button':
      return { id, type, label: 'Learn more', url: '', align: 'center', variant: 'solid' }
    case 'note':
      return { id, type, html: '', tone: 'info', title: '' }
    case 'columns':
      return {
        id,
        type,
        columns: [
          { id: uid(), html: '' },
          { id: uid(), html: '' },
        ],
      }
    case 'accordion':
      return {
        id,
        type,
        items: [
          { id: uid(), title: 'Section 1', html: '' },
          { id: uid(), title: 'Section 2', html: '' },
        ],
      }
    case 'tabs':
      return {
        id,
        type,
        items: [
          { id: uid(), title: 'Tab 1', html: '' },
          { id: uid(), title: 'Tab 2', html: '' },
        ],
      }
    case 'flashcards':
      return {
        id,
        type,
        cards: [
          { id: uid(), front: '', back: '' },
          { id: uid(), front: '', back: '' },
        ],
      }
    case 'sorting':
      return {
        id,
        type,
        title: 'Put these in the right order',
        items: [
          { id: uid(), text: '' },
          { id: uid(), text: '' },
          { id: uid(), text: '' },
        ],
        feedbackCorrect: 'Correct — that’s the right sequence.',
        feedbackIncorrect: 'Not quite. Rearrange the steps and try again.',
      }
    case 'matching':
      return {
        id,
        type,
        title: 'Match each item to its pair',
        pairs: [
          { id: uid(), left: '', right: '' },
          { id: uid(), left: '', right: '' },
          { id: uid(), left: '', right: '' },
        ],
        feedbackCorrect: 'All matched correctly.',
        feedbackIncorrect: 'Some pairs aren’t right — check the highlighted ones.',
      }
    case 'hotspot':
      return { id, type, src: '', alt: '', title: '', spots: [] }
    case 'quiz':
      return {
        id,
        type,
        title: 'Knowledge check',
        questions: [newQuestion()],
        passingScore: 80,
        shuffle: false,
        showFeedback: true,
      }
  }
}
