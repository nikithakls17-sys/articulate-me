export type World = 'student' | 'job_seeker' | 'customer_facing' | 'creator' | 'everyday' | 'new_here'
export type Country = 'US' | 'UK' | 'Canada' | 'Australia'
export type Setting = 'campus' | 'workplace' | 'neighbourhood' | 'social'
export interface NewHere { country: Country; setting: Setting }

export interface DayState { read: boolean; practiced: boolean; best_score: number | null; unlocked: boolean }
export interface NextStep { kind: 'read' | 'baseline' | 'practice'; day: number }

export interface User {
  id: string
  name: string
  worlds: World[]
  goals: string[]
  new_here?: NewHere
  xp: number
  streak: number
  days: Record<string, DayState>
  next_step: NextStep | null
  done_today: boolean
}

export interface CourseDay {
  day: number; title: string; technique: string; learn: string; available: boolean; pro: boolean; minutes: number; pages: number
}
export interface BadgeDef { id: string; title: string; desc: string }
export interface Target { id: string; title: string; goal: number; unit: string; lower?: boolean }
export interface Track {
  id: World; title: string; summary: string; days: CourseDay[]; countries: Record<Country, string>; settings: Record<Setting, string>
}
export interface Course {
  tracks: Track[]
  weeks: { week: number; title: string; locked: boolean; summary: string }[]
  days: CourseDay[]
  worlds: Record<World, string>
  badges: BadgeDef[]
  targets: Target[]
  overview: { lessons: number; minutes_total: number; minutes_per_lesson: number }
}

export interface Citation { book: string; chapter: string; section?: string; page: number; url?: string; license?: string }
export type Page =
  | { kind: 'intro'; title: string; body: string; learn: string }
  | { kind: 'steps'; title: string; steps: { label: string; text: string }[]; cite?: Citation | null }
  | { kind: 'terms'; title: string; terms: { term: string; meaning: string }[]; cite?: Citation | null }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][]; cite?: Citation | null }
  | { kind: 'before_after'; title: string; situation: string; before: string; after: string; why: string }
  | { kind: 'why'; title: string; body: string; cite?: Citation | null }
  | { kind: 'example'; title: string; body: string }

export interface Scenario { partner: string; role: string; setup: string; opening: string }
export interface RubricItem { id: string; check: string }
export interface Lesson {
  day: number
  technique: string
  title: string
  learn: string
  pages: Page[]
  quiz: { q: string; options: string[] }[]
  scenario: Scenario | null
  world: World
  worlds: World[]
  rubric: RubricItem[]
  citations: Citation[]
  track?: World
  country?: Country
  setting?: Setting
}

export interface Explanation { items: { phrase: string; meaning: string; source: string; url: string | null }[]; plain: string | null }

export interface QuizResult { results: { correct: boolean; answer: number; explain: string }[]; correct: number; total: number; xp: number }

export interface Metrics {
  duration_sec: number
  word_count: number
  wpm: number
  filler_count: number
  fillers_per_min: number
  fillers: Record<string, number>
  pauses_over_0_7s: number
  longest_pause_sec: number
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

export interface Turn { speaker: 'partner' | 'user'; text: string }

export interface Attempt extends AttemptSummary {
  rubric: Graded[]
  feedback: string
  fix: string
  rewrite: string
  xp: number
  turns: Turn[]
  scenario: Scenario
  previous: AttemptSummary | null
}

export interface Conversation {
  id: string; day: number; world: World; scenario: Scenario; status: string; turns: Turn[]; max_user_turns: number; user_turns: number
  voice: { key: string; label: string }
}
export interface TurnResult { user_text: string; partner_text: string; done: boolean; user_turns: number; max_user_turns: number }

export interface Note {
  id: string; day: number; lesson_title: string; page_title: string; text: string; citation: Citation | null; comment: string; created_at: string
}

export interface Progress {
  baseline: AttemptSummary | null
  latest: AttemptSummary | null
  by_day: AttemptSummary[]
  history: AttemptSummary[]
  lessons_done: number
  lessons_total: number
  chapters_read: number
  streak: number
  longest_streak: number
  badges: (BadgeDef & { earned: boolean })[]
  targets: (Target & { current: number | null; done: boolean })[]
}

export interface Health { mode: string; llm: string; model: string; grader: string; stt: string; tts: boolean; tts_engine: string; max_recording_sec: number }

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

const send = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

export const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const audioName = (b: Blob) => (b.type.includes('mp4') || b.type.includes('m4a') || b.type.includes('aac') ? 'answer.mp4' : 'answer.webm')

export const api = {
  health: () => req<Health>('/api/health'),
  course: () => req<Course>('/api/course'),
  lesson: (day: number, userId: string, world?: string) =>
    req<Lesson>(`/api/lessons/${day}?user_id=${userId}${world ? `&world=${world}` : ''}`),
  createUser: (name: string, worlds: World[], goals: string[], newHere?: NewHere) =>
    req<User>('/api/users', send('POST', { name, worlds, goals, new_here: newHere })),
  explain: (convId: string, turn: number) => req<Explanation>(`/api/conversations/${convId}/explain`, send('POST', { turn })),
  updateUser: (id: string, patch: { worlds?: World[]; goals?: string[]; new_here?: NewHere }) => req<User>(`/api/users/${id}`, send('PATCH', patch)),
  user: (id: string) => req<User>(`/api/users/${id}?today=${localDate()}`),
  progress: (id: string) => req<Progress>(`/api/users/${id}/progress?today=${localDate()}`),
  quiz: (day: number, userId: string, answers: number[]) =>
    req<QuizResult>(`/api/lessons/${day}/quiz`, send('POST', { user_id: userId, answers, local_date: localDate() })),
  notes: (userId: string) => req<Note[]>(`/api/users/${userId}/notes`),
  addNote: (n: { user_id: string; day: number; page_title: string; text: string; citation: Citation | null | undefined }) =>
    req<Note>('/api/notes', send('POST', n)),
  editNote: (id: string, comment: string) => req<Note>(`/api/notes/${id}`, send('PATCH', { comment })),
  deleteNote: (id: string) => req<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),
  startConversation: (userId: string, day: number, world?: string) =>
    req<Conversation>('/api/conversations', send('POST', { user_id: userId, day, world })),
  sendTurn: (convId: string, audio: Blob) => {
    const f = new FormData()
    f.append('audio', audio, audioName(audio))
    return req<TurnResult>(`/api/conversations/${convId}/turns`, { method: 'POST', body: f })
  },
  finishConversation: (convId: string) => req<Attempt>(`/api/conversations/${convId}/finish`, send('POST', { local_date: localDate() })),
}

export const WORLD_LABELS: Record<World, { label: string; blurb: string }> = {
  student: { label: 'Student', blurb: 'Presentations, group projects, office hours' },
  job_seeker: { label: 'Job seeker', blurb: '"Tell me about yourself", interviews, networking' },
  customer_facing: { label: 'Customer-facing', blurb: 'Patients, customers, sales pitches' },
  creator: { label: 'Creator / performer', blurb: 'Video intros, storytelling, auditions' },
  everyday: { label: 'Everyday', blurb: 'Small talk, saying no, a toast' },
  new_here: { label: 'New here', blurb: 'Just moved? Small talk, slang and making friends' },
}
