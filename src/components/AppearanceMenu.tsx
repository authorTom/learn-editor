import { Monitor, Moon, Sun } from 'lucide-react'
import { IconButton, Popover } from '../ui'
import { useUi, type Appearance } from '../uiStore'

const OPTIONS: { v: Appearance; label: string; Icon: typeof Sun }[] = [
  { v: 'light', label: 'Light', Icon: Sun },
  { v: 'dark', label: 'Dark', Icon: Moon },
  { v: 'system', label: 'Match system', Icon: Monitor },
]

/**
 * Editor appearance, independent of the course's own colour scheme — you can
 * author a Light-scheme course in a dark editor. The canvas keeps the course's
 * colours; only the chrome follows this.
 */
export default function AppearanceMenu() {
  const appearance = useUi((s) => s.appearance)
  const setAppearance = useUi((s) => s.setAppearance)
  const Current = OPTIONS.find((o) => o.v === appearance)?.Icon ?? Monitor

  return (
    <Popover
      label="Editor appearance"
      align="end"
      className="menu-pop"
      trigger={<IconButton label="Editor appearance" icon={<Current size={16} />} />}
    >
      {({ close }) => (
        <div role="radiogroup" aria-label="Editor appearance">
          {OPTIONS.map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={appearance === v}
              className={'menu-item' + (appearance === v ? ' is-active' : '')}
              onClick={() => {
                setAppearance(v)
                close()
              }}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
