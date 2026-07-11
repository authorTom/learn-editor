import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  List, ListOrdered, Quote, Link as LinkIcon, Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, Heading2, Heading3,
} from 'lucide-react'

interface RichTextProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  compact?: boolean // fewer toolbar buttons for small inline editors
}

function ToolBtn({
  editor, action, active, title, children,
}: {
  editor: Editor
  action: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={'rt-btn' + (active ? ' on' : '')}
      title={title}
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

export default function RichText({ value, onChange, placeholder, compact }: RichTextProps) {
  // avoid feeding our own output back in as an external change
  const lastEmitted = useRef(value)

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

  function setLink() {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    if (url === '' || url === 'https://') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  return (
    <div className="rt-wrap">
      <div className="rt-toolbar">
        <ToolBtn editor={editor} title="Bold (⌘B)" active={editor.isActive('bold')} action={() => editor.chain().toggleBold().run()}><Bold size={14} /></ToolBtn>
        <ToolBtn editor={editor} title="Italic (⌘I)" active={editor.isActive('italic')} action={() => editor.chain().toggleItalic().run()}><Italic size={14} /></ToolBtn>
        <ToolBtn editor={editor} title="Underline (⌘U)" active={editor.isActive('underline')} action={() => editor.chain().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolBtn>
        <ToolBtn editor={editor} title="Strikethrough" active={editor.isActive('strike')} action={() => editor.chain().toggleStrike().run()}><Strikethrough size={14} /></ToolBtn>
        <ToolBtn editor={editor} title="Inline code" active={editor.isActive('code')} action={() => editor.chain().toggleCode().run()}><Code size={14} /></ToolBtn>
        <span className="rt-sep" />
        {!compact && (
          <>
            <ToolBtn editor={editor} title="Heading" active={editor.isActive('heading', { level: 2 })} action={() => editor.chain().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolBtn>
            <ToolBtn editor={editor} title="Subheading" active={editor.isActive('heading', { level: 3 })} action={() => editor.chain().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolBtn>
            <span className="rt-sep" />
          </>
        )}
        <ToolBtn editor={editor} title="Bullet list" active={editor.isActive('bulletList')} action={() => editor.chain().toggleBulletList().run()}><List size={14} /></ToolBtn>
        <ToolBtn editor={editor} title="Numbered list" active={editor.isActive('orderedList')} action={() => editor.chain().toggleOrderedList().run()}><ListOrdered size={14} /></ToolBtn>
        {!compact && (
          <ToolBtn editor={editor} title="Quote" active={editor.isActive('blockquote')} action={() => editor.chain().toggleBlockquote().run()}><Quote size={14} /></ToolBtn>
        )}
        <span className="rt-sep" />
        <ToolBtn editor={editor} title="Link" active={editor.isActive('link')} action={setLink}><LinkIcon size={14} /></ToolBtn>
        {!compact && (
          <>
            <span className="rt-sep" />
            <ToolBtn editor={editor} title="Align left" active={editor.isActive({ textAlign: 'left' })} action={() => editor.chain().setTextAlign('left').run()}><AlignLeft size={14} /></ToolBtn>
            <ToolBtn editor={editor} title="Align center" active={editor.isActive({ textAlign: 'center' })} action={() => editor.chain().setTextAlign('center').run()}><AlignCenter size={14} /></ToolBtn>
            <ToolBtn editor={editor} title="Align right" active={editor.isActive({ textAlign: 'right' })} action={() => editor.chain().setTextAlign('right').run()}><AlignRight size={14} /></ToolBtn>
            <span className="rt-sep" />
            <ToolBtn editor={editor} title="Undo" action={() => editor.chain().undo().run()}><Undo size={14} /></ToolBtn>
            <ToolBtn editor={editor} title="Redo" action={() => editor.chain().redo().run()}><Redo size={14} /></ToolBtn>
          </>
        )}
      </div>
      <div className="rt-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
