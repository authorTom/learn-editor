import { useState } from 'react'
import { Button, Dialog, Field, Input, Textarea } from '../ui'

/** Names a block or course before it goes into the template library. */
export default function SaveTemplateDialog({
  heading,
  hint,
  defaultName,
  withDescription = false,
  onSave,
  onClose,
}: {
  heading: string
  hint: string
  defaultName: string
  withDescription?: boolean
  onSave: (name: string, description: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')

  function save() {
    if (!name.trim()) return
    onSave(name.trim(), description.trim())
    onClose()
  }

  return (
    <Dialog
      title={heading}
      description={hint}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Save to library
          </Button>
        </>
      }
    >
      <Field label="Template name" required>
        <Input
          data-autofocus
          value={name}
          placeholder="e.g. Course intro banner"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
      </Field>
      {withDescription && (
        <Field label="Description" hint="Optional — what is this template for?">
          <Textarea
            value={description}
            placeholder="When should someone reach for this template?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      )}
    </Dialog>
  )
}
