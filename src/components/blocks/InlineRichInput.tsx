import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

/**
 * A one-line rich field: inline marks only, no block structure.
 *
 * List items are rendered by the player as `<li><span class="rich">…</span>`,
 * so the field has always *been* rich HTML — but the editor edited it through a
 * plain `<input>`, which showed authors the literal `<strong>Patient
 * identity</strong>` their imported course contained. Editor and player
 * disagreed about what the field was, which is exactly the drift the
 * one-renderer principle exists to prevent.
 *
 * Block structure is switched off rather than merely discouraged: no headings,
 * lists, quotes, code blocks or rules, Enter is handed to the caller instead of
 * splitting the line, and the paragraph wrapper is stripped on the way out so
 * the stored value stays a fragment the player drops straight into its span.
 * Pasting several paragraphs flattens to one line rather than silently losing
 * everything after the first.
 */

function stripBlocks(html: string): string {
  const parts = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim())
  const inner = (parts.length ? parts.join(' ') : html).trim()
  return inner === '<br>' ? '' : inner
}

export default function InlineRichInput({
  value,
  onChange,
  onEnter,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (html: string) => void
  /** Enter cannot break the line, so the caller decides what it means. */
  onEnter?: () => void
  placeholder?: string
  ariaLabel: string
}) {
  const lastEmitted = useRef(value)
  const enterRef = useRef(onEnter)
  enterRef.current = onEnter

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value ? `<p>${value}</p>` : '',
    editorProps: {
      attributes: { class: 'inline-rich', 'aria-label': ariaLabel },
      handleKeyDown(_view, event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          enterRef.current?.()
          return true
        }
        return false
      },
    },
    onUpdate({ editor }) {
      const html = stripBlocks(editor.getHTML())
      lastEmitted.current = html
      onChange(html)
    },
  })

  // Only push external changes in — echoing our own output back would move the
  // caret to the end on every keystroke.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(value ? `<p>${value}</p>` : '', false)
  }, [value, editor])

  return (
    <div className="inline-rich-wrap">
      <EditorContent editor={editor} />
    </div>
  )
}
