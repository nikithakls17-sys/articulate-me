# Build notes

Running log of decisions, bugs and fixes. Feeds the "How I Built It" section of the post.

## Decisions
- **Python 3.12 for the backend**, not the 3.14 default on the laptop: wheels for onnxruntime (fastembed) and ctranslate2 (faster-whisper) are safest on 3.12. Docker image uses python:3.12-slim too.
- **Local store fallback.** If `MONGODB_URI` is empty, users/attempts/lessons go to JSON files in `data/local_store/` and vector search is a numpy cosine over `data/chunks.jsonl`. Makes local mode truly offline and let me build before having Atlas keys. Hosted mode uses Atlas + Atlas Vector Search.

## Bugs hit
- **Gemma 4 returned empty content.** `gemma4:e4b` on Ollama thinks by default: 100/100 completion tokens went to `reasoning`, `content=''`, `finish_reason=length`. `extra_body={"think": False}` did nothing on the OpenAI-compatible endpoint; `{"reasoning_effort": "none"}` fixed it (12 tokens, 4.1 s vs 9.0 s and nothing). Only sent for the Ollama provider.
- **faster-whisper 1.1/1.2 vs PyAV 19:** `TypeError: open() got an unexpected keyword argument 'metadata_errors'`. PyAV 14 (which still had it) has no wheel here. Fix: decode audio ourselves with `av.AudioResampler(format="s16", layout="mono", rate=16000)` and pass faster-whisper a float32 numpy array (`stt._decode_16k_mono`). Bonus: one decoder for webm/opus (Chrome), mp4/aac (Safari) and wav.
- **`mkl_malloc: failed to allocate memory`** loading Whisper while Gemma (gemma4:e4b, ~5 GB resident) was loaded in Ollama on a 16 GB laptop with Chrome open (0.7 GB free). Whisper `base.en` int8 could not allocate; `tiny.en` fits. Local mode default stays `base.en`; set `WHISPER_MODEL=tiny.en` on tight machines.
- **Empty grades stored as an attempt.** Under the same memory pressure both Gemma passes came back unparseable, and the attempt was saved with every rubric item "unverified" and no feedback. Now: unparseable output is a Sentry issue (`llm: unparseable grading output`), and if no rubric grades come back at all the API returns 503 "try again" instead of saving a broken attempt.
- **numpy bool in JSON.** faster-whisper timestamps are numpy floats, so `duration > limit` became `numpy.bool_` and the JSON store crashed. Cast timestamps to `float` at the STT boundary.

## Things that worked first try
- **Verbatim fillers from Whisper.** A deliberately disfluent `initial_prompt` ("Umm, so, uh, I was like, you know…") keeps fillers in the transcript. Test clip: "Hi, um, I'm Nicky… So, basically, I build apps… and, uh, about 40 people tried it" → 4 fillers counted (um, so, basically, uh), 117 WPM, 2 pauses > 0.7 s (longest 1.08 s).
- **Filler heuristics.** "like"/"so" only count next to a comma; "you know" doesn't count before a clause. "I like dogs" and "You know what I did?" are correctly not fillers.
- **Pause markers.** The transcript sent to Gemma gets `[pause]` where silence > 0.7 s; the validator strips markers before matching, so a quote spanning a pause still verifies.

## Numbers (local, laptop CPU)
- Day 0 attempt end to end: 22.0 s (Whisper tiny.en 4.5 s + Gemma grading ~17 s, 410 in / 217 out tokens, 1 LLM call, 0 validator problems).

## Oct 17 evening: first real mic test, low-RAM fixes

- **"It didn't give me anything" was a frontend bug, not grading.** Both of Niki's recordings were transcribed and graded on the server (26.5 s and 59.6 s clips, score 100, 0 validator problems, 46.6 s and 25.4 s end to end on gemma4:e4b). Right after grading, the app refreshed the user's XP; the lesson screen depended on the user object, so it reloaded the Day 0 lesson and jumped back to the record screen, wiping the feedback. Fixed in the redesign (lesson only reloads when the day changes).
- **Disk full.** Pulling `gemma4:e2b` filled the last 3.3 GB of a 176 GB disk (partial download), which also broke the textbook embedding model download. Deleted the partial file. e2b can't fit on this laptop anyway.
- **Ingestion RAM.** `ingest_books.py` peaked at ~5 GB because fastembed embedded all 1,138 chunks in one go. Now `batch_size=16`.
- **Ingestion numbers:** Exploring Public Speaking 788 pages → 619 chunks (239.6 s); Stand up, Speak out 515 pages → 519 chunks (100.4 s). 1,138 chunks, 384-dim bge-small.

