import { useMemo, useState } from 'react'
import { ArrowRight, Columns2, List, X } from 'lucide-react'
import type { Course } from '../types'
import { buildPlayerHtml } from '../scorm/buildPlayerHtml'
import { diffCourses, highlightMap, type ChangeKind } from '../versions/diff'
import { Button, Segmented } from '../ui'

/**
 * A rendered diff: two real players, side by side, with changed blocks painted.
 *
 * A JSON diff of a course is unreadable — the interesting change is one word
 * inside a `html` field forty lines into an object. What a reviewer actually
 * needs to see is the course, with the changes pointed at.
 *
 * This is only possible because the player already stamps `data-bid` on every
 * rendered block (it was added for the review layer's comment anchors). That
 * single attribute means a stylesheet injected into the exported page can
 * highlight blocks by id without the diff knowing anything about layout.
 */

const KIND_LABEL: Record<ChangeKind, string> = {
  added: 'Added', removed: 'Removed', changed: 'Edited', moved: 'Moved', unchanged: '',
}

/**
 * Painted into both frames. Colours are literal rather than tokens because this
 * stylesheet lands inside the exported player, which has a palette of its own —
 * and the highlight has to stay legible over whichever one the course uses.
 *
 * Static: the script below sets `data-diff` per block, so the stylesheet needs
 * no per-id rules and stays the same size whatever the diff contains.
 */
const HIGHLIGHT_CSS = `
.block[data-diff]{position:relative;border-radius:6px;}
.block[data-diff]::after{
  content:attr(data-diff-label);position:absolute;top:-9px;left:10px;
  font:600 10px/1.6 -apple-system,'Segoe UI',sans-serif;letter-spacing:.06em;
  text-transform:uppercase;padding:1px 7px;border-radius:99px;color:#fff;z-index:2;}
.block[data-diff="added"]{outline:2px solid #16a34a;outline-offset:6px;background:rgba(22,163,74,.07);}
.block[data-diff="added"]::after{background:#16a34a;}
.block[data-diff="removed"]{outline:2px solid #dc2626;outline-offset:6px;background:rgba(220,38,38,.07);}
.block[data-diff="removed"]::after{background:#dc2626;}
.block[data-diff="changed"]{outline:2px solid #d97706;outline-offset:6px;background:rgba(217,119,6,.07);}
.block[data-diff="changed"]::after{background:#d97706;}
.block[data-diff="moved"]{outline:2px dashed #6366f1;outline-offset:6px;}
.block[data-diff="moved"]::after{background:#6366f1;}`

/**
 * Tag the blocks by id once the frame has rendered, and open the lesson the
 * reader needs to see.
 *
 * Both are done in script rather than in CSS: attribute selectors cannot set
 * attributes, and the player builds itself on DOMContentLoaded, so there is
 * nothing to tag or navigate at the moment this runs. The observer covers both
 * — the player replaces the whole `.blocks` subtree on every lesson change, so
 * the same hook that repaints after navigation is the one that tells us the
 * player has finished starting up.
 *
 * Navigating matters more than it sounds: a course with a title page opens on
 * the cover, so a diff would otherwise present two identical contents pages and
 * leave the reader to find the change themselves.
 */
function tagScript(
  map: Record<string, ChangeKind>,
  side: 'before' | 'after',
  focusLessonId?: string
): string {
  const entries = Object.entries(map).filter(([, k]) => {
    if (k === 'unchanged') return false
    if (side === 'before' && k === 'added') return false
    if (side === 'after' && k === 'removed') return false
    return true
  })
  const labels: Record<ChangeKind, string> = KIND_LABEL
  return `
(function(){
  var m = ${JSON.stringify(entries)};
  var labels = ${JSON.stringify(labels)};
  var focus = ${JSON.stringify(focusLessonId ?? '')};
  var navigated = false;
  function paint(){
    m.forEach(function(e){
      document.querySelectorAll('[data-bid="' + e[0] + '"]').forEach(function(n){
        n.setAttribute('data-diff', e[1]);
        n.setAttribute('data-diff-label', labels[e[1]] || '');
      });
    });
    if (focus && !navigated) {
      var btn = document.querySelector('.lesson-nav button[data-id="' + focus + '"]');
      if (btn) { navigated = true; btn.click(); }
    }
  }
  paint();
  new MutationObserver(paint).observe(document.body, { childList: true, subtree: true });
})();`
}

function withHighlights(
  html: string,
  map: Record<string, ChangeKind>,
  side: 'before' | 'after',
  focusLessonId?: string
) {
  return html.replace(
    '</body>',
    `<style>${HIGHLIGHT_CSS}</style><script>${tagScript(map, side, focusLessonId)}</script></body>`
  )
}

