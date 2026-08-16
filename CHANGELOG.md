# Changelog

All notable changes to Learn Editor are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

`package.json` is the single source of the version. The browser bundle gets it
baked in by Vite as `__APP_VERSION__`, and the server reads the same field at
boot, so *About Learn Editor* and `GET /api/version` can never disagree about
which build is running.

## [Unreleased]

## [1.0.0] — 2026-08-16

The first released, versioned build. Learn Editor gains an optional server:
accounts, and courses that follow you between machines.

**The app still runs with no server at all.** That is not a fallback — it is the
default for `npm run dev` and for anyone who sets `LE_AUTH=off`. With no backend
there is no sign-in, nothing is uploaded, and every course lives in the browser
that made it, exactly as before. The client asks `GET /api/config` what it is
talking to and behaves accordingly, so one build covers both deployments.

### Added

- **Accounts and account management.** Email-and-password sign-in, per-user
  profile, password change, and a list of every device signed in as you, each
  revocable. Administrators get a *People* screen to invite, suspend, promote
  and remove colleagues. There is no public sign-up: an administrator creates
  the account and hands over a one-time invitation link.
- **First-run setup.** With no accounts yet, the app offers to create the
  founding administrator, guarded by a setup token printed to the server log —
  so an exposed port cannot be claimed by whoever finds it first.
- **Course sync.** Signed in, courses and their named version snapshots are
  pushed to the server and pulled onto any other machine you sign in from.
  IndexedDB stays the working copy, so the editor keeps its offline speed and
  autosave is untouched.
- **Conflict resolution that does not lose work.** When the same course was
  edited in two places, the push is refused rather than overwriting. The
  difference is shown as a rendered diff — the same view the version panel uses
  — and the author chooses: keep both, keep this computer's, or take the
  server's. Nothing is merged silently.
- **Content-addressed media.** Images and audio are stored by the SHA-256 of
  their bytes, so a photograph used in six courses, or captured in twelve
  snapshots, uploads and stores once.
- **About Learn Editor**, naming the version, the server's version, and where
  your courses are actually being kept.
- **An error boundary.** A rendering fault used to blank the screen, which on a
  tool whose courses live in the browser reads as lost work. It now says what
  happened, confirms the course is saved, and offers a way back.
- **A test suite** — 126 tests over theming, the review anchoring logic, the
  accessibility audit, SCORM manifest generation, content import, hashing and
  the server's auth primitives — run in CI on every pull request.

### Changed

- **The image now runs Learn Editor's own Node server instead of nginx**, and
  serves the SPA and the API from one port. `server/static.mjs` reproduces the
  caching and history-fallback rules `nginx.conf` provided. `compose.yaml` gains
  a `/data` volume: with accounts on, there is finally something to persist.
- **Fonts are served from this origin.** The app linked six families from
  `fonts.googleapis.com`, which sent every visitor's IP to a third party, broke
  on an internal network with no route out, and made a strict Content Security
  Policy impossible. They are vendored into `public/fonts` by
  `npm run fonts:fetch`. The in-app preview uses them too, so it still matches
  the exported package exactly.
- **The bundle is split.** It shipped as a single 1.1 MB chunk; first load is
  now 368 kB (111 kB gzipped), with the rich-text stack, the SCORM exporter and
  the heavier dialogs fetched when they are first needed.
- Security headers on every response, including a Content Security Policy.
  `script-src` permits inline script because the preview, the flight recorder,
  the version diff and Custom HTML blocks all render the player into a `srcdoc`
  iframe, which inherits this policy — see the note in `server/index.mjs`.
- Production builds emit sourcemaps, so a stack trace from a self-hosted
  instance is readable.

### Fixed

- **Opening a course while another was mid-autosave could silently discard the
  last 400 ms of edits** to the first one. The queued save now flushes before
  the open course is swapped. The same gap made every course close write itself
  a second time.
- Imported HTML is stripped of `<script>`, event-handler attributes and
  `javascript:` URLs. Pasting a Word or intranet page could otherwise carry
  executable code into a SCORM package bound for someone else's LMS. The Custom
  HTML block, where running script is the deliberate and visible point, is
  unchanged.
- Block templates arriving through an import had no revision number, leaving the
  linked-block staleness check resting on a fallback.
- Two high-severity advisories in build dependencies.

[Unreleased]: https://github.com/authorTom/learn-editor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/authorTom/learn-editor/releases/tag/v1.0.0
