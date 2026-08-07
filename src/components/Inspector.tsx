import { AlertTriangle, Copy, Link2, Palette, RefreshCw, Trash2, Unlink, Upload } from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { blockDefs } from '../blockDefaults'
import { contrastRatio, schemeOf } from '../theme'
import { Button, IconButton, useConfirm, useToast } from '../ui'
import BlockOptions from './blocks/BlockOptions'
import { Group, SegRow } from './blocks/inspectorFields'
import type { Block } from '../types'

const BG_PRESETS = [
  { v: '', label: 'None' },
  { v: 'panel', label: 'Panel' },
  { v: 'tint', label: 'Tint' },
]
const BG_SWATCHES = [
  '#fef9c3', '#ffedd5', '#fee2e2', '#fce7f3', '#ede9fe', '#dbeafe', '#dcfce7', '#f1f5f9',
]

/**
 * Library link controls, shown only on a block inserted as *linked*.
 *
 * The library used to be copy-only, which meant the same data-protection
 * boilerplate lived independently in forty courses and a policy change was
 * forty manual edits nobody could verify. A linked block keeps a pointer to its
 * library entry and the revision it last matched, so it can say — without
 * scanning anything — that it is behind.
 */
function LinkGroup({ block }: { block: Block }) {
  const templates = useStore((s) => s.blockTemplates)
  const publish = useStore((s) => s.publishBlockTemplate)
  const sync = useStore((s) => s.syncLinkedBlock)
  const unlink = useStore((s) => s.unlinkBlock)
  const confirm = useConfirm()
  const toast = useToast()

  if (!block.linkedTo) return null
  const tpl = templates.find((t) => t.id === block.linkedTo)

  if (!tpl) {
    return (
      <Group title="Library link">
        <p className="insp-note">
          This block was linked to a library entry that has since been deleted. It keeps its
          content and behaves as a normal block.
        </p>
        <Button size="sm" block icon={<Unlink size={14} />} onClick={() => unlink(block.id)}>
          Clear the broken link
        </Button>
      </Group>
    )
  }

  const rev = tpl.rev ?? 1
  const stale = (block.linkedRev ?? 0) !== rev

  return (
    <Group title="Library link">
      <p className={stale ? 'insp-warn' : 'insp-note'}>
        {stale ? (
          <>
            <strong>“{tpl.name}” has been updated</strong> in your library since this copy was
            inserted. Updating replaces this block's content with the library version.
          </>
        ) : (
          <>
            Linked to <strong>“{tpl.name}”</strong> and up to date. Edits you make here stay local
            until you publish them back.
          </>
        )}
      </p>
      {stale && (
        <Button size="sm" block variant="primary" icon={<RefreshCw size={14} />} onClick={() => sync(block.id)}>
          Update from library
        </Button>
      )}
      <Button
        size="sm"
        block
        icon={<Upload size={14} />}
        onClick={async () => {
          const ok = await confirm({
            title: `Publish to “${tpl.name}”?`,
            message:
              'This block becomes the library version. Every other linked copy — in this course ' +
              'and any other — will be told an update is available. Copies inserted unlinked are ' +
              'not affected.',
            confirmLabel: 'Publish',
          })
          if (ok) {
            await publish(tpl.id, block)
            toast.success(`“${tpl.name}” updated to revision ${rev + 1}.`)
          }
        }}
      >
        Publish this version to the library
      </Button>
      <Button size="sm" block icon={<Unlink size={14} />} onClick={() => unlink(block.id)}>
        Unlink
      </Button>
    </Group>
  )
}

/**
 * Width and vertical rhythm, available on every block type.
 *
 * Both were previously fixed: content ran at the course measure and blocks were
 * evenly spaced, so a full-bleed statement or a tight heading-then-paragraph
 * pair could not be built at all. Because they live on `BlockBase`, one group
 * here covers all twenty-five block types.
 */
function LayoutGroup({ block }: { block: Block }) {
  const updateBlock = useStore((s) => s.updateBlock)
  return (
    <Group title="Layout">
      <SegRow
        label="Width"
        value={block.width ?? 'normal'}
        options={[
          { value: 'normal', label: 'Column' },
          { value: 'wide', label: 'Wide' },
          { value: 'full', label: 'Full' },
        ]}
        onChange={(width) => updateBlock(block.id, { width })}
        hint="Wide breaks out of the reading column; full runs edge to edge."
      />
      <SegRow
        label="Space after"
        value={block.space ?? 'normal'}
        options={[
          { value: 'tight', label: 'Tight' },
          { value: 'normal', label: 'Normal' },
          { value: 'loose', label: 'Loose' },
        ]}
        onChange={(space) => updateBlock(block.id, { space })}
      />
    </Group>
  )
}

