# Learn Editor

**A modern, web-based SCORM course authoring tool.**

Build block-based, fully responsive e-learning in the browser and export it as a
SCORM package for any LMS. No backend, no account, and your content stays on
your machine.

<!-- TODO: add a hero screenshot of the block editor at docs/screenshots/editor.png
     and a two-column table of the review inbox and the theming panel, to match
     the other projects. -->

## Why it exists

Authoring tools for SCORM tend to be desktop software with a per-seat licence, a
Windows-only installer, and a file format only that tool can open. The
alternative is hand-writing HTML against a twenty-year-old specification.

Learn Editor is a browser app that produces standards-compliant SCORM 1.2 and
2004 packages, with the course stored in your own browser and exported as JSON
you can keep. Nothing is uploaded anywhere: there is no server to send it to.

Two decisions follow from that and are worth knowing up front. **The in-app
preview and the exported package share the same player code**, so what you
preview is pixel-identical to what the LMS shows. And **review works without a
server** — a round exports one self-contained HTML file that reviewers open and
annotate, returning a few kilobytes of JSON.

## What it does

- **Course dashboard** — create, duplicate, delete, import and export courses.
  Everything autosaves to your browser's IndexedDB.
- **Block-based lesson editor** — 20 block types across Text, Media, Layout,
  Interactive and Assessment categories:
  - Rich text paragraphs (TipTap: bold/italic/underline/strike/code, headings,
    lists, quotes, links, alignment, undo/redo) with layout variants: normal,
    lead (large intro), two columns, boxed panel
  - Headings, statements, quotes, lists (bullet/numbered/checklist), callouts
  - Images (drag-and-drop upload, auto-downscaled, captions/alt/width),
    image+text, galleries, audio
  - **Video** — paste any YouTube or Vimeo URL (also supports generic iframe
    embeds)
  - **Custom HTML** — paste raw HTML or embed codes (scripts run in the player),
    with a sandboxed live preview in the editor
  - Dividers, buttons, multi-column layouts
  - Accordions, tabs, flashcards (flip cards, optional images)
  - **Sequence** — learners restore the correct order of shuffled steps
  - **Matching** — pair prompts with their partners (click-to-link, so it works
    on touch and with a keyboard)
  - **Hotspots** — clickable markers dropped on an image, each revealing rich
    text
  - **Quizzes** — multiple choice, multiple response, true/false,
    fill-in-the-blank; per-question feedback, pass mark, shuffle; gates lesson
    progression
- **Per-block backgrounds** — none, theme panel, accent tint, preset pastels or
  any custom colour (text colour auto-adjusts for contrast).
- **Reorder** lessons and blocks by dragging or with move up/down arrows; hover
  between blocks to insert.
- **Undo / redo** across the whole course (⌘Z / ⇧⌘Z, or the toolbar), 60 steps
  deep. Rapid typing collapses into one step; inside a rich-text block TipTap's
  own history takes over.
- **Media library** — every upload is stored once per course and referenced by
  blocks (`asset:<id>`), so reusing an image doesn't re-embed it. Browse,
  rename, see per-file usage counts, and pick existing media from any media
  block.
- **Bulk import** — paste Markdown or HTML and it becomes blocks: headings,
  paragraphs, lists, quotes, images, rules and tables. Optionally split into one
  lesson per top-level heading.
- **Template library** — reuse work across courses:
  - **Saved blocks** — bookmark any block (content, styling and background
    included) from the block toolbar; it then appears under "Saved blocks" at
    the top of the Add-a-block menu in *every* course. Inserting one drops in an
    independent copy.
  - **Course templates** — save a whole course (lessons, blocks and theme) as a
    template from Settings → Reuse, or from its dashboard card. New courses can
    then start from any template instead of blank.
  - Manage both from **Templates** on the dashboard, and export or import the
    whole library as JSON to move it between browsers or share it with
    colleagues.
