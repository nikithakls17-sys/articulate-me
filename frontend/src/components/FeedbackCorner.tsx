import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, FEEDBACK_OPTIONS, type FeedbackForm } from '../api'
import { useSession } from '../session'

type Multi = 'liked' | 'off' | 'who'
type Single = 'retry_help' | 'come_back' | 'pay' | 'fair_price'

const tap = (on: boolean) =>
  `label border-2 border-ink px-3 py-2 text-left normal-case tracking-normal text-[0.95rem] ${on ? 'bg-ink text-white' : 'bg-white'}`

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-bold"><span className="label mr-1.5 text-muted">{n}.</span>{title}{hint && <span className="label ml-1.5 text-muted">{hint}</span>}</legend>
      {children}
    </fieldset>
  )
}

/** Feedback corner: a short, optional card after a chapter or a conversation, and on /feedback. Anonymous, mostly taps. */
export default function FeedbackCorner({ context, day, onClose }:
  { context: FeedbackForm['context']; day?: number | null; onClose?: () => void }) {
  const { user } = useSession()
  const [f, setF] = useState<FeedbackForm>({
    context, day, rating: null, design: null, liked: [], off: [], who: [],
    retry_help: null, come_back: null, pay: null, fair_price: null, improve: '',
  })
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const empty = f.rating === null && f.design === null && !f.liked.length && !f.off.length && !f.who.length
    && !f.retry_help && !f.come_back && !f.pay && !f.improve.trim()

  const toggle = (k: Multi, id: string) => setF((p) => {
    const cur = p[k] as string[]
    let next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    // "Nothing" felt off excludes the rest, and the other way round
    if (k === 'off') next = id === 'nothing' && !cur.includes(id) ? ['nothing'] : next.filter((x) => id === 'nothing' || x !== 'nothing')
    return { ...p, [k]: next }
  })
  const pick = (k: Single, id: string) => setF((p) => ({ ...p, [k]: p[k] === id ? null : id }))

  const multi = (k: Multi) => (
    <div className="flex flex-wrap gap-2">
      {FEEDBACK_OPTIONS[k].map(([id, label]) => {
        const on = (f[k] as string[]).includes(id)
        return <button key={id} type="button" aria-pressed={on} onClick={() => toggle(k, id)} className={tap(on)}>{label}</button>
      })}
    </div>
  )
  const single = (k: Single, aria: string) => (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={aria}>
      {FEEDBACK_OPTIONS[k].map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={f[k] === id} onClick={() => pick(k, id)} className={`${tap(f[k] === id)} min-w-[4.5rem] text-center`}>{label}</button>
      ))}
    </div>
  )
  const scale = (k: 'rating' | 'design', aria: string, low: string, high: string) => (
    <>
      <div className="grid grid-cols-5 border-2 border-ink" role="radiogroup" aria-label={aria}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={f[k] === n} aria-label={`${n} of 5`}
            onClick={() => setF((p) => ({ ...p, [k]: p[k] === n ? null : n }))}
            className={`label py-2.5 text-base ${n > 1 ? 'border-l-2 border-ink' : ''} ${f[k] === n ? 'bg-ink text-white' : 'bg-white'}`}>
            {n}
          </button>
        ))}
      </div>
      <p className="label flex justify-between text-muted"><span>{low}</span><span>{high}</span></p>
    </>
  )

  const submit = async () => {
    setState('sending'); setError('')
    try {
      await api.sendFeedback(user?.id, { ...f, fair_price: f.pay === 'maybe' || f.pay === 'no' ? f.fair_price : null })
      setState('sent')
    } catch (e) {
      setError((e as Error).message); setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <aside className="card flex items-center gap-3 bg-check-soft!" aria-live="polite">
        <Check className="shrink-0" size={22} strokeWidth={3} />
        <p className="flex-1">Thank you. That helps a lot.</p>
        {onClose && <button className="label underline" onClick={onClose}>Close</button>}
      </aside>
    )
  }

  return (
    <aside className="card flex flex-col gap-5 bg-check-soft!" aria-labelledby="fb-title">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
        <div>
          <p className="label">Feedback corner · optional · under a minute</p>
          <h2 id="fb-title" className="text-2xl font-bold">How was that?</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="border-2 border-ink bg-white p-1" aria-label="Skip feedback"><X size={18} /></button>
        )}
      </div>

      <Question n={1} title="How useful was this?">{scale('rating', 'Usefulness, 1 to 5', 'Not useful', 'Very useful')}</Question>
      <Question n={2} title="What did you like most?" hint="pick any">{multi('liked')}</Question>
      <Question n={3} title="What felt off?" hint="pick any">{multi('off')}</Question>
      <Question n={4} title="How do you like the design?">{scale('design', 'Design, 1 to 5', 'Not for me', 'Love it')}</Question>
      <Question n={5} title="Did the feedback help on your retry?">{single('retry_help', 'Did the feedback help on your retry')}</Question>
      <Question n={6} title="Would you come back tomorrow?">{single('come_back', 'Would you come back tomorrow')}</Question>
      <Question n={7} title="Would you pay $5/month?">
        {single('pay', 'Would you pay 5 dollars a month')}
        {(f.pay === 'maybe' || f.pay === 'no') && (
          <div className="mt-1 border-l-4 border-ink pl-3">
            <p className="mb-2 font-bold">What price feels fair?</p>
            {single('fair_price', 'What price feels fair')}
          </div>
        )}
      </Question>
      <Question n={8} title="Who should use this?" hint="pick any">{multi('who')}</Question>
      <label className="font-bold">
        <span className="label mr-1.5 text-muted">9.</span>One thing to improve <span className="label text-muted">optional</span>
        <input maxLength={300} value={f.improve} onChange={(e) => { const improve = e.target.value; setF((p) => ({ ...p, improve })) }} autoComplete="off"
          placeholder="Short is fine"
          className="mt-1 w-full border-2 border-ink bg-cream p-2 font-serif text-base font-normal text-ink outline-none focus:bg-white" />
      </label>

      <p className="text-sm italic text-muted">
        Stored anonymously: your answers, your world and lesson, and your before and after numbers. Never your name, your audio or what you said.
      </p>
      {error && <p className="label text-coral-dark" role="alert">{error}</p>}
      <button className="btn-primary" disabled={empty || state === 'sending'} onClick={submit}>
        {state === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </aside>
  )
}
