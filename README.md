# Learn Editor

**A modern, web-based SCORM course authoring tool.**

Build block-based, fully responsive e-learning in the browser and export it as a
SCORM package for any LMS. Runs with no backend and no account, with your
content on your own machine — or, self-hosted with its optional server, with
accounts and courses that follow you between machines.

<!-- TODO: add a hero screenshot of the block editor at docs/screenshots/editor.png
     and a two-column table of the review inbox and the theming panel, to match
     the other projects. -->

## Why it exists

Authoring tools for SCORM tend to be desktop software with a per-seat licence, a
Windows-only installer, and a file format only that tool can open. The
alternative is hand-writing HTML against a twenty-year-old specification.

Learn Editor is a browser app that produces standards-compliant SCORM 1.2 and
2004 packages, with the course stored in your own browser and exported as JSON
you can keep.

**How much of a backend you want is your decision, and it is one setting.** Run
the app with no server at all and nothing is uploaded anywhere, because there is
nowhere to send it — the original promise, still the default for `npm run dev`.
Run the bundled server and you get accounts and sync: the courses stay in your
browser as the working copy, and are mirrored to a machine you own. Not to us;
there is no hosted Learn Editor to sign up for.

Two decisions follow from that and are worth knowing up front. **The in-app
preview and the exported package share the same player code**, so what you
preview is pixel-identical to what the LMS shows. And **review works without a
server** — a round exports one self-contained HTML file that reviewers open and
annotate, returning a few kilobytes of JSON.

## The editor

Three columns: the **course outline** on the left, the **lesson canvas** in the
middle, and a **dock** on the right holding the block inspector, media library,
templates and review feedback — one at a time, so opening any of them never
loses your place in the lesson.

- **The canvas wears the course's own theme.** Colour scheme, font pack, text
  size, spacing, heading scale, depth and content width are derived by
  `src/theme.ts` — the same function the exported player uses — and applied to
  the canvas, so a Sand or Midnight course looks like itself while you author
  it. Per-lesson overrides apply too, as do per-block width and spacing.
- **Blocks hold content only.** How a block looks or behaves — layout,
  alignment, width, alt text, quiz pass mark, interaction feedback, background —
  lives in the inspector, so the canvas reads as the course rather than as a
  column of forms.
- **Insert** with the `+` between blocks, the button at the end of the lesson,
  or by typing `/` in an empty paragraph. The picker is searchable and fully
  keyboard-driven, with your saved blocks and recent choices first.
