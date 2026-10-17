import { BookOpen } from 'lucide-react'
import type { Citation } from '../api'

export default function CitationChip({ c }: { c: Citation }) {
  const short = c.book.split(':')[0].split(',')[0].replace(/\s*\(.*\)$/, '')
  const label = c.page ? `${short} · p.${c.page}` : `${short} · ${c.chapter}`
  const title = `${c.book}: ${c.chapter}${c.section ? ` / ${c.section}` : ''}`
  const inner = <><BookOpen size={14} aria-hidden /> <span className="truncate">{label}</span></>
  return c.url
    ? <a className="chip max-w-full" href={c.url} target="_blank" rel="noreferrer" title={title}>{inner}</a>
    : <span className="chip max-w-full" title={title}>{inner}</span>
}
