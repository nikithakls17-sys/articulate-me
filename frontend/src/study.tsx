import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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
  running: boolean
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void
  goalMin: number
  setGoalMin: (m: number) => void
  notesVersion: number
  notesChanged: () => void
  targetsVersion: number
  refreshTargets: () => void
}

const Ctx = createContext<Study>(null as unknown as Study)

/** Saved per day: time banked so far + when the current run started (null = paused). Timestamps, not ticks,
 *  so the count stays right across reloads, sleeping laptops and background tabs. */
interface Saved { date: string; banked: number; startedAt: number | null }

function load(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && v.date === localDate() && typeof v.banked === 'number') return v
  } catch { /* storage blocked */ }
  return { date: localDate(), banked: 0, startedAt: null }
}
function save(v: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* ignore */ }
}
const elapsed = (v: Saved) => v.banked + (v.startedAt ? (Date.now() - v.startedAt) / 1000 : 0)

/** Study state shared by the side panel, the hourglass and the pages. The timer only runs when the learner
 *  presses Start (an open tab isn't the same as studying) and stops on Pause. */
export function StudyProvider({ children }: { children: ReactNode; active?: boolean }) {
  const [tab, setTab] = useState<StudyTab>('notes')
  const [drawer, setDrawer] = useState(false)
  const [saved, setSaved] = useState<Saved>(load)
  const [, tick] = useState(0)
  const [goalMin, setGoal] = useState(() => {
    try { return Number(localStorage.getItem(GOAL_KEY)) || 15 } catch { return 15 }
  })
  const [notesVersion, setNotesVersion] = useState(0)
  const [targetsVersion, setTargetsVersion] = useState(0)
  const running = saved.startedAt !== null

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      if (saved.date !== localDate()) { const fresh = { date: localDate(), banked: 0, startedAt: Date.now() }; save(fresh); setSaved(fresh) }
      tick((n) => n + 1)
    }, 1000)
    return () => window.clearInterval(t)
  }, [running, saved.date])

  const update = (v: Saved) => { save(v); setSaved(v) }
  const startTimer = () => { if (!running) update({ ...load(), startedAt: Date.now() }) }
  const pauseTimer = () => { if (running) update({ date: saved.date, banked: elapsed(saved), startedAt: null }) }
  const resetTimer = () => update({ date: localDate(), banked: 0, startedAt: null })

  const setGoalMin = (m: number) => {
    setGoal(m)
    try { localStorage.setItem(GOAL_KEY, String(m)) } catch { /* ignore */ }
  }
  const notesChanged = useCallback(() => setNotesVersion((v) => v + 1), [])
  const refreshTargets = useCallback(() => setTargetsVersion((v) => v + 1), [])

  return (
    <Ctx.Provider value={{ tab, setTab, drawer, setDrawer, seconds: Math.floor(elapsed(saved)), running, startTimer, pauseTimer, resetTimer,
      goalMin, setGoalMin, notesVersion, notesChanged, targetsVersion, refreshTargets }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStudy = () => useContext(Ctx)

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
