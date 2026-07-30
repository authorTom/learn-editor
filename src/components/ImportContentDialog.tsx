import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { parseContent } from '../utils/importContent'
import { blockDefs } from '../blockDefaults'
import { Button, Checkbox, Dialog, Field, Textarea } from '../ui'

const SAMPLE = `## Why fire safety matters
Every workplace fire starts small. **Spotting the risk early** is what keeps people safe.

- Keep fire doors closed
- Know your nearest exit
- Report blocked escape routes

> A fire door wedged open is not a fire door.

## Your responsibilities
1. Complete this course
2. Attend the annual drill`

/** Paste Markdown or HTML and turn it into blocks — the fast path for moving
    existing material (Word, Confluence, an intranet page) into a course. */
export default function ImportContentDialog({ onClose }: { onClose: () => void }) {
  const addBlocks = useStore((s) => s.addBlocks)
  const addLessons = useStore((s) => s.addLessons)
  const [text, setText] = useState('')
  const [split, setSplit] = useState(true)

  const sections = useMemo(() => parseContent(text, split), [text, split])
  const blockCount = sections.reduce((n, s) => n + s.blocks.length, 0)

  const summary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of sections) {
      for (const b of s.blocks) counts.set(b.type, (counts.get(b.type) ?? 0) + 1)
    }
    return [...counts.entries()].map(
      ([type, n]) => `${n} × ${blockDefs.find((d) => d.type === type)?.label ?? type}`
    )
  }, [sections])

  function run() {
    if (!blockCount) return
    // One untitled section = insert into the lesson you're editing; titled
    // sections each become their own lesson.
    if (sections.length === 1 && !sections[0].title) addBlocks(sections[0].blocks)
    else addLessons(sections)
    onClose()
  }

  return (
    <Dialog
      title="Import content"
      description="Paste from Word, Confluence, an intranet page or a Markdown file — it becomes blocks."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={blockCount === 0} onClick={run}>
            Import {blockCount > 0 ? `${blockCount} block${blockCount === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <Field label="Markdown or HTML">
        <Textarea
          data-autofocus
          className="import-area"
          value={text}
          placeholder={SAMPLE}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Checkbox
        label="Split into a lesson per top-level heading"
        hint="Off: everything is added to the current lesson as blocks."
        checked={split}
        onChange={(e) => setSplit(e.target.checked)}
      />

      {/* aria-live: the summary updates as you type, and a screen reader user
          needs to know what the Import button is about to do. */}
      <div className="import-preview" aria-live="polite">
        {blockCount === 0 ? (
          <span className="drop-hint">
            Headings, paragraphs, lists, quotes, images, rules and tables are recognised.
          </span>
        ) : (
          <>
            <strong>
              {blockCount} block{blockCount === 1 ? '' : 's'}
              {sections.length > 1 || sections[0].title
                ? ` across ${sections.length} lesson${sections.length === 1 ? '' : 's'}`
                : ' into this lesson'}
            </strong>
            <div className="drop-hint" style={{ marginTop: 4 }}>{summary.join(' · ')}</div>
            {sections.some((s) => s.title) && (
              <div className="drop-hint" style={{ marginTop: 4 }}>
                Lessons: {sections.map((s) => s.title || 'Untitled').join(' · ')}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