- **Send for review** — get comments from subject-matter experts without an
  account or a server:
  - **Start a round** and the app freezes a *copy* of the course into one
    self-contained `.html` file. Put it anywhere reviewers can reach —
    SharePoint, Drive, Dropbox, a static host — and send that link, or just
    email the file. Keep editing the live course meanwhile.
  - **Reviewers** open it and read the real course, as a learner sees it. They
    select any text to leave a **comment** or a **suggested rewrite**, or
    comment on a whole block or lesson. Their work is kept in the browser as
    they go, so they can close the tab and come back. When done they click *Send
    feedback*, which downloads a small JSON file (anchors and text only —
    kilobytes, no media) to send back.
  - **The author** imports those files — one per reviewer, several at a time —
    and every comment lands in a **review inbox** beside the editor: filter by
    open / suggestions / reviewer, click through to the exact block, then
    **reply**, **resolve**, **decline**, or **apply**. Applying writes the
    suggested text straight into the course as a normal, undoable edit.
  - Comments are anchored to the *quoted text plus its surrounding context*, not
    to character offsets, so they survive you editing the course around them. If
    a quote is edited away, the comment degrades to a block-level note flagged
    "you've edited this since" rather than silently vanishing or overwriting
    your work — Apply is disabled and you handle it by hand.
  - Re-importing the same feedback file twice is a no-op, so there's no way to
    double up on comments.
- **Preview** — phone, tablet and desktop frames rendering the *actual* exported
  player, so preview is pixel-identical to what the LMS shows.
- **Theming** — applied across the whole course player:
  - 14 colour schemes with harmonised backgrounds — 9 light (Light, Warm, Cool,
    Sand, Sage, Rose, Lavender, Sky, Mist) and 5 dark (Dark, Midnight, Forest,
    Plum, Charcoal; callouts and quiz states adapt automatically) — plus a
    custom accent colour
  - Font packs: Modern (Inter), Elegant (Playfair Display + Source Sans),
    Friendly (Nunito), Classic (Georgia), Technical (Space Grotesk + IBM Plex
    Sans)
  - Layout: sidebar or top-bar navigation, gradient/solid/minimal lesson
    headers, narrow/normal/wide content width, rounded or square corners,
    heading weight
  - Global styles: text size, block spacing and a course logo in the player
    header
  - **Per-lesson overrides** — any lesson can override the accent colour, colour
    scheme and header style; the player swaps the CSS variables at lesson
    boundaries. Untouched lessons inherit the course theme.
- **Completion rules** — choose what the learner must do before the course
  reports complete to the LMS: finish every lesson, pass every quiz, reach a
  minimum average quiz score, and/or spend a minimum time in the course. The
  player tells the learner exactly what is still outstanding.
- **Export** — SCORM 1.2 zip (works in virtually every LMS), SCORM 2004 (4th
  Ed.) zip, a standalone web zip (single `index.html`), or a re-importable JSON
  backup.

## Run it

### With Docker (recommended)

Learn Editor ships as a prebuilt image (a multi-stage build serving the static
site with nginx), published to GitHub Container Registry on every push to
`main`. The image is public, so no login is needed to pull it.

```bash
mkdir -p learn-editor && cd learn-editor

curl -fsSL -o compose.yaml https://raw.githubusercontent.com/authorTom/learn-editor/main/compose.yaml
curl -fsSL -o .env.example https://raw.githubusercontent.com/authorTom/learn-editor/main/.env.example
cp .env.example .env          # edit if you want a different host port

docker compose pull
docker compose up -d
docker compose ps             # STATUS should show "Up (healthy)"
```

Open **`http://<server>:8080`** (or whatever `PORT` you set).

**Pre-seeded content.** The Docker image ships with the dashboard pre-populated
on first visit: the *Recording a 12-Lead ECG* exemplar course, plus a starter
template library (9 reusable blocks — callouts, quizzes, matching, sequence,
flashcards, hotspots and more — and one course template). Seeding runs once per
browser and only into an empty library, so deleting the seeded items makes them
stay gone. To ship an empty dashboard instead, build with
`--build-arg SEED_EXAMPLES=false`.

