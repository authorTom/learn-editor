import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import { useUi } from '../../uiStore'
import type {
  TextBlock, HeadingBlock, StatementBlock, QuoteBlock, ListBlock,
  NoteBlock, DividerBlock, ButtonBlock, ColumnsBlock, HtmlBlock, Block,
} from '../../types'
import { uid } from '../../utils/id'
import { Button, IconButton, Input } from '../../ui'
import RichText from '../RichText'
import InlineRichInput from './InlineRichInput'
import { CheckRow, Group, NoOptions, NumberRow, SegRow, TextRow } from './inspectorFields'

function usePatch<T extends Block>(block: T) {
  const updateBlock = useStore((s) => s.updateBlock)
  return (patch: Partial<T>) => updateBlock(block.id, patch as Partial<Block>)
}

export { usePatch }

/* ============================================================
   Content editors — rendered on the canvas.
   Only what a learner ends up reading lives here; everything
   about styling or behaviour is in the *Options components below.
   ============================================================ */

/* ---------- Text ---------- */
export function TextEditor({ block }: { block: TextBlock }) {
  const patch = usePatch(block)
  const openSlashPicker = useUi((s) => s.openSlashPicker)
  return (
    <RichText
      value={block.html}
      onChange={(html) => patch({ html })}
      placeholder="Write your paragraph, or press / to insert a block…"
      // Typing "/" in an empty paragraph is the fast path to the block picker,
      // which opens anchored to this block and inserts directly after it.
      onSlash={() => openSlashPicker(block.id)}
    />
  )
}

export function TextOptions({ block }: { block: TextBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Formatting">
      <SegRow
        label="Layout"
        value={block.layout ?? 'normal'}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'lead', label: 'Lead' },
          { value: 'columns', label: 'Columns' },
          { value: 'boxed', label: 'Boxed' },
        ]}
        onChange={(layout) => patch({ layout })}
        hint="Lead renders larger, as an introduction."
      />
    </Group>
  )
}

/* ---------- Heading ---------- */
export function HeadingEditor({ block }: { block: HeadingBlock }) {
  const patch = usePatch(block)
  return (
    <input
      className={'blk-input-title h' + block.level}
      style={{ textAlign: block.align }}
      aria-label="Heading text"
      value={block.text}
      placeholder="Heading text…"
      onChange={(e) => patch({ text: e.target.value })}
    />
  )
}

export function HeadingOptions({ block }: { block: HeadingBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Heading">
      <SegRow
        label="Size"
        value={String(block.level) as '1' | '2' | '3'}
        options={[
          { value: '1', label: 'Large' },
          { value: '2', label: 'Medium' },
          { value: '3', label: 'Small' },
        ]}
        onChange={(v) => patch({ level: Number(v) as 1 | 2 | 3 })}
      />
      <SegRow
        label="Alignment"
        value={block.align}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Centre' },
        ]}
        onChange={(align) => patch({ align })}
      />
    </Group>
  )
}

/* ---------- Statement ---------- */
export function StatementEditor({ block }: { block: StatementBlock }) {
  const patch = usePatch(block)
  return (
    <RichText
      value={block.html}
      onChange={(html) => patch({ html })}
      placeholder="A bold statement your learners should remember…"
      compact
    />
  )
}

export function StatementOptions({ block }: { block: StatementBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Statement">
      <SegRow
        label="Style"
        value={block.style}
        options={[
          { value: 'a', label: 'Ruled' },
          { value: 'b', label: 'Panel' },
          { value: 'c', label: 'Accent' },
        ]}
        onChange={(style) => patch({ style })}
      />
    </Group>
  )
}

/* ---------- Quote ---------- */
export function QuoteEditor({ block }: { block: QuoteBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <RichText
        value={block.html}
        onChange={(html) => patch({ html })}
        placeholder="“The quote goes here…”"
        compact
      />
      {/* Attribution stays on the canvas: learners read it, so it is content. */}
      <input
        className="mini-input blk-attribution"
        aria-label="Attribution"
        value={block.attribution}
        placeholder="— Attribution (e.g. Marie Curie)"
        onChange={(e) => patch({ attribution: e.target.value })}
      />
    </div>
  )
}

export function QuoteOptions() {
  return <NoOptions what="A quote" />
}