- **⌘K** opens a command palette over every command and lesson; **⌘/** lists
  every shortcut. Blocks answer to ↑/↓, ⌘D, ⌫ and Escape, and drag handles can
  be driven from the keyboard (space to lift, arrows to move, space to drop).
- **The editor chrome is light.** Courses still have their own light and dark
  colour schemes — that is a property of the course, and the canvas wears it.

Accessibility is held to WCAG 2.2 AA: every control carries an accessible name,
dialogs trap and restore focus, drag-and-drop is announced to screen readers,
and all text clears 4.5:1 (3:1 for large text and control boundaries).

## What it does

- **Course dashboard** — search, sort, and switch between grid and list views;
  create, duplicate, delete, import and export courses. Everything autosaves to
  your browser's IndexedDB.
- **Block-based lesson editor** — 25 block types across Text, Media, Layout,
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
  - Dividers, buttons, multi-column layouts (even, 2:1 or 1:2 split, top or
    middle alignment, three gap widths)
  - **Cards** — a 2/3/4-up grid of titled cards with optional image or emoji,
    in bordered, filled or elevated styles
  - **Steps** — a numbered process as a vertical timeline or a horizontal
    track, with numbered or dot markers
  - Accordions, tabs, flashcards (flip cards, optional images)
  - **Sequence** — learners restore the correct order of shuffled steps
  - **Matching** — pair prompts with their partners (click-to-link, so it works
    on touch and with a keyboard)
  - **Hotspots** — clickable markers dropped on an image, each revealing rich
    text
  - **Quizzes** — multiple choice, multiple response, true/false,
    fill-in-the-blank; per-question feedback, pass mark, shuffle; gates lesson
    progression. Each answer is reported to the LMS as a `cmi.interactions`
    record, so LMS reporting can answer which question learners get wrong
- **Per-block layout and backgrounds** — every block can run at the reading
  measure, break out of it, or go full-bleed edge to edge, with tight/normal/
  loose spacing after it. Backgrounds are none, theme panel, accent tint, preset
  pastels or any custom colour (text colour auto-adjusts for contrast). All set
  from the block inspector.
- **Reorder** lessons and blocks by dragging, with move up/down arrows, or from
  the keyboard: focus a drag handle, space to lift, arrows to move, space to
  drop.
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
    the top of the block picker in *every* course. Inserting one drops in an
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
- **SCORM flight recorder** — the course running against a simulated LMS, with
  every runtime call recorded. Preview answers "does it look right"; this
  answers "does it *report* right", which otherwise cannot be known until the
  package is in a real LMS.
  - A conformant **SCORM 1.2 and 2004 runtime** the course discovers exactly as
    it would in an LMS — by walking `window.parent` for `API` /
    `API_1484_11`. The course is not instrumented and cannot tell the difference.
  - **A live call log** — every `SetValue`, `GetValue` and `Commit` with its
    arguments, return value and spec error code, plus a **CMI data model**
    table showing what the LMS is actually holding.
  - **Behaviour profiles**: *Specification* (smallest permitted field sizes,
    unknown elements rejected, nothing durable until Commit), *Lenient*,
    *Silently truncating*, and *Legacy* (whole-number scores, strict duration
    formats). Named after behaviours rather than vendors, because that is what
    can be modelled honestly.
  - **A suspend-data budget meter.** SCORM 1.2 guarantees only 4096 characters
    of `cmi.suspend_data`; past that most LMSs truncate rather than fail, so
    bookmarking dies and every call still returns success. The meter shows the
    headroom before that happens.
  - **Relaunch and resume** replays the next attempt carrying only what the LMS
    actually retained, which is how resume bugs surface.
  - **Download a transcript** to hand an LMS administrator: here is what my
    course sent, and here is what your LMS did with it.
- **Accessibility conformance** — an audit of the *authored course*, not just of
  the editor. Missing and placeholder alt text, heading-level skips, vague or
  relative link text, audio without a transcript, unlabelled hotspots, quiz
  questions with no correct answer, colour contrast computed from the real theme
  tokens, and instructions that lean on colour or position. Findings are graded
  *fails* / *risks* / *check by hand* and click through to the exact block.
  - **A downloadable conformance report** covering every WCAG 2.2 Level A and AA
    success criterion, with each verdict traced to the findings that produced
    it. Criteria with no automated test are reported as *not evaluated* rather
    than quietly omitted — an omission is what makes a conformance report
    misleading. Hand it to procurement, or keep it in the audit file.
- **Version history and visual diff** — named snapshots of the whole course kept
  on your machine, and a **rendered side-by-side diff**: two real players with
  added, removed, edited and moved blocks outlined in place, opened on the first
  lesson that differs. Or read it as a change list, including course and theme
  settings. Restore any version; the course keeps its identity, so review rounds
  and history stay attached.
- **Linked library blocks** — insert a saved block *linked* rather than copied
  and it keeps a pointer to the library entry. Edit it anywhere and publish, and
  every other linked copy reports that an update is waiting and can pull it in.
  The boilerplate that lives in forty courses stops being forty manual edits.
- **Theming** — applied across the whole course player:
  - **Design presets** — eight curated whole-course looks (Corporate, Editorial,
    Academic, Vivid, Minimal, Onboarding, Technical, Immersive) that set the
    palette, type, headers, corners, depth and spacing in one click. Everything
    stays editable afterwards, and your navigation, progress and title-page
    choices are deliberately left alone.
  - 14 colour schemes with harmonised backgrounds — 9 light (Light, Warm, Cool,
    Sand, Sage, Rose, Lavender, Sky, Mist) and 5 dark (Dark, Midnight, Forest,
    Plum, Charcoal; callouts and quiz states adapt automatically) — plus a
    custom accent colour with a **live WCAG contrast readout**
  - Font packs: Modern (Inter), Elegant (Playfair Display + Source Sans),
    Friendly (Nunito), Classic (Georgia), Technical (Space Grotesk + IBM Plex
    Sans), Editorial (Fraunces + Inter), Corporate (Manrope), Academic (Lora +
    Inter)
  - Global styles: heading scale (compact/balanced/dramatic), depth
    (flat/soft/raised), text size, block spacing, rounded or square corners,
    heading weight, and a course logo in the player header
  - **Per-lesson overrides** — any lesson can override the accent colour, colour
    scheme, header style and header image; the player swaps the CSS variables at
    lesson boundaries. Untouched lessons inherit the course theme.
- **Course layout** — how the finished course is structured for the learner:
  - **Navigation**: a sidebar, a top-bar drawer, or *linear* — no menu at all,
    so learners can only move with Previous and Continue
  - **Title page** — an optional opening screen carrying the cover image, title,
    author, description and a contents list, with Start / Resume
  - **Modules** — give consecutive lessons a shared section name and they group
    under a heading in both the course outline and the learner's menu
  - **Lesson headers**: gradient, solid, split (an accent slab beside the
    title), image (a photograph behind it, under a scrim), or minimal
  - **Progress**: a percentage bar, one marker per lesson, or hidden; lesson
    numbering on or off
- **Contrast is derived, not assumed** — the accent sets link colour, quiz
  numbering and nav highlights as well as filling buttons and headers. The
  player computes a readable ink *on* every accent fill and a darkened accent
  *as* text, so a pale brand colour can no longer produce white-on-yellow.
- **Completion rules** — choose what the learner must do before the course
  reports complete to the LMS: finish every lesson, pass every quiz, reach a
  minimum average quiz score, and/or spend a minimum time in the course. The
  player tells the learner exactly what is still outstanding.
- **Export** — SCORM 1.2 zip (works in virtually every LMS), SCORM 2004 (4th
  Ed.) zip, a standalone web zip (single `index.html`), or a re-importable JSON
  backup.

## Run it

### With Docker (recommended)

Learn Editor ships as a prebuilt image — a multi-stage build that serves the app
and its API from one Node process — published to GitHub Container Registry on
every push to `main` and on every `v*` tag. The image is public, so no login is
needed to pull it.

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

**On first run, the app asks you to create an administrator.** It needs a setup
token, which the server prints to its log when it starts with no accounts yet:

```bash
docker compose logs learn-editor | grep setupToken
```

That token is the thing standing between an exposed port and a stranger claiming
your instance, so it is deliberately not skippable. From then on, invite
colleagues from **People** in the account menu — there is no public sign-up, and
no email to configure: you create the account and send them the link it gives
you.

To run the app the way it worked before there was a server — no sign-in, nothing
uploaded, every course living only in the browser that made it — set `LE_AUTH=off`
in `.env`.

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
npm run dev          # the app, local-only, at the printed URL
```

That is a complete Learn Editor: no server, no sign-in, courses in your browser.
To work on the accounts and sync side as well, run the server alongside it —
Vite proxies `/api` to it, so cookies and CSRF behave exactly as in production:

```bash
npm run dev:server   # in a second terminal; writes to ./.data
```

Production build: `npm run build`, output in `dist/`. `npm run serve` runs the
server over it. `dist/` is still hostable as a plain static site if you want the
local-only app and no backend at all. Plain `npm run dev` and `npm run build`
never seed the example content — that is opt-in via the `VITE_SEED_EXAMPLES`
build flag the image sets.

Tests: `npm test`.

## Configuration

Copy [`.env.example`](.env.example) to `.env` and adjust.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8080` | Host port to expose (the container listens on 8080) |
| `IMAGE_TAG` | `latest` | Which published tag to run; pin to `sha-…` for reproducible deploys |
| `LE_AUTH` | `on` | `off` runs the original local-only app: no sign-in, no sync, nothing uploaded |
| `LE_SESSION_TTL_DAYS` | `30` | How long a sign-in lasts |
| `LE_SETUP_TOKEN` | *generated* | Fix the first-run token instead of reading it from the log |
| `LE_TRUST_PROXY` | `off` | Read `X-Forwarded-For` for rate limiting. **Only** with a proxy in front — otherwise a client can forge its own address and get unlimited password guesses |
| `LE_SECURE_COOKIES` | follows `LE_TRUST_PROXY` | Mark the session cookie `Secure`. Correct over https; over plain http nobody can stay signed in |
| `LE_MAX_BODY_MB` | `32` | Largest request the API accepts. Courses carry embedded media |
| `LE_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent` |

Everything else — themes, completion rules, block content — is edited in the app
itself.

### Behind a reverse proxy

Terminate TLS at the proxy, pass everything through to port 8080, and set both
`LE_TRUST_PROXY=on` and `LE_SECURE_COOKIES=on`. Getting the first wrong is a
security hole rather than an inconvenience: with it on and no proxy actually
rewriting `X-Forwarded-For`, the login rate limiter can be bypassed by anyone
who sets the header themselves.

## Backups

With `LE_AUTH=off` there is nothing server-side to back up — every course is in
somebody's browser, and the dashboard's JSON export is the backup.

With accounts on, **the `/data` volume is the thing to keep.** It holds the
accounts, every synced course, their version history and all uploaded media.

```bash
# A consistent copy while the server keeps running (SQLite is in WAL mode).
docker compose exec learn-editor \
  node -e "const {DatabaseSync}=require('node:sqlite'); \
           new DatabaseSync('/data/learn-editor.db').exec(\"VACUUM INTO '/data/backup.db'\")"

docker compose cp learn-editor:/data/backup.db ./learn-editor-backup.db
docker compose cp learn-editor:/data/blobs ./blobs-backup
```

`learn-editor.db` without `blobs/` restores the courses with their images
missing, so keep the pair together. Restoring is the reverse: stop the
container, put both back under the volume, start it.

Note that a course's *authoritative* copy is still the one in the author's
browser. Losing the server loses the sync, not the work.

## Releasing

`package.json` is the single source of the version: Vite bakes it into the
bundle and the server reads the same field at boot, so *About Learn Editor* and
`GET /api/version` can never disagree.

1. Update `CHANGELOG.md` and bump `version` in `package.json`.
2. Merge to `main` — CI builds, type-checks and tests every pull request.
3. Tag it: `git tag v1.2.0 && git push --tags`.

The **Publish container image** workflow builds the image, runs it, and checks
that it becomes healthy, reports the expected version, serves the app shell and
starts with authentication required — and only then publishes `:latest`,
`:1.2.0` and an immutable `:sha-<commit>`. Pin the `sha-` tag for a deploy you
can roll back to a known image.

## SCORM behaviour

The exported package is a single self-contained SCO. It reports:

- `lesson_status` / `completion_status`: `incomplete` on launch, then
  `completed` (or `passed`/`failed` for a course with quizzes) once the course's
  **completion rules** are all satisfied — not merely when the last page is
  reached
- `score.raw` (0–100, average across quizzes; plus `score.scaled` in 2004)
- `session_time` in the version's own format (`hh:mm:ss` for 1.2, ISO 8601 for
  2004)
- `suspend_data`: resume position, completed lessons, quiz scores, time on task,
  encoded by index rather than by id. SCORM 1.2 guarantees only 4096 characters
  and most LMSs truncate silently past it, so the payload is a few hundred
  characters even for a hundred-lesson course. Packages written before this
  encoding still resume correctly
- `cmi.interactions.n` per answered question — id, type, the learner's response
  as text, and correct/wrong — so LMS reporting can show which questions people
  fail rather than a single score
- `masteryscore` in the manifest when a quiz exists

`success_status` (2004) is left `unknown` until the course is actually finished.
It used to be written on every save, which told the LMS the learner had *failed*
the moment they opened a course containing a quiz.

Learners must submit all quizzes in a lesson before they can continue past it.
The **flight recorder** (above) runs all of this against a simulated LMS so it
can be checked before the package leaves your machine.

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

The front end is a React/TypeScript SPA. The server is optional, written against
Node's standard library with **no runtime dependencies at all** — its whole
runtime is Node, the built assets and about 1,500 lines of `.mjs`.

```
server/                  optional: accounts, sync, and serving the built app
  index.mjs              http server, routing, security headers, graceful shutdown
  config.mjs             environment parsing, validated at boot; fails fast
  db.mjs                 node:sqlite, schema migrations via PRAGMA user_version
  auth.mjs               scrypt passwords, revocable sessions, CSRF, rate limiting
  users.mjs              administration, invitations, the last-administrator rule
  courses.mjs            sync: list / pull / push, revision conflicts
  assets.mjs             content-addressed media blobs, reference-counted
  static.mjs             serves dist/ with the rules nginx.conf used to provide

src/
  types.ts               course → lessons → blocks data model, themes, completion
  theme.ts               course theme → CSS custom properties, shared by the
                         exported player and the editor canvas
  store.ts               Zustand store, undo/redo history, debounced IndexedDB autosave
  uiStore.ts             editor UI state: dock, selection, recent blocks
  hotkeys.ts             the shortcut registry the palette and help sheet read from
  dndA11y.ts             screen-reader announcements for keyboard drag-and-drop
  blockDefaults.ts       block registry + factories + deep clone
  utils/assets.ts        media asset refs: one visitor teaches every block about media
  utils/importContent.ts Markdown/HTML → blocks (bulk import), sanitised on the way in
  auth/api.ts            the only place the app talks to a server
  auth/authStore.ts      local vs server mode, who is signed in
  sync/syncStore.ts      push/pull, conflict detection, the offline story
  sync/hash.ts           SHA-256 for content-addressed media (WebCrypto, with a
                         fallback for the http LAN deployments it is missing on)
  ui/                    design-system primitives — Button, IconButton, Dialog,
                         Sheet, Popover, Field, Segmented, Toast, Confirm
  styles/                tokens.css (two-layer design tokens) and one
                         stylesheet per surface
  components/            editor UI (dashboard, shell, outline, canvas, dock,
                         inspector, block picker, command palette, dialogs)
    blocks/              per block type, a content editor for the canvas and an
                         options editor for the inspector, paired in
                         BlockEditor.tsx and BlockOptions.tsx
  review/
    types.ts             review rounds, comments, anchors, the reviewer bundle format
    anchor.ts            quote+context anchoring: re-find a comment's text after edits
    blockText.ts         text visitor: one place to teach every block about its prose
    reviewStore.ts       review rounds in IndexedDB (`review:`), merge, triage, apply
    buildReviewHtml.ts   wraps the exported player in the review layer — one file to share
    player/review.js     reviewer-side annotation layer (highlight, comment, suggest)
    player/review.css    review chrome, independent of the course theme
  a11y/
    criteria.ts          the WCAG 2.2 A + AA catalogue, and what the player
                         satisfies structurally
    audit.ts             rule engine over the course model → graded findings
    buildAcr.ts          the downloadable conformance report
  versions/
    storage.ts           named course snapshots in IndexedDB (`ver:`/`verdata:`)
    diff.ts              id-keyed structural diff: added / removed / edited / moved
  scorm/
    player/player.js     self-contained vanilla-JS course player + SCORM adapter
    player/player.css    responsive player styles
    buildPlayerHtml.ts   inlines player + course JSON into one index.html
    manifest.ts          imsmanifest.xml generators (1.2 & 2004)
    exporter.ts          JSZip packaging
    lms/fakeLms.ts       recording SCORM runtime — the flight recorder's LMS
    lms/profiles.ts      LMS behaviour profiles (field limits, strictness)
```

The in-app preview and the exported package share the same player code, imported
as raw text and inlined — one renderer to maintain, zero drift between preview
and what learners see.

`theme.ts` extends that principle to the editor: the exporter and the lesson
canvas call the same function to turn a course theme into CSS custom
properties, so the canvas is not approximating the player's colours but
computing them from the same inputs.

Two token systems meet on the canvas. Course tokens (`--ink`, `--bg`, `--line`,
`--accent`) style the content; chrome tokens (`--surface`, `--text`, `--border`)
style the editor. Widgets sitting inline in the content adopt the course palette
— the scheme guarantees they are contrast-paired with it — while editor
furniture floating above the content reads `--chrome-*` copies that are never
remapped.

Sync reuses a split the app already had. `courseStorage.ts` keeps a course's
prose and its media in separate IndexedDB records, because media never changes
and prose is what autosave rewrites every 400ms. That stored record — media
already stripped — is exactly the document pushed to the server, and the media
travels separately under the SHA-256 of its bytes. So the protocol did not have
to invent a representation; it inherited one that was already the right shape.

Conflicts are surfaced rather than resolved. Every accepted push bumps a server
revision; a client sends the revision it last agreed with, and if the server has
moved on the push is refused. The author is then shown the difference through
`DiffView` — the same rendered comparison the version panel uses — and chooses.
Last-write-wins would be less code and would quietly discard an afternoon of
someone else's work, which for regulated training is the worst thing the
software could do.

The review build is the same player again, with an annotation layer appended:
the player renders the course, and `review.js` decorates the DOM it produced.
The only concession the player makes to it is a `data-bid` attribute on each
rendered block, which is what comments anchor to. So reviewers comment on
exactly the course learners will get — not a separate "review mode" rendering
that could drift from it.

## Licence

MIT — see [LICENSE](LICENSE).
