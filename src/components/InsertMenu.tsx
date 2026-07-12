import { useMemo, useState } from 'react'
import {
  Type, Heading1, MessageSquareQuote, Quote, List, Info, Image, LayoutPanelLeft,
  LayoutGrid, Play, Globe, Volume2, Minus, MousePointerClick, Columns2,
  ChevronsUpDown, PanelTop, GalleryHorizontalEnd, CircleCheckBig, Code, X, Bookmark, Trash2,
  ArrowDownUp, Shuffle, MapPin,
  type LucideIcon,
} from 'lucide-react'
import { blockDefs, cloneBlock, createBlock } from '../blockDefaults'
import { useStore } from '../store'
import type { Asset, Block, BlockType } from '../types'

const ICONS: Record<string, LucideIcon> = {
  Type, Heading1, MessageSquareQuote, Quote, List, Info, Image, LayoutPanelLeft,
  LayoutGrid, Play, Globe, Volume2, Minus, MousePointerClick, Columns2,
  ChevronsUpDown, PanelTop, GalleryHorizontalEnd, CircleCheckBig, Code,
  ArrowDownUp, Shuffle, MapPin,
}

const CATEGORIES = ['Text', 'Media', 'Layout', 'Interactive', 'Assessment'] as const

function typeLabel(type: BlockType): string {
  return blockDefs.find((d) => d.type === type)?.label ?? type
}

export default function InsertMenu({
  onInsert,
  onClose,
}: {
  onInsert: (block: Block, assets?: Asset[]) => void
  onClose: () => void
}) {
  const blockTemplates = useStore((s) => s.blockTemplates)
  const deleteBlockTemplate = useStore((s) => s.deleteBlockTemplate)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return blockDefs
    return blockDefs.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    )
  }, [q])

  const templates = useMemo(() => {
    if (!q) return blockTemplates
    return blockTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || typeLabel(t.blockType).toLowerCase().includes(q)
    )
  }, [blockTemplates, q])

  /** Enter picks the first visible result, saved blocks first. */
  function insertFirstMatch() {
    if (templates.length > 0) onInsert(cloneBlock(templates[0].block), templates[0].assets)
    else if (filtered.length > 0) onInsert(createBlock(filtered[0].type))
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide insert-menu" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add a block</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="insert-search">
          <input
            className="input"
            autoFocus
            placeholder="Search blocks… (e.g. quiz, video, tabs)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter') insertFirstMatch()
            }}
          />
        </div>
        <div className="modal-body">
          {templates.length > 0 && (
            <div>
              <div className="insert-cat">Saved blocks</div>
              <div className="insert-grid">
                {templates.map((t) => {
                  const Icon = ICONS[blockDefs.find((d) => d.type === t.blockType)?.icon ?? ''] || Bookmark
                  return (
                    <div
                      key={t.id}
                      className="insert-item tpl"
                      role="button"
                      tabIndex={0}
                      onClick={() => onInsert(cloneBlock(t.block), t.assets)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onInsert(cloneBlock(t.block), t.assets)
                      }}
                    >
                      <span className="ii-icon saved">
                        <Icon size={17} />
                      </span>
                      <span className="ii-text">
                        <div className="ii-label">{t.name}</div>
                        <div className="ii-desc">Saved {typeLabel(t.blockType).toLowerCase()}</div>
                      </span>
                      <button
                        className="icon-btn danger ii-del"
                        title="Remove from library"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Remove "${t.name}" from your block library?`))
                            deleteBlockTemplate(t.id)
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const items = filtered.filter((d) => d.category === cat)
            if (!items.length) return null
            return (
              <div key={cat}>
                <div className="insert-cat">{cat}</div>
                <div className="insert-grid">
                  {items.map((d) => {
                    const Icon = ICONS[d.icon] || Type
                    return (
                      <button
                        key={d.type}
                        className="insert-item"
                        onClick={() => onInsert(createBlock(d.type))}
                      >
                        <span className="ii-icon">
                          <Icon size={17} />
                        </span>
                        <span className="ii-text">
                          <div className="ii-label">{d.label}</div>
                          <div className="ii-desc">{d.description}</div>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { createBlock }
