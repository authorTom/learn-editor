import { create } from 'zustand'
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Asset, Block, BlockTemplate, Course, CourseMeta, CourseTemplate, Lesson } from './types'
import { defaultCompletion, defaultTheme, normalizeCompletion, normalizeTheme } from './types'
import {
  COURSE_PREFIX,
  collectAssetGarbage,
  deleteCourseRecord,
  loadCourse,
  saveCourse,
} from './courseStorage'
import { cloneBlock } from './blockDefaults'
import { fetchExampleCourse, fetchSeedTemplates } from './exampleCourse'
import { assetsForBlock, assetsForLessons, mergeAssets } from './utils/assets'
import { readFileAsDataURL, readImageFile } from './utils/file'
import { uid } from './utils/id'

const BLOCK_TPL_PREFIX = 'btpl:'
const COURSE_TPL_PREFIX = 'ctpl:'
// Set once the fresh-install seed has run, so it never repeats (and deleting
// the seeded course/templates makes them stay gone).
const SEED_MARKER = 'meta:seeded-examples'

function newLesson(title = 'New lesson'): Lesson {
  return { id: uid(), title, icon: '📄', blocks: [] }
}

/** Copy a lesson with fresh ids throughout, so it can be reused in another course. */
function cloneLesson(l: Lesson): Lesson {
  return { ...l, id: uid(), blocks: l.blocks.map(cloneBlock) }
}

export function newCourse(title: string): Course {
  const now = Date.now()
  return {
    id: uid(),
    title,
    description: '',
    author: '',
    coverImage: '',
    lessons: [newLesson('Introduction')],
    theme: { ...defaultTheme },
    assets: [],
    completion: { ...defaultCompletion },
    createdAt: now,
    updatedAt: now,
  }
}

/** Fill in fields added after a course was first saved. */
function normalizeCourse(c: Course): Course {
  return {
    ...c,
    theme: normalizeTheme(c.theme),
    assets: c.assets ?? [],
    completion: normalizeCompletion(c.completion),
  }
}

function toMeta(c: Course): CourseMeta {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    coverImage: c.coverImage,
    lessonCount: c.lessons.length,
    updatedAt: c.updatedAt,
  }
}

interface EditorState {
  courses: CourseMeta[]
  loaded: boolean
  course: Course | null // currently open course
  lessonId: string | null // currently selected lesson
  saveState: 'saved' | 'saving' | 'idle'
  blockTemplates: BlockTemplate[]
  courseTemplates: CourseTemplate[]
  past: Course[]
  future: Course[]

  loadCourseList: () => Promise<void>
  seedExamples: () => Promise<void>
  createCourse: (title: string) => Promise<Course>
  createCourseFromTemplate: (title: string, templateId: string) => Promise<Course | undefined>
  openCourse: (id: string) => Promise<void>
  closeCourse: () => void
  deleteCourse: (id: string) => Promise<void>
  duplicateCourse: (id: string) => Promise<void>
  importCourse: (data: Course) => Promise<Course>

  saveBlockTemplate: (name: string, block: Block) => Promise<void>
  /** Push a block's current content back to the library entry it came from,
      bumping the revision so every other copy learns it is out of date. */
  publishBlockTemplate: (templateId: string, block: Block) => Promise<void>
  /** Pull the library's current content into one linked block. */
  syncLinkedBlock: (blockId: string) => void
  /** Pull it into every out-of-date linked block in the open course. */
  syncAllLinked: () => number
  /** Detach a block from its library entry, keeping the content. */
  unlinkBlock: (blockId: string) => void
  deleteBlockTemplate: (id: string) => Promise<void>
  saveCourseTemplate: (name: string, description: string, source: Course) => Promise<void>
  saveCourseTemplateById: (name: string, description: string, courseId: string) => Promise<void>
  deleteCourseTemplate: (id: string) => Promise<void>
  importTemplates: (blocks: BlockTemplate[], courses: CourseTemplate[]) => Promise<number>

  undo: () => void
  redo: () => void

  addAsset: (file: File) => Promise<Asset | undefined>
  deleteAsset: (id: string) => void
  renameAsset: (id: string, name: string) => void

