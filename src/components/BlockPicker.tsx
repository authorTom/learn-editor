import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Type, Heading1, MessageSquareQuote, Quote, List, Info, Image, LayoutPanelLeft,
  LayoutGrid, Play, Globe, Volume2, Minus, MousePointerClick, Columns2,
  ChevronsUpDown, PanelTop, GalleryHorizontalEnd, CircleCheckBig, Code, Bookmark,
  ArrowDownUp, Shuffle, MapPin, Trash2,
  type LucideIcon,
} from 'lucide-react'
import { blockDefs, cloneBlock, createBlock } from '../blockDefaults'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { IconButton, Input, useConfirm } from '../ui'
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

/** One flat, ordered list of everything selectable — the arrow keys walk this,
    so what you see is exactly what Down/Up traverse, across group boundaries. */
interface Entry {
  key: string
  kind: 'template' | 'def'
  label: string
  description: string
  Icon: LucideIcon
  group: string
  make: () => { block: Block; assets?: Asset[] }
  onDelete?: () => void
}

export default function BlockPicker({
  onInsert,
  onClose,
  autoFocus = true,
}: {
  onInsert: (block: Block, assets?: Asset[]) => void
  onClose: () => void
  autoFocus?: boolean
}) {
  const blockTemplates = useStore((s) => s.blockTemplates)
  const deleteBlockTemplate = useStore((s) => s.deleteBlockTemplate)
  const recentTypes = useUi((s) => s.recentBlockTypes)
  const noteBlockUsed = useUi((s) => s.noteBlockUsed)
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()

  // Focus explicitly rather than relying on data-autofocus: that is honoured
  // by Dialog/Popover's focus trap, and the slash picker renders outside one.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []

    const matchesDef = (d: (typeof blockDefs)[number]) =>
      !q ||
      d.label.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)

    // Saved blocks first — they are the author's own work.
    for (const t of blockTemplates) {
      if (q && !t.name.toLowerCase().includes(q) && !typeLabel(t.blockType).toLowerCase().includes(q))
        continue
      const def = blockDefs.find((d) => d.type === t.blockType)
      out.push({
        key: 'tpl:' + t.id,
        kind: 'template',
        label: t.name,
        description: `Saved ${typeLabel(t.blockType).toLowerCase()}`,
        Icon: ICONS[def?.icon ?? ''] ?? Bookmark,
        group: 'Saved blocks',
        make: () => ({ block: cloneBlock(t.block), assets: t.assets }),
        onDelete: async () => {
          const ok = await confirm({
            title: `Remove “${t.name}” from your block library?`,
            message: 'Blocks you already inserted from it stay where they are.',
            confirmLabel: 'Remove',
            destructive: true,
          })
          if (ok) deleteBlockTemplate(t.id)
        },
      })
    }

    // Recents, but only once there is history and no active search.
    if (!q && recentTypes.length) {
      for (const type of recentTypes) {
        const d = blockDefs.find((x) => x.type === type)
        if (!d) continue
        out.push({
          key: 'recent:' + d.type,
          kind: 'def',
          label: d.label,
          description: d.description,
          Icon: ICONS[d.icon] ?? Type,
          group: 'Recent',
          make: () => ({ block: createBlock(d.type) }),
        })
      }
    }

    for (const cat of CATEGORIES) {
      for (const d of blockDefs) {
        if (d.category !== cat || !matchesDef(d)) continue
        out.push({
          key: 'def:' + d.type,
          kind: 'def',
          label: d.label,
          description: d.description,
          Icon: ICONS[d.icon] ?? Type,
          group: cat,
          make: () => ({ block: createBlock(d.type) }),
        })
      }
    }
    return out
  }, [q, blockTemplates, recentTypes, confirm, deleteBlockTemplate])

  // Any change to the result set resets the cursor to the top match.
  useEffect(() => setActive(0), [q])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function pick(entry: Entry | undefined) {
    if (!entry) return
    const { block, assets } = entry.make()
    noteBlockUsed(block.type)
    onInsert(block, assets)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, entries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(entries.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(entries[active])
    }
  }

  let lastGroup = ''

  return (
    <div className="picker" onKeyDown={onKeyDown}>
      <div className="picker__search">
        <Input
          ref={inputRef}
          data-autofocus={autoFocus || undefined}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="picker-list"
          aria-activedescendant={entries[active] ? `picker-opt-${entries[active].key}` : undefined}
          aria-label="Search blocks"
          placeholder="Search blocks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="picker__list" id="picker-list" role="listbox" aria-label="Blocks" ref={listRef}>
        {entries.length === 0 && (
          <p className="picker__empty">No blocks match “{query}”.</p>
        )}
        {entries.map((entry, i) => {
          const header = entry.group !== lastGroup ? entry.group : null
          lastGroup = entry.group
          const isActive = i === active
          return (
            <div key={entry.key}>
              {header && <div className="picker__group">{header}</div>}
              <div
                id={`picker-opt-${entry.key}`}
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                className={'picker__item' + (isActive ? ' is-active' : '')}
                onClick={() => pick(entry)}
                onPointerMove={() => setActive(i)}
              >
                <span
                  className={'picker__icon' + (entry.kind === 'template' ? ' is-saved' : '')}
                  aria-hidden="true"
                >
                  <entry.Icon size={16} />
                </span>
                <span className="picker__text">
                  <span className="picker__label">{entry.label}</span>
                  <span className="picker__desc">{entry.description}</span>
                </span>
                {entry.onDelete && (
                  <IconButton
                    label={`Remove ${entry.label} from library`}
                    size="sm"
                    variant="danger"
                    className="picker__del"
                    icon={<Trash2 size={13} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      entry.onDelete!()
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
