import { Dialog } from '../ui'
import { formatKeys, type Command } from '../hotkeys'

/** Extra bindings owned by the canvas and the layers, rather than the registry.
    Listed here so the sheet is a complete answer to "what can I press?". */
const CONTEXTUAL: { group: string; items: { keys: string; label: string }[] }[] = [
  {
    group: 'On the canvas',
    items: [
      { keys: '/', label: 'Insert a block (in an empty paragraph)' },
      { keys: 'up', label: 'Select the previous block' },
      { keys: 'down', label: 'Select the next block' },
      { keys: 'escape', label: 'Leave the field, then clear the selection' },
      { keys: 'backspace', label: 'Delete the selected block' },
      { keys: 'mod+d', label: 'Duplicate the selected block' },
    ],
  },
  {
    group: 'Reordering',
    items: [
      { keys: 'space', label: 'Pick up a block or lesson (on its drag handle)' },
      { keys: 'up', label: 'Move it up while lifted' },
      { keys: 'down', label: 'Move it down while lifted' },
      { keys: 'escape', label: 'Cancel the move' },
    ],
  },
]

function Keys({ keys }: { keys: string }) {
  return <kbd className="sc-key">{formatKeys(keys)}</kbd>
}

export default function ShortcutSheet({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const bound = commands.filter((c) => c.keys)
  const groups = [...new Set(bound.map((c) => c.group))]

  return (
    <Dialog
      title="Keyboard shortcuts"
      description="Everything the editor binds. ⌘K opens the command palette, which can run any of these by name."
      size="lg"
      onClose={onClose}
    >
      <div className="sc-grid">
        {groups.map((g) => (
          <section key={g} className="sc-group">
            <h3 className="sc-group__title">{g}</h3>
            {bound
              .filter((c) => c.group === g)
              .map((c) => (
                <div key={c.id} className="sc-row">
                  <span>{c.label}</span>
                  <Keys keys={c.keys!} />
                </div>
              ))}
          </section>
        ))}
        {CONTEXTUAL.map((g) => (
          <section key={g.group} className="sc-group">
            <h3 className="sc-group__title">{g.group}</h3>
            {g.items.map((it) => (
              <div key={it.keys + it.label} className="sc-row">
                <span>{it.label}</span>
                <Keys keys={it.keys} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  )
}