  updateCourse: (patch: Partial<Course>) => void
  selectLesson: (id: string) => void
  addLesson: () => void
  addLessons: (sections: { title: string; blocks: Block[] }[]) => void
  updateLesson: (id: string, patch: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  duplicateLesson: (id: string) => void
  moveLesson: (from: number, to: number) => void

  addBlock: (block: Block, index?: number, assets?: Asset[]) => void
  addBlocks: (blocks: Block[], index?: number) => void
  updateBlock: (id: string, patch: Partial<Block>) => void
  /** Patch a block in a named lesson, not just the selected one — used when
      applying a review suggestion, which can land anywhere in the course. */
  updateBlockIn: (lessonId: string, blockId: string, patch: Partial<Block>) => void
  deleteBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (from: number, to: number) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Media keys already written for the open course, so autosave rewrites only
    prose. Reset whenever the open course changes — see `adoptCourse`. */
let persistedAssets = new Set<string>()

const HISTORY_LIMIT = 60
/** Rapid edits that share a coalesce key (e.g. typing in one block) collapse
    into a single undo step, so ⌘Z doesn't walk back one keystroke at a time. */
const COALESCE_MS = 800
let lastKey: string | null = null
let lastAt = 0

export const useStore = create<EditorState>((set, get) => {
  function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const c = get().course
      if (!c) return
      await saveCourse(c, persistedAssets)
      set((s) => ({
        saveState: 'saved',
        courses: s.courses.map((m) => (m.id === c.id ? toMeta(c) : m)),
      }))
    }, 400)
  }

  /** Make a course the open one: fresh history, and a media ledger matching
      what is already on disk for it, so the first autosave writes only prose. */
  function adoptCourse(c: Course, persisted: Set<string>) {
    persistedAssets = persisted
    set({
      course: c,
      lessonId: c.lessons[0]?.id ?? null,
      saveState: 'saved',
      past: [],
      future: [],
    })
  }

  /** Apply a mutation to the open course: push history, then persist (debounced). */
  function mutate(fn: (c: Course) => Course, coalesceKey?: string) {
    const c = get().course
    if (!c) return
    const now = Date.now()
    const coalesce = !!coalesceKey && coalesceKey === lastKey && now - lastAt < COALESCE_MS
    lastKey = coalesceKey ?? null
    lastAt = now
    const next = { ...fn(c), updatedAt: now }
    set((s) => ({
      course: next,
      saveState: 'saving',
      past: coalesce ? s.past : [...s.past, c].slice(-HISTORY_LIMIT),
      future: [],
    }))
    schedulePersist()
  }

  /** Move between history stacks. `dir` is the stack we take the course from. */
  function travel(dir: 'past' | 'future') {
    const s = get()
    const stack = dir === 'past' ? s.past : s.future
    const other = dir === 'past' ? s.future : s.past
    const cur = s.course
    if (!cur || stack.length === 0) return
    const next = stack[stack.length - 1]
    lastKey = null
    set({
      course: { ...next, updatedAt: Date.now() },
      past: dir === 'past' ? stack.slice(0, -1) : [...other, cur],
      future: dir === 'future' ? stack.slice(0, -1) : [...other, cur],
      saveState: 'saving',
      lessonId: next.lessons.some((l) => l.id === s.lessonId)
        ? s.lessonId
        : next.lessons[0]?.id ?? null,
    })
    schedulePersist()
  }

