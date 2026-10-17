import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { fetchSpeech, speak, stopSpeaking } from './voice'

export type ReadStatus = 'idle' | 'loading' | 'reading'

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/** Read the visible textbook page(s) aloud, sentence by sentence.
 *  - Every readable bit of text is a `[data-say]` element (PageView splits paragraphs into sentences).
 *  - Click a sentence to put the reading cursor there; Start reads from the cursor.
 *  - The sentence being read gets the `.reading` highlight; the next one is fetched while this one plays.
 *  - At the end of the visible page(s) it turns the page (via `nextPage`) and keeps going. */
export function useReadAloud(container: RefObject<HTMLElement | null>, nextPage: () => boolean, voice = 'narrator') {
  const [status, setStatus] = useState<ReadStatus>('idle')
  const [cursor, setCursorState] = useState<string | null>(null)
  const run = useRef(0)
  const cursorRef = useRef<string | null>(null)
  const nextRef = useRef(nextPage)
  nextRef.current = nextPage

  const collect = useCallback(
    () => Array.from(container.current?.querySelectorAll<HTMLElement>('[data-page-visible="true"] [data-say]') ?? [])
      .filter((el) => el.textContent?.trim()),
    [container],
  )

  const mark = (cls: string, id: string | null) => {
    container.current?.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls))
    if (id) container.current?.querySelector(`[data-say-id="${id}"]`)?.classList.add(cls)
  }

  const setCursor = useCallback((id: string | null) => {
    cursorRef.current = id
    setCursorState(id)
    mark('read-cursor', id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    run.current++
    stopSpeaking()
    setStatus('idle')
    mark('reading', null)
    mark('read-cursor', cursorRef.current) // stopping leaves the cursor where you were, so Start resumes there
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    const token = ++run.current
    let els = collect()
    let i = Math.max(0, els.findIndex((e) => e.dataset.sayId === cursorRef.current))
    setStatus('loading')
    while (token === run.current) {
      if (i >= els.length) {
        if (!nextRef.current()) break // last page: done
        await sleep(950) // let the page turn and render
        if (token !== run.current) return
        els = collect()
        i = 0
        continue
      }
      const el = els[i]
      const id = el.dataset.sayId ?? null
      cursorRef.current = id
      setCursorState(id)
      mark('read-cursor', null)
      mark('reading', id)
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      const next = els[i + 1]
      if (next?.textContent) fetchSpeech(next.textContent.trim(), voice) // prefetch while this one plays
      const p = speak(el.textContent!.trim(), voice)
      setStatus('reading')
      await p
      i++
    }
    if (token === run.current) {
      setStatus('idle')
      mark('reading', null)
      setCursor(null)
    }
  }, [collect, voice, setCursor])

  useEffect(() => () => { run.current++; stopSpeaking() }, [])

  return { status, cursor, setCursor, start, stop }
}
