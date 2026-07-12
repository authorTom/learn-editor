import { create } from 'zustand'
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Asset, Block, BlockTemplate, Course, CourseMeta, CourseTemplate, Lesson } from './types'
import { defaultCompletion, defaultTheme, normalizeCompletion, normalizeTheme } from './types'
import { cloneBlock } from './blockDefaults'
import { assetsForBlock, assetsForBlocks, mergeAssets } from './utils/assets'
import { readFileAsDataURL, readImageFile } from './utils/file'
import { uid } from './utils/id'

const COURSE_PREFIX = 'course:'
const BLOCK_TPL_PREFIX = 'btpl:'
const COURSE_TPL_PREFIX = 'ctpl:'

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
  createCourse: (title: string) => Promise<Course>
  createCourseFromTemplate: (title: string, templateId: string) => Promise<Course | undefined>
  openCourse: (id: string) => Promise<void>
  closeCourse: () => void
  deleteCourse: (id: string) => Promise<void>
  duplicateCourse: (id: string) => Promise<void>
  importCourse: (data: Course) => Promise<void>

  saveBlockTemplate: (name: string, block: Block) => Promise<void>
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
  deleteBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (from: number, to: number) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

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
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({
        saveState: 'saved',
        courses: s.courses.map((m) => (m.id === c.id ? toMeta(c) : m)),
      }))
    }, 400)
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

    createCourse: async (title) => {
      const c = newCourse(title)
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({
        courses: [toMeta(c), ...s.courses],
        course: c,
        lessonId: c.lessons[0].id,
        saveState: 'saved',
        past: [],
        future: [],
      }))
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
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({
        courses: [toMeta(c), ...s.courses],
        course: c,
        lessonId: c.lessons[0].id,
        saveState: 'saved',
        past: [],
        future: [],
      }))
      return c
    },

    openCourse: async (id) => {
      const raw = (await idbGet(COURSE_PREFIX + id)) as Course | undefined
      if (raw) {
        const c = normalizeCourse(raw)
        set({
          course: c,
          lessonId: c.lessons[0]?.id ?? null,
          saveState: 'saved',
          past: [],
          future: [],
        })
      }
    },

    closeCourse: () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
        const c = get().course
        if (c) idbSet(COURSE_PREFIX + c.id, c)
      }
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

    deleteCourse: async (id) => {
      await idbDel(COURSE_PREFIX + id)
      set((s) => ({ courses: s.courses.filter((m) => m.id !== id) }))
    },

    duplicateCourse: async (id) => {
      const c = (await idbGet(COURSE_PREFIX + id)) as Course | undefined
      if (!c) return
      const copy: Course = {
        ...structuredClone(c),
        id: uid(),
        title: c.title + ' (copy)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await idbSet(COURSE_PREFIX + copy.id, copy)
      set((s) => ({ courses: [toMeta(copy), ...s.courses] }))
    },

    importCourse: async (data) => {
      const c = normalizeCourse({ ...data, id: uid(), updatedAt: Date.now() })
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({ courses: [toMeta(c), ...s.courses] }))
    },

    saveBlockTemplate: async (name, block) => {
      const c = get().course
      const t: BlockTemplate = {
        id: uid(),
        name,
        blockType: block.type,
        block: cloneBlock(block),
        assets: c ? assetsForBlock(block, c.assets) : [],
        createdAt: Date.now(),
      }
      await idbSet(BLOCK_TPL_PREFIX + t.id, t)
      set((s) => ({ blockTemplates: [t, ...s.blockTemplates] }))
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
        assets: assetsForBlocks(lessons.flatMap((l) => l.blocks), source.assets ?? []),
        completion: normalizeCompletion(source.completion),
        createdAt: Date.now(),
      }
      await idbSet(COURSE_TPL_PREFIX + t.id, t)
      set((s) => ({ courseTemplates: [t, ...s.courseTemplates] }))
    },

    saveCourseTemplateById: async (name, description, courseId) => {
      const c = (await idbGet(COURSE_PREFIX + courseId)) as Course | undefined
      if (!c) return
      await get().saveCourseTemplate(name, description, normalizeCourse(c))
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