/* ---------- List ---------- */
export function ListEditor({ block }: { block: ListBlock }) {
  const patch = usePatch(block)

  function setItem(i: number, v: string) {
    const items = [...block.items]
    items[i] = v
    patch({ items })
  }

  return (
    <div>
      {block.items.map((item, i) => (
        <div key={i} className="qz-choice-row">
          <span className="list-marker" aria-hidden="true">
            {block.style === 'number' ? `${i + 1}.` : block.style === 'check' ? '✓' : '•'}
          </span>
          <InlineRichInput
            value={item}
            ariaLabel={`List item ${i + 1}`}
            placeholder={`Item ${i + 1}`}
            onChange={(html) => setItem(i, html)}
            onEnter={() => {
              const items = [...block.items]
              items.splice(i + 1, 0, '')
              patch({ items })
            }}
          />
          <IconButton
            label={`Remove item ${i + 1}`}
            size="sm"
            variant="danger"
            icon={<X size={14} />}
            disabled={block.items.length <= 1}
            onClick={() => patch({ items: block.items.filter((_, j) => j !== i) })}
          />
        </div>
      ))}
      <Button size="sm" icon={<Plus size={13} />} onClick={() => patch({ items: [...block.items, ''] })}>
        Add item
      </Button>
    </div>
  )
}

export function ListOptions({ block }: { block: ListBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="List">
      <SegRow
        label="Marker"
        value={block.style}
        options={[
          { value: 'bullet', label: 'Bullets' },
          { value: 'number', label: 'Numbers' },
          { value: 'check', label: 'Checks' },
        ]}
        onChange={(style) => patch({ style })}
      />
    </Group>
  )
}

/* ---------- Note / callout ---------- */
export function NoteEditor({ block }: { block: NoteBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <input
        className="mini-input blk-subtitle"
        aria-label="Callout title"
        value={block.title}
        placeholder="Callout title (optional)"
        onChange={(e) => patch({ title: e.target.value })}
      />
      <RichText
        value={block.html}
        onChange={(html) => patch({ html })}
        placeholder="Callout content…"
        compact
      />
    </div>
  )
}

export function NoteOptions({ block }: { block: NoteBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Callout">
      <SegRow
        label="Tone"
        value={block.tone}
        options={[
          { value: 'info', label: 'ℹ️', srLabel: 'Info' },
          { value: 'success', label: '✅', srLabel: 'Tip' },
          { value: 'warning', label: '⚠️', srLabel: 'Warning' },
          { value: 'danger', label: '⛔', srLabel: 'Important' },
        ]}
        onChange={(tone) => patch({ tone })}
        hint="Sets the colour and icon learners see."
      />
    </Group>
  )
}

/* ---------- Divider ---------- */
/* A divider has no content, so the canvas shows what it will look like and
   every setting lives in the inspector. */
export function DividerEditor({ block }: { block: DividerBlock }) {
  return (
    <div className="divider-preview" aria-label={`${block.style} divider`}>
      {block.style === 'line' && <span className="divider-preview__line" />}
      {block.style === 'space' && <span className="divider-preview__space">Spacer</span>}
      {block.style === 'numbered' && (
        <span className="divider-preview__num">{block.number ?? 1}</span>
      )}
    </div>
  )
}

export function DividerOptions({ block }: { block: DividerBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Divider">
      <SegRow
        label="Style"
        value={block.style}
        options={[
          { value: 'line', label: 'Line' },
          { value: 'space', label: 'Spacer' },
          { value: 'numbered', label: 'Number' },
        ]}
        onChange={(style) => patch({ style })}
      />
      {block.style === 'numbered' && (
        <NumberRow
          label="Number"
          min={1}
          value={block.number ?? 1}
          onChange={(number) => patch({ number })}
        />
      )}
    </Group>
  )
}

/* ---------- Button ---------- */
export function ButtonEditor({ block }: { block: ButtonBlock }) {
  const patch = usePatch(block)
  return (
    <div className="blk-row">
      <Input
        style={{ flex: 1 }}
        aria-label="Button label"
        value={block.label}
        placeholder="Button label"
        onChange={(e) => patch({ label: e.target.value })}
      />
      <Input
        style={{ flex: 2 }}
        type="url"
        aria-label="Button link"
        value={block.url}
        placeholder="https://link-to-open.com"
        onChange={(e) => patch({ url: e.target.value })}
      />
    </div>
  )
}

export function ButtonOptions({ block }: { block: ButtonBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Button">
      <SegRow
        label="Alignment"
        value={block.align}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Centre' },
        ]}
        onChange={(align) => patch({ align })}
      />
      <SegRow
        label="Style"
        value={block.variant}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'outline', label: 'Outline' },
        ]}
        onChange={(variant) => patch({ variant })}
      />
    </Group>
  )
}

