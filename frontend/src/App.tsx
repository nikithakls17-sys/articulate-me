import { BookOpen, Map, MessageCircle, NotebookPen, TrendingUp } from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './session'
import { Logo } from './icons'
import Welcome from './pages/Welcome'
import Overview from './pages/Overview'
import CoursePage from './pages/Course'
import Textbook from './pages/Textbook'
import Reader from './pages/Reader'
import Practice from './pages/Practice'
import Talk from './pages/Talk'
import Notes from './pages/Notes'
import ProgressPage from './pages/Progress'
import Sources from './pages/Sources'

const TABS = [
  { to: '/', icon: Map, label: 'Course' },
  { to: '/textbook', icon: BookOpen, label: 'Textbook' },
  { to: '/practice', icon: MessageCircle, label: 'Practice' },
  { to: '/notes', icon: NotebookPen, label: 'Notes' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
]

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const immersive = ['/welcome', '/read/', '/talk/'].some((p) => pathname.startsWith(p))
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden px-4">
      <main className={`flex-1 pt-4 ${immersive ? 'pb-8' : 'pb-28'}`}>{children}</main>
      {!immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-cream/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-md grid-cols-5 py-1.5 text-[11px] font-extrabold">
            {TABS.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${isActive ? 'text-coral' : 'text-muted'}`}>
                <Icon size={24} strokeWidth={2.2} aria-hidden />{label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const { user, loading } = useSession()
  if (loading) return <div className="grid min-h-dvh place-items-center"><Logo size={56} /></div>
  return (
    <Shell>
      <Routes>
        <Route path="/welcome" element={user ? <Navigate to="/" /> : <Welcome />} />
        <Route path="/sources" element={<Sources />} />
        {user ? (
          <>
            <Route path="/" element={<CoursePage />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/textbook" element={<Textbook />} />
            <Route path="/read/:day" element={<Reader />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/talk/:day" element={<Talk />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/progress" element={<ProgressPage />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/welcome" />} />
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  )
}