To build locally instead of pulling — for an air-gapped host, or to run a fork —
comment out the `image:` line in `compose.yaml`, uncomment the `build:` block,
then run `docker compose up -d --build`.

### From source

```bash
npm install
npm run dev      # open the printed localhost URL
```

Production build: `npm run build`, output in `dist/`, hostable as any static
site. Plain `npm run dev` and `npm run build` never seed the example content —
that is opt-in via the `VITE_SEED_EXAMPLES` build flag the image sets.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8080` | Host port to expose (the container listens on 80) |
| `IMAGE_TAG` | `latest` | Which published tag to run; pin to `sha-…` for reproducible deploys |

Copy [`.env.example`](.env.example) to `.env` and adjust. This is a
**stateless** static site — every course lives in the browser's IndexedDB — so
there is no server-side volume to persist, and nothing to back up on the server.
Use the dashboard's JSON export to back up a course.

Everything else — themes, completion rules, block content — is edited in the app
itself.

## SCORM behaviour

The exported package is a single self-contained SCO. It reports:

- `lesson_status` / `completion_status`: `incomplete` on launch, then
  `completed` (or `passed`/`failed` for a course with quizzes) once the course's
  **completion rules** are all satisfied — not merely when the last page is
  reached
- `score.raw` (0–100, average across quizzes; plus `score.scaled` in 2004)
- `session_time` in the version's own format (`hh:mm:ss` for 1.2, ISO 8601 for
  2004)
- `suspend_data`: resume position, completed lessons, quiz scores, time on task
- `masteryscore` in the manifest when a quiz exists

Learners must submit all quizzes in a lesson before they can continue past it.

## Example course

The app ships with a complete, production-quality course — *Recording a 12-Lead
ECG*, a UK clinical training course aligned to the
[SCST 2024 guideline](https://scst.org.uk/wp-content/uploads/2024/09/2024_ECG_Recording_Guidelines_26-09-2024_V5_FINAL.pdf).
Click **Example** on the dashboard (or **Open the example course** on a fresh
install) and it loads straight into the editor. The source is
[`public/examples/recording-a-12-lead-ecg-uk.json`](public/examples/recording-a-12-lead-ecg-uk.json),
served as a static asset and fetched on demand, so it costs nothing in the JS
bundle.

It is there to show what the tool can do: 9 lessons · 72 blocks · 5 quizzes (16
questions) · 9 embedded SVG diagrams in the media library · per-lesson theme
overrides · completion gated on passing every quiz at 80%.

Worth opening for the interactive chest-electrode diagram (a hotspot block with
six markers), the sequence and matching interactions, and the artefact gallery.

## How it's built

```
src/
  types.ts               course → lessons → blocks data model, themes, completion
  store.ts               Zustand store, undo/redo history, debounced IndexedDB autosave
  blockDefaults.ts       block registry + factories + deep clone
  utils/assets.ts        media asset refs: one visitor teaches every block about media
  utils/importContent.ts Markdown/HTML → blocks (bulk import)
  components/            editor UI (dashboard, outline, canvas, block editors, dialogs)
  review/
    types.ts             review rounds, comments, anchors, the reviewer bundle format
    anchor.ts            quote+context anchoring: re-find a comment's text after edits
    blockText.ts         text visitor: one place to teach every block about its prose
    reviewStore.ts       review rounds in IndexedDB (`review:`), merge, triage, apply
    buildReviewHtml.ts   wraps the exported player in the review layer — one file to share
    player/review.js     reviewer-side annotation layer (highlight, comment, suggest)
    player/review.css    review chrome, independent of the course theme
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

The review build is the same player again, with an annotation layer appended:
the player renders the course, and `review.js` decorates the DOM it produced.
The only concession the player makes to it is a `data-bid` attribute on each
rendered block, which is what comments anchor to. So reviewers comment on
exactly the course learners will get — not a separate "review mode" rendering
that could drift from it.

## Licence

MIT — see [LICENSE](LICENSE).
