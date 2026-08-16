// SQLite, via Node's own `node:sqlite` — no dependency, no native build step.
//
// Schema changes are migrations keyed on `PRAGMA user_version`, applied in order
// inside a transaction at boot. That is the whole mechanism: it is enough for a
// single-file database that one process owns, and it means an upgrade is just
// pulling a newer image.
//
// Every migration must be additive or safely re-runnable. Someone's course
// library is in here, and a migration that drops a column to rebuild it is one
// interrupted container start away from being the reason they lost it.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { log } from './log.mjs'

const MIGRATIONS = [
  // 1 — accounts, sessions, invites.
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL CHECK (role IN ('admin', 'author')),
    -- Null until an invited user sets one. A null hash can never match, which
    -- is what stops an un-accepted invite being signed into.
    password_hash TEXT,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    last_seen_at  INTEGER
  );

  -- The row id is a SHA-256 of the cookie token, never the token itself: a
  -- stolen database backup then yields no usable session cookies.
  CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    user_agent   TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expiry ON sessions(expires_at);

  CREATE TABLE invites (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER
  );
  CREATE INDEX invites_user ON invites(user_id);
  `,

  // 2 — synced courses, their version history, and content-addressed media.
  `
  CREATE TABLE courses (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    -- The course record with asset bytes stripped, exactly as courseStorage.ts
    -- already writes it in the browser. Media lives in blobs/.
    doc        TEXT NOT NULL,
    -- Bumped on every accepted push. The client sends the rev it last saw, and
    -- a mismatch is a conflict rather than a silent overwrite.
    rev        INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    -- A tombstone, not a DELETE: another device still holding the course has to
    -- be able to learn that it went away.
    deleted_at INTEGER
  );
  CREATE INDEX courses_owner ON courses(owner_id, updated_at);

  CREATE TABLE course_versions (
    id           TEXT PRIMARY KEY,
    course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL,
    lesson_count INTEGER NOT NULL DEFAULT 0,
    block_count  INTEGER NOT NULL DEFAULT 0,
    auto         INTEGER NOT NULL DEFAULT 0,
    doc          TEXT NOT NULL
  );
  CREATE INDEX course_versions_course ON course_versions(course_id, created_at);

  -- One row per distinct blob. Deduped by content, so a course duplicated ten
  -- times, or ten snapshots of one course, still store their shared photograph
  -- exactly once.
  CREATE TABLE blobs (
    sha        TEXT PRIMARY KEY,
    bytes      INTEGER NOT NULL,
    mime       TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  -- What refers to what, so deleting a course can free the bytes nothing else
  -- is using — and only those.
  CREATE TABLE course_blobs (
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    sha       TEXT NOT NULL REFERENCES blobs(sha),
    PRIMARY KEY (course_id, sha)
  );
  CREATE INDEX course_blobs_sha ON course_blobs(sha);
  `,
]

/**
 * Open the database, creating and migrating it as needed.
 *
 * `dataDir` and the blob directory are created here rather than assumed: a
 * fresh volume mounts empty, and failing at first write instead of at boot
 * turns a permissions mistake into a mystery an hour later.
 */
export function openDatabase({ dbPath, blobDir }) {
  mkdirSync(path.dirname(dbPath), { recursive: true })
  mkdirSync(blobDir, { recursive: true })

  const db = new DatabaseSync(dbPath)

  // WAL: readers never block the writer, which matters because a sync push and
  // a dashboard poll routinely overlap. busy_timeout stops a brief overlap
  // surfacing to the author as an error.
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
  // Off by default in SQLite, and every ON DELETE CASCADE above is load-bearing.
  db.exec('PRAGMA foreign_keys = ON')

  migrate(db)
  return db
}

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version
  if (current > MIGRATIONS.length) {
    throw new Error(
      `The database is at schema version ${current}, but this build only knows ${MIGRATIONS.length}. ` +
        `It was written by a newer Quoin — upgrade the image rather than downgrading the data.`
    )
  }
  if (current === MIGRATIONS.length) return

  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v])
      // PRAGMA will not take a bound parameter, and `v` is a loop index, not input.
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
      log.info('database migrated', { to: v + 1 })
    } catch (err) {
      db.exec('ROLLBACK')
      throw new Error(`Migration to schema version ${v + 1} failed: ${err.message}`)
    }
  }
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction(db, fn) {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
