import { useEffect } from 'react'
import { useStore } from './store'
import Dashboard from './components/Dashboard'
import CourseEditor from './components/CourseEditor'

export default function App() {
  const course = useStore((s) => s.course)
  const loadCourseList = useStore((s) => s.loadCourseList)

  useEffect(() => {
    loadCourseList()
  }, [loadCourseList])

  return course ? <CourseEditor /> : <Dashboard />
}
