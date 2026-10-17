import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api, WORLD_LABELS, type World } from '../api'
import { useSession } from '../session'
import { WORLD_ICONS } from '../icons'
import Blob, { BlobSays } from '../components/Blob'

export const GOALS = ['Stop rambling', 'Sound more confident', 'Fewer "um"s', 'Nail an interview', 'Speak up in class or meetings', 'Tell better stories']

function Steps({ n }: { n: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${n + 1} of 3`}>
      {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? 'bg-coral' : 'bg-line'}`} />)}
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`card flex w-full items-center gap-3 p-4 text-left transition ${on ? 'border-coral bg-orange-50' : ''}`}>
      {children}
      <span className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${on ? 'border-coral bg-coral text-white' : 'border-line'}`}>
        {on && <Check size={18} strokeWidth={3} />}
      </span>
    </button>
  )
}

export default function Welcome() {
  const { signIn } = useSession()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [worlds, setWorlds] = useState<World[]>([])
  const [goals, setGoals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const flip = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  const finish = async () => {
    setBusy(true)
    try {
      const u = await api.createUser(name || 'friend', worlds, goals)
      signIn(u.id)
      nav('/overview?new=1')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (step === 0) {
    return (
      <div className="flex min-h-[88dvh] flex-col justify-center gap-6 text-center">
        <div className="mx-auto"><Blob mood="happy" size={120} label="Blob, the Articulate Me mascot, waving" /></div>
        <h1 className="text-4xl font-black leading-tight">Articulate Me</h1>
        <p className="label -mt-3 text-talk">Hi, I'm Blob. I'll be your speaking coach.</p>
        <p className="text-lg text-muted">
          Everyone says “get to the point.” Nobody teaches how. Learn one real technique from a public speaking
          textbook, then practice it in a short conversation and see if you actually used it.
        </p>
        <label className="text-left font-extrabold">
          What should we call you?
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your first name"
            autoComplete="given-name"
            className="mt-2 w-full rounded-2xl border-2 border-line bg-white px-4 py-4 text-lg font-bold outline-none focus:border-coral" />
        </label>
        <button className="btn-primary" onClick={() => setStep(1)}>Get started</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Steps n={step} />
      {step === 1 && (
        <>
          <BlobSays mood="excited" size={56}>Nice to meet you{name ? `, ${name}` : ''}! Tell me where you talk, and I'll build your lessons around it.</BlobSays>
          <h2 className="text-3xl font-black">Where do you need to talk?</h2>
          <p className="text-muted">Pick all that fit. Your examples and conversation partners come from these.</p>
          {(Object.keys(WORLD_LABELS) as World[]).map((w) => {
            const Icon = WORLD_ICONS[w]
            return (
              <Toggle key={w} on={worlds.includes(w)} onClick={() => setWorlds(flip(worlds, w))}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream text-coral"><Icon size={24} /></span>
                <span>
                  <span className="block text-lg font-extrabold">{WORLD_LABELS[w].label}</span>
                  <span className="text-sm text-muted">{WORLD_LABELS[w].blurb}</span>
                </span>
              </Toggle>
            )
          })}
          <button className="btn-primary mt-2" disabled={!worlds.length} onClick={() => setStep(2)}>
            Continue{worlds.length > 1 ? ` with ${worlds.length}` : ''}
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <BlobSays mood="calm" accessory="specs" size={56}>Got it. And what should we work on together{name ? `, ${name}` : ''}?</BlobSays>
          <h2 className="text-3xl font-black">What do you want to get better at?</h2>
          <p className="text-muted">Pick as many as you like.</p>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <Toggle key={g} on={goals.includes(g)} onClick={() => setGoals(flip(goals, g))}>
                <span className="text-lg font-extrabold">{g}</span>
              </Toggle>
            ))}
          </div>
          {error && <p className="font-bold text-coral-dark">{error}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" disabled={busy} onClick={finish}>{busy ? 'Building your course…' : 'See my course'}</button>
          </div>
        </>
      )}
    </div>
  )
}
