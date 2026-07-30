import { Plus, X, Check, ArrowUp, ArrowDown } from 'lucide-react'
import type { QuizBlock, QuizQuestion, QuestionType } from '../../types'
import { newQuestion } from '../../blockDefaults'
import { uid } from '../../utils/id'
import { usePatch } from './SimpleBlocks'
import { CheckRow, Group, NumberRow } from './inspectorFields'

const Q_TYPES: { v: QuestionType; label: string }[] = [
  { v: 'choice', label: 'Multiple choice' },
  { v: 'multiple', label: 'Multiple response' },
  { v: 'truefalse', label: 'True / False' },
  { v: 'fillin', label: 'Fill in the blank' },
]

function QuestionEditor({
  q,
  index,
  count,
  onChange,
  onDelete,
  onMove,
}: {
  q: QuizQuestion
  index: number
  count: number
  onChange: (q: QuizQuestion) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  function changeType(type: QuestionType) {
    const fresh = newQuestion(type)
    onChange({ ...fresh, id: q.id, text: q.text, feedbackCorrect: q.feedbackCorrect, feedbackIncorrect: q.feedbackIncorrect })
  }

  function patchChoice(id: string, p: Partial<{ text: string; correct: boolean }>) {
    onChange({ ...q, choices: q.choices.map((c) => (c.id === id ? { ...c, ...p } : c)) })
  }

  function toggleCorrect(id: string) {
    if (q.type === 'multiple') {
      const c = q.choices.find((x) => x.id === id)!
      patchChoice(id, { correct: !c.correct })
    } else {
      // single answer: radio behaviour
      onChange({ ...q, choices: q.choices.map((c) => ({ ...c, correct: c.id === id })) })
    }
  }

  return (
    <div className="qz-question">
      <div className="qz-q-head">
        <span className="qz-num">Q{index + 1}</span>
        <select
          className="mini-input"
          value={q.type}
          onChange={(e) => changeType(e.target.value as QuestionType)}
        >
          {Q_TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" disabled={index === 0} title="Move up" aria-label="Move up" onClick={() => onMove(-1)}>
          <ArrowUp size={13} />
        </button>
        <button className="icon-btn" disabled={index === count - 1} title="Move down" aria-label="Move down" onClick={() => onMove(1)}>
          <ArrowDown size={13} />
        </button>
        <button className="icon-btn danger" disabled={count <= 1} title="Delete question" onClick={onDelete} aria-label="Delete question">
          <X size={14} />
        </button>
      </div>
      <div className="qz-q-body">
        <input
          className="input"
          style={{ fontWeight: 600, marginBottom: 12 }}
          value={q.text}
          placeholder="Type the question…"
          onChange={(e) => onChange({ ...q, text: e.target.value })}
        />

        {q.type === 'fillin' ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
              Accepted answers (case-insensitive)
            </div>
            {q.answers.map((a, i) => (
              <div key={i} className="qz-choice-row">
                <input
                  className="input"
                  value={a}
                  placeholder={`Answer ${i + 1}`}
                  onChange={(e) => {
                    const answers = [...q.answers]
                    answers[i] = e.target.value
                    onChange({ ...q, answers })
                  }}
                />
                <button
                  className="icon-btn danger"
                  disabled={q.answers.length <= 1}
                  onClick={() => onChange({ ...q, answers: q.answers.filter((_, j) => j !== i) })}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button className="btn sm" onClick={() => onChange({ ...q, answers: [...q.answers, ''] })}>
              <Plus size={13} /> Add accepted answer
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
              Choices — tick the correct one{q.type === 'multiple' ? 's' : ''}
            </div>
            {q.choices.map((c) => (
              <div key={c.id} className="qz-choice-row">
                <button
                  className={'correct-toggle' + (c.correct ? ' on' : '')}
                  title={c.correct ? 'Correct answer' : 'Mark as correct'}
                  aria-label={c.correct ? 'Correct answer' : 'Mark as correct'} onClick={() => toggleCorrect(c.id)}
                >
                  <Check size={15} />
                </button>
                <input
                  className="input"
                  value={c.text}
                  readOnly={q.type === 'truefalse'}
                  placeholder="Choice text…"
                  onChange={(e) => patchChoice(c.id, { text: e.target.value })}
                />
                {q.type !== 'truefalse' && (
                  <button
                    className="icon-btn danger"
                    disabled={q.choices.length <= 2}
                    onClick={() => onChange({ ...q, choices: q.choices.filter((x) => x.id !== c.id) })}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            {q.type !== 'truefalse' && (
              <button
                className="btn sm"
                onClick={() =>
                  onChange({ ...q, choices: [...q.choices, { id: uid(), text: '', correct: false }] })
                }
              >
                <Plus size={13} /> Add choice
              </button>
            )}
          </div>
        )}

        <div className="qz-feedback-grid">
          <div className="field" style={{ margin: 0 }}>
            <label>Feedback when correct</label>
            <input
              type="text"
              value={q.feedbackCorrect}
              onChange={(e) => onChange({ ...q, feedbackCorrect: e.target.value })}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Feedback when incorrect</label>
            <input
              type="text"
              value={q.feedbackIncorrect}
              onChange={(e) => onChange({ ...q, feedbackIncorrect: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function QuizEditor({ block }: { block: QuizBlock }) {
  const patch = usePatch(block)

  function setQuestion(i: number, q: QuizQuestion) {
    const questions = [...block.questions]
    questions[i] = q
    patch({ questions })
  }

  return (
    <div>
      <div className="blk-row" style={{ marginBottom: 14 }}>
        <input
          className="mini-input"
          style={{ flex: 1, fontWeight: 700, fontSize: 15 }}
          value={block.title}
          placeholder="Quiz title"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {block.questions.map((q, i) => (
        <QuestionEditor
          key={q.id}
          q={q}
          index={i}
          count={block.questions.length}
          onChange={(nq) => setQuestion(i, nq)}
          onDelete={() => patch({ questions: block.questions.filter((_, j) => j !== i) })}
          onMove={(dir) => {
            const questions = [...block.questions]
            const [item] = questions.splice(i, 1)
            questions.splice(i + dir, 0, item)
            patch({ questions })
          }}
        />
      ))}

      <div className="blk-actions">
        <button className="btn sm" onClick={() => patch({ questions: [...block.questions, newQuestion()] })}>
          <Plus size={13} /> Add question
        </button>
      </div>
    </div>
  )
}

export function QuizOptions({ block }: { block: QuizBlock }) {
  const patch = usePatch(block)
  return (
    <>
      <Group title="Scoring">
        <NumberRow
          label="Pass mark"
          min={0}
          max={100}
          step={5}
          suffix="%"
          value={block.passingScore}
          onChange={(passingScore) => patch({ passingScore })}
          hint="Scores report to the LMS over SCORM."
        />
      </Group>
      <Group title="Behaviour">
        <CheckRow
          label="Shuffle questions"
          hint="Each learner sees them in a different order."
          checked={block.shuffle}
          onChange={(shuffle) => patch({ shuffle })}
        />
        <CheckRow
          label="Show feedback"
          hint="Reveal the per-question feedback after submitting."
          checked={block.showFeedback}
          onChange={(showFeedback) => patch({ showFeedback })}
        />
        <p className="insp-note">
          Learners must submit this quiz before they can continue past the lesson.
        </p>
      </Group>
    </>
  )
}
