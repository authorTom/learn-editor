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
  - **Quizzes** — multiple choice, multiple response, true/false, fill-in-the-blank;
    per-question feedback, pass mark, shuffle; gates lesson progression
- **Per-block backgrounds** — none, theme panel, accent tint, preset pastels or
  any custom colour (text colour auto-adjusts for contrast).
- **Reorder** lessons and blocks by dragging or with move up/down arrows;
  hover between blocks to insert.
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
- **Export**:
  - **SCORM 1.2** zip — works in virtually every LMS
  - **SCORM 2004 (4th Ed.)** zip
  - Standalone web zip (single `index.html`)
  - JSON backup (re-importable)

## SCORM behaviour

The exported package is a single self-contained SCO. It reports:

- `lesson_status` / `completion_status`: `incomplete` on launch, `completed`
  when all lessons are finished, `passed`/`failed` when the course contains quizzes
- `score.raw` (0–100, average across quizzes; plus `score.scaled` in 2004)
- `suspend_data`: resume position, completed lessons, quiz scores
- `masteryscore` in the manifest when a quiz exists

Learners must submit all quizzes in a lesson before they can continue past it.

## Architecture

```
src/
  types.ts               course → lessons → blocks data model
  store.ts               Zustand store, debounced autosave to IndexedDB
  blockDefaults.ts       block registry + factories
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