### Local model: gemma4:e4b → gemma3:1b (target: fits in ~2 GB)

| | gemma4:e4b | gemma3:1b |
|---|---|---|
| Disk | 6.6 GB | 806 MB |
| RAM while loaded | ~5 GB (free RAM fell 5.8 → 0.7 GB) | 944 MB (llama-server working set) |
| One-call JSON grading | works (Day 0 sample: 2/2 grounded quotes, 1 call, 17-28 s) | **fails**: echoes the template back (`"id": "<rubric id>"`), or no JSON at all on 2 of 3 runs |
| Stepwise grading (plain-text questions) | n/a | works: 6-8 calls, 11-21 s |
| Grading accuracy (3 hand cases) | strong / vague / partial all sensible | strong case right; **vague and partial over-scored** (said "I do a lot of things" shows who you are; "I work in a hospital" counted as a concrete detail) |

- **New `GRADER=stepwise` mode** for tiny models: one plain-text question per call ("YES, PARTLY or NO?", "copy the one sentence that shows it"), JSON assembled in code. Tiny models can't fill JSON templates but can answer one question.
- Feedback cleanup for 1b: strips "Okay, here are two sentences…:" preambles, markdown, `---` and follow-up questions ("Would you like me to…?"); keeps 2 sentences.
- **Decision:** local default is now `gemma3:1b` + stepwise (fits the RAM budget). Grading quality is noticeably worse, so hosted mode keeps a bigger Gemma with one-call JSON grading, and `OLLAMA_MODEL=gemma4:e4b GRADER=json` brings the better local grader back on a machine with ~6 GB free.

### Validator holes found by the tiny model
- **Paraphrased quotes passed.** `partial_ratio` (character-level, best substring) scored "I made a walking journal app for a hackathon *with about 40 people trying it*" ≥ 90 against "…*and, uh, about 40 people tried it*". Switched to **word-level** similarity against same-length windows of the transcript (fillers and apostrophes ignored). Now: paraphrase rejected, quote stitched from two sentences rejected, real quote with "uh" dropped accepted.
- **Chatty multi-line feedback passed** the 2-sentence rule because line breaks weren't sentence breaks. Newlines now split sentences, and markdown/"here are some options" chatter fails validation.
- **Gemma 4 emitted a raw control character inside a JSON string** (Day 1 chapter, `"meaning": ...` on line 28), so strict `json.loads` failed 3 retries in a row at the same spot ("Expecting ',' delimiter"). Fix: strip control characters other than newline/tab and parse with `strict=False`.
- **Chapter JSON "unparseable" was really truncation.** Same error 6 times ("Expecting ',' delimiter: line 40"). The raw output stopped after 375 tokens, mid-table, so "everything up to the last `}`" was cut mid-object. Cause: Ollama's default context is 4,096 tokens and 8 excerpts × ~400 tokens of textbook filled it. Fix: 6 excerpts capped at 200 words each, and `chat_json` now raises a clear "output truncated at N tokens" when `finish_reason == "length"` instead of a confusing parse error.

