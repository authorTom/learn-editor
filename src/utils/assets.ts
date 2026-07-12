import type { Asset, Block } from '../types'
import { ASSET_REF } from '../types'

/** Visit every media `src` on a block, replacing each with `fn`'s return value.
    One place to teach new block types about media, rather than nine. */
export function mapBlockSrc(block: Block, fn: (src: string) => string): Block {
  const b = { ...block } as Block
  switch (b.type) {
    case 'image':
    case 'imageText':
    case 'hotspot':
      return { ...b, src: fn(b.src) }
    case 'audio':
      return { ...b, src: fn(b.src) }
    case 'gallery':
      return { ...b, images: b.images.map((im) => ({ ...im, src: fn(im.src) })) }
    case 'flashcards':
      return {
        ...b,
        cards: b.cards.map((c) =>
          c.frontImage ? { ...c, frontImage: fn(c.frontImage) } : c
        ),
      }
    default:
      return b
  }
}

/** Asset ids a block references. */
export function blockAssetIds(block: Block): string[] {
  const ids: string[] = []
  mapBlockSrc(block, (src) => {
    if (src && src.startsWith(ASSET_REF)) ids.push(src.slice(ASSET_REF.length))
    return src
  })
  return ids
}

/** The assets a block needs, so a saved block template can carry its media with it. */
export function assetsForBlock(block: Block, assets: Asset[]): Asset[] {
  const ids = new Set(blockAssetIds(block))
  return assets.filter((a) => ids.has(a.id))
}

/** Assets referenced anywhere in a set of blocks. */
export function assetsForBlocks(blocks: Block[], assets: Asset[]): Asset[] {
  const ids = new Set(blocks.flatMap(blockAssetIds))
  return assets.filter((a) => ids.has(a.id))
}

/** Merge incoming assets into a course's library, keeping ids (they're unique)
    and skipping any that are already there. */
export function mergeAssets(existing: Asset[], incoming: Asset[]): Asset[] {
  const have = new Set(existing.map((a) => a.id))
  return [...existing, ...incoming.filter((a) => !have.has(a.id))]
}

/** How many blocks in the course use this asset — shown in the media library. */
export function assetUsageCount(assetId: string, blocks: Block[]): number {
  return blocks.filter((b) => blockAssetIds(b).includes(assetId)).length
}
