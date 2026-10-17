import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Lock } from 'lucide-react'
import { api, type Course } from '../api'
import { useSession } from '../session'

export default function Textbook() {
  const { user } = useSession()
  const [course, setCourse] = useState<Course | null>(null)
  useEffect(() => { api.course().then(setCourse) }, [])
  if (!course || !user) return <div className="py-20 text-center text-muted">Loading…</div>

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <header className="md:col-span-2">
        <h1 className="text-3xl font-black">Textbook</h1>
        <p className="text-muted">Short illustrated chapters, written from two open college public speaking textbooks.</p>
      </header>
      {course.days.filter((d) => d.day > 0).map((d) => {
        const st = user.days[String(d.day)]
        const open = d.available && st?.unlocked
        const inner = (
          <>
            <span className={`grid h-14 w-11 shrink-0 place-items-center rounded-lg text-lg font-black shadow-[3px_3px_0_var(--color-line)]
              ${st?.read ? 'bg-leaf text-white' : open ? 'bg-sky text-white' : 'bg-cream text-muted'}`}>
              {st?.read ? <Check size={20} strokeWidth={3} /> : open ? d.day : <Lock size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-extrabold">{d.title}</span>
              <span className="block text-sm text-muted">{d.learn}</span>
              {d.available && <span className="mt-1 flex items-center gap-1 text-xs font-bold text-muted"><BookOpen size={12} /> {d.pages} pages · quick check</span>}
              {!d.available && <span className="mt-1 block text-xs font-bold text-muted">Being written</span>}
            </span>
          </>
        )
        return open
          ? <Link key={d.day} to={`/read/${d.day}`} className="card flex items-center gap-4">{inner}</Link>
          : <div key={d.day} className="card flex items-center gap-4 opacity-60">{inner}</div>
      })}
      {course.tracks.filter((t) => user.worlds.includes(t.id)).flatMap((t) => t.days).map((d) => {
        const st = user.days[String(d.day)]
        const open = d.available && st?.unlocked
        return open ? (
          <Link key={d.day} to={`/read/${d.day}`} className="card flex items-center gap-4 border-l-[10px] border-l-target">
            <span className="min-w-0 flex-1">
              <span className="label text-target">New here</span>
              <span className="block truncate text-lg font-extrabold">{d.title}</span>
              <span className="block text-sm text-muted">{d.learn}</span>
            </span>
          </Link>
        ) : null
      })}
      <Link to="/sources" className="text-center text-sm font-bold text-sky underline md:col-span-2">About the textbooks and licenses</Link>
    </div>
  )
}
