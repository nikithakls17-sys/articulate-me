import { BookOpen, Library, Map, MessageCircle, PanelRightClose, PanelRightOpen, Pause, Play, TrendingUp } from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from './session'
import { Logo } from './icons'
import { mmss, StudyProvider, useStudy } from './study'
import { useMedia } from './components/Book'
import Hourglass from './components/Hourglass'
import StudyPanel from './components/StudyPanel'
import Welcome from './pages/Welcome'
import Overview from './pages/Overview'
import CoursePage from './pages/Course'
import Textbook from './pages/Textbook'
import Reader from './pages/Reader'
import Practice from './pages/Practice'
import Talk from './pages/Talk'
import Study from './pages/Study'
import ProgressPage from './pages/Progress'
import Sources from './pages/Sources'
import Blobs from './pages/Blobs'

const TABS = [
  { to: '/', icon: Map, label: 'Course' },
  { to: '/textbook', icon: BookOpen, label: 'Textbook' },
  { to: '/practice', icon: MessageCircle, label: 'Practice' },
  { to: '/study', icon: Library, label: 'Study', phoneOnly: true },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
]

function HourglassButton() {
  const { seconds, goalMin, running, startTimer, pauseTimer, setTab, setDrawer } = useStudy()
  const laptop = useMedia('(min-width: 1024px)')
  const tablet = useMedia('(min-width: 768px)')
  const nav = useNavigate()
  const open = () => {
    setTab('timer')
    if (laptop) return
    if (tablet) setDrawer(true)
    else nav('/study')
  }
  return (
    <div className="flex items-stretch border-2 border-ink bg-white shadow-[3px_3px_0_var(--ink)]">
      <button onClick={open} className="flex items-center gap-1.5 px-2 py-1"
        aria-label={`Study timer: ${mmss(seconds)} of ${goalMin} minutes${running ? ', running' : ', paused'}. Open timer.`}>
        <Hourglass progress={seconds / (goalMin * 60)} size={22} />
        <span className={`label whitespace-nowrap tabular-nums ${running ? 'text-timer' : ''}`}>{mmss(seconds)} / {goalMin}:00</span>
      </button>
      <button onClick={running ? pauseTimer : startTimer} className={`grid w-8 place-items-center border-l-2 border-ink ${running ? 'bg-timer text-white' : 'bg-timer-soft'}`}
        aria-label={running ? 'Pause study timer' : 'Start study timer'}>
        {running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
    </div>
  )
}

function TopBar({ showTabs }: { showTabs: boolean }) {
  const { drawer, setDrawer } = useStudy()
  const laptop = useMedia('(min-width: 1024px)')
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
        <NavLink to="/" className="flex items-center gap-2" aria-label="Articulate Me home">
          <Logo size={30} />
          <span className="hidden whitespace-nowrap font-heading text-lg font-bold sm:inline md:hidden lg:inline">Articulate Me</span>
        </NavLink>
        {showTabs && (
          <nav className="ml-4 hidden h-full items-stretch md:flex" aria-label="Main">
            {TABS.filter((t) => !t.phoneOnly).map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `label flex items-center whitespace-nowrap border-l-2 border-ink px-3 last:border-r-2 lg:px-4 ${isActive ? 'bg-ink text-white' : 'hover:bg-white'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <HourglassButton />
          {!laptop && (
            <button onClick={() => setDrawer(!drawer)} className="hidden border-2 border-ink bg-white p-1.5 md:block"
              aria-label={drawer ? 'Close study panel' : 'Open study panel'} aria-expanded={drawer}>
              {drawer ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useSession()
  const { drawer, setDrawer } = useStudy()
  const { pathname } = useLocation()
  const laptop = useMedia('(min-width: 1024px)')
  const tablet = useMedia('(min-width: 768px)')
  const onboarding = pathname === '/welcome' || !user
  const immersive = ['/read/', '/talk/'].some((p) => pathname.startsWith(p))
  const wide = pathname.startsWith('/read/')

  if (onboarding) {
    return <div className="mx-auto min-h-dvh w-full max-w-xl overflow-x-hidden px-4 py-6">{children}</div>
  }

  return (
    <div className="min-h-dvh">
      <TopBar showTabs />
      <div className={`mx-auto flex w-full max-w-[1440px] gap-6 px-4 lg:px-6 ${tablet ? 'pt-6' : 'pt-4'}`}>
        <main className={`min-w-0 flex-1 ${!tablet && !immersive ? 'pb-28' : 'pb-10'}`}>
          <div className={`mx-auto ${wide ? 'max-w-[1100px]' : 'max-w-3xl'}`}>{children}</div>
        </main>
        {laptop && (
          <aside className="sticky top-20 h-[calc(100dvh-6.5rem)] w-[340px] shrink-0" aria-label="Study panel">
            <StudyPanel />
          </aside>
        )}
      </div>

      {tablet && !laptop && drawer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={() => setDrawer(false)}>
          <div className="h-full w-[380px] max-w-[90vw] p-3 pt-[4.5rem]" onClick={(e) => e.stopPropagation()}>
            <StudyPanel />
          </div>
        </div>
      )}

      {!tablet && !immersive && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-cream pb-[env(safe-area-inset-bottom)]" aria-label="Main">
          <div className="grid grid-cols-5">
            {TABS.map(({ to, icon: Icon, label }, i) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `label flex flex-col items-center gap-1 py-2 text-[0.6rem] ${i ? 'border-l-2 border-ink' : ''} ${isActive ? 'bg-ink text-white' : ''}`}>
                <Icon size={22} strokeWidth={2.2} aria-hidden />{label}
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
    <StudyProvider active={!!user}>
      <Shell>
        <Routes>
          <Route path="/welcome" element={user ? <Navigate to="/" /> : <Welcome />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/blobs" element={<Blobs />} />
          {user ? (
            <>
              <Route path="/" element={<CoursePage />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/textbook" element={<Textbook />} />
              <Route path="/read/:day" element={<Reader />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/talk/:day" element={<Talk />} />
              <Route path="/study" element={<Study />} />
              <Route path="/notes" element={<Navigate to="/study" />} />
              <Route path="/progress" element={<ProgressPage />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/welcome" />} />
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Shell>
    </StudyProvider>
  )
}