## Course chapters (Days 1-3), built with gemma4:e4b
- First build of Day 1 taught **speech conclusions**, not PREP: one long retrieval query matched only "conclusions" chunks, and the model followed the excerpts. Fix: each technique now has a short hand-written outline (the course's definition of the technique) plus 3-4 focused searches (e.g. "stating your main point first", "supporting a claim with reasons", "examples as supporting material", "restating the main idea"). The steps follow the outline; the excerpts explain and support it, with citations.
- Scenario openings came out **addressed to the partner** ("Sarah, you mentioned leadership skills…" when Sarah is the interviewer). Prompt now says the partner speaks to "you", and the builder rejects openings that start with the partner's own name.
- Build time per chapter on CPU: 322-347 s, ~3.4-3.9k input / ~1.6-1.7k output tokens across 3 calls (pages, quiz, worlds).
- Hand-review edits (`scripts/review_edits.py`, re-run after rebuilding): Day 1 comparison table was off-topic ("good vs bad sources: U.S. Department of Labor vs Wikipedia", 1 row) → replaced with a PREP step-by-step table; Day 1 partners were generic ("Professor", "Interviewer") → named; Day 3 customer-facing opening had the customer saying "I can see you're frustrated" → rewritten.

## First full spoken conversation (local, gemma3:1b, Whisper tiny.en)
- Day 1, job seeker, 3 spoken replies (Windows TTS clips). Turn latency 5.8 s / 3.4 s / 2.5 s (Whisper + partner reply); grading 27.3 s (14 small calls, 2.3k in / 220 out tokens). Metrics across the 3 turns: 144 WPM, 5.7 fillers/min (um, uh, like), 4 pauses > 0.7 s.
- Partner (Dana, interviewer) stayed in character and reacted to answers ("That's a really impressive ability to manage chaos… can you give me a specific example?").
- **Weakness:** 1B grading is generous: 100% even though reply 2 was "I'd, like, handle it by talking to people and stuff. It depends." Feedback is generic praise. The validator still hid one quote it couldn't find. Hosted mode (bigger Gemma, one-call JSON) is the demo path; local 1B is the privacy/cost path.

## Oct 18: textbook + brutalist redesign
- **Palette lives in `:root` CSS variables** (`--paper`, `--surface`, `--ink`, `--accent`, `--highlight`…) and Tailwind's colour names are mapped onto them with `@theme inline`, so the existing pages restyled without touching every class, and a new palette is a 15-line swap. Placeholder palette until Niki's reference images arrive.
- **Brutalism via tokens:** every `rounded-*` radius token set to 0 (circles like the mic stay round), `--color-line` (all borders) is now ink, cards/buttons get 2-3 px black borders and hard 4 px offset shadows with no blur; a 24 px graph-paper grid on the page background.
- **Type:** EB Garamond body, Libre Baskerville headings, IBM Plex Mono for UI labels. Trick: every `.uppercase` label in the app is set in the mono face by one CSS rule, instead of editing ~60 class lists.
- **Flipbook, rebuilt in React (no HAML/CodePen assets):** each leaf is a `preserve-3d` div with a front and back face (`backface-visibility: hidden`) rotating `rotateY(-180deg)` on the spine. Laptop spread: leaf k = page 2k (front, right) / page 2k+1 (back, left after the turn), with a static chapter plate under the left side and an "end of chapter" plate under the last leaf. Phone: one page per leaf, the back is lined paper and the leaf fades out once turned. z-index: turned leaves stack in turn order, unturned in reverse, and the leaf in motion rides on top for 800 ms. Flip by page corner, arrows, swipe (ignored while text is selected so highlighting still works) or arrow keys. `prefers-reduced-motion` renders a plain cross-fade instead.
- **Textbook furniture:** running heads (chapter / title, mirrored on even pages), folios, drop caps, "Figure 1.1"-style captions on diagrams/tables/before-after, yellow key-term boxes, a margin note on the intro page, and the RAG citation as a footnote (superscript 1 + "Exploring Public Speaking, 4th ed., 'Developing Topics…', p. 166. CC BY-NC-SA 4.0.").
- **Layouts:** ≥1024 px top nav + open-book spread + a 340 px sticky study panel (Notes/Targets/Timer); 768-1023 px top nav + single large page + collapsible study drawer; <768 px single page + bottom tab bar (Course, Textbook, Practice, Study, Progress). Lists become two-column grids from 768 px. Checked at 375, 768 and 1440 px with an iframe harness.
- Bug caught in the 768 px check: brand name and the "0:53 / 15:00" timer wrapped to two lines in the top bar. Brand hides between 768 and 1023 px; labels are `nowrap`.
