import { useRef, useState } from 'react'
import { Plus, X, ArrowUp, ArrowDown, MapPin, Trash2 } from 'lucide-react'
import type {
  AccordionBlock, TabsBlock, FlashcardsBlock, SortingBlock, MatchingBlock, HotspotBlock,
} from '../../types'
import { uid } from '../../utils/id'
import RichText from '../RichText'
import { usePatch } from './SimpleBlocks'
import { Group, TextRow } from './inspectorFields'
import { UploadZone, useAssetSrc } from './MediaBlocks'

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
            <button className="icon-btn" disabled={i === 0} title="Move up" aria-label="Move up" onClick={() => move(i, -1)}>
              <ArrowUp size={13} />
            </button>
            <button className="icon-btn" disabled={i === items.length - 1} title="Move down" aria-label="Move down" onClick={() => move(i, 1)}>
              <ArrowDown size={13} />
            </button>
            <button
              className="icon-btn danger"
              disabled={items.length <= 1}
              title="Delete"
              aria-label="Delete" onClick={() => onChange(items.filter((x) => x.id !== it.id))}
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

export function AccordionOptions({ block }: { block: AccordionBlock }) {
  return (
    <Group title="Accordion">
      <p className="insp-note">
        {block.items.length} section{block.items.length === 1 ? '' : 's'}. Learners expand one at a
        time; all sections start collapsed.
      </p>
    </Group>
  )
}

export function TabsEditor({ block }: { block: TabsBlock }) {
  const patch = usePatch(block)
  return <ItemsEditor items={block.items} itemNoun="Tab" onChange={(items) => patch({ items })} />
}

export function TabsOptions({ block }: { block: TabsBlock }) {
  return (
    <Group title="Tabs">
      <p className="insp-note">
        {block.items.length} tab{block.items.length === 1 ? '' : 's'}. The first is shown by default.
      </p>
    </Group>
  )
}

