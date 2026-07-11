import { useMemo, useState } from 'react'
import {
  Type, Heading1, MessageSquareQuote, Quote, List, Info, Image, LayoutPanelLeft,
  LayoutGrid, Play, Globe, Volume2, Minus, MousePointerClick, Columns2,
  ChevronsUpDown, PanelTop, GalleryHorizontalEnd, CircleCheckBig, X,
  type LucideIcon,
} from 'lucide-react'
import { blockDefs, createBlock } from '../blockDefaults'
import type { BlockType } from '../types'

const ICONS: Record<string, LucideIcon> = {
  Type, Heading1, MessageSquareQuote, Quote, List, Info, Image, LayoutPanelLeft,
  LayoutGrid, Play, Globe, Volume2, Minus, MousePointerClick, Columns2,
  ChevronsUpDown, PanelTop, GalleryHorizontalEnd, CircleCheckBig,
}

const CATEGORIES = ['Text', 'Media', 'Layout', 'Interactive', 'Assessment'] as const

export default function InsertMenu({
  onInsert,
  onClose,
}: {
  onInsert: (type: BlockType) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return blockDefs
    return blockDefs.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    )
  }, [query])

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
              if (e.key === 'Enter' && filtered.length > 0) {
                onInsert(filtered[0].type)
              }
            }}
          />
        </div>
        <div className="modal-body">
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
                      <button key={d.type} className="insert-item" onClick={() => onInsert(d.type)}>
                        <span className="ii-icon">
                          <Icon size={17} />
                        </span>
                        <span>
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
