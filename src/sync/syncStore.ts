import { create } from 'zustand'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { Asset, Course } from '../types'
import {
  loadAssetMedia, loadCourse, loadCourseRecord, saveAssetMedia, saveCourse,
} from '../courseStorage'
import { useStore } from '../store'
import { useAuth } from '../auth/authStore'
import {
  ApiError, OfflineError, deleteRemoteCourse, downloadAsset, listRemoteCourses, missingAssets,
  pullCourse, pullServerCopy, pushCourse, uploadAsset,
} from '../auth/api'
import { decodeDataUrl, sha256, sha256Text, toDataUrl } from './hash'

/**
 * Course sync: local-first, server-backed.
 *
 * The editor never waits for this. Autosave still writes to IndexedDB 400ms
 * after a keystroke and the author carries on; sync happens behind it, and if
 * the network is gone the app is exactly the app it was before there was a
 * server. Everything here is therefore allowed to fail quietly — except a
 * conflict, which is the one case that must interrupt.
 *
 * ## What is stored where
 *
 * The document pushed to the server is the *stored* course record, which
 * already has asset bytes stripped out (see courseStorage.ts). Media travels
 * separately, addressed by the SHA-256 of its bytes, so it uploads once however
 * many courses or snapshots use it. Each synced asset carries its hash in the
 * document so that a client pulling the course knows what to fetch.
 *
 * ## How a conflict is decided
 *
 * `rev` is the server's counter. We remember the rev we last agreed on; if the
 * server has moved past it, someone else's machine got there first and the push
 * is refused. Nothing is merged automatically — the author is shown what
 * differs and chooses. See `resolveConflict`.
 */

/** Sync bookkeeping for one course. Kept out of the course itself so it never
    travels in an export or a template. */
interface SyncRecord {
  /** The server rev this browser last agreed with. */
  rev: number
  /** Hash of the document at that moment, so "changed since" needs no clock. */
  docHash: string
  syncedAt: number
}

const SYNC_PREFIX = 'sync:'
/** assetsha:<courseId>:<assetId> — an asset's bytes never change once written,
    so its hash is cached rather than recomputed over megabytes on every push. */
const ASSET_SHA_PREFIX = 'assetsha:'

/**
 * Which account this browser's library belongs to.
 *
 * Set the first time anyone syncs from this browser. It exists to stop a
 * genuinely bad outcome on a shared machine: sign in as one person, then as
 * another, and without this the second account would have the *first person's
 * entire course library* pushed into it. Uploading someone's unpublished
 * compliance training into a colleague's account is not a sync bug, it is a
 * disclosure.
 *
 * When the signed-in user is not the owner, sync runs one-way: their own
 * courses are pulled down, and nothing local is ever pushed up.
 */
const LIBRARY_OWNER = 'meta:sync-owner'

const readSync = (id: string) => idbGet(SYNC_PREFIX + id) as Promise<SyncRecord | undefined>
const writeSync = (id: string, r: SyncRecord) => idbSet(SYNC_PREFIX + id, r)
const dropSync = (id: string) => idbDel(SYNC_PREFIX + id)

/** An asset as it travels: no bytes, plus the hash that names them. */
type WireAsset = Omit<Asset, 'src'> & { src: '' ; sha?: string }

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

export interface Conflict {
  courseId: string
  title: string
  /** The server's copy, hydrated with media, ready to diff or adopt. */
  theirs: Course
  /** Ours, hydrated, as it stands in this browser. */
  mine: Course
  serverRev: number
}

interface SyncState {
  status: SyncStatus
  lastSyncedAt: number | null
  /** Set when the last attempt failed for a reason worth showing. */
  message: string | null
  conflict: Conflict | null

  /** Reconcile everything. Called on sign-in and on demand. */
  syncAll: () => Promise<void>
  /** Push one course if it has changed. Debounced by the caller. */
  syncCourse: (courseId: string) => Promise<void>
  /** Tell the server a course was deleted here. */
  syncDelete: (courseId: string) => Promise<void>
  /** Queue a push for the open course, coalescing rapid edits. */
  schedule: (courseId: string) => void
  resolveConflict: (choice: 'mine' | 'theirs' | 'copy') => Promise<void>
  dismissConflict: () => void
}

