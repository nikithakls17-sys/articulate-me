import { Navigate } from 'react-router-dom'
import StudyPanel from '../components/StudyPanel'
import { useMedia } from '../components/Book'

/** Phone: the study tools get their own tab. Laptop and tablet show them in the side panel instead. */
export default function Study() {
  const tablet = useMedia('(min-width: 768px)')
  if (tablet) return <Navigate to="/" />
  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-3">
      <h1 className="text-3xl font-bold">Study</h1>
      <div className="min-h-0 flex-1"><StudyPanel compact /></div>
    </div>
  )
}
