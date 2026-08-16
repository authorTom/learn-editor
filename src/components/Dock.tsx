import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Accessibility, History, Images, LayoutTemplate, MessageSquare, PanelRight,
  SlidersHorizontal, X,
} from 'lucide-react'
import { IconButton, Tooltip } from '../ui'
import { useUi, type DockTab } from '../uiStore'

interface TabDef {
  id: DockTab
  label: string
  Icon: typeof Images
  /** Small count badge, e.g. open review comments. */
  badge?: number
}

/**
 * The single right-hand dock.
 *
 * Replaces four independent surfaces that each had their own idiom: the review
 * inbox was a fixed 340px panel, while Media and Templates were centred modals
 * that hid the course behind them. Docking all of them in one column means
 * opening any of them never loses your place in the lesson, and only one can
 * claim the space at a time.
 *
 * Below 1024px it becomes an overlay instead of a column — see shell.css.
 */
export default function Dock({
  openComments,
  a11yErrors,
  panels,
}: {
  openComments: number
  a11yErrors: number
  panels: Record<DockTab, ReactNode>
}) {
  const dockOpen = useUi((s) => s.dockOpen)
  const dockTab = useUi((s) => s.dockTab)
  const openDock = useUi((s) => s.openDock)
  const closeDock = useUi((s) => s.closeDock)
  const tablistRef = useRef<HTMLDivElement>(null)

  // Memoised because the effect below depends on it: rebuilt every render, the
  // identity changed every render and the effect ran every render.
  const tabs = useMemo<TabDef[]>(
    () => [
      { id: 'inspector', label: 'Inspector', Icon: SlidersHorizontal },
      { id: 'media', label: 'Media', Icon: Images },
      { id: 'templates', label: 'Templates', Icon: LayoutTemplate },
      { id: 'review', label: 'Review', Icon: MessageSquare, badge: openComments || undefined },
      { id: 'a11y', label: 'Accessibility', Icon: Accessibility, badge: a11yErrors || undefined },
      { id: 'versions', label: 'Versions', Icon: History },
    ],
    [openComments, a11yErrors]
  )

  // Keep the active tab reachable if the dock is reopened on a tab that no
  // longer makes sense.
  useEffect(() => {
    if (dockOpen && !tabs.some((t) => t.id === dockTab)) openDock('inspector')
  }, [dockOpen, dockTab, openDock, tabs])

  if (!dockOpen) return null

  function onKeyDown(e: React.KeyboardEvent) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === dockTab)
    const next = tabs[(i + dir + tabs.length) % tabs.length]
    openDock(next.id)
    tablistRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)
      ?.focus()
  }

  const activeLabel = tabs.find((t) => t.id === dockTab)?.label ?? ''

  return (
    <aside className="dock" aria-label="Course tools">
      <div className="dock__head">
        {/* Icon-only tabs: four text labels can't fit beside the close button
            at 320px without truncating to "Insp…". The name is carried by
            aria-label, the tooltip, and the heading directly below. */}
        <div
          ref={tablistRef}
          className="dock__tabs"
          role="tablist"
          aria-label="Course tools"
          onKeyDown={onKeyDown}
        >
          {tabs.map(({ id, label, Icon, badge }) => (
            <Tooltip key={id} label={label}>
              <button
                type="button"
                role="tab"
                data-tab={id}
                id={`dock-tab-${id}`}
                aria-label={label}
                aria-selected={dockTab === id}
                aria-controls={`dock-panel-${id}`}
                tabIndex={dockTab === id ? 0 : -1}
                className={'dock__tab' + (dockTab === id ? ' is-active' : '')}
                onClick={() => openDock(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {badge ? (
                  <span className="dock__badge" aria-label={`${badge} open`}>
                    {badge}
                  </span>
                ) : null}
              </button>
            </Tooltip>
          ))}
        </div>
        <span className="dock__title">{activeLabel}</span>
        <IconButton
          label="Close panel"
          shortcut="⌘."
          icon={<X size={16} />}
          variant="ghost"
          onClick={closeDock}
        />
      </div>

      <div
        className="dock__body"
        role="tabpanel"
        id={`dock-panel-${dockTab}`}
        aria-labelledby={`dock-tab-${dockTab}`}
        tabIndex={0}
      >
        {panels[dockTab]}
      </div>
    </aside>
  )
}

/** Shown in the topbar to reopen a dismissed dock. */
export function DockToggle() {
  const dockOpen = useUi((s) => s.dockOpen)
  const dockTab = useUi((s) => s.dockTab)
  const toggleDock = useUi((s) => s.toggleDock)
  return (
    <IconButton
      label={dockOpen ? 'Hide panel' : 'Show panel'}
      shortcut="⌘."
      icon={<PanelRight size={16} />}
      pressed={dockOpen}
      onClick={() => toggleDock(dockTab)}
    />
  )
}
