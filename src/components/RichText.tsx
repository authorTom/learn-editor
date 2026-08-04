import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, BubbleMenu, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  List, ListOrdered, Quote, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, Heading2, Heading3,
} from 'lucide-react'
import { Button, Dialog, Field, Input } from '../ui'

interface RichTextProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  compact?: boolean // fewer toolbar buttons for small inline editors
  /** Called when the user types "/" into an otherwise empty editor. The "/" is
      removed first, so the caller can open the block picker cleanly. */
  onSlash?: () => void
}

function ToolBtn({
  editor, action, active, label, children,
}: {
  editor: Editor
  action: () => void
  active?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={'rt-btn' + (active ? ' on' : '')}
      // Both: the title is the mouse affordance, aria-label the accessible
      // name. title alone is not exposed reliably and never on touch.
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // keep editor focus
      onClick={() => {
        action()
        editor.commands.focus()
      }}
    >
      {children}
    </button>
  )
}

export default function RichText({ value, onChange, placeholder, compact, onSlash }: RichTextProps) {
  // avoid feeding our own output back in as an external change
  const lastEmitted = useRef(value)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const slashRef = useRef(onSlash)
  slashRef.current = onSlash

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Type something…' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      // Slash command: a lone "/" in an empty block opens the block picker.
      // Detected on the emitted text rather than a keydown so it can't fire
      // mid-sentence, and the character is removed before handing off.
      if (slashRef.current && editor.getText() === '/') {
        editor.commands.clearContent(true)
        lastEmitted.current = ''
        onChange('')
        slashRef.current()
        return
      }
      const html = editor.isEmpty ? '' : editor.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
  })

  useEffect(() => {
    if (editor && value !== lastEmitted.current) {
      editor.commands.setContent(value || '', false)
      lastEmitted.current = value
    }
  }, [value, editor])

  if (!editor) return null

  function openLink() {
    if (!editor) return
    setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '')
    setLinkOpen(true)
  }

  function applyLink() {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    setLinkOpen(false)
  }

  return (
    <div className="rt-wrap">
      {/* Formatting follows the selection instead of standing permanently above
          every block. A lesson used to show one toolbar per rich-text field —
          a dozen of them stacked down a page — which is precisely the "column
          of forms" the canvas is meant not to be. The bar now appears over the
          text being formatted, which is also where the eye already is.

          Keyboard users never see it and do not need to: every command here has
          a shortcut, and the ones that don't (align, quote) are reachable from
          the block inspector. `shouldShow` keeps it away from empty selections
          and from the link dialog. */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, maxWidth: 'none' }}
        shouldShow={({ editor, from, to }) => !linkOpen && from !== to && !editor.isActive('link')}
      >
      <div className="rt-toolbar rt-toolbar--bubble" role="toolbar" aria-label="Text formatting">
        <ToolBtn editor={editor} label="Bold (⌘B)" active={editor.isActive('bold')} action={() => editor.chain().toggleBold().run()}><Bold size={14} /></ToolBtn>
        <ToolBtn editor={editor} label="Italic (⌘I)" active={editor.isActive('italic')} action={() => editor.chain().toggleItalic().run()}><Italic size={14} /></ToolBtn>
        <ToolBtn editor={editor} label="Underline (⌘U)" active={editor.isActive('underline')} action={() => editor.chain().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolBtn>
        <ToolBtn editor={editor} label="Strikethrough" active={editor.isActive('strike')} action={() => editor.chain().toggleStrike().run()}><Strikethrough size={14} /></ToolBtn>
        <ToolBtn editor={editor} label="Inline code" active={editor.isActive('code')} action={() => editor.chain().toggleCode().run()}><Code size={14} /></ToolBtn>
        <span className="rt-sep" />
        {!compact && (
          <>
            <ToolBtn editor={editor} label="Heading" active={editor.isActive('heading', { level: 2 })} action={() => editor.chain().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolBtn>
            <ToolBtn editor={editor} label="Subheading" active={editor.isActive('heading', { level: 3 })} action={() => editor.chain().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolBtn>
            <span className="rt-sep" />
          </>
        )}
        <ToolBtn editor={editor} label="Bullet list" active={editor.isActive('bulletList')} action={() => editor.chain().toggleBulletList().run()}><List size={14} /></ToolBtn>
        <ToolBtn editor={editor} label="Numbered list" active={editor.isActive('orderedList')} action={() => editor.chain().toggleOrderedList().run()}><ListOrdered size={14} /></ToolBtn>
        {!compact && (
          <ToolBtn editor={editor} label="Quote" active={editor.isActive('blockquote')} action={() => editor.chain().toggleBlockquote().run()}><Quote size={14} /></ToolBtn>
        )}
        <span className="rt-sep" />
        <ToolBtn editor={editor} label="Link" active={editor.isActive('link')} action={openLink}><LinkIcon size={14} /></ToolBtn>
        {!compact && (
          <>
            <span className="rt-sep" />
            <ToolBtn editor={editor} label="Align left" active={editor.isActive({ textAlign: 'left' })} action={() => editor.chain().setTextAlign('left').run()}><AlignLeft size={14} /></ToolBtn>
            <ToolBtn editor={editor} label="Align centre" active={editor.isActive({ textAlign: 'center' })} action={() => editor.chain().setTextAlign('center').run()}><AlignCenter size={14} /></ToolBtn>
            <ToolBtn editor={editor} label="Align right" active={editor.isActive({ textAlign: 'right' })} action={() => editor.chain().setTextAlign('right').run()}><AlignRight size={14} /></ToolBtn>
          </>
        )}
      </div>
      </BubbleMenu>
      <div className="rt-editor">
        <EditorContent editor={editor} />
      </div>

      {/* Replaces window.prompt(), which could not be styled, was announced as
          browser chrome rather than part of the page, and on some platforms
          offers a checkbox that permanently suppresses further prompts. */}
      {linkOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <Dialog
            size="sm"
            title="Link"
            onClose={() => setLinkOpen(false)}
            footer={
              <>
                <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={applyLink}>
                  {linkUrl.trim() ? 'Apply' : 'Remove link'}
                </Button>
              </>
            }
          >
            <Field label="URL" hint="Leave empty to remove the link.">
              <Input
                data-autofocus
                type="url"
                value={linkUrl}
                placeholder="https://example.com"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink()
                }}
              />
            </Field>
          </Dialog>
        </div>
      )}
    </div>
  )
}
