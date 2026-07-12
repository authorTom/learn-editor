import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import type {
  TextBlock, HeadingBlock, StatementBlock, QuoteBlock, ListBlock,
  NoteBlock, DividerBlock, ButtonBlock, ColumnsBlock, HtmlBlock, Block,
} from '../../types'
import { uid } from '../../utils/id'
import RichText from '../RichText'

function usePatch<T extends Block>(block: T) {
  const updateBlock = useStore((s) => s.updateBlock)
  return (patch: Partial<T>) => updateBlock(block.id, patch as Partial<Block>)
}

function Seg<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <span className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          className={value === o.v ? 'active' : ''}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

export { usePatch, Seg }

/* ---------- Text ---------- */
export function TextEditor({ block }: { block: TextBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <RichText
        value={block.html}
        onChange={(html) => patch({ html })}
        placeholder="Write your paragraph… select text to format it."
      />
      <div className="blk-options">
        <span className="lbl">Layout</span>
        <Seg
          value={block.layout ?? 'normal'}
          options={[
            { v: 'normal', label: 'Normal' },
            { v: 'lead', label: 'Lead' },
            { v: 'columns', label: 'Two columns' },
            { v: 'boxed', label: 'Boxed' },
          ]}
          onChange={(layout) => patch({ layout })}
        />
      </div>
    </div>
  )
}

/* ---------- Heading ---------- */
export function HeadingEditor({ block }: { block: HeadingBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <input
        className={'blk-input-title h' + block.level}
        style={{ textAlign: block.align }}
        value={block.text}
        placeholder="Heading text…"
        onChange={(e) => patch({ text: e.target.value })}
      />
      <div className="blk-options">
        <span className="lbl">Size</span>
        <Seg
          value={String(block.level) as '1' | '2' | '3'}
          options={[{ v: '1', label: 'Large' }, { v: '2', label: 'Medium' }, { v: '3', label: 'Small' }]}
          onChange={(v) => patch({ level: Number(v) as 1 | 2 | 3 })}
        />
        <span className="lbl">Align</span>
        <Seg
          value={block.align}
          options={[{ v: 'left', label: 'Left' }, { v: 'center', label: 'Center' }]}
          onChange={(align) => patch({ align })}
        />
      </div>
    </div>
  )
}

/* ---------- Statement ---------- */
export function StatementEditor({ block }: { block: StatementBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <RichText
        value={block.html}
        onChange={(html) => patch({ html })}
        placeholder="A bold statement your learners should remember…"
        compact
      />
      <div className="blk-options">
        <span className="lbl">Style</span>
        <Seg
          value={block.style}
          options={[{ v: 'a', label: 'Ruled' }, { v: 'b', label: 'Panel' }, { v: 'c', label: 'Accent' }]}
          onChange={(style) => patch({ style })}
        />
      </div>
    </div>
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
      <div className="blk-options" style={{ borderTop: 'none', paddingTop: 0 }}>
        <input
          className="mini-input"
          style={{ flex: 1 }}
          value={block.attribution}
          placeholder="Attribution (e.g. Marie Curie)"
          onChange={(e) => patch({ attribution: e.target.value })}
        />
      </div>
    </div>
  )
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
          <span style={{ color: 'var(--ink-3)', width: 20, textAlign: 'center', flexShrink: 0 }}>
            {block.style === 'number' ? `${i + 1}.` : block.style === 'check' ? '✓' : '•'}
          </span>
          <input
            className="input"
            value={item}
            placeholder={`Item ${i + 1}`}
            onChange={(e) => setItem(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const items = [...block.items]
                items.splice(i + 1, 0, '')
                patch({ items })
              }
            }}
          />
          <button
            className="icon-btn danger"
            disabled={block.items.length <= 1}
            onClick={() => patch({ items: block.items.filter((_, j) => j !== i) })}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="blk-options">
        <button className="btn sm" onClick={() => patch({ items: [...block.items, ''] })}>
          <Plus size={13} /> Add item
        </button>
        <span className="lbl">Style</span>
        <Seg
          value={block.style}
          options={[{ v: 'bullet', label: 'Bullets' }, { v: 'number', label: 'Numbers' }, { v: 'check', label: 'Checks' }]}
          onChange={(style) => patch({ style })}
        />
      </div>
    </div>
  )
}

