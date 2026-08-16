# Verify Quoin

Build/launch/drive recipe for this repo (Vite + React SCORM authoring app, with an
optional Node server for accounts and sync — see `server/`).

## Build & launch

```bash
npm run build            # tsc -b && vite build — catches type errors
npm run dev -- --port 5199   # dev server; app at http://localhost:5199
```

## Drive (browser)

Use `playwright-core` (already in devDependencies) with system Chrome:

```js
import { chromium } from '<repo>/node_modules/playwright-core/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
```

A full working E2E script (author course → preview → export SCORM → replay in fake LMS)
exists from the initial build; the flow it drives:

1. Dashboard → "New course" → title → Create.
2. `.add-block-cta` opens the insert menu; click `.insert-item:has-text("<Block name>")`.
3. Rich text: click `.block-shell .tiptap`, then `keyboard.type(...)`.
4. Video block: fill `input[placeholder*="YouTube"]`, click "Add video", assert
   `.video-embed-preview iframe` src.
5. Preview: `button:has-text("Preview")`, iframe uses `srcDoc` (the real exported player).
6. Export: `button:has-text("Export")` → Download; capture with `page.waitForEvent('download')`.

## Verify the SCORM package

1. Unzip; `xmllint --noout imsmanifest.xml`.
2. Serve extracted dir + a harness page defining a recording `window.API`
   (SCORM 1.2 stub: LMSInitialize/LMSSetValue/LMSCommit/LMSFinish returning 'true')
   with the course in an iframe. `python3 -m http.server`.
3. Drive the player frame: quiz gate keeps the Continue button disabled until quiz
   submitted; after finishing all lessons expect `cmi.core.lesson_status` set to
   `passed`/`completed` and `cmi.core.score.raw` set when quizzes exist.

## Always check a dark-scheme course

The canvas wears the *course's* theme while editor furniture must stay chrome
(the two-palette rule in DESIGN.md). Every regression in this area is invisible
on a light course, so a light-only pass proves nothing.

Open a lesson with a dark colour scheme — the ECG example course has per-lesson
theme overrides and lesson 9 is Midnight — and confirm all of these stay legible
against the dark canvas:

- the `/` block picker (block names and descriptions)
- block drag handles and the width/spacing handles
- the selection ring on a selected block, and the keyboard focus ring, which
  must be visibly different from each other
- the insert `+` between blocks, hovered
- the "Add block" button at the end of the lesson
- the block toolbar and its icons

Anything failing here is almost always an element inside `.canvas` that is
missing `chrome-island` (see `src/styles/tokens.css`).

## Gotchas

- Autosave debounces 400ms — wait ~600ms before reloading to test persistence.
- Course data persists in IndexedDB (`idb-keyval`), key prefix `course:`.
- The preview iframe and the exported index.html are the same player
  (`src/scorm/buildPlayerHtml.ts`), so preview behaviour == LMS behaviour minus SCORM.
