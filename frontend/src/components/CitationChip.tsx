import type { Citation } from '../api'

export default function CitationChip({ c }: { c: Citation }) {
  const short = c.book.split(':')[0].split(',')[0]
  const label = `📖 ${short} · ${c.chapter.replace(/^Chapter\s*/i, 'Ch. ')} · p.${c.page}`
  return c.url
    ? <a className="chip" href={c.url} target="_blank" rel="noreferrer" title={`${c.book} — ${c.chapter}${c.section ? ` / ${c.section}` : ''}`}>{label}</a>
    : <span className="chip">{label}</span>
}
