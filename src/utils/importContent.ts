import type { Block } from '../types'
import { createBlock } from '../blockDefaults'
import { escapeHtml } from './file'

/** A parsed chunk of pasted content: blocks, optionally grouped under a heading
    that can become its own lesson. */
export interface ParsedSection {
  title: string
  blocks: Block[]
}

function make<T extends Block['type']>(type: T, patch: Partial<Extract<Block, { type: T }>>): Block {
  return { ...createBlock(type), ...patch } as Block
}

/* ---------- Markdown ---------- */

/** Inline markdown → the HTML subset the rich-text blocks already store. */
function inlineMd(s: string): string {
  let h = escapeHtml(s)
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  h = h.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  h = h.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  )
  return h
}

function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { style: 'bullet' | 'number'; items: string[] } | null = null

  function flushPara() {
    if (!para.length) return
    blocks.push(make('text', { html: '<p>' + inlineMd(para.join(' ')) + '</p>' }))
    para = []
  }
  function flushList() {
    if (!list) return
    blocks.push(make('list', { style: list.style, items: list.items.map(inlineMd) }))
    list = null
  }
  function flush() {
    flushPara()
    flushList()
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      flush()
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3
      blocks.push(make('heading', { text: heading[2].trim(), level }))
      continue
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flush()
      blocks.push(make('divider', { style: 'line' }))
      continue
    }

    const image = /^!\[([^\]]*)\]\((\S+?)\)$/.exec(line)
    if (image) {
      flush()
      blocks.push(make('image', { src: image[2], alt: image[1], caption: '' }))
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flush()
      blocks.push(make('quote', { html: '<p>' + inlineMd(quote[1]) + '</p>' }))
      continue
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushPara()
      const style = bullet ? 'bullet' : 'number'
      if (!list || list.style !== style) {
        flushList()
        list = { style, items: [] }
      }
      list.items.push((bullet ? bullet[1] : numbered![1]).trim())
      continue
    }

    flushList()
    para.push(line)
  }
  flush()
  return blocks
}

/* ---------- HTML ---------- */

function parseHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: Block[] = []

  function walk(node: Element) {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase()
      const text = (child.textContent ?? '').trim()

      if (/^h[1-6]$/.test(tag)) {
        if (text) {
          const level = Math.min(3, Number(tag[1])) as 1 | 2 | 3
          blocks.push(make('heading', { text, level }))
        }
      } else if (tag === 'p') {
        if (child.querySelector('img') && !text) {
          const img = child.querySelector('img')!
          blocks.push(make('image', { src: img.getAttribute('src') ?? '', alt: img.getAttribute('alt') ?? '' }))
        } else if (text) {
          blocks.push(make('text', { html: '<p>' + child.innerHTML.trim() + '</p>' }))
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(child.querySelectorAll(':scope > li')).map((li) => li.innerHTML.trim())
        if (items.length) blocks.push(make('list', { style: tag === 'ol' ? 'number' : 'bullet', items }))
      } else if (tag === 'blockquote') {
        if (text) blocks.push(make('quote', { html: child.innerHTML.trim() }))
      } else if (tag === 'hr') {
        blocks.push(make('divider', { style: 'line' }))
      } else if (tag === 'img') {
        blocks.push(make('image', { src: child.getAttribute('src') ?? '', alt: child.getAttribute('alt') ?? '' }))
      } else if (tag === 'pre' || tag === 'table') {
        blocks.push(make('html', { code: child.outerHTML }))
      } else if (child.children.length) {
        walk(child) // div/section/article wrappers — descend
      } else if (text) {
        blocks.push(make('text', { html: '<p>' + escapeHtml(text) + '</p>' }))
      }
    }
  }

  walk(doc.body)
  return blocks
}

function looksLikeHtml(s: string): boolean {
  return /<(p|div|h[1-6]|ul|ol|li|table|section|article|br|img|blockquote)\b[^>]*>/i.test(s)
}

/** Parse pasted Markdown or HTML into blocks. When `splitOnHeadings` is set,
    every top-level heading starts a new section (→ a new lesson). */
export function parseContent(input: string, splitOnHeadings: boolean): ParsedSection[] {
  const text = input.trim()
  if (!text) return []
  const blocks = looksLikeHtml(text) ? parseHtml(text) : parseMarkdown(text)
  if (!blocks.length) return []

  if (!splitOnHeadings) return [{ title: '', blocks }]

  // Split at the shallowest heading level present, so "# A / ## B" splits on #.
  const levels = blocks
    .filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading')
    .map((b) => b.level)
  if (!levels.length) return [{ title: '', blocks }]
  const top = Math.min(...levels)

  const sections: ParsedSection[] = []
  let current: ParsedSection = { title: '', blocks: [] }
  for (const b of blocks) {
    if (b.type === 'heading' && b.level === top) {
      if (current.blocks.length || current.title) sections.push(current)
      current = { title: b.text, blocks: [] } // the heading becomes the lesson title
    } else {
      current.blocks.push(b)
    }
  }
  if (current.blocks.length || current.title) sections.push(current)
  return sections
}
