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

/**
 * Strip executable content from a fragment of imported markup.
 *
 * Learn Editor is perfectly happy to run an author's script — that is what the
 * Custom HTML block is *for*, and it is a deliberate, visible choice made block
 * by block. Import is the one path where markup arrives from somewhere else:
 * pasted out of a Word export, a Confluence page, an intranet article. Content
 * from there should never bring code in without anyone saying so, especially
 * when the end product is a SCORM package that runs inside a corporate LMS
 * under someone else's domain.
 *
 * So: no script or event handler survives an import, and nothing else changes.
 * An author who wants script adds a Custom HTML block and pastes it there.
 *
 * `DOMParser` has already done the dangerous-sounding part safely — parsing
 * with it never executes anything — so this only has to clean the tree before
 * its `innerHTML` is read back out.
 */
const UNSAFE_TAGS = 'script, style, iframe, object, embed, link, meta, base, form, input, button, textarea, select'

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'srcset', 'data'])

/**
 * Does this attribute value resolve to a javascript: URL?
 *
 * A plain `/^\s*javascript:/` is not enough. Browsers ignore control characters
 * *inside* the scheme when resolving a URL, so `jav&#9;ascript:alert(1)` — which
 * the parser has already decoded to a real tab by the time we see it — reads as
 * `javascript:` to the browser and as harmless text to the regex. Strip every
 * character below U+0021 first and the trick has nothing left to hide in.
 */
function isJavascriptUrl(value: string): boolean {
  return /^javascript:/i.test(value.replace(/[\u0000-\u0020]+/g, ''))
}

function scrubAttributes(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
    } else if (URL_ATTRS.has(name) && isJavascriptUrl(attr.value)) {
      el.removeAttribute(attr.name)
    }
  }
}

function sanitiseFragment(root: Element): void {
  for (const el of Array.from(root.querySelectorAll(UNSAFE_TAGS))) el.remove()
  // The root itself, then its descendants. `querySelectorAll('*')` does not
  // include the element it is called on — so without this first line a
  // `<table onmouseover=…>` kept its handler all the way into the package,
  // because a table is imported by its *outer* HTML.
  scrubAttributes(root)
  for (const el of Array.from(root.querySelectorAll('*'))) scrubAttributes(el)
}

/** The cleaned inner markup of an element, for storing in a rich-text field. */
function safeInnerHtml(el: Element): string {
  const copy = el.cloneNode(true) as Element
  sanitiseFragment(copy)
  return copy.innerHTML.trim()
}

/** The cleaned element itself, for the blocks that keep whole markup. */
function safeOuterHtml(el: Element): string {
  const copy = el.cloneNode(true) as Element
  sanitiseFragment(copy)
  return copy.outerHTML
}

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
          blocks.push(make('text', { html: '<p>' + safeInnerHtml(child) + '</p>' }))
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(child.querySelectorAll(':scope > li')).map(safeInnerHtml)
        if (items.length) blocks.push(make('list', { style: tag === 'ol' ? 'number' : 'bullet', items }))
      } else if (tag === 'blockquote') {
        if (text) blocks.push(make('quote', { html: safeInnerHtml(child) }))
      } else if (tag === 'hr') {
        blocks.push(make('divider', { style: 'line' }))
      } else if (tag === 'img') {
        blocks.push(make('image', { src: child.getAttribute('src') ?? '', alt: child.getAttribute('alt') ?? '' }))
      } else if (tag === 'pre' || tag === 'table') {
        blocks.push(make('html', { code: safeOuterHtml(child) }))
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