/* ---------- HTML / embed code ---------- */
export function HtmlEditor({ block }: { block: HtmlBlock }) {
  const patch = usePatch(block)
  const [showPreview, setShowPreview] = useState(false)
  return (
    <div>
      <textarea
        className="code-input"
        aria-label="HTML source"
        value={block.code}
        placeholder={'<!-- Paste HTML or an embed code, e.g. -->\n<iframe src="https://example.com" width="100%" height="400"></iframe>'}
        spellCheck={false}
        rows={Math.min(16, Math.max(5, block.code.split('\n').length + 1))}
        onChange={(e) => patch({ code: e.target.value })}
      />
      <div className="blk-actions">
        <Button
          size="sm"
          disabled={!block.code.trim()}
          pressed={showPreview}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Hide preview' : 'Preview'}
        </Button>
      </div>
      {showPreview && block.code.trim() && (
        <iframe
          className="code-preview"
          title="HTML preview"
          sandbox="allow-scripts"
          srcDoc={block.code}
        />
      )}
    </div>
  )
}

export function HtmlOptions() {
  return (
    <Group title="Custom HTML">
      <p className="insp-note">
        This block is rendered as-is in the course. Scripts and embed codes will run, so only paste
        markup you trust.
      </p>
    </Group>
  )
}

/* ---------- Columns ---------- */
export function ColumnsEditor({ block }: { block: ColumnsBlock }) {
  const patch = usePatch(block)

  function setCol(id: string, html: string) {
    patch({ columns: block.columns.map((c) => (c.id === id ? { ...c, html } : c)) })
  }

  return (
    <div>
      <div
        className="columns-edit-grid"
        style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}
      >
        {block.columns.map((c, i) => (
          <div key={c.id} className="item-editor" style={{ marginBottom: 0 }}>
            <div className="item-editor-head">
              <span className="item-editor-title">Column {i + 1}</span>
              <span style={{ flex: 1 }} />
              <IconButton
                label={`Remove column ${i + 1}`}
                size="sm"
                variant="danger"
                icon={<X size={13} />}
                disabled={block.columns.length <= 2}
                onClick={() => patch({ columns: block.columns.filter((x) => x.id !== c.id) })}
              />
            </div>
            <div className="item-editor-body">
              <RichText value={c.html} onChange={(html) => setCol(c.id, html)} placeholder="Column content…" compact />
            </div>
          </div>
        ))}
      </div>
      <div className="blk-actions">
        <Button
          size="sm"
          icon={<Plus size={13} />}
          disabled={block.columns.length >= 4}
          onClick={() => patch({ columns: [...block.columns, { id: uid(), html: '' }] })}
        >
          Add column
        </Button>
      </div>
    </div>
  )
}

export function ColumnsOptions({ block }: { block: ColumnsBlock }) {
  const patch = usePatch(block)
  const two = block.columns.length === 2
  return (
    <Group title="Columns">
      {/* Uneven splits only make sense across two columns; three or four always
          divide evenly, so the control is hidden rather than shown doing
          nothing. */}
      {two && (
        <SegRow
          label="Split"
          value={block.ratio ?? 'equal'}
          options={[
            { value: 'equal', label: 'Even' },
            { value: 'wide-left', label: '2 : 1' },
            { value: 'wide-right', label: '1 : 2' },
          ]}
          onChange={(ratio) => patch({ ratio })}
        />
      )}
      <SegRow
        label="Align"
        value={block.valign ?? 'top'}
        options={[
          { value: 'top', label: 'Top' },
          { value: 'center', label: 'Middle' },
        ]}
        onChange={(valign) => patch({ valign })}
        hint="How columns of different lengths line up against one another."
      />
      <SegRow
        label="Gap"
        value={block.gap ?? 'md'}
        options={[
          { value: 'sm', label: 'Tight' },
          { value: 'md', label: 'Normal' },
          { value: 'lg', label: 'Wide' },
        ]}
        onChange={(gap) => patch({ gap })}
      />
      <p className="insp-note">
        {block.columns.length} columns. They stack vertically on phones.
      </p>
    </Group>
  )
}

/* Re-exported so the quiz editor can keep using the shared checkbox row. */
export { CheckRow, Group, NoOptions, NumberRow, SegRow, TextRow }
