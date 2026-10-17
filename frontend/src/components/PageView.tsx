import { ArrowDown } from 'lucide-react'
import type { Citation, Page } from '../api'

function cite(c: Citation) {
  const book = c.book.replace(/\s*\(.*\)$/, '')
  return `${book}, “${c.chapter.replace(/^Chapter \d+:\s*/, '')},” p. ${c.page}.`
}

/** One printed textbook page: running head, body, figure captions, footnote citation, folio. */
export default function PageView({ page, chapter, chapterTitle, technique, pageNo, figureNo }:
  { page: Page; chapter: number; chapterTitle: string; technique: string; pageNo: number; figureNo: number }) {
  const even = pageNo % 2 === 0
  const c = 'cite' in page ? page.cite : null
  return (
    <div className="flex h-full flex-col px-6 pb-3 pt-4 sm:px-8">
      <header className={`running-head flex justify-between pb-1 ${even ? '' : 'flex-row-reverse'}`}>
        <span>Chapter {chapter}</span>
        <span className="truncate pl-3">{chapterTitle}</span>
      </header>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        <h2 className="text-[1.45rem] font-bold leading-tight">
          {page.title}{c && <sup className="ml-0.5 font-label text-xs text-coral">1</sup>}
        </h2>
        <div className="mt-3 text-[1.08rem] leading-relaxed">
          <Body page={page} chapter={chapter} technique={technique} figureNo={figureNo} />
        </div>
      </div>

      {c && (
        <p className="footnotes mt-3 pt-1.5">
          <sup className="font-label text-coral">1</sup>{' '}
          {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">{cite(c)}</a> : cite(c)}
          {' '}CC BY-NC-SA 4.0.
        </p>
      )}
      <footer className={`folio mt-2 flex ${even ? 'justify-start' : 'justify-end'}`}>{pageNo}</footer>
    </div>
  )
}

function Caption({ n, chapter, children }: { n: number; chapter: number; children: React.ReactNode }) {
  return <p className="figure-caption mt-2"><b>Figure {chapter}.{n}</b> &nbsp;{children}</p>
}

function Body({ page, chapter, technique, figureNo }: { page: Page; chapter: number; technique: string; figureNo: number }) {
  switch (page.kind) {
    case 'intro':
      return (
        <>
          <p className="drop-cap">{page.body}</p>
          <aside className="margin-note mt-5 pl-3">
            <p className="label text-coral">In this chapter</p>
            <p className="mt-1 font-semibold">{page.learn}</p>
          </aside>
        </>
      )
    case 'steps':
      return (
        <figure>
          <ol className="flex flex-col" aria-label={`${technique} steps`}>
            {page.steps.map((s, i) => (
              <li key={i} className="flex flex-col items-center">
                <div className="flex w-full items-stretch border-2 border-ink bg-white">
                  <span className="grid w-11 shrink-0 place-items-center border-r-2 border-ink bg-coral font-heading text-lg font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 px-3 py-2">
                    <p className="label">{s.label}</p>
                    <p className="text-[0.98rem] leading-snug">{s.text}</p>
                  </div>
                </div>
                {i < page.steps.length - 1 && <ArrowDown className="my-0.5" size={20} strokeWidth={2.5} aria-hidden />}
              </li>
            ))}
          </ol>
          <Caption n={figureNo} chapter={chapter}>The {technique} sequence, step by step.</Caption>
        </figure>
      )
    case 'terms':
      return (
        <dl className="flex flex-col gap-3">
          {page.terms.map((t) => (
            <div key={t.term} className="keyterm px-3 py-2">
              <dt className="label">Key term</dt>
              <dd>
                <span className="font-heading text-lg font-bold">{t.term}.</span>{' '}
                <span className="leading-snug">{t.meaning}</span>
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'table':
      return (
        <figure>
          <table className="w-full table-fixed border-2 border-ink bg-white text-left text-[0.95rem]">
            <thead className="bg-ink text-white">
              <tr>{page.columns.map((col) => <th key={col} className="label p-2 text-white">{col}</th>)}</tr>
            </thead>
            <tbody>
              {page.rows.map((r, i) => (
                <tr key={i} className="border-t-2 border-ink align-top">
                  {r.map((cell, j) => <td key={j} className={`p-2 leading-snug [overflow-wrap:anywhere] ${j === 0 ? 'font-semibold' : ''}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <Caption n={figureNo} chapter={chapter}>{page.title}.</Caption>
        </figure>
      )
    case 'before_after':
      return (
        <figure>
          {page.situation && <p className="italic text-muted">{page.situation}</p>}
          <div className="mt-3 grid gap-3">
            <div className="border-2 border-ink bg-orange-50 p-3">
              <p className="label text-coral-dark">Before</p>
              <p className="mt-1 italic">“{page.before}”</p>
            </div>
            <div className="border-2 border-ink bg-leaf-soft p-3 shadow-[4px_4px_0_var(--ink)]">
              <p className="label text-leaf">After</p>
              <p className="mt-1 italic">“{page.after}”</p>
            </div>
          </div>
          <Caption n={figureNo} chapter={chapter}>{page.why}</Caption>
        </figure>
      )
    case 'why':
      return <p className="drop-cap">{page.body}</p>
    case 'example':
      return (
        <figure>
          <blockquote className="border-l-4 border-coral pl-4 text-[1.15rem] italic leading-relaxed">{page.body}</blockquote>
          <Caption n={figureNo} chapter={chapter}>An example from your world.</Caption>
        </figure>
      )
  }
}
