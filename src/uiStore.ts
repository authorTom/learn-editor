import { create } from 'zustand'
import type { PresetPatch } from './themePresets'

/** Panels that share the single right-hand dock. Only one is ever visible, so
    the inspector and the review inbox can't fight over the same column. */
export type DockTab = 'inspector' | 'media' | 'templates' | 'review' | 'a11y' | 'versions'

interface UiState {
  /** Left outline column. On narrow viewports this drives an overlay drawer. */
  outlineOpen: boolean
  dockOpen: boolean
  dockTab: DockTab

  /**
   * Currently selected block. Lifted out of LessonEditor's local state so the
   * inspector, the keyboard handlers and the canvas all agree on one selection
   * — a component-local useState could never be read by the dock.
   * Deliberately not persisted: selection is per-session, not a preference.
   */
  selectedBlockId: string | null
  selectBlock: (id: string | null) => void

  /** Most-recently inserted block types, newest first, capped at 5. Surfaces a
      "Recent" group at the top of the block picker. */
  recentBlockTypes: string[]
  noteBlockUsed: (type: string) => void

  /** Block id whose "/" shortcut opened the picker, or null. The canvas renders
      the picker anchored to that block and inserts immediately after it. */
  /** A theme being tried on. The canvas renders with it, nothing is written to
      the course, and clearing it restores what was there — so browsing eight
      presets costs no undo history and leaves no trace if you walk away. */
  themePreview: PresetPatch | null
  setThemePreview: (t: PresetPatch | null) => void

  slashPickerFor: string | null
  openSlashPicker: (blockId: string) => void
  closeSlashPicker: () => void

  toggleOutline: () => void
  setOutlineOpen: (v: boolean) => void
  closeDock: () => void
  /** Open the dock on a tab, or toggle it shut if that tab is already showing. */
  toggleDock: (tab: DockTab) => void
  openDock: (tab: DockTab) => void
}

const KEY = 'quoin:ui'
/** The same preferences under the product's previous name. Read once, if the
    new key holds nothing, so the rename does not silently reset an author's
    sidebar, dock and recent-block choices. Never written. */
const LEGACY_KEY = 'learn-editor:ui'

interface Persisted {
  outlineOpen: boolean
  dockOpen: boolean
  dockTab: DockTab
  recentBlockTypes: string[]
}

const MAX_RECENT = 5

/** Storage can throw, not just return null: Safari private mode and blocked
    third-party storage both raise on access. Every touch is guarded. */
function readPrefs(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
  } catch {
    return {}
  }
}

function writePrefs(prefs: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are a convenience; losing them must never break authoring.
  }
}

const saved = readPrefs()

/** Matches shell.css's 1023px breakpoint, where the rails stop being columns
    and become overlays over the canvas. */
function isNarrow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

export const useUi = create<UiState>((set, get) => {
  function persist() {
    const { outlineOpen, dockOpen, dockTab, recentBlockTypes } = get()
    writePrefs({ outlineOpen, dockOpen, dockTab, recentBlockTypes })
  }

  return {
    /* Below 1024px both rails are overlays with a scrim, so restoring a saved
       "open" put first contact behind a greyed-out drawer — on a docked laptop
       window, which is the modal case for this audience, not an edge case. The
       preference is still written; it just does not apply where the rail is not
       a column. */
    outlineOpen: isNarrow() ? false : (saved.outlineOpen ?? true),
    dockOpen: isNarrow() ? false : (saved.dockOpen ?? false),
    dockTab: saved.dockTab ?? 'inspector',
    selectedBlockId: null,
    recentBlockTypes: saved.recentBlockTypes ?? [],

    themePreview: null,
    setThemePreview: (t) => set({ themePreview: t }),

    slashPickerFor: null,

    selectBlock: (selectedBlockId) => set({ selectedBlockId }),
    openSlashPicker: (slashPickerFor) => set({ slashPickerFor }),
    closeSlashPicker: () => set({ slashPickerFor: null }),

    noteBlockUsed: (type) => {
      set((s) => ({
        recentBlockTypes: [type, ...s.recentBlockTypes.filter((t) => t !== type)].slice(0, MAX_RECENT),
      }))
      persist()
    },

    toggleOutline: () => {
      set((s) => ({ outlineOpen: !s.outlineOpen }))
      persist()
    },
    setOutlineOpen: (outlineOpen) => {
      set({ outlineOpen })
      persist()
    },
    closeDock: () => {
      set({ dockOpen: false })
      persist()
    },
    toggleDock: (tab) => {
      set((s) => (s.dockOpen && s.dockTab === tab ? { dockOpen: false } : { dockOpen: true, dockTab: tab }))
      persist()
    },
    openDock: (dockTab) => {
      set({ dockOpen: true, dockTab })
      persist()
    },
  }
})
