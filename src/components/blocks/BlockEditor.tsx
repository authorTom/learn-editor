import type { Block } from '../../types'
import {
  TextEditor, HeadingEditor, StatementEditor, QuoteEditor, ListEditor,
  NoteEditor, DividerEditor, ButtonEditor, ColumnsEditor, HtmlEditor,
} from './SimpleBlocks'
import {
  ImageEditor, ImageTextEditor, GalleryEditor, VideoEditor, EmbedEditor, AudioEditor,
} from './MediaBlocks'
import { AccordionEditor, TabsEditor, FlashcardsEditor } from './InteractiveBlocks'
import QuizEditor from './QuizEditor'

export default function BlockEditor({ block }: { block: Block }) {
  switch (block.type) {
    case 'text': return <TextEditor block={block} />
    case 'heading': return <HeadingEditor block={block} />
    case 'statement': return <StatementEditor block={block} />
    case 'quote': return <QuoteEditor block={block} />
    case 'list': return <ListEditor block={block} />
    case 'note': return <NoteEditor block={block} />
    case 'divider': return <DividerEditor block={block} />
    case 'button': return <ButtonEditor block={block} />
    case 'columns': return <ColumnsEditor block={block} />
    case 'image': return <ImageEditor block={block} />
    case 'imageText': return <ImageTextEditor block={block} />
    case 'gallery': return <GalleryEditor block={block} />
    case 'video': return <VideoEditor block={block} />
    case 'embed': return <EmbedEditor block={block} />
    case 'audio': return <AudioEditor block={block} />
    case 'accordion': return <AccordionEditor block={block} />
    case 'tabs': return <TabsEditor block={block} />
    case 'flashcards': return <FlashcardsEditor block={block} />
    case 'quiz': return <QuizEditor block={block} />
    case 'html': return <HtmlEditor block={block} />
  }
}
