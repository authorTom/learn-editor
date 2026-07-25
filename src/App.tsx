import { useEffect } from 'react'
import { useStore } from './store'
import Dashboard from './components/Dashboard'
import CourseEditor from './components/CourseEditor'

export default function App() {
  const course = useStore((s) => s.course)
  const loadCourseList = useStore((s) => s.loadCourseList)
  const seedExamples = useStore((s) => s.seedExamples)

  useEffect(() => {
    // Load the library first, then (on builds that opt in, e.g. the Docker
    // image) seed a fresh install with the exemplar course and templates.
    loadCourseList().then(() => {
      if (import.meta.env.VITE_SEED_EXAMPLES === 'true') seedExamples()
    })
  }, [loadCourseList, seedExamples])

  return course ? <CourseEditor /> : <Dashboard />
}
