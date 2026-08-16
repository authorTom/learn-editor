import { describe, expect, it } from 'vitest'
import { parseContent } from './importContent'

/**
 * Import is the one path where markup reaches a course from outside the
 * author's own typing — a Word export, an intranet page, a Confluence copy —
 * and whatever survives it is written into a SCORM package that runs inside
 * someone else's LMS. These tests pin what may and may not come through.
 */

function blocksOf(html: string) {
  return parseContent(html, false).flatMap((s) => s.blocks)
}

function allText(html: string): string {
  return JSON.stringify(blocksOf(html))
}

describe('imported HTML is stripped of anything executable', () => {
  it('drops a script tag entirely', () => {
    const out = allText('<p>Before<script>alert(1)</script>After</p>')
    expect(out).not.toContain('alert(1)')
    expect(out).not.toContain('<script')
  })

  it('removes event-handler attributes but keeps the element', () => {
    const out = allText('<p>See <img src="x.png" alt="A photo" onerror="alert(1)"> here</p>')
    expect(out).not.toContain('onerror')
    expect(out).toContain('x.png')
  })

  it('removes a javascript: URL from a link, keeping its text', () => {
    const out = allText('<p><a href="javascript:alert(1)">Click me</a></p>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('Click me')
  })

  it('cleans list items and blockquotes too, not only paragraphs', () => {
    expect(allText('<ul><li onclick="alert(1)">One</li></ul>')).not.toContain('onclick')
    expect(allText('<blockquote><p onmouseover="alert(1)">Quoted</p></blockquote>'))
      .not.toContain('onmouseover')
  })

  it('cleans a table, which is imported as whole markup', () => {
    const out = allText('<table><tr><td onclick="alert(1)">Cell</td></tr></table>')
    expect(out).not.toContain('onclick')
    expect(out).toContain('Cell')
  })

  it('cleans the outermost element itself, not only its descendants', () => {
    // A table is imported by its *outer* HTML, and querySelectorAll('*') does
    // not match the element it is called on — so a handler on the table tag
    // survived into the exported package.
    const out = allText('<table onmouseover="alert(1)"><tr><td>Cell</td></tr></table>')
    expect(out).not.toContain('onmouseover')
    expect(out).toContain('Cell')
  })

  it('catches a javascript: URL hidden behind a control character', () => {
    // The parser decodes &#9; to a real tab before we see it, and browsers
    // ignore control characters inside a scheme when resolving the URL — so
    // this resolves to javascript: while reading as harmless to a naive regex.
    for (const href of ['jav&#9;ascript:alert(1)', 'jav&#10;ascript:alert(1)', ' JavaScript:alert(1)']) {
      const out = allText(`<p><a href="${href}">Click</a></p>`)
      expect(out.toLowerCase(), href).not.toContain('alert(1)')
    }
  })

  it('strips an embedded iframe rather than carrying it into the package', () => {
    const out = allText('<p>Text<iframe src="https://evil.example"></iframe></p>')
    expect(out).not.toContain('iframe')
  })
})

describe('ordinary formatting still survives an import', () => {
  it('keeps inline emphasis and links', () => {
    const out = allText('<p>A <strong>bold</strong> and <em>italic</em> <a href="https://example.com">link</a></p>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>italic</em>')
    expect(out).toContain('https://example.com')
  })

  it('reads headings, lists, quotes and rules into the right block types', () => {
    const blocks = blocksOf(
      '<h2>Title</h2><p>Body</p><ul><li>One</li><li>Two</li></ul><blockquote>Said</blockquote><hr>'
    )
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'text', 'list', 'quote', 'divider'])
  })

  it('imports markdown as well as HTML', () => {
    const blocks = blocksOf('# Heading\n\nSome **bold** text.\n\n- one\n- two')
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'text', 'list'])
  })
})

describe('splitting into lessons', () => {
  it('starts a new section at each heading when asked', () => {
    const sections = parseContent('<h2>One</h2><p>a</p><h2>Two</h2><p>b</p>', true)
    expect(sections.map((s) => s.title)).toEqual(['One', 'Two'])
  })

  it('keeps everything in one section when not', () => {
    expect(parseContent('<h2>One</h2><p>a</p><h2>Two</h2><p>b</p>', false)).toHaveLength(1)
  })
})
