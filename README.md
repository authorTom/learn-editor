# Learn Editor

A modern, web-based SCORM course authoring tool.
Build block-based, fully responsive e-learning in the browser and export it as a
SCORM package for any LMS — no backend, no account, your content stays on your machine.

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL
```

Production build: `npm run build` (output in `dist/`, host it as any static site).

## What it does

- **Course dashboard** — create, duplicate, delete, import/export courses.
  Everything autosaves to your browser's IndexedDB.
- **Block-based lesson editor** — 20 block types across Text, Media, Layout,
  Interactive and Assessment categories:
  - Rich text paragraphs (TipTap: bold/italic/underline/strike/code, headings,
    lists, quotes, links, alignment, undo/redo) with layout variants:
    normal, lead (large intro), two columns, boxed panel
  - Headings, statements, quotes, lists (bullet/numbered/checklist), callouts
  - Images (drag-and-drop upload, auto-downscaled, captions/alt/width), image+text,
    galleries, audio
  - **Video** — paste any YouTube or Vimeo URL (also supports generic iframe embeds)
  - **Custom HTML** — paste raw HTML or embed codes (scripts run in the player),
    with a sandboxed live preview in the editor
  - Dividers, buttons, multi-column layouts
  - Accordions, tabs, flashcards (flip cards, optional images)
  - **Sequence** — learners restore the correct order of shuffled steps
  - **Matching** — pair prompts with their partners (click-to-link, so it works
    on touch and with a keyboard)
  - **Hotspots** — clickable markers dropped on an image, each revealing rich text
  - **Quizzes** — multiple choice, multiple response, true/false, fill-in-the-blank;
    per-question feedback, pass mark, shuffle; gates lesson progression
- **Per-block backgrounds** — none, theme panel, accent tint, preset pastels or
  any custom colour (text colour auto-adjusts for contrast).
- **Reorder** lessons and blocks by dragging or with move up/down arrows;
  hover between blocks to insert.
- **Undo / redo** across the whole course (⌘Z / ⇧⌘Z, or the toolbar), 60 steps deep.
  Rapid typing collapses into one step; inside a rich-text block TipTap's own
  history takes over.
- **Media library** — every upload is stored once per course and referenced by
  blocks (`asset:<id>`), so reusing an image doesn't re-embed it. Browse, rename,
  see per-file usage counts, and pick existing media from any media block.
- **Bulk import** — paste Markdown or HTML and it becomes blocks: headings,
  paragraphs, lists, quotes, images, rules and tables. Optionally split into one
  lesson per top-level heading.
- **Template library** — reuse work across courses:
  - **Saved blocks** — bookmark any block (content, styling and background included)
    from the block toolbar; it then appears under "Saved blocks" at the top of the
    Add-a-block menu in *every* course. Inserting one drops in an independent copy.
  - **Course templates** — save a whole course (lessons, blocks and theme) as a
    template from Settings → Reuse, or from its dashboard card. New courses can
    then start from any template instead of blank.
  - Manage both from **Templates** on the dashboard, and export/import the whole
    library as JSON to move it between browsers or share it with colleagues.
- **Preview** — phone / tablet / desktop frames rendering the *actual* exported
  player, so preview is pixel-identical to what the LMS shows.
- **Theming** — applied across the whole course player:
  - 14 colour schemes with harmonised backgrounds — 9 light (Light, Warm, Cool,
    Sand, Sage, Rose, Lavender, Sky, Mist) and 5 dark (Dark, Midnight, Forest,
    Plum, Charcoal; callouts and quiz states adapt automatically) — plus a
    custom accent colour
  - Font packs: Modern (Inter), Elegant (Playfair Display + Source Sans),
    Friendly (Nunito), Classic (Georgia), Technical (Space Grotesk + IBM Plex Sans)
  - Layout: sidebar or top-bar navigation, gradient/solid/minimal lesson headers,
    narrow/normal/wide content width, rounded or square corners, heading weight
  - Global styles: text size (small/normal/large), block spacing
    (compact/normal/airy) and a course logo in the player header
  - **Per-lesson overrides** — any lesson can override the accent colour, colour
    scheme and header style; the player swaps the CSS variables at lesson
    boundaries. Untouched lessons inherit the course theme.
- **Completion rules** — choose what the learner must do before the course reports
  complete to the LMS: finish every lesson, pass every quiz, reach a minimum
  average quiz score, and/or spend a minimum time in the course. The player tells
  the learner exactly what is still outstanding.
- **Export**:
  - **SCORM 1.2** zip — works in virtually every LMS
  - **SCORM 2004 (4th Ed.)** zip
  - Standalone web zip (single `index.html`)
  - JSON backup (re-importable)

## Example course

The app ships with a complete, production-quality course — *Recording a 12-Lead ECG*, a UK
clinical training course aligned to the
[SCST 2024 guideline](https://scst.org.uk/wp-content/uploads/2024/09/2024_ECG_Recording_Guidelines_26-09-2024_V5_FINAL.pdf).
Click **Example** on the dashboard (or **Open the example course** on a fresh install) and it
loads straight into the editor. The source is
[`public/examples/recording-a-12-lead-ecg-uk.json`](public/examples/recording-a-12-lead-ecg-uk.json),
served as a static asset and fetched on demand, so it costs nothing in the JS bundle.

It's there to show what the tool can do:

9 lessons · 72 blocks · 20 of the 23 block types · 5 quizzes (16 questions) · 9 embedded
SVG diagrams in the media library · per-lesson theme overrides · completion gated on
passing every quiz at 80%.

It is worth opening for the interactive chest-electrode diagram (a hotspot block with
six markers), the sequence and matching interactions, and the artefact gallery.

## SCORM behaviour

The exported package is a single self-contained SCO. It reports:

- `lesson_status` / `completion_status`: `incomplete` on launch, then `completed`
  (or `passed`/`failed` for a course with quizzes) once the course's **completion
  rules** are all satisfied — not merely when the last page is reached
- `score.raw` (0–100, average across quizzes; plus `score.scaled` in 2004)
- `session_time` in the version's own format (`hh:mm:ss` for 1.2, ISO 8601 for 2004)
- `suspend_data`: resume position, completed lessons, quiz scores, time on task
- `masteryscore` in the manifest when a quiz exists

Learners must submit all quizzes in a lesson before they can continue past it.

## Architecture

```
src/
  types.ts               course → lessons → blocks data model, themes, completion
  store.ts               Zustand store, undo/redo history, debounced IndexedDB autosave
  blockDefaults.ts       block registry + factories + deep clone
  utils/assets.ts        media asset refs: one visitor teaches every block about media
  utils/importContent.ts Markdown/HTML → blocks (bulk import)
  components/            editor UI (dashboard, outline, canvas, block editors, dialogs)
  scorm/
    player/player.js     self-contained vanilla-JS course player + SCORM adapter
    player/player.css    responsive player styles
    buildPlayerHtml.ts   inlines player + course JSON into one index.html
    manifest.ts          imsmanifest.xml generators (1.2 & 2004)
    exporter.ts          JSZip packaging
```

The in-app preview and the exported package share the same player code, imported
as raw text and inlined — one renderer to maintain, zero drift between preview
and what learners see.
