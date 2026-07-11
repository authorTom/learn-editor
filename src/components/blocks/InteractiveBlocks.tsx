import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import type { AccordionBlock, TabsBlock, FlashcardsBlock } from '../../types'
import { uid } from '../../utils/id'
import RichText from '../RichText'
import { usePatch } from './SimpleBlocks'
import { UploadZone } from './MediaBlocks'

/* Shared editor for accordion + tabs (title/html item lists). */
function ItemsEditor({
  items,
  itemNoun,
  onChange,
}: {
  items: { id: string; title: string; html: string }[]
  itemNoun: string
  onChange: (items: { id: string; title: string; html: string }[]) => void
}) {
  function patchItem(id: string, p: Partial<{ title: string; html: string }>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)))
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(i + dir, 0, it)
    onChange(next)
  }

  return (
    <div>
      {items.map((it, i) => (
        <div key={it.id} className="item-editor">
          <div className="item-editor-head">
            <input
              value={it.title}
              placeholder={`${itemNoun} title`}
              onChange={(e) => patchItem(it.id, { title: e.target.value })}
            />
            <button className="icon-btn" disabled={i === 0} title="Move up" onClick={() => move(i, -1)}>
              <ArrowUp size={13} />
            </button>
            <button className="icon-btn" disabled={i === items.length - 1} title="Move down" onClick={() => move(i, 1)}>
              <ArrowDown size={13} />
            </button>
            <button
              className="icon-btn danger"
              disabled={items.length <= 1}
              title="Delete"
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            >
              <X size={13} />
            </button>
          </div>
          <div className="item-editor-body">
            <RichText
              value={it.html}
              onChange={(html) => patchItem(it.id, { html })}
              placeholder={`${itemNoun} content…`}
              compact
            />
          </div>
        </div>
      ))}
      <button
        className="btn sm"
        onClick={() =>
          onChange([...items, { id: uid(), title: `${itemNoun} ${items.length + 1}`, html: '' }])
        }
      >
        <Plus size={13} /> Add {itemNoun.toLowerCase()}
      </button>
    </div>
  )
}

export function AccordionEditor({ block }: { block: AccordionBlock }) {
  const patch = usePatch(block)
  return <ItemsEditor items={block.items} itemNoun="Section" onChange={(items) => patch({ items })} />
}

export function TabsEditor({ block }: { block: TabsBlock }) {
  const patch = usePatch(block)
  return <ItemsEditor items={block.items} itemNoun="Tab" onChange={(items) => patch({ items })} />
}

export function FlashcardsEditor({ block }: { block: FlashcardsBlock }) {
  const patch = usePatch(block)

  function patchCard(id: string, p: Partial<{ front: string; back: string; frontImage?: string }>) {
    patch({ cards: block.cards.map((c) => (c.id === id ? { ...c, ...p } : c)) })
  }

  return (
    <div>
      <div className="fc-grid">
        {block.cards.map((c, i) => (
          <div key={c.id} className="fc-card-edit">
            <button
              className="icon-btn danger fc-del"
              disabled={block.cards.length <= 1}
              title="Delete card"
              onClick={() => patch({ cards: block.cards.filter((x) => x.id !== c.id) })}
            >
              <X size={13} />
            </button>
            <div className="fc-side-lbl">Card {i + 1} — front</div>
            {c.frontImage ? (
              <div className="img-preview" style={{ marginBottom: 8 }}>
                <img src={c.frontImage} alt="" style={{ maxHeight: 90, objectFit: 'cover', width: '100%' }} />
                <div className="img-replace">
                  <button className="btn sm" onClick={() => patchCard(c.id, { frontImage: undefined })}>
                    <X size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <UploadZone compact label="Optional image" onImage={(src) => patchCard(c.id, { frontImage: src })} />
              </div>
            )}
            <textarea
              value={c.front}
              placeholder="Front text (the prompt)"
              onChange={(e) => patchCard(c.id, { front: e.target.value })}
            />
            <div className="fc-side-lbl" style={{ marginTop: 8 }}>Back</div>
            <textarea
              value={c.back}
              placeholder="Back text (the answer)"
              onChange={(e) => patchCard(c.id, { back: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="blk-options">
        <button
          className="btn sm"
          onClick={() => patch({ cards: [...block.cards, { id: uid(), front: '', back: '' }] })}
        >
          <Plus size={13} /> Add card
        </button>
      </div>
    </div>
  )
}
