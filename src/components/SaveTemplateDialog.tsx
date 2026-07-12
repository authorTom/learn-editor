import { useState } from 'react'

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
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{heading}</h2>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Template name</label>
            <input
              type="text"
              autoFocus
              value={name}
              placeholder="e.g. Course intro banner"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') onClose()
              }}
            />
          </div>
          {withDescription && (
            <div className="field">
              <label>Description (optional)</label>
              <textarea
                value={description}
                placeholder="When should someone reach for this template?"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
          <p className="drop-hint">{hint}</p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!name.trim()} onClick={save}>
            Save to library
          </button>
        </div>
      </div>
    </div>
  )
}
