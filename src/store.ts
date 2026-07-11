import { create } from 'zustand'
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Block, Course, CourseMeta, Lesson } from './types'
import { defaultTheme } from './types'
import { uid } from './utils/id'

const COURSE_PREFIX = 'course:'

function newLesson(title = 'New lesson'): Lesson {
  return { id: uid(), title, icon: '📄', blocks: [] }
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
    createdAt: now,
    updatedAt: now,
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

  loadCourseList: () => Promise<void>
  createCourse: (title: string) => Promise<Course>
  openCourse: (id: string) => Promise<void>
  closeCourse: () => void
  deleteCourse: (id: string) => Promise<void>
  duplicateCourse: (id: string) => Promise<void>
  importCourse: (data: Course) => Promise<void>

  updateCourse: (patch: Partial<Course>) => void
  selectLesson: (id: string) => void
  addLesson: () => void
  updateLesson: (id: string, patch: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  duplicateLesson: (id: string) => void
  moveLesson: (from: number, to: number) => void

  addBlock: (block: Block, index?: number) => void
  updateBlock: (id: string, patch: Partial<Block>) => void
  deleteBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (from: number, to: number) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<EditorState>((set, get) => {
  /** Apply a mutation to the open course, then persist (debounced). */
  function mutate(fn: (c: Course) => Course) {
    const c = get().course
    if (!c) return
    const next = { ...fn(c), updatedAt: Date.now() }
    set({ course: next, saveState: 'saving' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      await idbSet(COURSE_PREFIX + next.id, get().course)
      set((s) => ({
        saveState: 'saved',
        courses: s.courses.map((m) => (m.id === next.id ? toMeta(get().course!) : m)),
      }))
    }, 400)
  }

  function mutateLesson(fn: (l: Lesson) => Lesson) {
    const { lessonId } = get()
    mutate((c) => ({
      ...c,
      lessons: c.lessons.map((l) => (l.id === lessonId ? fn(l) : l)),
    }))
  }

  return {
    courses: [],
    loaded: false,
    course: null,
    lessonId: null,
    saveState: 'idle',

    loadCourseList: async () => {
      const ks = (await idbKeys()) as string[]
      const metas: CourseMeta[] = []
      for (const k of ks) {
        if (typeof k === 'string' && k.startsWith(COURSE_PREFIX)) {
          const c = (await idbGet(k)) as Course | undefined
          if (c) metas.push(toMeta(c))
        }
      }
      metas.sort((a, b) => b.updatedAt - a.updatedAt)
      set({ courses: metas, loaded: true })
    },

    createCourse: async (title) => {
      const c = newCourse(title)
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({
        courses: [toMeta(c), ...s.courses],
        course: c,
        lessonId: c.lessons[0].id,
        saveState: 'saved',
      }))
      return c
    },

    openCourse: async (id) => {
      const c = (await idbGet(COURSE_PREFIX + id)) as Course | undefined
      if (c) set({ course: c, lessonId: c.lessons[0]?.id ?? null, saveState: 'saved' })
    },

    closeCourse: () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
        const c = get().course
        if (c) idbSet(COURSE_PREFIX + c.id, c)
      }
      set({ course: null, lessonId: null, saveState: 'idle' })
    },

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
      const c: Course = { ...data, id: uid(), updatedAt: Date.now() }
      await idbSet(COURSE_PREFIX + c.id, c)
      set((s) => ({ courses: [toMeta(c), ...s.courses] }))
    },

    updateCourse: (patch) => mutate((c) => ({ ...c, ...patch })),

    selectLesson: (id) => set({ lessonId: id }),

    addLesson: () => {
      const l = newLesson()
      mutate((c) => ({ ...c, lessons: [...c.lessons, l] }))
      set({ lessonId: l.id })
    },

    updateLesson: (id, patch) =>
      mutate((c) => ({
        ...c,
        lessons: c.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),

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
        const copy: Lesson = {
          ...structuredClone(src),
          id: uid(),
          title: src.title + ' (copy)',
          blocks: src.blocks.map((b) => ({ ...structuredClone(b), id: uid() })),
        }
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

    addBlock: (block, index) =>
      mutateLesson((l) => {
        const blocks = [...l.blocks]
        blocks.splice(index ?? blocks.length, 0, block)
        return { ...l, blocks }
      }),

    updateBlock: (id, patch) =>
      mutateLesson((l) => ({
        ...l,
        blocks: l.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
      })),

    deleteBlock: (id) =>
      mutateLesson((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== id) })),

    duplicateBlock: (id) =>
      mutateLesson((l) => {
        const idx = l.blocks.findIndex((b) => b.id === id)
        if (idx < 0) return l
        const copy = { ...structuredClone(l.blocks[idx]), id: uid() }
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
