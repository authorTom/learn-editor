// Regenerate the product screenshots in docs/screenshots/.
//
// README screenshots rot: a panel is restyled, the shot keeps showing last
// year's interface, and the first thing a visitor sees is out of date. This
// drives the real app in a real browser so refreshing them is one command
// rather than an afternoon of window-cropping.
//
// Usage:
//   VITE_SEED_EXAMPLES=true npm run build
//   QUOIN_DATA_DIR=/tmp/shots QUOIN_PORT=8123 QUOIN_AUTH=off node server/index.mjs &
//   node scripts/capture-screenshots.mjs
//
// Every shot uses the seeded "Recording a 12-Lead ECG" exemplar, so the
// content is real course material rather than lorem ipsum — and the same
// course every time, so a diff between two runs is a genuine UI change.

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = process.env.SHOT_URL || 'http://localhost:8123'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots')

// A 16:10 laptop, captured at 2× so the images stay crisp when GitHub scales
// them down. Wide enough that the editor renders as three real columns —
// below 1280 the outline and dock become overlays and the shot would show a
// layout most authors never see.
const VIEWPORT = { width: 1440, height: 900 }
const SCALE = 2

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Chrome paints a focus ring on whatever was clicked last, which reads as a
    stray blue outline in a still image. Nothing here is a keyboard demo.
    The pointer is parked in dead space for the same reason: left where it
    clicked, it freezes a row mid-hover with its action icons showing. */
async function settle(page) {
  await page.evaluate(() => document.activeElement?.blur?.())
  await page.mouse.move(VIEWPORT.width - 4, VIEWPORT.height - 4)
  await page.waitForTimeout(350)
}

async function shot(page, name) {
  await settle(page)
  await page.waitForTimeout(400)
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  console.log('  ✓', `${name}.png`)
}

/** Close whatever modal is open, preferring its own button — Escape is not
    wired up on every dialog, and a missed close silently blocks the next shot. */
async function closeModal(page) {
  for (const name of ['Close', 'Done', 'Cancel']) {
    const btn = page.getByRole('button', { name, exact: true })
    if (await btn.count()) {
      await btn.first().click().catch(() => {})
      await page.waitForTimeout(700)
      break
    }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(700)
  // Anything still modal would intercept the next click.
  const left = await page.locator('[aria-modal="true"]').count()
  if (left) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(600)
  }
}

/** Put the reading column back at the top of the lesson, so a shot opens on
    the lesson title rather than halfway down a block. */
async function scrollCanvasTop(page) {
  await page.evaluate(() => {
    document.querySelector('.canvas')?.scrollTo({ top: 0 })
  })
  await page.waitForTimeout(500)
}

/** Open the seeded exemplar from the dashboard. */
async function openCourse(page) {
  await page.locator('.course-card').first().click()
  await page.waitForSelector('.canvas', { timeout: 15_000 })
  await page.waitForTimeout(1200)
}

async function selectLesson(page, index) {
  await page.locator('.outline-item').nth(index).click()
  await page.waitForTimeout(900)
}

async function openDock(page, label) {
  const toggle = page.locator('[aria-label="Show panel"]')
  if (await toggle.count()) await toggle.click().catch(() => {})
  await page.waitForTimeout(500)
  await page.locator(`.dock [aria-label="${label}"]`).click()
  await page.waitForTimeout(900)
}

