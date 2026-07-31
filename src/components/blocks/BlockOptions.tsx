import type { Block } from '../../types'
import {
  TextOptions, HeadingOptions, StatementOptions, QuoteOptions, ListOptions,
  NoteOptions, DividerOptions, ButtonOptions, ColumnsOptions, HtmlOptions,
} from './SimpleBlocks'
import {
  ImageOptions, ImageTextOptions, GalleryOptions, VideoOptions, EmbedOptions, AudioOptions,
} from './MediaBlocks'
import {
  AccordionOptions, TabsOptions, FlashcardsOptions, SortingOptions, MatchingOptions, HotspotOptions,
} from './InteractiveBlocks'
import { CardsOptions, StepsOptions } from './LayoutBlocks'
import { QuizOptions } from './QuizEditor'

/**
 * Inspector half of each block editor. Mirrors BlockEditor's switch exactly —
 * one case per block type, so adding a block type surfaces as a type error in
 * both files rather than silently rendering an empty panel.
 */
export default function BlockOptions({ block }: { block: Block }) {
  switch (block.type) {
    case 'text': return <TextOptions block={block} />
    case 'heading': return <HeadingOptions block={block} />
    case 'statement': return <StatementOptions block={block} />
    case 'quote': return <QuoteOptions />
    case 'list': return <ListOptions block={block} />
    case 'note': return <NoteOptions block={block} />
    case 'divider': return <DividerOptions block={block} />
    case 'button': return <ButtonOptions block={block} />
    case 'columns': return <ColumnsOptions block={block} />
    case 'cards': return <CardsOptions block={block} />
    case 'steps': return <StepsOptions block={block} />
    case 'image': return <ImageOptions block={block} />
    case 'imageText': return <ImageTextOptions block={block} />
    case 'gallery': return <GalleryOptions block={block} />
    case 'video': return <VideoOptions block={block} />
    case 'embed': return <EmbedOptions block={block} />
    case 'audio': return <AudioOptions />
    case 'accordion': return <AccordionOptions block={block} />
    case 'tabs': return <TabsOptions block={block} />
    case 'flashcards': return <FlashcardsOptions block={block} />
    case 'sorting': return <SortingOptions block={block} />
    case 'matching': return <MatchingOptions block={block} />
    case 'hotspot': return <HotspotOptions block={block} />
    case 'quiz': return <QuizOptions block={block} />
    case 'html': return <HtmlOptions />
  }
}