function BackgroundGroup({ block }: { block: Block }) {
  const updateBlock = useStore((s) => s.updateBlock)
  const course = useStore((s) => s.course)
  const lessonId = useStore((s) => s.lessonId)
  const isPreset = BG_PRESETS.some((p) => p.v === (block.bg ?? ''))

  /* Custom and pastel fills bypass the theme's contrast pairing entirely — the
     scheme guarantees --ink against --bg, not against a colour the author
     typed. The conformance audit already flags this (a11y/audit.ts, 1.4.3),
     but only after the fact, which on a 40-block course means 40 edits. Same
     rule, same maths, at the moment of the choice. */
  const lesson = course?.lessons.find((l) => l.id === lessonId)
  const scheme = schemeOf(lesson?.theme?.scheme ?? course?.theme.scheme)
  const swatchRatio = (c: string) => contrastRatio(scheme.ink, c)
  const activeRatio = block.bg?.startsWith('#') ? swatchRatio(block.bg) : null

  return (
    <Group title="Background">
      <SegRow
        label="Fill"
        value={isPreset ? (block.bg ?? '') : 'custom'}
        options={[
          ...BG_PRESETS.map((p) => ({ value: p.v, label: p.label })),
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={(v) => {
          // Picking "Custom" without a colour yet would blank the block, so it
          // seeds from the first swatch and the grid below refines it.
          if (v === 'custom') updateBlock(block.id, { bg: block.bg?.startsWith('#') ? block.bg : BG_SWATCHES[0] })
          else updateBlock(block.id, { bg: v })
        }}
      />
      <div className="insp-swatches">
        {BG_SWATCHES.map((c) => {
          const r = swatchRatio(c)
          const fails = r < 4.5
          return (
            <button
              key={c}
              className={'bg-swatch' + (block.bg === c ? ' sel' : '') + (fails ? ' fails' : '')}
              style={{ background: c }}
              aria-label={`Background ${c}${fails ? ` — fails contrast at ${r.toFixed(1)} to 1` : ''}`}
              aria-pressed={block.bg === c}
              onClick={() => updateBlock(block.id, { bg: c })}
            />
          )
        })}
        <input
          type="color"
          className="bg-custom"
          aria-label="Custom background colour"
          value={block.bg?.startsWith('#') ? block.bg : '#ffffff'}
          onChange={(e) => updateBlock(block.id, { bg: e.target.value })}
        />
      </div>
      {activeRatio !== null && (
        <p className={'insp-contrast' + (activeRatio < 4.5 ? ' is-fail' : '')} role="status">
          {activeRatio < 4.5 ? (
            <>
              <AlertTriangle size={13} aria-hidden="true" />
              Text on this background contrasts {activeRatio.toFixed(1)}:1 — below the 4.5:1 this
              course needs. Panel and Tint are paired with the scheme by construction.
            </>
          ) : (
            <>Text on this background contrasts {activeRatio.toFixed(1)}:1.</>
          )}
        </p>
      )}
    </Group>
  )
}

/**
 * The inspector: block options when a block is selected, lesson properties
 * otherwise.
 *
 * This is where every block's styling and behaviour settings moved to. They
 * used to sit inline under each block as a `.blk-options` row, which meant the
 * canvas was a column of forms rather than a preview of the course.
 */
export default function Inspector({ onOpenLessonStyle }: { onOpenLessonStyle: () => void }) {
  const course = useStore((s) => s.course)!
  const lessonId = useStore((s) => s.lessonId)
  const duplicateBlock = useStore((s) => s.duplicateBlock)
  const deleteBlock = useStore((s) => s.deleteBlock)
  const selectedId = useUi((s) => s.selectedBlockId)
  const selectBlock = useUi((s) => s.selectBlock)

  const lesson = course.lessons.find((l) => l.id === lessonId)
  const block = lesson?.blocks.find((b) => b.id === selectedId)

  if (!block) {
    const styled = !!lesson?.theme && Object.keys(lesson.theme).length > 0
    return (
      <div className="insp">
        <Group title="Lesson">
          <p className="insp-note">
            {lesson?.blocks.length ?? 0} block{lesson?.blocks.length === 1 ? '' : 's'} in “
            {lesson?.title || 'Untitled lesson'}”.
          </p>
          <Button size="sm" block icon={<Palette size={14} />} onClick={onOpenLessonStyle}>
            {styled ? 'Edit lesson style' : 'Override lesson style'}
          </Button>
        </Group>
        <p className="insp-empty">Select a block on the canvas to edit its options.</p>
      </div>
    )
  }

  const def = blockDefs.find((d) => d.type === block.type)

  return (
    <div className="insp">
      <header className="insp-head">
        <div className="insp-head__text">
          <span className="insp-head__type">
            {def?.label ?? block.type}
            {block.linkedTo && (
              <span className="insp-linked" title="Linked to a library block">
                <Link2 size={11} aria-hidden="true" /> Linked
              </span>
            )}
          </span>
          {def?.description && <span className="insp-head__desc">{def.description}</span>}
        </div>
        <IconButton
          label="Duplicate block"
          shortcut="⌘D"
          size="sm"
          icon={<Copy size={14} />}
          onClick={() => duplicateBlock(block.id)}
        />
        <IconButton
          label="Delete block"
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={() => {
            deleteBlock(block.id)
            selectBlock(null)
          }}
        />
      </header>

      <BlockOptions block={block} />
      <LinkGroup block={block} />
      <LayoutGroup block={block} />
      <BackgroundGroup block={block} />
    </div>
  )
}
