export type World = 'student' | 'job_seeker' | 'customer_facing' | 'creator' | 'everyday'

export interface User {
  id: string
  name: string
  world: World
  goal: string
  xp: number
  streak: number
  completed_days: number[]
  next_day: number | null
  done_today: boolean
}

export interface CourseDay { day: number; title: string; technique: string; available: boolean; pro: boolean }
export interface Course { weeks: { week: number; title: string; locked: boolean }[]; days: CourseDay[]; worlds: Record<World, string> }

export interface Citation { book: string; chapter: string; section?: string; page: number; url?: string }
export interface RubricItem { id: string; check: string }
export interface Lesson {
  day: number
  technique: string
  title: string
  teach: string[]
  why_it_works: string
  example: string
  drill: { prompt: string; time_limit_sec: number }
  rubric: RubricItem[]
  citations: Citation[]
}

export interface Metrics {
  duration_sec: number
  time_limit_sec: number
  over_time: boolean
  word_count: number
  wpm: number
  filler_count: number
  fillers_per_min: number
  fillers: Record<string, number>
  pauses_over_0_7s: number
  longest_pause_sec: number
  words_to_first_sentence_end: number
}

export type Status = 'used' | 'partly' | 'missing' | 'unverified'
export interface Graded { id: string; check: string; status: Status; evidence: string }

export interface AttemptSummary {
  id: string
  day: number
  attempt_no: number
  created_at: string
  local_date: string
  rubric_score: number | null
  metrics: Metrics
  transcript: string
  rubric?: Graded[]
}

export interface Attempt extends AttemptSummary {
  rubric: Graded[]
  feedback: string
  fix: string
  rewrite: string
  xp: number
  previous: AttemptSummary | null
  validator: { first_pass: string[]; final: string[]; retried: boolean }
}

export interface Progress {
  baseline: AttemptSummary | null
  latest: AttemptSummary | null
  by_day: AttemptSummary[]
  history: AttemptSummary[]
}

export interface Health { mode: string; llm: string; model: string; stt: string; tts: boolean; max_recording_sec: number }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init)
  if (!r.ok) {
    let msg = `Something went wrong (${r.status})`
    try {
      const body = await r.json()
      if (typeof body.detail === 'string') msg = body.detail
    } catch { /* not json */ }
    throw new Error(msg)
  }
  return r.json()
}

const json = (body: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

export const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const api = {
  health: () => req<Health>('/api/health'),
  course: () => req<Course>('/api/course'),
  lesson: (day: number, world: World) => req<Lesson>(`/api/lessons/${day}?world=${world}`),
  createUser: (name: string, world: World, goal: string) => req<User>('/api/users', json({ name, world, goal })),
  user: (id: string) => req<User>(`/api/users/${id}?today=${localDate()}`),
  progress: (id: string) => req<Progress>(`/api/users/${id}/progress`),
  attempt: (userId: string, day: number, audio: Blob) => {
    const f = new FormData()
    f.append('user_id', userId)
    f.append('day', String(day))
    f.append('local_date', localDate())
    f.append('audio', audio, audio.type.includes('mp4') ? 'answer.mp4' : 'answer.webm')
    return req<Attempt>('/api/attempts', { method: 'POST', body: f })
  },
}

export const WORLD_LABELS: Record<World, { label: string; emoji: string; blurb: string }> = {
  student: { label: 'Student', emoji: '🎓', blurb: 'Presentations, group projects, office hours' },
  job_seeker: { label: 'Job seeker', emoji: '💼', blurb: '"Tell me about yourself", interviews, networking' },
  customer_facing: { label: 'Customer-facing', emoji: '🤝', blurb: 'Patients, customers, sales pitches' },
  creator: { label: 'Creator / performer', emoji: '🎬', blurb: 'Video intros, storytelling, auditions' },
  everyday: { label: 'Everyday', emoji: '☕', blurb: 'Small talk, saying no, a toast' },
}