async function openTool(page, label) {
  await page.locator('[aria-label="More course tools"]').click()
  await page.waitForTimeout(500)
  await page.getByText(label, { exact: true }).click()
  await page.waitForTimeout(1600)
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    // The player and the editor both branch on reduced motion; capturing with
    // it on stops a half-finished transition being frozen into a still.
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  const problems = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()) })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.course-card', { timeout: 20_000 })
  await page.waitForTimeout(1500)

  console.log('Capturing:')

  // ---- 1. the library -----------------------------------------------------
  await shot(page, 'dashboard')

  // ---- 2. the editor, three columns, a block selected ---------------------
  await openCourse(page)
  await selectLesson(page, 5) // "Chest electrodes" — the most visual lesson
  await page.locator('[aria-label="Show panel"]').click().catch(() => {})
  await page.waitForTimeout(600)
  // The hotspot block: an interactive block over a real clinical illustration,
  // so the inspector has something worth showing rather than a paragraph's
  // three options.
  await page.locator('.block').nth(1).click()
  await page.waitForTimeout(700)
  await scrollCanvasTop(page)
  await shot(page, 'editor')

  // ---- 3. the block picker ------------------------------------------------
  await page.locator('.insert-point__btn').first().click()
  await page.waitForTimeout(900)
  // Saved blocks come first by design — they are what an author reaches for
  // most. Scroll to the end of the list instead: it shows the interactive and
  // assessment blocks, which are the ones worth knowing about, and a list
  // anchored at its end has a clean bottom edge rather than a clipped row.
  const picker = page.locator('.picker, [class*="picker"]').first()
  const box = await picker.boundingBox().catch(() => null)
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(700)
  }
  await shot(page, 'block-picker')
  await closeModal(page)

  // ---- 4. accessibility audit, over a light lesson ------------------------
  await selectLesson(page, 5)
  await scrollCanvasTop(page)
  await openDock(page, 'Accessibility')
  await shot(page, 'accessibility')

  // ---- 5. a dark-scheme lesson -------------------------------------------
  // Lesson 9 carries a Midnight override. The canvas wears the course's
  // colours while the editor's own furniture stays chrome — the one thing a
  // light-only screenshot set would never show.
  await openDock(page, 'Inspector')
  await selectLesson(page, 8)
  await scrollCanvasTop(page)
  await shot(page, 'dark-scheme')

  // ---- 7. design presets --------------------------------------------------
  await selectLesson(page, 0)
  await scrollCanvasTop(page)
  await openTool(page, 'Design presets')
  await shot(page, 'themes')
  await closeModal(page)

  // ---- 8. the learner's preview ------------------------------------------
  // Before the flight recorder: both are full-screen modals, and the preview
  // is the cheaper one to recover from if a close misfires.
  await page.getByRole('button', { name: 'Preview' }).click()
  await page.waitForTimeout(3500)
  await shot(page, 'preview')
  await closeModal(page)

  // ---- 9. the SCORM flight recorder --------------------------------------
  await openTool(page, 'Test in a simulated LMS')
  await page.waitForTimeout(3000)
  await shot(page, 'flight-recorder')
  await closeModal(page)

  // ---- 10. version history, showing an actual diff ------------------------
  //
  // Last, and deliberately: this one has to *edit* the course to have anything
  // to compare, and an edit made earlier would leak into every shot after it.
  //
  // An empty "no versions yet" panel would be an honest screenshot of nothing.
  // The feature is the comparison — what changed between the version that went
  // out for clinical review and the one about to ship — so the shot has to
  // earn it: save a snapshot, change something, then compare.
  await selectLesson(page, 0)
  await scrollCanvasTop(page)
  await openDock(page, 'Versions')

  await page.getByLabel('Version name').fill('Sent for clinical review')
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await page.waitForTimeout(1200)

  // A small, plausible edit: tighten the opening line the way a reviewer would.
  const para = page.locator('.canvas .tiptap').first()
  await para.click()
  await page.waitForTimeout(400)
  await page.keyboard.press('End')
  await page.keyboard.type(' Get this wrong and the trace is not diagnostic.')
  await page.waitForTimeout(1200) // let autosave settle

  await page
    .getByLabel('Compare Sent for clinical review with the course now')
    .click()
  await page.waitForTimeout(1500)
  await shot(page, 'versions')
  await closeModal(page)

  await browser.close()

  if (problems.length) {
    console.log('\nPage problems seen while capturing:')
    for (const p of [...new Set(problems)].slice(0, 10)) console.log('  !', p)
  } else {
    console.log('\nNo page errors during capture.')
  }
}

await main()
