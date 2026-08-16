import type { Course } from '../types'
import { CRITERIA, PLAYER_SUPPORTED, type Criterion } from './criteria'
import type { AuditResult, Finding } from './audit'
import { escapeHtml } from '../utils/file'

/**
 * An Accessibility Conformance Report for a specific exported course.
 *
 * This is the document procurement asks for and nobody has. Today it is written
 * by hand, months after the course shipped, by someone who was not in the room
 * when it was authored — so it is a guess, and everyone involved knows it.
 *
 * Generating it from the audit changes what the document *is*: every "Does not
 * support" is backed by the finding that produced it, and every claim of
 * support is either a structural property of the player or an explicit
 * statement that nothing was found. Criteria the tool cannot evaluate say so,
 * rather than being quietly omitted — an omission is the one thing that makes
 * a conformance report actively misleading.
 */

type Verdict = 'Supports' | 'Partially supports' | 'Does not support' | 'Not applicable' | 'Not evaluated'

interface Row {
  criterion: Criterion
  verdict: Verdict
  remarks: string
  findings: Finding[]
}

/** Criteria that cannot apply to a course with no content of the relevant kind. */
function notApplicable(course: Course, num: string): string | null {
  const has = (t: string) => course.lessons.some((l) => l.blocks.some((b) => b.type === t))
  const anyMedia = has('video') || has('audio')
  switch (num) {
    case '1.2.1':
      return has('audio') || has('video') ? null : 'The course contains no audio-only or video-only content.'
    case '1.2.2': case '1.2.3': case '1.2.5':
      return has('video') ? null : 'The course contains no prerecorded video.'
    case '1.2.4':
      return 'The course contains no live media.'
    case '1.4.2':
      return anyMedia ? 'Media is presented with standard controls and never plays automatically.' : 'The course contains no audio.'
    case '1.3.5': case '3.3.4': case '3.3.8':
      return 'The course collects no personal, financial or authentication data.'
    case '2.5.4':
      return 'No function is operated by device motion.'
    case '3.1.2':
      return 'No passages in a language other than the course language are marked up. Confirm by hand if the course quotes another language.'
    default:
      return null
  }
}

function verdictFor(findings: Finding[]): Verdict {
  if (findings.some((f) => f.severity === 'error')) return 'Does not support'
  if (findings.some((f) => f.severity === 'warning')) return 'Partially supports'
  return 'Supports'
}

function buildRows(course: Course, audit: AuditResult): Row[] {
  const byCriterion = new Map<string, Finding[]>()
  audit.findings.forEach((f) => {
    const list = byCriterion.get(f.criterion) ?? []
    list.push(f)
    byCriterion.set(f.criterion, list)
  })

  return CRITERIA.map((criterion) => {
    const findings = byCriterion.get(criterion.num) ?? []
    const na = notApplicable(course, criterion.num)
    const structural = PLAYER_SUPPORTED[criterion.num]

    if (findings.length) {
      const reviewOnly = findings.every((f) => f.severity === 'review')
      return {
        criterion,
        verdict: reviewOnly ? 'Not evaluated' : verdictFor(findings),
        remarks: reviewOnly
          ? 'Requires a manual determination. ' + (structural ?? '')
          : `${findings.length} issue${findings.length === 1 ? '' : 's'} found in the course content.`,
        findings,
      }
    }
    if (na) return { criterion, verdict: 'Not applicable', remarks: na, findings }
    if (structural) return { criterion, verdict: 'Supports', remarks: structural, findings }
    return {
      criterion,
      verdict: 'Not evaluated',
      remarks:
        'No automated check covers this criterion. It requires review by a person — typically with a screen reader and a keyboard.',
      findings,
    }
  })
}

const VERDICT_CLASS: Record<Verdict, string> = {
  'Supports': 'ok',
  'Partially supports': 'partial',
  'Does not support': 'fail',
  'Not applicable': 'na',
  'Not evaluated': 'manual',
}