  function mutateLesson(fn: (l: Lesson) => Lesson, coalesceKey?: string) {
    const { lessonId } = get()
    mutate(
      (c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === lessonId ? fn(l) : l)),
      }),
      coalesceKey
    )
  }

  return {
    courses: [],
    loaded: false,
    course: null,
    lessonId: null,
    saveState: 'idle',
    blockTemplates: [],
    courseTemplates: [],
    past: [],
    future: [],

    /** One pass over IndexedDB: course list plus both template libraries. */
    loadCourseList: async () => {
      const ks = (await idbKeys()) as string[]
      const metas: CourseMeta[] = []
      const blockTpls: BlockTemplate[] = []
      const courseTpls: CourseTemplate[] = []
      for (const k of ks) {
        if (typeof k !== 'string') continue
        if (k.startsWith(COURSE_PREFIX)) {
          // The stored record has media stripped out (see courseStorage), and
          // `toMeta` wants none of it, so listing costs kilobytes per course.
          const c = (await idbGet(k)) as Course | undefined
          if (c) metas.push(toMeta(c))
        } else if (k.startsWith(BLOCK_TPL_PREFIX)) {
          const t = (await idbGet(k)) as BlockTemplate | undefined
          if (t) blockTpls.push(t)
        } else if (k.startsWith(COURSE_TPL_PREFIX)) {
          const t = (await idbGet(k)) as CourseTemplate | undefined
          if (t) courseTpls.push({ ...t, theme: normalizeTheme(t.theme) })
        }
      }
      metas.sort((a, b) => b.updatedAt - a.updatedAt)
      blockTpls.sort((a, b) => b.createdAt - a.createdAt)
      courseTpls.sort((a, b) => b.createdAt - a.createdAt)
      set({ courses: metas, blockTemplates: blockTpls, courseTemplates: courseTpls, loaded: true })
    },

    /** Fresh-install seed: on a brand-new browser, drop in the ECG exemplar and
        the starter template library. Runs at most once (guarded by SEED_MARKER)
        and only into an empty library, so it never clobbers real work and stays
        gone once the user deletes it. Call after `loadCourseList`. */
    seedExamples: async () => {
      if (await idbGet(SEED_MARKER)) return
      const s = get()
      if (s.courses.length || s.blockTemplates.length || s.courseTemplates.length) {
        // Not a fresh install — record that seeding is settled and do nothing.
        await idbSet(SEED_MARKER, true)
        return
      }
      try {
        const [course, tpls] = await Promise.all([fetchExampleCourse(), fetchSeedTemplates()])
        await get().importTemplates(tpls.blockTemplates ?? [], tpls.courseTemplates ?? [])
        await get().importCourse(course)
        await idbSet(SEED_MARKER, true)
      } catch (e) {
        // Non-fatal (e.g. a fetch hiccup): leave the marker unset so the next
        // load retries rather than leaving a permanently empty dashboard.
        console.warn('Example seeding failed; will retry on next load.', e)
      }
    },

    createCourse: async (title) => {
      const c = newCourse(title)
      await saveCourse(c)
      set((s) => ({ courses: [toMeta(c), ...s.courses] }))
      adoptCourse(c, new Set())
      return c
    },

    createCourseFromTemplate: async (title, templateId) => {
      const t = get().courseTemplates.find((x) => x.id === templateId)
      if (!t) return undefined
      const now = Date.now()
      const c: Course = {
        id: uid(),
        title,
        description: t.description,
        author: '',
        coverImage: t.coverImage,
        lessons: t.lessons.length ? t.lessons.map(cloneLesson) : [newLesson('Introduction')],
        theme: normalizeTheme(t.theme),
        // lesson clones keep their `asset:` refs, so the media library comes along whole
        assets: t.assets ?? [],
        completion: normalizeCompletion(t.completion),
        createdAt: now,
        updatedAt: now,
      }
      // A template's media is new to this course, so every asset is written.
      const persisted = new Set<string>()
      await saveCourse(c, persisted)
      set((s) => ({ courses: [toMeta(c), ...s.courses] }))
      adoptCourse(c, persisted)
      return c
    },

    openCourse: async (id) => {
      const loaded = await loadCourse(id)
      if (!loaded) return
      const c = normalizeCourse(loaded.course)
      adoptCourse(c, loaded.persisted)
      // History is empty again, so nothing can restore an asset deleted in an
      // earlier session — the safe moment to free what it left behind. Awaited
      // rather than fired off: the editor is already on screen (the state is
      // set above), and letting it run loose risks it deciding an asset is dead
      // from a snapshot taken before a concurrent upload added it.
      await collectAssetGarbage(c)
    },

    closeCourse: () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
        const c = get().course
        if (c) void saveCourse(c, persistedAssets)
      }
      persistedAssets = new Set()
      set({ course: null, lessonId: null, saveState: 'idle', past: [], future: [] })
    },

    undo: () => travel('past'),
    redo: () => travel('future'),

    addAsset: async (file) => {
      const c = get().course
      if (!c) return undefined
      const isImage = file.type.startsWith('image/')
      const src = isImage ? await readImageFile(file) : await readFileAsDataURL(file)
      const existing = c.assets.find((a) => a.src === src)
      if (existing) return existing // same bytes already uploaded — reuse it
      const asset: Asset = {
        id: uid(),
        name: file.name || (isImage ? 'image' : 'audio'),
        kind: isImage ? 'image' : 'audio',
        src,
        size: src.length,
        createdAt: Date.now(),
      }
      mutate((cc) => ({ ...cc, assets: [asset, ...cc.assets] }))
      return asset
    },

    deleteAsset: (id) => mutate((c) => ({ ...c, assets: c.assets.filter((a) => a.id !== id) })),

    renameAsset: (id, name) =>
      mutate((c) => ({
        ...c,
        assets: c.assets.map((a) => (a.id === id ? { ...a, name } : a)),
      })),

    /** Takes the course's review rounds with it. Each round stores a full copy of
        the course, media and all, so leaving them behind would strand megabytes
        in IndexedDB with nothing left to reference them.

        The review store is pulled in dynamically: it imports this one (to apply
        suggestions), and a static import back would make that a cycle. */
    deleteCourse: async (id) => {
      await deleteCourseRecord(id)
      const { purgeCourseReviews } = await import('./review/storage')
      await purgeCourseReviews(id)
      const { purgeCourseVersions } = await import('./versions/storage')
      await purgeCourseVersions(id)
      const { useReviews } = await import('./review/reviewStore')
      useReviews.getState().forgetCourse(id)
      set((s) => ({ courses: s.courses.filter((m) => m.id !== id) }))
    },

    /** Loaded hydrated, so the copy owns its own media rather than pointing at
        the original's — which deleting the original would otherwise take away. */
    duplicateCourse: async (id) => {
      const loaded = await loadCourse(id)
      if (!loaded) return
      const copy: Course = {
        ...structuredClone(loaded.course),
        id: uid(),
        title: loaded.course.title + ' (copy)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await saveCourse(copy)
      set((s) => ({ courses: [toMeta(copy), ...s.courses] }))
    },

    importCourse: async (data) => {
      const c = normalizeCourse({ ...data, id: uid(), updatedAt: Date.now() })
      await saveCourse(c)
      set((s) => ({ courses: [toMeta(c), ...s.courses] }))
      return c
    },

    saveBlockTemplate: async (name, block) => {
      const c = get().course
      const t: BlockTemplate = {
        id: uid(),
        name,
        blockType: block.type,
        block: cloneBlock(block),
        assets: c ? assetsForBlock(block, c.assets) : [],
        rev: 1,
        createdAt: Date.now(),
      }
      await idbSet(BLOCK_TPL_PREFIX + t.id, t)
      set((s) => ({ blockTemplates: [t, ...s.blockTemplates] }))
    },

    publishBlockTemplate: async (templateId, block) => {
      const existing = get().blockTemplates.find((t) => t.id === templateId)
      if (!existing) return
      const c = get().course
      const next: BlockTemplate = {
        ...existing,
        block: cloneBlock(block),
        assets: c ? assetsForBlock(block, c.assets) : existing.assets,
        rev: (existing.rev ?? 1) + 1,
      }
      await idbSet(BLOCK_TPL_PREFIX + next.id, next)
      set((s) => ({ blockTemplates: s.blockTemplates.map((t) => (t.id === next.id ? next : t)) }))
      // The block that was just published is by definition current again.
      get().updateBlock(block.id, { linkedRev: next.rev })
    },

    syncLinkedBlock: (blockId) => {
      const s = get()
      const lesson = s.course?.lessons.find((l) => l.blocks.some((b) => b.id === blockId))
      const block = lesson?.blocks.find((b) => b.id === blockId)
      if (!block?.linkedTo) return
      const tpl = s.blockTemplates.find((t) => t.id === block.linkedTo)
      if (!tpl) return
      // Keep this block's own id and link, take everything else from the
      // library — including per-block width, spacing and background, which are
      // part of what was saved.
      const fresh = cloneBlock(tpl.block)
      s.updateBlock(blockId, {
        ...fresh,
        id: blockId,
        linkedTo: tpl.id,
        linkedRev: tpl.rev ?? 1,
      } as Partial<Block>)
      if (tpl.assets.length && s.course) {
        s.updateCourse({ assets: mergeAssets(s.course.assets, tpl.assets) })
      }
    },

    syncAllLinked: () => {
      const s = get()
      const course = s.course
      if (!course) return 0
      const stale = course.lessons.flatMap((l) =>
        l.blocks.filter((b) => {
          if (!b.linkedTo) return false
          const tpl = s.blockTemplates.find((t) => t.id === b.linkedTo)
          return !!tpl && (tpl.rev ?? 1) !== (b.linkedRev ?? 0)
        })
      )
      stale.forEach((b) => get().syncLinkedBlock(b.id))
      return stale.length
    },

    unlinkBlock: (blockId) => {
      get().updateBlock(blockId, { linkedTo: undefined, linkedRev: undefined } as Partial<Block>)
    },

    deleteBlockTemplate: async (id) => {
      await idbDel(BLOCK_TPL_PREFIX + id)
      set((s) => ({ blockTemplates: s.blockTemplates.filter((t) => t.id !== id) }))
    },

    saveCourseTemplate: async (name, description, source) => {
      const lessons = source.lessons.map(cloneLesson)
      const t: CourseTemplate = {
        id: uid(),
        name,
        description,
        coverImage: source.coverImage,
        theme: { ...source.theme },
        lessons,
        assets: assetsForLessons(lessons, source.assets ?? [], source.theme?.logo),
        completion: normalizeCompletion(source.completion),
        createdAt: Date.now(),
      }
      await idbSet(COURSE_TPL_PREFIX + t.id, t)
      set((s) => ({ courseTemplates: [t, ...s.courseTemplates] }))
    },

    /** Hydrated: a template carries its own copy of the media, so saving one
        from a course that isn't open still has to load the bytes. */
    saveCourseTemplateById: async (name, description, courseId) => {
      const loaded = await loadCourse(courseId)
      if (!loaded) return
      await get().saveCourseTemplate(name, description, normalizeCourse(loaded.course))
    },

    deleteCourseTemplate: async (id) => {
      await idbDel(COURSE_TPL_PREFIX + id)
      set((s) => ({ courseTemplates: s.courseTemplates.filter((t) => t.id !== id) }))
    },

    /** Merge templates from a library file; every entry gets a fresh id so an
        import can never overwrite what is already in the library. */
    importTemplates: async (blocks, courses) => {
      const now = Date.now()
      const newBlocks: BlockTemplate[] = []
      const newCourses: CourseTemplate[] = []
      for (const b of blocks) {
        if (!b?.block?.type) continue
        const t: BlockTemplate = {
          id: uid(),
          name: b.name || 'Untitled block',
          blockType: b.block.type,
          block: cloneBlock(b.block),
          assets: b.assets ?? [],
          createdAt: b.createdAt ?? now,
        }
        await idbSet(BLOCK_TPL_PREFIX + t.id, t)
        newBlocks.push(t)
      }
      for (const c of courses) {
        if (!Array.isArray(c?.lessons)) continue
        const t: CourseTemplate = {
          id: uid(),
          name: c.name || 'Untitled template',
          description: c.description ?? '',
          coverImage: c.coverImage ?? '',
          theme: normalizeTheme(c.theme),
          lessons: c.lessons.map(cloneLesson),
          assets: c.assets ?? [],
          completion: normalizeCompletion(c.completion),
          createdAt: c.createdAt ?? now,
        }
        await idbSet(COURSE_TPL_PREFIX + t.id, t)
        newCourses.push(t)
      }
      set((s) => ({
        blockTemplates: [...newBlocks, ...s.blockTemplates],
        courseTemplates: [...newCourses, ...s.courseTemplates],
      }))
      return newBlocks.length + newCourses.length
    },

    updateCourse: (patch) => mutate((c) => ({ ...c, ...patch })),

    selectLesson: (id) => set({ lessonId: id }),

    addLesson: () => {
      const l = newLesson()
      mutate((c) => ({ ...c, lessons: [...c.lessons, l] }))
      set({ lessonId: l.id })
    },

    /** Bulk import: each section becomes a lesson appended to the course. */
    addLessons: (sections) => {
      if (!sections.length) return
      const lessons: Lesson[] = sections.map((s, i) => ({
        ...newLesson(s.title || `Imported lesson ${i + 1}`),
        blocks: s.blocks,
      }))
      mutate((c) => ({ ...c, lessons: [...c.lessons, ...lessons] }))
      set({ lessonId: lessons[0].id })
    },

    updateLesson: (id, patch) =>
      mutate(
        (c) => ({
          ...c,
          lessons: c.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }),
        'lesson:' + id
      ),

    deleteLesson: (id) => {
      const c = get().course
      if (!c || c.lessons.length <= 1) return
      const idx = c.lessons.findIndex((l) => l.id === id)
      mutate((cc) => ({ ...cc, lessons: cc.lessons.filter((l) => l.id !== id) }))
      if (get().lessonId === id) {
        const rest = get().course!.lessons
        set({ lessonId: rest[Math.max(0, idx - 1)]?.id ?? rest[0]?.id ?? null })
      }
    },

    duplicateLesson: (id) => {
      mutate((c) => {
        const idx = c.lessons.findIndex((l) => l.id === id)
        if (idx < 0) return c
        const src = c.lessons[idx]
        const copy: Lesson = { ...cloneLesson(src), title: src.title + ' (copy)' }
        const lessons = [...c.lessons]
        lessons.splice(idx + 1, 0, copy)
        return { ...c, lessons }
      })
    },

    moveLesson: (from, to) =>
      mutate((c) => {
        const lessons = [...c.lessons]
        const [l] = lessons.splice(from, 1)
        lessons.splice(to, 0, l)
        return { ...c, lessons }
      }),

    /** `assets` arrives when the block came from the template library and brought
        its media with it — adopt those into this course's library. */
    addBlock: (block, index, assets) => {
      const { lessonId } = get()
      mutate((c) => ({
        ...c,
        assets: assets?.length ? mergeAssets(c.assets, assets) : c.assets,
        lessons: c.lessons.map((l) => {
          if (l.id !== lessonId) return l
          const blocks = [...l.blocks]
          blocks.splice(index ?? blocks.length, 0, block)
          return { ...l, blocks }
        }),
      }))
    },

    addBlocks: (blocks, index) =>
      mutateLesson((l) => {
        const next = [...l.blocks]
        next.splice(index ?? next.length, 0, ...blocks)
        return { ...l, blocks: next }
      }),

    updateBlock: (id, patch) =>
      mutateLesson(
        (l) => ({
          ...l,
          blocks: l.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
        }),
        'block:' + id
      ),

    /** No coalesce key: each applied suggestion is its own undo step. */
    updateBlockIn: (lessonId, blockId, patch) =>
      mutate((c) => ({
        ...c,
        lessons: c.lessons.map((l) =>
          l.id === lessonId
            ? {
                ...l,
                blocks: l.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)),
              }
            : l
        ),
      })),

    deleteBlock: (id) =>
      mutateLesson((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== id) })),

    duplicateBlock: (id) =>
      mutateLesson((l) => {
        const idx = l.blocks.findIndex((b) => b.id === id)
        if (idx < 0) return l
        const copy = cloneBlock(l.blocks[idx])
        const blocks = [...l.blocks]
        blocks.splice(idx + 1, 0, copy)
        return { ...l, blocks }
      }),

    moveBlock: (from, to) =>
      mutateLesson((l) => {
        const blocks = [...l.blocks]
        const [b] = blocks.splice(from, 1)
        blocks.splice(to, 0, b)
        return { ...l, blocks }
      }),
  }
})
