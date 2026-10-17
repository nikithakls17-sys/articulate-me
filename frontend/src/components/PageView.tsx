import { ArrowDown, Quote, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Page } from '../api'
import CitationChip from './CitationChip'

/** One textbook page. Every kind is visual first: a flow diagram, a table, a before/after, a term list. */
export default function PageView({ page, technique }: { page: Page; technique: string }) {
  return (
    <article className="flex flex-col gap-4">
      <h2 className="text-2xl font-black leading-tight">{page.title}</h2>
      <Body page={page} technique={technique} />
      {'cite' in page && page.cite && <div><CitationChip c={page.cite} /></div>}
    </article>
  )
}

function Body({ page, technique }: { page: Page; technique: string }) {
  switch (page.kind) {
    case 'intro':
      return (
        <>
          <p className="text-lg leading-relaxed">{page.body}</p>
          <div className="rounded-2xl bg-sky/10 p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-sky">In this chapter</p>
            <p className="mt-1 text-lg font-bold">{page.learn}</p>
          </div>
        </>
      )
    case 'steps':
      return (
        <ol className="flex flex-col items-stretch" aria-label={`${technique} steps`}>
          {page.steps.map((s, i) => (
            <li key={i} className="flex flex-col items-center">
              <div className="flex w-full items-stretch overflow-hidden rounded-2xl border-2 border-sky/40 bg-white">
                <span className="grid w-12 shrink-0 place-items-center bg-sky text-lg font-black text-white">{i + 1}</span>
                <div className="min-w-0 p-3">
                  <p className="font-black">{s.label}</p>
                  <p className="text-sm leading-snug text-muted">{s.text}</p>
                </div>
              </div>
              {i < page.steps.length - 1 && <ArrowDown className="my-1 text-sky" size={22} aria-hidden />}
            </li>
          ))}
        </ol>
      )
    case 'terms':
      return (
        <dl className="flex flex-col gap-2">
          {page.terms.map((t) => (
            <div key={t.term} className="rounded-2xl border-2 border-line bg-white p-3">
              <dt className="font-black text-coral-dark">{t.term}</dt>
              <dd className="text-sm leading-snug">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      )
    case 'table':
      return (
        <div className="overflow-hidden rounded-2xl border-2 border-line bg-white">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-cream">
              <tr>{page.columns.map((c) => <th key={c} className="p-2.5 font-black">{c}</th>)}</tr>
            </thead>
            <tbody>
              {page.rows.map((r, i) => (
                <tr key={i} className="border-t border-line align-top">
                  {r.map((cell, j) => <td key={j} className="p-2.5 leading-snug [overflow-wrap:anywhere]">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'before_after':
      return (
        <>
          {page.situation && <p className="font-bold text-muted">{page.situation}</p>}
          <div className="rounded-2xl border-2 border-coral/30 bg-orange-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-coral-dark"><ThumbsDown size={14} /> Before</p>
            <p className="mt-1 text-lg italic">“{page.before}”</p>
          </div>
          <div className="rounded-2xl border-2 border-leaf/40 bg-leaf-soft p-4">
            <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-leaf"><ThumbsUp size={14} /> After</p>
            <p className="mt-1 text-lg italic">“{page.after}”</p>
          </div>
          {page.why && <p className="text-muted">{page.why}</p>}
        </>
      )
    case 'why':
      return <p className="text-lg leading-relaxed">{page.body}</p>
    case 'example':
      return (
        <div className="relative rounded-3xl bg-leaf-soft p-5">
          <Quote className="text-leaf" size={28} aria-hidden />
          <p className="mt-2 text-lg italic leading-relaxed">{page.body}</p>
        </div>
      )
  }
}
