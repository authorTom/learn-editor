import { Copy, Palette, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useUi } from '../uiStore'
import { blockDefs } from '../blockDefaults'
import { Button, IconButton } from '../ui'
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

function BackgroundGroup({ block }: { block: Block }) {
  const updateBlock = useStore((s) => s.updateBlock)
  const isPreset = BG_PRESETS.some((p) => p.v === (block.bg ?? ''))

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
        {BG_SWATCHES.map((c) => (
          <button
            key={c}
            className={'bg-swatch' + (block.bg === c ? ' sel' : '')}
            style={{ background: c }}
            aria-label={`Background ${c}`}
            aria-pressed={block.bg === c}
            onClick={() => updateBlock(block.id, { bg: c })}
          />
        ))}
        <input
          type="color"
          className="bg-custom"
          aria-label="Custom background colour"
          value={block.bg?.startsWith('#') ? block.bg : '#ffffff'}
          onChange={(e) => updateBlock(block.id, { bg: e.target.value })}
        />
      </div>
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
          <span className="insp-head__type">{def?.label ?? block.type}</span>
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
      <BackgroundGroup block={block} />
    </div>
  )
}