/** True when there is a server and someone is signed in to it. */
function active(): boolean {
  const auth = useAuth.getState()
  return auth.mode === 'server' && !!auth.user
}

// ---------- assets ----------

async function shaForAsset(courseId: string, asset: Asset): Promise<string | null> {
  const key = `${ASSET_SHA_PREFIX}${courseId}:${asset.id}`
  const cached = (await idbGet(key)) as string | undefined
  if (cached) return cached

  // The record's assets have empty `src`, so the bytes come from their own key.
  const src = asset.src || (await loadAssetMedia(courseId, asset.id))
  if (!src) return null
  const decoded = decodeDataUrl(src)
  if (!decoded) return null
  const sha = await sha256(decoded.bytes)
  await idbSet(key, sha)
  return sha
}

/** Upload whatever the server does not already hold. */
async function pushAssets(courseId: string, assets: Asset[]): Promise<Map<string, string>> {
  const shas = new Map<string, string>() // assetId -> sha
  for (const asset of assets) {
    const sha = await shaForAsset(courseId, asset)
    if (sha) shas.set(asset.id, sha)
  }
  if (!shas.size) return shas

  const unique = [...new Set(shas.values())]
  const { missing } = await missingAssets(unique)
  if (!missing.length) return shas

  const wanted = new Set(missing)
  const sent = new Set<string>()
  for (const asset of assets) {
    const sha = shas.get(asset.id)
    if (!sha || !wanted.has(sha) || sent.has(sha)) continue
    const src = asset.src || (await loadAssetMedia(courseId, asset.id))
    if (!src) continue
    const decoded = decodeDataUrl(src)
    if (!decoded) continue
    await uploadAsset(sha, new Blob([decoded.bytes as BlobPart], { type: decoded.mime }), decoded.mime)
    sent.add(sha)
  }
  return shas
}

/**
 * Fetch media for a *version snapshot*, inlined rather than stored.
 *
 * Snapshots keep their own copy of the bytes inside the snapshot record — see
 * versions/storage.ts, which `structuredClone`s the whole hydrated course. They
 * deliberately do not share the course's media keys, and must not: those keys
 * are swept by `collectAssetGarbage` whenever an asset is deleted from the live
 * course, which would quietly strip the images out of an "immutable" snapshot
 * of the version somebody approved.
 */
async function pullAssetsInline(wire: WireAsset[]): Promise<Asset[]> {
  const out: Asset[] = []
  for (const a of wire) {
    const { sha, ...rest } = a
    let src = ''
    if (sha) {
      try {
        const blob = await downloadAsset(sha)
        src = toDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type)
      } catch {
        console.warn(`Could not fetch snapshot media ${sha.slice(0, 8)}.`)
      }
    }
    out.push({ ...rest, src } as Asset)
  }
  return out
}

/** Fetch the media a pulled document refers to, and store it locally. */
async function pullAssets(courseId: string, wire: WireAsset[]): Promise<Asset[]> {
  const out: Asset[] = []
  for (const a of wire) {
    const { sha, ...rest } = a
    const asset = { ...rest, src: '' } as Asset
    if (sha) {
      // Already here from another course or an earlier pull? Then nothing to do.
      const existing = await loadAssetMedia(courseId, asset.id)
      if (existing) {
        await idbSet(`${ASSET_SHA_PREFIX}${courseId}:${asset.id}`, sha)
      } else {
        try {
          const blob = await downloadAsset(sha)
          const bytes = new Uint8Array(await blob.arrayBuffer())
          await saveAssetMedia(courseId, asset.id, toDataUrl(bytes, blob.type))
          await idbSet(`${ASSET_SHA_PREFIX}${courseId}:${asset.id}`, sha)
        } catch {
          // A missing blob must not sink the whole course. The asset arrives
          // with no bytes — which the editor already renders as a broken
          // image — and every word of the course still lands.
          console.warn(`Could not fetch media for asset ${asset.id}.`)
        }
      }
    }
    out.push(asset)
  }
  return out
}

