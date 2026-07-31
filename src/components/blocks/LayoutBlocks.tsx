import { useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Plus, X } from 'lucide-react'
import type { CardsBlock, StepsBlock } from '../../types'
import { uid } from '../../utils/id'
import { Button, IconButton, Input } from '../../ui'
import RichText from '../RichText'
import { usePatch } from './SimpleBlocks'
import { Group, SegRow } from './inspectorFields'
import { UploadZone, useAssetSrc } from './MediaBlocks'

/**
 * Cards and Steps — the two arrangements authors reached for most and had to
 * fake with a Columns block full of hand-formatted text.
 *
 * Both render on the canvas as an editable stack rather than as the finished
 * grid: a three-column card grid at canvas width leaves each card too narrow to
 * write in. The grid itself is what Preview and the player show, driven by the
 * same `columns` / `layout` settings from the inspector.
 */

/* ---------- Cards ---------- */

function CardThumb({ src }: { src: string }) {
  const resolved = useAssetSrc(src)
  if (!resolved) return null
  return <img className="card-thumb" src={resolved} alt="" />
}

export function CardsEditor({ block }: { block: CardsBlock }) {
  const patch = usePatch(block)
  const items = block.items
  // The upload zone is ~110px tall, and a four-card block would have spent more
  // of the canvas on empty drop targets than on the cards' own text. It opens
  // per card instead, and closes as soon as an image lands.
  const [uploading, setUploading] = useState<string | null>(null)

  const set = (id: string, p: Partial<CardsBlock['items'][number]>) =>
    patch({ items: items.map((it) => (it.id === id ? { ...it, ...p } : it)) })

  function move(i: number, dir: -1 | 1) {
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(i + dir, 0, it)
    patch({ items: next })
  }

  return (
    <div>
      {items.map((it, i) => (
        <div key={it.id} className="item-editor">
          <div className="item-editor-head">
            <Input
              value={it.title}
              aria-label={`Card ${i + 1} title`}
              placeholder="Card title"
              onChange={(e) => set(it.id, { title: e.target.value })}
            />
            <Input
              value={it.icon}
              aria-label={`Card ${i + 1} icon`}
              placeholder="Icon"
              title="An emoji shown above the title"
              style={{ width: 62, textAlign: 'center' }}
              onChange={(e) => set(it.id, { icon: e.target.value })}
            />
            <IconButton
              label={`Move card ${i + 1} up`}
              size="sm"
              icon={<ArrowUp size={13} />}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            />
            <IconButton
              label={`Move card ${i + 1} down`}
              size="sm"
              icon={<ArrowDown size={13} />}
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            />
            <IconButton
              label={`Delete card ${i + 1}`}
              size="sm"
              variant="danger"
              icon={<X size={13} />}
              disabled={items.length <= 1}
              onClick={() => patch({ items: items.filter((x) => x.id !== it.id) })}
            />
          </div>
          <div className="item-editor-body">
            <RichText
              value={it.html}
              onChange={(html) => set(it.id, { html })}
              placeholder="Card text…"
              compact
            />
            {it.src ? (
              <div className="card-img-row">
                <CardThumb src={it.src} />
                <Button size="sm" onClick={() => set(it.id, { src: '' })}>
                  Remove image
                </Button>
              </div>
            ) : uploading === it.id ? (
              <UploadZone
                compact
                label="Drop a card image here, or click to browse"
                onImage={(src) => {
                  set(it.id, { src })
                  setUploading(null)
                }}
              />
            ) : (
              <div className="card-img-row">
                <Button size="sm" icon={<ImagePlus size={13} />} onClick={() => setUploading(it.id)}>
                  Add image
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="blk-actions">
        <Button
          size="sm"
          icon={<Plus size={13} />}
          onClick={() =>
            patch({ items: [...items, { id: uid(), src: '', icon: '', title: '', html: '' }] })
          }
        >
          Add card
        </Button>
      </div>
    </div>
  )
}

export function CardsOptions({ block }: { block: CardsBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Cards">
      <SegRow
        label="Columns"
        value={String(block.columns)}
        options={[
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ]}
        onChange={(v) => patch({ columns: Number(v) as CardsBlock['columns'] })}
        hint="Cards reflow to one column on phones however many you pick."
      />
      <SegRow
        label="Style"
        value={block.style}
        options={[
          { value: 'bordered', label: 'Bordered' },
          { value: 'filled', label: 'Filled' },
          { value: 'elevated', label: 'Elevated' },
        ]}
        onChange={(style) => patch({ style })}
      />
      <SegRow
        label="Alignment"
        value={block.align}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Centred' },
        ]}
        onChange={(align) => patch({ align })}
      />
      <p className="insp-note">
        {block.items.length} card{block.items.length === 1 ? '' : 's'}. Images and icons are both
        optional — a card with neither is just a heading and its text.
      </p>
    </Group>
  )
}

/* ---------- Steps ---------- */

export function StepsEditor({ block }: { block: StepsBlock }) {
  const patch = usePatch(block)
  const items = block.items

  const set = (id: string, p: Partial<StepsBlock['items'][number]>) =>
    patch({ items: items.map((it) => (it.id === id ? { ...it, ...p } : it)) })

  function move(i: number, dir: -1 | 1) {
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(i + dir, 0, it)
    patch({ items: next })
  }

  return (
    <div>
      {items.map((it, i) => (
        <div key={it.id} className="item-editor">
          <div className="item-editor-head">
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            <Input
              value={it.title}
              aria-label={`Step ${i + 1} title`}
              placeholder="Step title"
              onChange={(e) => set(it.id, { title: e.target.value })}
            />
            <IconButton
              label={`Move step ${i + 1} up`}
              size="sm"
              icon={<ArrowUp size={13} />}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            />
            <IconButton
              label={`Move step ${i + 1} down`}
              size="sm"
              icon={<ArrowDown size={13} />}
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            />
            <IconButton
              label={`Delete step ${i + 1}`}
              size="sm"
              variant="danger"
              icon={<X size={13} />}
              disabled={items.length <= 1}
              onClick={() => patch({ items: items.filter((x) => x.id !== it.id) })}
            />
          </div>
          <div className="item-editor-body">
            <RichText
              value={it.html}
              onChange={(html) => set(it.id, { html })}
              placeholder="What happens at this step…"
              compact
            />
          </div>
        </div>
      ))}
      <div className="blk-actions">
        <Button
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => patch({ items: [...items, { id: uid(), title: '', html: '' }] })}
        >
          Add step
        </Button>
      </div>
    </div>
  )
}

export function StepsOptions({ block }: { block: StepsBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Steps">
      <SegRow
        label="Layout"
        value={block.layout}
        options={[
          { value: 'vertical', label: 'Timeline' },
          { value: 'horizontal', label: 'Track' },
        ]}
        onChange={(layout) => patch({ layout })}
        hint={
          block.layout === 'horizontal'
            ? 'A horizontal track stacks back to a timeline on narrow screens.'
            : 'Steps run down the page, connected by a rule.'
        }
      />
      <SegRow
        label="Marker"
        value={block.marker}
        options={[
          { value: 'number', label: 'Numbered' },
          { value: 'dot', label: 'Dot' },
        ]}
        onChange={(marker) => patch({ marker })}
      />
    </Group>
  )
}