export function buildAcrHtml(course: Course, audit: AuditResult): string {
  const rows = buildRows(course, audit)
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1
    return acc
  }, {})
  const date = new Date().toISOString().slice(0, 10)
  const e = escapeHtml

  const section = (level: 'A' | 'AA') => `
  <h2>WCAG 2.2 Level ${level}</h2>
  <table>
    <thead>
      <tr><th style="width:5.5rem">Criterion</th><th>Name</th><th style="width:10rem">Conformance</th><th>Remarks and explanations</th></tr>
    </thead>
    <tbody>
      ${rows.filter((r) => r.criterion.level === level).map((r) => `
      <tr>
        <td class="num">${e(r.criterion.num)}</td>
        <td>${e(r.criterion.name)}<div class="intent">${e(r.criterion.intent)}</div></td>
        <td><span class="v v-${VERDICT_CLASS[r.verdict]}">${e(r.verdict)}</span></td>
        <td>
          <p>${e(r.remarks)}</p>
          ${r.findings.length ? `<ul class="findings">${r.findings.map((f) => `
            <li class="s-${f.severity}">
              <b>${e(f.severity === 'error' ? 'Fails' : f.severity === 'warning' ? 'Risk' : 'Check')}:</b>
              ${e(f.message)}
              ${f.lessonTitle ? `<span class="loc">— ${e(f.lessonTitle)}${f.blockType ? `, ${e(f.blockType)} block` : ''}</span>` : ''}
            </li>`).join('')}</ul>` : ''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Conformance Report — ${e(course.title || 'Untitled course')}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 24px 80px;
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1b1e28; background: #fff;
  }
  main { max-width: 1040px; margin: 0 auto; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 6px; }
  h2 { font-size: 20px; margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e6e8f0; }
  .sub { color: #5b6178; margin: 0 0 28px; }
  dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 6px 20px; margin: 0 0 28px; }
  dl.meta dt { color: #5b6178; }
  dl.meta dd { margin: 0; font-weight: 600; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 20px; }
  .chip { padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid; }
  .note { padding: 14px 18px; border-left: 3px solid #4f46e5; background: #f6f7fb; margin: 0 0 28px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid #e6e8f0; }
  th { background: #f6f7fb; font-size: 13px; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
  .intent { color: #5b6178; font-size: 13px; margin-top: 3px; }
  td p { margin: 0; }
  .v { display: inline-block; padding: 3px 9px; border-radius: 6px; font-size: 12.5px; font-weight: 700; white-space: nowrap; border: 1px solid; }
  .v-ok      { background: #ecfdf3; border-color: #b8e8cb; color: #10643a; }
  .v-partial { background: #fffaeb; border-color: #f3dfa0; color: #8a5106; }
  .v-fail    { background: #fef3f2; border-color: #f5c4c0; color: #a5231a; }
  .v-na      { background: #f1f5f9; border-color: #dde3ea; color: #55606e; }
  .v-manual  { background: #eff4ff; border-color: #c5d5fb; color: #24479f; }
  ul.findings { margin: 8px 0 0; padding-left: 18px; font-size: 13px; }
  ul.findings li { margin-bottom: 4px; }
  li.s-error b { color: #a5231a; }
  li.s-warning b { color: #8a5106; }
  li.s-review b { color: #24479f; }
  .loc { color: #5b6178; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e6e8f0; font-size: 13px; color: #5b6178; }
  @media print {
    body { padding: 0; font-size: 11pt; }
    h2 { break-after: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <h1>Accessibility Conformance Report</h1>
  <p class="sub">WCAG 2.2 Level AA — evaluation of a single e-learning package</p>

  <dl class="meta">
    <dt>Product</dt><dd>${e(course.title || 'Untitled course')}</dd>
    <dt>Author</dt><dd>${e(course.author || 'Not stated')}</dd>
    <dt>Description</dt><dd>${e(course.description || 'Not stated')}</dd>
    <dt>Scope</dt><dd>${course.lessons.length} lesson${course.lessons.length === 1 ? '' : 's'}, ${course.lessons.reduce((n, l) => n + l.blocks.length, 0)} content blocks</dd>
    <dt>Format</dt><dd>SCORM 1.2 / SCORM 2004 (4th Ed.) — self-contained HTML</dd>
    <dt>Standard</dt><dd>WCAG 2.2, Levels A and AA</dd>
    <dt>Evaluated</dt><dd>${e(date)}</dd>
    <dt>Method</dt><dd>Automated analysis of authored content and theme, plus assertions about the fixed player</dd>
  </dl>

  <div class="summary">
    ${(['Supports', 'Partially supports', 'Does not support', 'Not applicable', 'Not evaluated'] as Verdict[])
      .map((v) => `<span class="chip v v-${VERDICT_CLASS[v]}">${counts[v] ?? 0} ${e(v)}</span>`).join('')}
  </div>

  <div class="note">
    <strong>How to read this report.</strong> Verdicts marked <em>Does not support</em> and
    <em>Partially supports</em> are each backed by the specific findings listed beside them, so
    every one can be traced to a place in the course and fixed. Criteria marked
    <em>Not evaluated</em> have no automated test and still require a person with a keyboard and a
    screen reader — this report does not claim them. It is a working document produced by the
    authoring tool, not a substitute for an independent audit, and it describes this package only.
  </div>

  ${section('A')}
  ${section('AA')}

  <footer>
    Generated by Quoin on ${e(date)} from the course source. Re-generate after any content
    change: the findings above describe the course exactly as it stood at that moment.
  </footer>
</main>
</body>
</html>`
}