// ---------- documents ----------

/** The record as it goes on the wire: stripped, with hashes attached. */
function toWire(record: Course, shas: Map<string, string>) {
  return {
    ...record,
    assets: (record.assets ?? []).map((a) => ({
      ...a,
      src: '' as const,
      ...(shas.get(a.id) ? { sha: shas.get(a.id) } : {}),
    })),
  }
}

const docHashOf = (doc: unknown) => sha256Text(JSON.stringify(doc))

export const useSync = create<SyncState>((set, get) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** One sync at a time. Two concurrent pushes of the same course would race
      each other's rev and manufacture a conflict out of nothing. */
  let running: Promise<void> = Promise.resolve()

  function serialise<T>(fn: () => Promise<T>): Promise<T> {
    const next = running.then(fn, fn)
    running = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  /** Map a thrown error onto the status line, without shouting. */
  function report(err: unknown) {
    if (err instanceof OfflineError) {
      set({ status: 'offline', message: null })
      return
    }
    if (err instanceof ApiError && err.status === 401) {
      // The session went away underneath us. The auth store owns that story.
      useAuth.getState().sessionExpired()
      set({ status: 'off', message: null })
      return
    }
    console.warn('Sync failed.', err)
    set({
      status: 'error',
      message: err instanceof ApiError ? err.message : 'Could not sync with the server.',
    })
  }

  /** May the signed-in account upload what is in this browser? See LIBRARY_OWNER. */
  async function mayPushLibrary(): Promise<boolean> {
    const me = useAuth.getState().user?.id
    if (!me) return false
    const owner = (await idbGet(LIBRARY_OWNER)) as string | undefined
    return !owner || owner === me
  }

  async function pushOne(courseId: string): Promise<void> {
    // Checked here rather than only in `syncAll`, so the debounced
    // after-an-edit push cannot slip a course into the wrong account either.
    if (!(await mayPushLibrary())) return
    const record = await loadCourseRecord(courseId)
    if (!record) return

    const local = await readSync(courseId)
    const shas = await pushAssets(courseId, record.assets ?? [])
    const doc = toWire(record, shas)
    const hash = await docHashOf(doc)

    // Nothing has changed since the last agreed state — the common case on a
    // periodic reconcile, and worth not spending an upload on.
    if (local && local.docHash === hash) return

    try {
      const res = await pushCourse(courseId, {
        doc,
        baseRev: local?.rev ?? 0,
        assets: [...new Set(shas.values())],
      })
      await writeSync(courseId, { rev: res.rev, docHash: hash, syncedAt: Date.now() })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await raiseConflict(courseId)
        return
      }
      throw err
    }
  }

  async function pullOne(courseId: string): Promise<void> {
    const res = await pullCourse(courseId)
    const wire = res.doc as Course & { assets?: WireAsset[] }
    const assets = await pullAssets(courseId, wire.assets ?? [])
    const course = { ...wire, assets } as Course
    await saveCourse(course, new Set())
    await writeSync(courseId, {
      rev: res.rev,
      docHash: await docHashOf(toWire(course, new Map())),
      syncedAt: Date.now(),
    })

    // Writing to IndexedDB is not enough if the author is *looking* at this
    // course: the editor still holds the version it loaded, and the next
    // keystroke autosaves that stale copy straight back over what was just
    // pulled — then pushes it, silently reverting the other machine's work.
    // Reopening replaces the in-memory copy and resets its undo history.
    if (useStore.getState().course?.id === courseId) {
      await useStore.getState().openCourse(courseId)
    }
  }

  /**
   * Rewrite the local sync record after adopting the server's copy.
   *
   * Recomputed from what was actually stored rather than from what arrived: the
   * two differ if any media failed to download, and a hash taken from the wire
   * would then claim agreement the next push would disprove.
   */
  async function reconcileHash(courseId: string, rev: number) {
    const record = await loadCourseRecord(courseId)
    if (!record) return
    const shas = new Map<string, string>()
    for (const a of record.assets ?? []) {
      const sha = await shaForAsset(courseId, a)
      if (sha) shas.set(a.id, sha)
    }
    await writeSync(courseId, {
      rev,
      docHash: await docHashOf(toWire(record, shas)),
      syncedAt: Date.now(),
    })
  }

  // ---- conflict resolutions ----
  //
  // Each is a plain async function so `resolveConflict` can compose them inside
  // a single serialised task. None of them touch the store's status; their
  // caller owns that.

  /** This browser's version wins, and replaces the server's. */
  async function keepMine(conflict: Conflict) {
    const record = await loadCourseRecord(conflict.courseId)
    if (!record) return
    const shas = await pushAssets(conflict.courseId, record.assets ?? [])
    const doc = toWire(record, shas)
    const res = await pushCourse(conflict.courseId, {
      doc,
      baseRev: conflict.serverRev,
      assets: [...new Set(shas.values())],
      // The author has seen the difference and chosen. This is the only place
      // that overrides the rev check, and it is only ever reached from that
      // decision.
      force: true,
    })
    await writeSync(conflict.courseId, {
      rev: res.rev,
      docHash: await docHashOf(doc),
      syncedAt: Date.now(),
    })
  }

  /** The server's version replaces what is here. */
  async function adoptTheirs(conflict: Conflict) {
    await pullOne(conflict.courseId)
    await reconcileHash(conflict.courseId, conflict.serverRev)
    // If the overwritten course is the one on screen, reopen it so the editor
    // is not left showing a document that no longer exists on disk.
    if (useStore.getState().course?.id === conflict.courseId) {
      await useStore.getState().openCourse(conflict.courseId)
    }
  }

  /** The server's version arrives as a separate course, leaving mine alone. */
  async function adoptTheirsAsCopy(conflict: Conflict) {
    const server = await pullServerCopy(conflict.courseId)
    const wire = server.doc as Course & { assets?: WireAsset[] }
    // `importCourse` mints a new id, so media has to be fetched under that new
    // id — hence importing first and letting it tell us what the id is.
    const imported = await useStore.getState().importCourse({
      ...(wire as Course),
      assets: (wire.assets ?? []).map((a) => ({ ...a, src: '' })) as Asset[],
      title: `${wire.title || 'Course'} (from the server)`,
    })
    const assets = await pullAssets(imported.id, wire.assets ?? [])
    await saveCourse({ ...imported, assets }, new Set())
  }

  /**
   * Named snapshots, both directions.
   *
   * These matter more than they look. PRODUCT.md rests the compliance case on
   * them — what changed between the version we approved and the one that
   * shipped — and an answer that exists only on the laptop that happened to
   * take the snapshot is not an answer an auditor can be given.
   *
   * Snapshots are immutable, so there is no conflict case: an id either exists
   * on a side or it does not, and the union is always correct.
   */
  async function syncVersions(courseId: string) {
    const { listVersions, getVersionCourse, upsertVersion } = await import('../versions/storage')
    const { listRemoteVersions, pushVersion, pullVersion } = await import('../auth/api')

    const local = await listVersions(courseId)
    const { versions: remote } = await listRemoteVersions(courseId)
    const remoteIds = new Set(remote.map((v) => v.id))
    const localIds = new Set(local.map((v) => v.id))

    for (const v of local) {
      if (remoteIds.has(v.id)) continue
      const course = await getVersionCourse(v.id)
      if (!course) continue
      // A snapshot carries its own copy of the media. Upload anything the
      // server is missing, then strip the bytes exactly as a course push does.
      const shas = await pushAssets(courseId, course.assets ?? [])
      await pushVersion(courseId, v.id, {
        doc: toWire({ ...course, id: courseId }, shas),
        name: v.name,
        note: v.note,
        createdAt: v.createdAt,
        lessonCount: v.lessonCount,
        blockCount: v.blockCount,
        auto: !!v.auto,
      })
    }

    for (const v of remote) {
      if (localIds.has(v.id)) continue
      const full = await pullVersion(courseId, v.id)
      const wire = full.doc as Course & { assets?: WireAsset[] }
      await upsertVersion(
        {
          id: v.id, courseId, name: v.name, note: v.note, createdAt: v.createdAt,
          lessonCount: v.lessonCount, blockCount: v.blockCount,
          ...(v.auto ? { auto: true } : {}),
        },
        // Inlined, not written into the course's media namespace — a snapshot
        // owns its bytes, or asset garbage collection will empty it later.
        { ...wire, assets: await pullAssetsInline(wire.assets ?? []) } as Course
      )
    }
  }

  async function raiseConflict(courseId: string) {
    const server = await pullServerCopy(courseId)
    const wire = server.doc as Course & { assets?: WireAsset[] }
    const loaded = await loadCourse(courseId)
    if (!loaded) return

    // Their media is not downloaded here. The diff is over text and structure,
    // and pulling every image of a copy the author may reject would be a large
    // download to show a dialog.
    const theirs = { ...wire, assets: (wire.assets ?? []).map((a) => ({ ...a, src: '' })) } as Course

    set({
      status: 'idle',
      conflict: {
        courseId,
        title: loaded.course.title,
        theirs,
        mine: loaded.course,
        serverRev: server.rev,
      },
    })
  }

  return {
    status: 'off',
    lastSyncedAt: null,
    message: null,
    conflict: null,

    schedule: (courseId) => {
      if (!active()) return
      const existing = timers.get(courseId)
      if (existing) clearTimeout(existing)
      // Well behind autosave's 400ms. Sync is not in the typing path, and a
      // push per pause would be a request every few seconds all afternoon.
      timers.set(
        courseId,
        setTimeout(() => {
          timers.delete(courseId)
          void get().syncCourse(courseId)
        }, 5000)
      )
    },

    syncCourse: (courseId) =>
      serialise(async () => {
        if (!active() || get().conflict) return
        set({ status: 'syncing', message: null })
        try {
          await pushOne(courseId)
          set((s) => ({
            status: s.conflict ? s.status : 'idle',
            lastSyncedAt: Date.now(),
          }))
        } catch (err) {
          report(err)
        }
      }),

    syncDelete: (courseId) =>
      serialise(async () => {
        if (!active()) return
        try {
          await deleteRemoteCourse(courseId)
        } catch (err) {
          // A delete that never reaches the server leaves a course that will
          // come back on the next reconcile. Better than blocking the delete.
          if (!(err instanceof OfflineError)) console.warn('Could not delete remotely.', err)
        }
        await dropSync(courseId)
      }),

    syncAll: () =>
      serialise(async () => {
        if (!active()) return
        set({ status: 'syncing', message: null })
        try {
          // Whose library is in this browser? On a first sync, the signed-in
          // user adopts it — that is the migration path from local-only use.
          // After that, a *different* account gets a read-only relationship
          // with it: their courses come down, nothing of anyone else's goes up.
          const me = useAuth.getState().user!.id
          const owner = ((await idbGet(LIBRARY_OWNER)) as string | undefined) ?? null
          if (owner === null) await idbSet(LIBRARY_OWNER, me)
          const mayPush = owner === null || owner === me
          if (!mayPush) {
            set({
              message:
                'These courses were made by someone else signed in on this browser, so they are not being uploaded to your account.',
            })
          }

          const { courses: remote } = await listRemoteCourses()
          const localMetas = useStore.getState().courses
          const localIds = new Set(localMetas.map((c) => c.id))
          const remoteById = new Map(remote.map((r) => [r.id, r]))

          // Anything the server has that this browser does not.
          for (const r of remote) {
            if (r.deletedAt) {
              // Deleted elsewhere. Remove it here too, but only if this browser
              // already agreed with the server about it — otherwise a course
              // created locally under a reused id would be destroyed.
              //
              // `remote: false`: the server already knows. Letting the store
              // call back into sync would queue behind this very task.
              if (localIds.has(r.id) && (await readSync(r.id))) {
                await useStore.getState().deleteCourse(r.id, { remote: false })
                await dropSync(r.id)
              }
              continue
            }
            if (!localIds.has(r.id)) {
              await pullOne(r.id)
            } else {
              const local = await readSync(r.id)
              // The server moved on without us and we have nothing unsent:
              // take theirs. If we do have something unsent, pushOne will
              // discover the conflict and ask.
              if (local && r.rev > local.rev) {
                const record = await loadCourseRecord(r.id)
                const shas = new Map<string, string>()
                for (const a of record?.assets ?? []) {
                  const sha = await shaForAsset(r.id, a)
                  if (sha) shas.set(a.id, sha)
                }
                const unchanged = record && (await docHashOf(toWire(record, shas))) === local.docHash
                if (unchanged) await pullOne(r.id)
              }
            }
          }

          // Anything this browser has that the server does not, or that has
          // changed here since we last agreed. Skipped entirely when the
          // library belongs to a different account — see LIBRARY_OWNER.
          for (const meta of mayPush ? localMetas : []) {
            if (remoteById.get(meta.id)?.deletedAt) continue
            await pushOne(meta.id)
            if (get().conflict) break // one at a time; the author has to choose
            // Only after the course itself is on the server: a snapshot
            // references a course row, and pushing history for a course the
            // server has never seen is rejected.
            try {
              await syncVersions(meta.id)
            } catch (err) {
              // History is valuable but not urgent. A failure here must not
              // stop the courses themselves from reaching the server.
              if (!(err instanceof OfflineError)) console.warn('Version sync failed.', err)
            }
          }

          await useStore.getState().loadCourseList()
          set((s) => ({
            status: s.conflict ? s.status : 'idle',
            lastSyncedAt: Date.now(),
          }))
        } catch (err) {
          report(err)
        }
      }),

    resolveConflict: (choice) =>
      // One `serialise` for the whole resolution, and the three strategies are
      // plain functions below rather than recursive calls back through this
      // method. "Keep both" is implemented as "import theirs, then keep mine",
      // and calling `resolveConflict('mine')` to do the second half would queue
      // a task behind the one already running it — a deadlock the sync test
      // found by hanging for twenty-five seconds.
      serialise(async () => {
        const conflict = get().conflict
        if (!conflict) return
        set({ status: 'syncing' })
        try {
          if (choice === 'theirs') {
            await adoptTheirs(conflict)
          } else {
            // "Keep both" is "save theirs beside mine, then keep mine".
            if (choice === 'copy') await adoptTheirsAsCopy(conflict)
            await keepMine(conflict)
          }

          set({ conflict: null, status: 'idle', lastSyncedAt: Date.now() })
          await useStore.getState().loadCourseList()
        } catch (err) {
          report(err)
        }
      }),

    dismissConflict: () => set({ conflict: null }),
  }
})

/**
 * Wire the store to the app: sync on sign-in, and after edits settle.
 *
 * Returns an unsubscribe. React 18's StrictMode runs effects twice in
 * development, and without this the app would hold two of each subscription
 * and fire two syncs for every edit.
 */
export function startSync(): () => void {
  let wasActive = false
  const stopAuth = useAuth.subscribe((state) => {
    const nowActive = state.mode === 'server' && !!state.user
    if (nowActive && !wasActive) {
      useSync.setState({ status: 'idle' })
      void useSync.getState().syncAll()
    }
    if (!nowActive && wasActive) {
      useSync.setState({ status: 'off', conflict: null, message: null })
    }
    wasActive = nowActive
  })

  // Every mutation bumps `updatedAt`, so this fires on real edits only.
  let lastSeen: { id: string; at: number } | null = null
  const stopStore = useStore.subscribe((state) => {
    const course = state.course
    if (!course) return
    if (lastSeen && lastSeen.id === course.id && lastSeen.at === course.updatedAt) return
    lastSeen = { id: course.id, at: course.updatedAt }
    useSync.getState().schedule(course.id)
  })

  return () => {
    stopAuth()
    stopStore()
  }
}