export default function DiffView({
  before,
  after,
  beforeLabel,
  afterLabel,
  onClose,
}: {
  before: Course
  after: Course
  beforeLabel: string
  afterLabel: string
  onClose: () => void
}) {
  const [mode, setMode] = useState<'rendered' | 'list'>('rendered')

  const diff = useMemo(() => diffCourses(before, after), [before, after])
  const map = useMemo(() => highlightMap(diff), [diff])
  const focus = diff.firstChangedLessonId
  const beforeHtml = useMemo(
    () => withHighlights(buildPlayerHtml(before, 'preview'), map, 'before', focus),
    [before, map, focus]
  )
  const afterHtml = useMemo(
    () => withHighlights(buildPlayerHtml(after, 'preview'), map, 'after', focus),
    [after, map, focus]
  )

  return (
    <div className="diff-scrim" role="dialog" aria-modal="true" aria-label="Compare versions">
      <div className="diff-topbar">
        <span className="diff-title">
          <span className="diff-chip">{beforeLabel}</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span className="diff-chip is-after">{afterLabel}</span>
        </span>
        <span className="diff-counts">
          {diff.added > 0 && <span className="dc is-added">{diff.added} added</span>}
          {diff.removed > 0 && <span className="dc is-removed">{diff.removed} removed</span>}
          {diff.changed > 0 && <span className="dc is-changed">{diff.changed} edited</span>}
          {diff.moved > 0 && <span className="dc is-moved">{diff.moved} moved</span>}
          {diff.lessonsChanged > 0 && (
            <span className="dc">
              {diff.lessonsChanged} lesson{diff.lessonsChanged === 1 ? '' : 's'}
            </span>
          )}
          {diff.settings.length > 0 && <span className="dc">{diff.settings.length} settings</span>}
          {diff.total === 0 && <span className="dc">No differences</span>}
        </span>
        <span style={{ flex: 1 }} />
        <Segmented
          label="Diff view"
          size="sm"
          value={mode}
          options={[
            { value: 'rendered', label: 'Side by side' },
            { value: 'list', label: 'Change list' },
          ]}
          onChange={setMode}
        />
        <Button size="sm" icon={<X size={14} />} onClick={onClose}>
          Close
        </Button>
      </div>

      {mode === 'rendered' ? (
        <div className="diff-stage">
          <div className="diff-pane">
            <div className="diff-pane__head">
              <Columns2 size={13} aria-hidden="true" /> {beforeLabel}
            </div>
            <iframe title={`Course as at ${beforeLabel}`} srcDoc={beforeHtml} sandbox="allow-scripts allow-same-origin" />
          </div>
          <div className="diff-pane">
            <div className="diff-pane__head is-after">
              <Columns2 size={13} aria-hidden="true" /> {afterLabel}
            </div>
            <iframe title={`Course as at ${afterLabel}`} srcDoc={afterHtml} sandbox="allow-scripts allow-same-origin" />
          </div>
        </div>
      ) : (
        <div className="diff-list">
          {diff.total === 0 && (
            <p className="insp-empty">These two versions are identical.</p>
          )}

          {diff.settings.length > 0 && (
            <section className="diff-group">
              <h3><List size={14} aria-hidden="true" /> Course settings</h3>
              <ul>
                {diff.settings.map((s) => (
                  <li key={s.label} className="diff-setting">
                    <span className="ds-label">{s.label}</span>
                    <span className="ds-before">{s.before}</span>
                    <ArrowRight size={12} aria-hidden="true" />
                    <span className="ds-after">{s.after}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {diff.lessons.map((l) => (
            <section key={l.lessonId} className={'diff-group is-' + l.kind}>
              <h3>
                <span className={'diff-tag is-' + l.kind}>{KIND_LABEL[l.kind]}</span>
                {l.title || 'Untitled lesson'}
                {l.previousTitle && <em> — was “{l.previousTitle}”</em>}
              </h3>
              {l.blocks.length === 0 ? (
                <p className="diff-none">Lesson settings changed; content is unchanged.</p>
              ) : (
                <ul>
                  {l.blocks.map((b) => (
                    <li key={b.blockId} className={'diff-block is-' + b.kind}>
                      <span className={'diff-tag is-' + b.kind}>{KIND_LABEL[b.kind]}</span>
                      <span className="db-type">{b.blockType}</span>
                      <div className="db-text">
                        {b.kind === 'changed' ? (
                          <>
                            <del>{b.before || <em>(empty)</em>}</del>
                            <ins>{b.after || <em>(empty)</em>}</ins>
                          </>
                        ) : b.kind === 'moved' ? (
                          <span className="db-moved">
                            position {(b.fromIndex ?? 0) + 1} → {(b.toIndex ?? 0) + 1}
                          </span>
                        ) : (
                          <span>{b.after ?? b.before ?? <em>(empty)</em>}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
