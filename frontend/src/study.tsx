import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { localDate } from './api'

export type StudyTab = 'notes' | 'targets' | 'timer'
const KEY = 'articulate.study'
const GOAL_KEY = 'articulate.goal_min'

interface Study {
  tab: StudyTab
  setTab: (t: StudyTab) => void
  drawer: boolean
  setDrawer: (open: boolean) => void
  seconds: number            // studied today
  goalMin: number
  setGoalMin: (m: number) => void
  notesVersion: number
  notesChanged: () => void
  targetsVersion: number
  refreshTargets: () => void
}

const Ctx = createContext<Study>(null as unknown as Study)

function load(): { date: string; seconds: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && v.date === localDate()) return v
  } catch { /* storage blocked */ }
  return { date: localDate(), seconds: 0 }
}

/** Study state shared by the side panel, the hourglass and the pages. Time only counts while the
 *  tab is visible and the learner has interacted in the last 2 minutes, so an idle open tab doesn't. */
export function StudyProvider({ children, active }: { children: ReactNode; active: boolean }) {
  const [tab, setTab] = useState<StudyTab>('notes')
  const [drawer, setDrawer] = useState(false)
  const [seconds, setSeconds] = useState(() => load().seconds)
  const [goalMin, setGoal] = useState(() => {
    try { return Number(localStorage.getItem(GOAL_KEY)) || 15 } catch { return 15 }
  })
  const [notesVersion, setNotesVersion] = useState(0)
  const [targetsVersion, setTargetsVersion] = useState(0)
  const lastInput = useRef(Date.now())

  useEffect(() => {
    const bump = () => { lastInput.current = Date.now() }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    return () => evs.forEach((e) => window.removeEventListener(e, bump))
  }, [])

  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > 120_000) return
      setSeconds((s) => {
        const cur = load()
        const next = cur.date === localDate() ? Math.max(s, cur.seconds) + 1 : 1
        try { localStorage.setItem(KEY, JSON.stringify({ date: localDate(), seconds: next })) } catch { /* ignore */ }
        return next
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [active])

  const setGoalMin = (m: number) => {
    setGoal(m)
    try { localStorage.setItem(GOAL_KEY, String(m)) } catch { /* ignore */ }
  }
  const notesChanged = useCallback(() => setNotesVersion((v) => v + 1), [])
  const refreshTargets = useCallback(() => setTargetsVersion((v) => v + 1), [])

  return (
    <Ctx.Provider value={{ tab, setTab, drawer, setDrawer, seconds, goalMin, setGoalMin, notesVersion, notesChanged, targetsVersion, refreshTargets }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStudy = () => useContext(Ctx)

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
