import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Eye, Settings, Share, PanelLeft, Undo2, Redo2, Search, Keyboard, Radar,
} from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { openCommentCount, useReviews } from '../review/reviewStore'
import { Button, IconButton } from '../ui'
import OutlineSidebar from './OutlineSidebar'
import LessonEditor from './LessonEditor'
import Preview from './Preview'
import ExportDialog from './ExportDialog'
import SettingsSheet from './SettingsSheet'
import MediaLibrary from './MediaLibrary'
import TemplateLibrary from './TemplateLibrary'
import ReviewDialog from './ReviewDialog'
import ReviewPanel from './ReviewPanel'
import Dock, { DockToggle } from './Dock'
import Inspector from './Inspector'
import LessonStyleDialog from './LessonStyleDialog'
import CommandPalette from './CommandPalette'
import ShortcutSheet from './ShortcutSheet'
import FlightRecorder from './FlightRecorder'
import AccessibilityPanel, { useA11yErrorCount } from './AccessibilityPanel'
import VersionPanel from './VersionPanel'
import { formatKeys, useHotkeys, type Command } from '../hotkeys'

export default function CourseEditor() {
  const course = useStore((s) => s.course)!
  const saveState = useStore((s) => s.saveState)
  const closeCourse = useStore((s) => s.closeCourse)
  const updateCourse = useStore((s) => s.updateCourse)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)

  const outlineOpen = useUi((s) => s.outlineOpen)
  const toggleOutline = useUi((s) => s.toggleOutline)
  const setOutlineOpen = useUi((s) => s.setOutlineOpen)
  const dockOpen = useUi((s) => s.dockOpen)
  const openDock = useUi((s) => s.openDock)
  const closeDock = useUi((s) => s.closeDock)

  const [showPreview, setShowPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showReviewSetup, setShowReviewSetup] = useState(false)
  const [showLessonStyle, setShowLessonStyle] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)

  const selectedBlockId = useUi((s) => s.selectedBlockId)
  const addLesson = useStore((s) => s.addLesson)
  const lessonId = useStore((s) => s.lessonId)
  const lesson = course.lessons.find((l) => l.id === lessonId)

  const reviews = useReviews((s) => s.reviews)
  const reviewsLoaded = useReviews((s) => s.loaded)
  const loadReviews = useReviews((s) => s.loadReviews)
  const openComments = openCommentCount(reviews, course.id)
  const a11yErrors = useA11yErrorCount()

  useEffect(() => {
    if (!reviewsLoaded) loadReviews()
  }, [reviewsLoaded, loadReviews])

  // Selecting a block reveals its options. Only auto-opens onto the inspector —
  // if you are deliberately sitting in Media or Review, selecting a block must
  // not yank that panel away.
  useEffect(() => {
    if (selectedBlockId && !dockOpen) openDock('inspector')
  }, [selectedBlockId, dockOpen, openDock])

  /** Single source of truth for shortcuts — the palette and the shortcut sheet
      both render from this list, so the keys can never disagree with the UI. */
  const commands = useMemo<Command[]>(
    () => [
      { id: 'palette', label: 'Command palette', group: 'View', keys: 'mod+k',
        run: () => setShowPalette(true), paletteHidden: true },
      { id: 'shortcuts', label: 'Keyboard shortcuts', group: 'View', keys: 'mod+/',
        run: () => setShowShortcuts(true) },
      { id: 'preview', label: 'Preview course', group: 'Course', keys: 'mod+p',
        run: () => setShowPreview(true) },
      { id: 'export', label: 'Export course', group: 'Course', keys: 'mod+e',
        run: () => setShowExport(true) },
      { id: 'flight', label: 'Test in a simulated LMS', group: 'Course', keys: 'mod+shift+t',
        run: () => setShowRecorder(true) },
      { id: 'settings', label: 'Course settings', group: 'Course',
        run: () => setShowSettings(true) },
      { id: 'review', label: 'Send for review', group: 'Course',
        run: () => setShowReviewSetup(true) },
      { id: 'back', label: 'Back to all courses', group: 'Course', run: closeCourse },
      { id: 'undo', label: 'Undo', group: 'Edit', keys: 'mod+z', disabled: !canUndo, run: undo },
      { id: 'redo', label: 'Redo', group: 'Edit', keys: 'mod+shift+z', disabled: !canRedo, run: redo },
      { id: 'lesson-add', label: 'Add lesson', group: 'Insert', run: addLesson },
      { id: 'lesson-style', label: 'Lesson style overrides', group: 'Insert',
        run: () => setShowLessonStyle(true) },
      { id: 'outline', label: 'Toggle the outline', group: 'View', keys: 'mod+\\',
        run: toggleOutline },
      { id: 'dock', label: 'Toggle the side panel', group: 'View', keys: 'mod+.',
        run: () => (dockOpen ? closeDock() : openDock('inspector')) },
      { id: 'dock-inspector', label: 'Show block inspector', group: 'View',
        run: () => openDock('inspector') },
      { id: 'dock-media', label: 'Show media library', group: 'View', run: () => openDock('media') },
      { id: 'dock-templates', label: 'Show templates', group: 'View', run: () => openDock('templates') },
      { id: 'dock-review', label: 'Show review feedback', group: 'View', run: () => openDock('review') },
      { id: 'dock-a11y', label: 'Show accessibility check', group: 'View', run: () => openDock('a11y') },
      { id: 'dock-versions', label: 'Show version history', group: 'View', run: () => openDock('versions') },
    ],
    [
      canUndo, canRedo, undo, redo, closeCourse, addLesson, toggleOutline, dockOpen,
      openDock, closeDock,
    ]
  )

  // ⌘Z is special-cased: inside a rich-text block TipTap owns its own history.
  const inRichText = () => !!(document.activeElement as HTMLElement | null)?.closest('.tiptap')
  useHotkeys(
    useMemo(
      () =>
        commands.map((c) =>
          c.id === 'undo' || c.id === 'redo'
            ? { ...c, run: () => { if (!inRichText()) c.run() } }
            : c
        ),
      [commands]
    )
  )

  return (
    <div
      className={
        'shell' + (outlineOpen ? ' shell--outline' : '') + (dockOpen ? ' shell--dock' : '')
      }
    >
      <header className="topbar">
        <div className="topbar__left">
          <IconButton
            label="Back to courses"
            icon={<ArrowLeft size={17} />}
            onClick={closeCourse}
          />
          <IconButton
            label={outlineOpen ? 'Hide outline' : 'Show outline'}
            shortcut="⌘\"
            icon={<PanelLeft size={17} />}
            pressed={outlineOpen}
            onClick={toggleOutline}
          />
          <input
            className="topbar__title"
            value={course.title}
            aria-label="Course title"
            placeholder="Untitled course"
            onChange={(e) => updateCourse({ title: e.target.value })}
          />
        </div>

        <div className="topbar__center">
          <div className="topbar__undo">
            <IconButton
              label="Undo"
              shortcut="⌘Z"
              icon={<Undo2 size={16} />}
              disabled={!canUndo}
              onClick={undo}
            />
            <IconButton
              label="Redo"
              shortcut="⇧⌘Z"
              icon={<Redo2 size={16} />}
              disabled={!canRedo}
              onClick={redo}
            />
          </div>
          {/* Politely announced so a screen reader user learns the course saved
              without the message interrupting what they're typing. */}
          <span
            className={'savestate' + (saveState === 'saving' ? ' is-saving' : '')}
            role="status"
            aria-live="polite"
          >
            <span className="savestate__dot" aria-hidden="true" />
            {saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>

        <div className="topbar__right">
          <button className="topbar__cmdk" onClick={() => setShowPalette(true)}>
            <Search size={14} aria-hidden="true" />
            <span>Search or jump to…</span>
            <kbd>{formatKeys('mod+k')}</kbd>
          </button>
          <IconButton
            label="Keyboard shortcuts"
            shortcut={formatKeys('mod+/')}
            icon={<Keyboard size={17} />}
            onClick={() => setShowShortcuts(true)}
          />
          <IconButton
            label="Course settings"
            icon={<Settings size={17} />}
            onClick={() => setShowSettings(true)}
          />
          <DockToggle />
          <span className="topbar__divider" aria-hidden="true" />
          <Button icon={<Radar size={15} />} onClick={() => setShowRecorder(true)}>
            Test
          </Button>
          <Button icon={<Eye size={15} />} onClick={() => setShowPreview(true)}>
            Preview
          </Button>
          <Button variant="primary" icon={<Share size={15} />} onClick={() => setShowExport(true)}>
            Export
          </Button>
        </div>
      </header>

      <div className="shell__main">
        <OutlineSidebar />
        {/* Scrim closes the outline when it is an overlay on narrow screens.
            aria-hidden + no name: the outline itself is reachable, this is
            purely a pointer target. */}
        <div
          className="shell__scrim"
          aria-hidden="true"
          onClick={() => setOutlineOpen(false)}
        />
        <LessonEditor />
        <Dock
          openComments={openComments}
          a11yErrors={a11yErrors}
          panels={{
            inspector: <Inspector onOpenLessonStyle={() => setShowLessonStyle(true)} />,
            media: <MediaLibrary as="panel" onClose={closeDock} />,
            templates: (
              <TemplateLibrary as="panel" onClose={closeDock} onUseCourseTemplate={() => {}} />
            ),
            review: (
              <ReviewPanel
                embedded
                onClose={closeDock}
                onManage={() => setShowReviewSetup(true)}
              />
            ),
            a11y: <AccessibilityPanel />,
            versions: <VersionPanel />,
          }}
        />
      </div>

      {showPreview && <Preview course={course} onClose={() => setShowPreview(false)} />}
      {showRecorder && <FlightRecorder course={course} onClose={() => setShowRecorder(false)} />}
      {showExport && <ExportDialog course={course} onClose={() => setShowExport(false)} />}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
      {showReviewSetup && (
        <ReviewDialog
          course={course}
          onClose={() => setShowReviewSetup(false)}
          onOpenInbox={() => openDock('review')}
        />
      )}
      {showLessonStyle && lesson && (
        <LessonStyleDialog lesson={lesson} onClose={() => setShowLessonStyle(false)} />
      )}
      {showPalette && (
        <CommandPalette commands={commands} onClose={() => setShowPalette(false)} />
      )}
      {showShortcuts && (
        <ShortcutSheet commands={commands} onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  )
}
