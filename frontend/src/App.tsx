import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './session'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import DayFlow from './pages/DayFlow'
import ProgressPage from './pages/Progress'
import Sources from './pages/Sources'

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const showNav = !pathname.startsWith('/day/') && pathname !== '/welcome'
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <main className="flex-1 pb-28 pt-4">{children}</main>
      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-cream/95 backdrop-blur">
          <div className="mx-auto flex max-w-md justify-around py-2 text-sm font-extrabold">
            {[
              ['/', '🏠', 'Learn'],
              ['/progress', '📈', 'Progress'],
              ['/sources', '📚', 'Sources'],
            ].map(([to, icon, label]) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => `flex flex-col items-center rounded-xl px-5 py-1 ${isActive ? 'text-coral' : 'text-muted'}`}>
                <span className="text-2xl" aria-hidden>{icon}</span>{label}
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
  if (loading) return <div className="grid min-h-screen place-items-center text-2xl font-black text-coral">🎙️</div>
  return (
    <Shell>
      <Routes>
        <Route path="/welcome" element={user ? <Navigate to="/" /> : <Welcome />} />
        <Route path="/sources" element={<Sources />} />
        {user ? (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/day/:day" element={<DayFlow />} />
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
