import { describe, expect, it } from 'vitest'
import { buildManifest12, buildManifest2004 } from './manifest'
import { course, lesson, quizBlock, textBlock } from '../test/fixtures'

/**
 * The manifest is the one file in the package an LMS reads before it will
 * accept anything else. A malformed one fails at import with a message that
 * names a line number and nothing else, on someone else's server, after the
 * author has already handed the file over — so it is worth pinning here.
 */

/** Parse with the DOM's own parser — the check an LMS effectively performs. */
function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`manifest is not well-formed XML: ${err.textContent}`)
  return doc
}

describe.each([
  ['SCORM 1.2', buildManifest12, '1.2'],
  ['SCORM 2004', buildManifest2004, '2004 4th Edition'],
] as const)('%s', (_name, build, schemaversion) => {
  it('produces well-formed XML', () => {
    expect(() => parse(build(course()))).not.toThrow()
  })

  it('declares the schema version the LMS will branch on', () => {
    const doc = parse(build(course()))
    expect(doc.querySelector('schemaversion')?.textContent).toBe(schemaversion)
    expect(doc.querySelector('schema')?.textContent).toBe('ADL SCORM')
  })

  it('carries the course title into the organization and the item', () => {
    const doc = parse(build(course({ title: 'Recording a 12-lead ECG' })))
    const titles = [...doc.querySelectorAll('title')].map((t) => t.textContent)
    expect(titles).toContain('Recording a 12-lead ECG')
  })

  it('escapes a title containing XML metacharacters instead of emitting broken markup', () => {
    // An author writing "Safety & Health <Level 1>" must not produce a package
    // that fails to import — this is the classic way a manifest breaks.
    const xml = build(course({ title: 'Safety & Health <Level 1> "core"' }))
    const doc = parse(xml)
    expect(doc.querySelector('organization > title')?.textContent)
      .toBe('Safety & Health <Level 1> "core"')
    expect(xml).toContain('&amp;')
  })

  it('lists every media file, so an LMS that deploys only declared files keeps the images', () => {
    const paths = ['media/a1.png', 'media/a2.jpg', 'media/audio 1.mp3']
    const doc = parse(build(course(), paths))
    const hrefs = [...doc.querySelectorAll('file')].map((f) => f.getAttribute('href'))
    expect(hrefs).toEqual(['index.html', ...paths])
  })

  it('escapes a media path containing an ampersand', () => {
    const doc = parse(build(course(), ['media/a&b.png']))
    const hrefs = [...doc.querySelectorAll('file')].map((f) => f.getAttribute('href'))
    expect(hrefs).toContain('media/a&b.png')
  })

  it('points the resource at index.html as the launchable SCO', () => {
    const res = parse(build(course())).querySelector('resource')!
    expect(res.getAttribute('href')).toBe('index.html')
    expect(res.getAttribute('type')).toBe('webcontent')
  })
})

describe('mastery score', () => {
  const withQuiz = course({ lessons: [lesson('One', [textBlock('<p>Intro</p>'), quizBlock(80)], 'les-1')] })
  const noQuiz = course({ lessons: [lesson('One', [textBlock('<p>Intro</p>')], 'les-1')] })

  it('1.2 emits masteryscore as a percentage', () => {
    const doc = parse(buildManifest12(withQuiz))
    expect(doc.getElementsByTagName('adlcp:masteryscore')[0]?.textContent).toBe('80')
  })

  it('2004 emits the same threshold as a normalised measure', () => {
    const doc = parse(buildManifest2004(withQuiz))
    expect(doc.getElementsByTagName('imsss:minNormalizedMeasure')[0]?.textContent).toBe('0.80')
  })

  it('omits the threshold entirely when the course has no quiz', () => {
    expect(buildManifest12(noQuiz)).not.toContain('masteryscore')
    expect(buildManifest2004(noQuiz)).not.toContain('minNormalizedMeasure')
  })

  it('takes the first quiz in the course when several disagree', () => {
    const many = course({
      lessons: [
        lesson('One', [quizBlock(60, 'q-a')], 'les-1'),
        lesson('Two', [quizBlock(90, 'q-b')], 'les-2'),
      ],
    })
    const doc = parse(buildManifest12(many))
    expect(doc.getElementsByTagName('adlcp:masteryscore')[0]?.textContent).toBe('60')
  })
})
