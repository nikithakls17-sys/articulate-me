import { useId, type ReactNode } from 'react'

export type Mood = 'happy' | 'calm' | 'excited' | 'proud' | 'thinking' | 'sleepy' | 'nervous' | 'listening'
export type Accessory = 'none' | 'specs' | 'cap' | 'coffee' | 'nightcap' | 'headphones' | 'mic'

/** Mood → colour. Same colour coding as the rest of the app. */
const MOOD_COLOR: Record<Mood, [string, string]> = {
  happy: ['var(--check)', 'var(--timer)'],
  calm: ['var(--read-soft)', 'var(--read)'],
  excited: ['var(--talk-soft)', 'var(--talk)'],
  proud: ['var(--good-soft)', 'var(--good)'],
  thinking: ['var(--notes-soft)', 'var(--notes)'],
  sleepy: ['#e3dcf3', '#8f7cc8'],
  nervous: ['var(--timer-soft)', 'var(--timer)'],
  listening: ['var(--target-soft)', 'var(--target)'],
}

function Eyes({ mood }: { mood: Mood }) {
  const s = { stroke: 'var(--blob-face)', strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' }
  switch (mood) {
    case 'happy':
    case 'excited':
      return <><path d="M38 50q4-6 8 0" {...s} /><path d="M56 50q4-6 8 0" {...s} /></>
    case 'proud':
      return <><path d="M37 48q5 6 10 0" {...s} /><path d="M55 48q5 6 10 0" {...s} /></>
    case 'sleepy':
      return <><path d="M37 51h9" {...s} /><path d="M56 51h9" {...s} /></>
    case 'thinking':
      return <><circle cx="44" cy="46" r="3.2" fill="var(--blob-face)" /><circle cx="62" cy="46" r="3.2" fill="var(--blob-face)" /></>
    case 'nervous':
      return <><circle cx="42" cy="50" r="4.2" fill="var(--surface)" stroke="var(--blob-face)" strokeWidth="2" /><circle cx="42" cy="51" r="1.8" fill="var(--blob-face)" />
        <circle cx="60" cy="50" r="4.2" fill="var(--surface)" stroke="var(--blob-face)" strokeWidth="2" /><circle cx="60" cy="51" r="1.8" fill="var(--blob-face)" /></>
    case 'listening':
      return <><circle cx="42" cy="50" r="3.4" fill="var(--blob-face)" /><circle cx="60" cy="50" r="3.4" fill="var(--blob-face)" /><circle cx="43" cy="49" r="1" fill="var(--surface)" /><circle cx="61" cy="49" r="1" fill="var(--surface)" /></>
    default:
      return <><circle cx="42" cy="50" r="3.2" fill="var(--blob-face)" /><circle cx="60" cy="50" r="3.2" fill="var(--blob-face)" /></>
  }
}

function Limbs({ mood, accessory }: { mood: Mood; accessory: Accessory }) {
  const s = { stroke: 'var(--ink)', strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' }
  const wave = mood === 'happy' || mood === 'excited' || mood === 'proud'
  return (
    <g>
      {/* legs + feet */}
      <path d="M44 80l-3 13h-5" {...s} />
      <path d="M58 80l3 13h5" {...s} />
      {/* left arm */}
      {mood === 'thinking' ? <path d="M27 62l-6 -4l9 -10" {...s} />
        : mood === 'nervous' ? <path d="M27 64l-8 4l6 6" {...s} />
        : <path d="M27 62l-10 8" {...s} />}
      {/* right arm */}
      {accessory === 'coffee' ? <path d="M75 62l9 3l2-6" {...s} />
        : accessory === 'mic' ? <path d="M75 60l9 -4l3 3" {...s} />
        : wave ? <path d="M75 60l9 -10l3 -7" {...s} />
        : mood === 'thinking' ? <path d="M75 60l8 -6" {...s} />
        : <path d="M75 62l10 8" {...s} />}
    </g>
  )
}

function Accessories({ accessory }: { accessory: Accessory }) {
  const s = { stroke: 'var(--ink)', strokeWidth: 2.4, fill: 'none' }
  switch (accessory) {
    case 'specs':
      return <g {...s} stroke="var(--blob-face)"><rect x="34" y="44" width="15" height="12" /><rect x="53" y="44" width="15" height="12" /><path d="M49 49h4M34 48l-6-2M68 48l6-2" /></g>
    case 'cap':
      return <g><path d="M30 26l21-9 21 9-21 9z" fill="var(--blob-face)" /><path d="M38 29v7q13 6 26 0v-7" fill="var(--blob-face)" /><path d="M72 26v10" {...s} /><rect x="70" y="35" width="4" height="5" fill="var(--check)" /></g>
    case 'coffee':
      return <g><rect x="82" y="56" width="11" height="12" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.2" /><path d="M93 59h3v6h-3" {...s} strokeWidth={2} />
        <path d="M85 52q2-3 0-6M90 52q2-3 0-6" stroke="var(--ink-soft)" strokeWidth="1.6" fill="none" strokeLinecap="round" /></g>
    case 'nightcap':
      return <g><path d="M33 30q18-22 40 0q-4 4-40 0" fill="var(--read)" stroke="var(--ink)" strokeWidth="2.2" /><path d="M66 22q12-4 16 8" stroke="var(--ink)" strokeWidth="2.2" fill="none" /><circle cx="83" cy="32" r="4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
        <text x="80" y="18" fontFamily="var(--font-label)" fontSize="10" fontWeight="700" fill="var(--ink)">z</text><text x="88" y="10" fontFamily="var(--font-label)" fontSize="8" fontWeight="700" fill="var(--ink)">z</text></g>
    case 'mic':
      return <g><path d="M86 52l5 9" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" /><circle cx="85" cy="49" r="4.5" fill="var(--ink-soft)" stroke="var(--ink)" strokeWidth="2" /></g>
    case 'headphones':
      return <g><path d="M26 50q0-30 25-30t25 30" {...s} strokeWidth={3} /><rect x="20" y="46" width="9" height="14" fill="var(--ink)" /><rect x="73" y="46" width="9" height="14" fill="var(--ink)" /></g>
    default:
      return null
  }
}

export type BlobId = 'clara' | 'sage' | 'sunny' | 'rio' | 'lull' | 'echo' | 'ember' | 'kiki'
export interface BlobCharacter { id: BlobId; name: string; skill: string; mood: Mood; accessory: Accessory; line: string; teaches: string }

/** The Blob squad: one colour = one speaking skill, and each Blob teaches the chapters on its skill. */
export const SQUAD: BlobCharacter[] = [
  { id: 'clara', name: 'Clara', skill: 'Clarity', mood: 'calm', accessory: 'specs', teaches: 'Get to the point (PREP)',
    line: 'Gets to the point, kindly. Will gently ask “so, what’s your answer?”' },
  { id: 'sage', name: 'Sage', skill: 'Structure', mood: 'proud', accessory: 'cap', teaches: 'Three reasons · Signposts',
    line: 'Loves a list of three and a clear “first, next, finally”.' },
  { id: 'sunny', name: 'Sunny', skill: 'Confidence', mood: 'happy', accessory: 'none', teaches: 'Open strong',
    line: 'Opens strong, and believes in you before you do.' },
  { id: 'rio', name: 'Rio', skill: 'Voice & energy', mood: 'excited', accessory: 'mic', teaches: 'Your baseline',
    line: 'Turns the volume up on stories. Wants to hear how you really sound.' },
  { id: 'lull', name: 'Lull', skill: 'Pace & pauses', mood: 'sleepy', accessory: 'nightcap', teaches: 'The pause',
    line: 'Never rushes. Knows a quiet second beats an “um”.' },
  { id: 'echo', name: 'Echo', skill: 'Listening & audience', mood: 'listening', accessory: 'headphones', teaches: 'Know your audience',
    line: 'Notices who is in the room and what they need to hear.' },
  { id: 'ember', name: 'Ember', skill: 'Nerves & tough questions', mood: 'nervous', accessory: 'none', teaches: 'Tough questions',
    line: 'Gets nervous too. Then acknowledges, bridges, answers.' },
  { id: 'kiki', name: 'Kiki', skill: 'Curiosity & small talk', mood: 'thinking', accessory: 'none', teaches: 'How small talk works here',
    line: 'Always has one more question for you. New in town too.' },
]
export const BLOB_BY_ID = Object.fromEntries(SQUAD.map((b) => [b.id, b])) as Record<BlobId, BlobCharacter>
const TECHNIQUE_BLOB: Record<string, BlobId> = {
  Baseline: 'rio', PREP: 'clara', 'Rule of three': 'sage', 'Open strong': 'sunny', Signposting: 'sage',
  'The deliberate pause': 'lull', 'Know your audience': 'echo', 'Handling a tough question': 'ember', 'Small talk': 'kiki',
}
export const blobFor = (technique: string): BlobCharacter => BLOB_BY_ID[TECHNIQUE_BLOB[technique] ?? 'sunny']

/** Blob, the Articulate Me mascot: a small fuzzy orb with eyes, stick limbs and a mood colour. */
export default function Blob({ who, mood, accessory, size = 64, className = '', label }:
  { who?: BlobId; mood?: Mood; accessory?: Accessory; size?: number; className?: string; label?: string }) {
  const id = useId().replace(/:/g, '')
  const c = who ? BLOB_BY_ID[who] : null
  // a named Blob keeps its colour (its skill); the mood only changes the expression
  const [light, deep] = MOOD_COLOR[c?.mood ?? mood ?? 'happy']
  mood = mood ?? c?.mood ?? 'happy'
  accessory = accessory ?? c?.accessory ?? 'none'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`blob ${className}`} role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={`g${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={deep} />
        </radialGradient>
        {/* fuzz: displace the edge with noise, then speckle the fill with grain */}
        <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" result="fuzzy" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="8" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" result="grainA" />
          <feComposite in="grainA" in2="fuzzy" operator="in" result="grainIn" />
          <feMerge><feMergeNode in="fuzzy" /><feMergeNode in="grainIn" /></feMerge>
        </filter>
      </defs>
      <Limbs mood={mood} accessory={accessory} />
      <g className="blob-body">
        <ellipse cx="51" cy="56" rx="25" ry="25" fill={`url(#g${id})`} filter={`url(#f${id})`} />
        <Eyes mood={mood} />
        <Accessories accessory={accessory} />
      </g>
    </svg>
  )
}

/** Blob with a speech bubble: the friendly-teacher voice of the app. */
export function BlobSays({ who, mood, accessory, children, size = 64, align = 'left' }:
  { who?: BlobId; mood?: Mood; accessory?: Accessory; children: ReactNode; size?: number; align?: 'left' | 'right' }) {
  return (
    <div className={`flex items-end gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <Blob who={who} mood={mood} accessory={accessory} size={size} className="shrink-0" label={who ? BLOB_BY_ID[who].name : undefined} />
      <div className="relative mb-3 border-2 border-ink bg-white px-3 py-2 text-[1.02rem] leading-snug shadow-[3px_3px_0_var(--ink)]">
        {children}
      </div>
    </div>
  )
}

/** Time-of-day accessory: coffee in the morning, nightcap late at night. */
export function timeAccessory(): Accessory {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'coffee'
  if (h >= 22 || h < 5) return 'nightcap'
  return 'none'
}

export function greeting(name: string) {
  const h = new Date().getHours()
  const part = h >= 5 && h < 12 ? 'Morning' : h < 17 ? 'Hey' : h < 22 ? 'Evening' : 'Still up'
  return `${part}, ${name}`
}