function CardImage({ src }: { src: string }) {
  const resolved = useAssetSrc(src)
  return <img src={resolved} alt="" style={{ maxHeight: 90, objectFit: 'cover', width: '100%' }} />
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
              aria-label="Delete card" onClick={() => patch({ cards: block.cards.filter((x) => x.id !== c.id) })}
            >
              <X size={13} />
            </button>
            <div className="fc-side-lbl">Card {i + 1} — front</div>
            {c.frontImage ? (
              <div className="img-preview" style={{ marginBottom: 8 }}>
                <CardImage src={c.frontImage} />
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
      <div className="blk-actions">
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

export function FlashcardsOptions({ block }: { block: FlashcardsBlock }) {
  return (
    <Group title="Flashcards">
      <p className="insp-note">
        {block.cards.length} card{block.cards.length === 1 ? '' : 's'}. Learners click each card to
        flip it.
      </p>
    </Group>
  )
}

/* ---------- Sequence (sorting) ---------- */
/* Items are authored in the correct order; the player shuffles them for the learner. */
export function SortingEditor({ block }: { block: SortingBlock }) {
  const patch = usePatch(block)

  function move(i: number, dir: -1 | 1) {
    const items = [...block.items]
    const [it] = items.splice(i, 1)
    items.splice(i + dir, 0, it)
    patch({ items })
  }

  return (
    <div>
      <input
        className="mini-input"
        style={{ width: '100%', marginBottom: 10, fontWeight: 600 }}
        value={block.title}
        placeholder="Instruction, e.g. “Put these steps in order”"
        onChange={(e) => patch({ title: e.target.value })}
      />
      <div className="order-list">
        {block.items.map((it, i) => (
          <div key={it.id} className="order-row">
            <span className="order-num">{i + 1}</span>
            <input
              className="mini-input"
              style={{ flex: 1 }}
              value={it.text}
              placeholder={`Step ${i + 1}`}
              onChange={(e) =>
                patch({
                  items: block.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)),
                })
              }
            />
            <button className="icon-btn" disabled={i === 0} title="Move up" aria-label="Move up" onClick={() => move(i, -1)}>
              <ArrowUp size={13} />
            </button>
            <button
              className="icon-btn"
              disabled={i === block.items.length - 1}
              title="Move down"
              aria-label="Move down" onClick={() => move(i, 1)}
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="icon-btn danger"
              disabled={block.items.length <= 2}
              title="Remove"
              aria-label="Remove" onClick={() => patch({ items: block.items.filter((x) => x.id !== it.id) })}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="blk-actions">
        <button
          className="btn sm"
          onClick={() => patch({ items: [...block.items, { id: uid(), text: '' }] })}
        >
          <Plus size={13} /> Add step
        </button>
        <span className="blk-actions__hint">
          Learners see these shuffled and must restore this order.
        </span>
      </div>
    </div>
  )
}

export function SortingOptions({ block }: { block: SortingBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Feedback">
      <TextRow
        label="When correct"
        value={block.feedbackCorrect}
        placeholder="Well done — that is the right order."
        onChange={(feedbackCorrect) => patch({ feedbackCorrect })}
      />
      <TextRow
        label="When incorrect"
        value={block.feedbackIncorrect}
        placeholder="Not quite — try again."
        onChange={(feedbackIncorrect) => patch({ feedbackIncorrect })}
      />
    </Group>
  )
}

/* ---------- Matching ---------- */
export function MatchingEditor({ block }: { block: MatchingBlock }) {
  const patch = usePatch(block)

  function patchPair(id: string, p: Partial<{ left: string; right: string }>) {
    patch({ pairs: block.pairs.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  }

  return (
    <div>
      <input
        className="mini-input"
        style={{ width: '100%', marginBottom: 10, fontWeight: 600 }}
        value={block.title}
        placeholder="Instruction, e.g. “Match each term to its definition”"
        onChange={(e) => patch({ title: e.target.value })}
      />
      <div className="pair-list">
        {block.pairs.map((p, i) => (
          <div key={p.id} className="pair-row">
            <input
              className="mini-input"
              value={p.left}
              placeholder={`Prompt ${i + 1}`}
              onChange={(e) => patchPair(p.id, { left: e.target.value })}
            />
            <span className="pair-link">↔</span>
            <input
              className="mini-input"
              value={p.right}
              placeholder={`Match ${i + 1}`}
              onChange={(e) => patchPair(p.id, { right: e.target.value })}
            />
            <button
              className="icon-btn danger"
              disabled={block.pairs.length <= 2}
              title="Remove pair"
              aria-label="Remove pair" onClick={() => patch({ pairs: block.pairs.filter((x) => x.id !== p.id) })}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="blk-actions">
        <button
          className="btn sm"
          onClick={() => patch({ pairs: [...block.pairs, { id: uid(), left: '', right: '' }] })}
        >
          <Plus size={13} /> Add pair
        </button>
        <span className="blk-actions__hint">
          The right-hand column is shuffled for learners.
        </span>
      </div>
    </div>
  )
}

export function MatchingOptions({ block }: { block: MatchingBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Feedback">
      <TextRow
        label="When correct"
        value={block.feedbackCorrect}
        placeholder="Well matched."
        onChange={(feedbackCorrect) => patch({ feedbackCorrect })}
      />
      <TextRow
        label="When incorrect"
        value={block.feedbackIncorrect}
        placeholder="Not quite — try again."
        onChange={(feedbackIncorrect) => patch({ feedbackIncorrect })}
      />
    </Group>
  )
}

/* ---------- Hotspots ---------- */
/* Markers are stored as percentages of the image box, so they hold their place
   at every screen size. Click the image to drop one. */
export function HotspotEditor({ block }: { block: HotspotBlock }) {
  const patch = usePatch(block)
  const src = useAssetSrc(block.src)
  const imgRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)

  function addSpotAt(e: React.MouseEvent) {
    const box = imgRef.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.round(((e.clientX - box.left) / box.width) * 1000) / 10
    const y = Math.round(((e.clientY - box.top) / box.height) * 1000) / 10
    const spot = {
      id: uid(),
      x: Math.min(97, Math.max(3, x)),
      y: Math.min(97, Math.max(3, y)),
      label: `Hotspot ${block.spots.length + 1}`,
      html: '',
    }
    patch({ spots: [...block.spots, spot] })
    setSelected(spot.id)
  }

  function patchSpot(id: string, p: Partial<HotspotBlock['spots'][number]>) {
    patch({ spots: block.spots.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  }

  if (!block.src) {
    return (
      <div>
        <UploadZone label="Add the image learners will explore" onImage={(s) => patch({ src: s })} />
      </div>
    )
  }

  return (
    <div>
      <input
        className="mini-input"
        style={{ width: '100%', marginBottom: 10, fontWeight: 600 }}
        value={block.title}
        placeholder="Instruction, e.g. “Select each marker to learn more”"
        onChange={(e) => patch({ title: e.target.value })}
      />
      <div className="hotspot-edit" ref={imgRef} onClick={addSpotAt} title="Click the image to add a hotspot">
        <img src={src} alt={block.alt} />
        {block.spots.map((s, i) => (
          <button
            key={s.id}
            className={'hs-dot' + (selected === s.id ? ' sel' : '')}
            style={{ left: s.x + '%', top: s.y + '%' }}
            title={s.label}
            aria-label={s.label} onClick={(e) => {
              e.stopPropagation()
              setSelected(selected === s.id ? null : s.id)
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="drop-hint">Click anywhere on the image to drop a marker; click a marker to edit it.</p>

      {block.spots.map((s, i) =>
        selected === s.id ? (
          <div key={s.id} className="item-editor" style={{ marginTop: 10 }}>
            <div className="item-editor-head">
              <MapPin size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <input
                value={s.label}
                placeholder={`Hotspot ${i + 1} label`}
                onChange={(e) => patchSpot(s.id, { label: e.target.value })}
              />
              <button
                className="icon-btn danger"
                title="Delete hotspot"
                aria-label="Delete hotspot" onClick={() => {
                  patch({ spots: block.spots.filter((x) => x.id !== s.id) })
                  setSelected(null)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="item-editor-body">
              <RichText
                value={s.html}
                onChange={(html) => patchSpot(s.id, { html })}
                placeholder="What does this marker reveal?"
                compact
              />
            </div>
          </div>
        ) : null
      )}

    </div>
  )
}

export function HotspotOptions({ block }: { block: HotspotBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Hotspots">
      <TextRow
        label="Alt text"
        value={block.alt}
        placeholder="Describe the image"
        onChange={(alt) => patch({ alt })}
      />
      <p className="insp-note">
        {block.spots.length} marker{block.spots.length === 1 ? '' : 's'}. Positions are stored as
        percentages, so they hold their place at every screen size.
      </p>
      <button className="btn sm" onClick={() => patch({ src: '', spots: [] })}>
        Replace image
      </button>
    </Group>
  )
}