/* ---------- Note / callout ---------- */
export function NoteEditor({ block }: { block: NoteBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <input
        className="mini-input"
        style={{ width: '100%', marginBottom: 10, fontWeight: 600 }}
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
      <div className="blk-options">
        <span className="lbl">Tone</span>
        <Seg
          value={block.tone}
          options={[
            { v: 'info', label: 'ℹ️ Info' },
            { v: 'success', label: '✅ Tip' },
            { v: 'warning', label: '⚠️ Warning' },
            { v: 'danger', label: '⛔ Important' },
          ]}
          onChange={(tone) => patch({ tone })}
        />
      </div>
    </div>
  )
}

/* ---------- Divider ---------- */
export function DividerEditor({ block }: { block: DividerBlock }) {
  const patch = usePatch(block)
  return (
    <div className="blk-row">
      <span className="lbl" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Divider</span>
      <Seg
        value={block.style}
        options={[{ v: 'line', label: 'Line' }, { v: 'space', label: 'Spacer' }, { v: 'numbered', label: 'Number' }]}
        onChange={(style) => patch({ style })}
      />
      {block.style === 'numbered' && (
        <input
          className="mini-input"
          type="number"
          min={1}
          style={{ width: 70 }}
          value={block.number ?? 1}
          onChange={(e) => patch({ number: Number(e.target.value) || 1 })}
        />
      )}
    </div>
  )
}

/* ---------- Button ---------- */
export function ButtonEditor({ block }: { block: ButtonBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <div className="blk-row">
        <input
          className="mini-input"
          style={{ flex: 1 }}
          value={block.label}
          placeholder="Button label"
          onChange={(e) => patch({ label: e.target.value })}
        />
        <input
          className="mini-input"
          style={{ flex: 2 }}
          value={block.url}
          placeholder="https://link-to-open.com"
          onChange={(e) => patch({ url: e.target.value })}
        />
      </div>
      <div className="blk-options">
        <span className="lbl">Align</span>
        <Seg
          value={block.align}
          options={[{ v: 'left', label: 'Left' }, { v: 'center', label: 'Center' }]}
          onChange={(align) => patch({ align })}
        />
        <span className="lbl">Style</span>
        <Seg
          value={block.variant}
          options={[{ v: 'solid', label: 'Solid' }, { v: 'outline', label: 'Outline' }]}
          onChange={(variant) => patch({ variant })}
        />
      </div>
    </div>
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
        value={block.code}
        placeholder={'<!-- Paste HTML or an embed code, e.g. -->\n<iframe src="https://example.com" width="100%" height="400"></iframe>'}
        spellCheck={false}
        rows={Math.min(16, Math.max(5, block.code.split('\n').length + 1))}
        onChange={(e) => patch({ code: e.target.value })}
      />
      <div className="blk-options">
        <button className="btn sm" disabled={!block.code.trim()} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide preview' : 'Preview'}
        </button>
        <span className="lbl" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
          Rendered as-is in the course — scripts and embed codes will run.
        </span>
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

/* ---------- Columns ---------- */
export function ColumnsEditor({ block }: { block: ColumnsBlock }) {
  const patch = usePatch(block)

  function setCol(id: string, html: string) {
    patch({ columns: block.columns.map((c) => (c.id === id ? { ...c, html } : c)) })
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns.length}, 1fr)`, gap: 14 }}>
        {block.columns.map((c, i) => (
          <div key={c.id} className="item-editor" style={{ marginBottom: 0 }}>
            <div className="item-editor-head">
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>Column {i + 1}</span>
              <span style={{ flex: 1 }} />
              <button
                className="icon-btn danger"
                disabled={block.columns.length <= 2}
                onClick={() => patch({ columns: block.columns.filter((x) => x.id !== c.id) })}
              >
                <X size={13} />
              </button>
            </div>
            <div className="item-editor-body">
              <RichText value={c.html} onChange={(html) => setCol(c.id, html)} placeholder="Column content…" compact />
            </div>
          </div>
        ))}
      </div>
      <div className="blk-options">
        <button
          className="btn sm"
          disabled={block.columns.length >= 4}
          onClick={() => patch({ columns: [...block.columns, { id: uid(), html: '' }] })}
        >
          <Plus size={13} /> Add column
        </button>
      </div>
    </div>
  )
}
