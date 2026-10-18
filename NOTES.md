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

## Oct 18: Niki's reference images → palette, colour coding, Blob
- References: brutalist posters (structure) + grainy risograph orbs / gradient blurs / speech-bubble poster on warm light grey (colour). Kept brutalist structure (black borders, hard shadows, square corners, grid); swapped the loud placeholder palette for soft pastels with grain.
- **Colour coding, one meaning per colour:** blue = reading/textbook, coral = talking/practice (and the primary action), yellow = quick checks/key terms, green = done/used it, pink = notes, orange = study timer, teal = targets/badges. Each has a soft fill and a stronger edge in `:root`.
- **Background:** warm light-grey paper, faint grid, four large blurred orbs (blue, coral, orange, green) on a fixed layer, plus an SVG `feTurbulence` film-grain overlay. No images.
- **Blob, the mascot:** an SVG orb whose edge is roughed up with `feTurbulence` + `feDisplacementMap` (fuzz) and speckled with a second noise layer (grain), filled with a radial gradient in its mood colour. Eyes only (arcs, dots, closed lines) carry the expression; stick arms/legs change pose by mood; accessories: specs, grad cap, coffee, nightcap with z's, headphones. 8 moods. Blob gently bobs (off with reduced motion). `/blobs` shows the whole cast.
- **Teacher voice with the learner's name:** Blob appears on welcome ("Hi, I'm Blob"), onboarding ("Nice to meet you, Niki!"), overview ("Niki, here's the plan I put together for you"), the course card (time-of-day accessory: coffee in the morning, nightcap after 10 pm, "Still up, Niki"), chapter cover and end page ("Nice reading, Niki."), the quick check, the conversation intro ("You've got this, Niki. Try PREP on Dana."), grading (thinking Blob), feedback (mood by score), empty notes (sleepy Blob), timer and progress.

## Voice: before / after (item 5)
| | Before | After (local) | After (hosted) |
|---|---|---|---|
| Engine | browser `speechSynthesis` | **Kokoro 82M** (kokoro-onnx, int8 ONNX, Apache-2.0) | **ElevenLabs `eleven_v4`** ("most emotive" model) |
| Personas | one OS voice for everyone | voice + speed per persona (`am_michael` 0.94× strict interviewer, `am_adam` 1.08× upset customer, `af_bella` friendly classmate, `bf_emma` curious professor…) | own voice per persona + an audio tag for mood: `[calm, serious, a little skeptical]`, `[frustrated sigh]`, `[warm, cheerful]`, `[curious]`, `[excited]` |
| Emotion | none | approximated by voice choice + speed (Kokoro has no emotion tags) | audio tags; falls back to `eleven_flash_v2_5` (no tags) if v4 is refused |
| Cost / privacy | free, local | free, local, 115 MB of model files | per character; text goes to ElevenLabs |
| Measured | instant, robotic, varies by OS/browser | +325 MB RAM; first line 12.2 s (model load, now warmed at startup), then 2.6-3.3 s for a 3-4 s line (real-time factor 0.78-0.85) | not measured yet (no API key) |

- Persona is chosen from the partner's role text (`voices.persona_for`): "Hiring Manager" → strict, "frustrated customer on their third call" → upset, "someone you just met at a party" → friendly, "Course Professor" → curious. Returned with the conversation and passed to `/api/tts`.
- ElevenLabs docs checked Oct 18: `eleven_v4` = most emotive; `eleven_v4_turbo` = expressive real-time (~100 ms), not confirmed on the plain TTS endpoint; `eleven_flash_v2_5` ~75 ms. Audio tags go in square brackets before the line; speed 0.7-1.2. Voice ids are ElevenLabs default-library voices, overridable with `ELEVENLABS_VOICES` JSON.
- Installing kokoro-onnx upgraded onnxruntime to 1.31 (pip warns fastembed wants <1.20); checked fastembed still embeds (384-dim) fine.

## "New here" track (item 6)
- New world for international students, immigrants and anyone who just moved. Onboarding asks the country (US, UK, Canada, Australia) and the setting (campus, workplace, neighbourhood, social events). Shows as its own track on the Course, Textbook and Practice pages.
- **Chapter "How small talk works here"** (day 101): pages written by gemma4:e4b from the Wikipedia article *Small talk* (rev 1365180312, CC BY-SA 4.0, cited by revision URL), with tone rules in the prompt ("many people here", never "Americans always"; no generalisations about genders or nationalities; the learner's culture is different, not worse). The article itself contains gender generalisations; the prompt told the model to leave them out and the output did. Built in 160 s.
- **Expressions table per country, straight from Wiktionary** (no LLM in between): 5 expressions × 4 countries, all 20 found. A sense hint picks the everyday sense ("what's up" → greeting, not "what's the matter?"). Hand trims for long or awkward senses (`review_edits.py`). The lesson endpoint swaps in the learner's country table and the example/scenario for their setting.
- **Partner** gets "You live in {country}… use one or two everyday local expressions naturally" + the tone rules, and a local accent persona (ElevenLabs: British George, Australian Charlie; Kokoro: `bm_george` for UK).
- **"Explain that"** under every partner line: (1) known local expressions matched in code, (2) phrases the model flags, kept only if 1-4 words, really in the line, and Wiktionary has an entry that's multi-word or marked informal/regional, (3) otherwise a plain-English rewording. Only the expression is sent to Wiktionary. Cached.
- Bugs found testing "Explain that" on gemma3:1b: it returned whole sentences as "slang" and the Wiktionary lookup for "wow" returned "ISO 639-3 language code for Wawonii". Fixed by the filters above and by skipping dictionary senses that are language codes, abbreviations or names. Wikimedia also returned 403 to a User-Agent without a contact URL (their bot policy); the UA now points to the GitHub repo.
- Recurring tooling bug: writing `\b` through shell heredocs turned it into a literal backspace character (0x08) in Python files three times; the regex silently never matched. Now checked with a scan for `chr(8)`.

## Study tabs + hourglass (item 4)
- Built together with the responsive layout: Notes (highlights grouped by chapter, with your own note), Targets (today's study goal, lessons left, targets, next badges) and Timer (goal 10/15/20/30 min, default 15). Time counts only while the tab is visible and you've interacted in the last 2 minutes; stored per day in localStorage.
- SVG hourglass in the top bar: sand drains from the top bulb into the bottom one as today's time approaches the goal, with "12:30 / 15:00" next to it. Tap: laptop switches the side panel to Timer; tablet opens the drawer on Timer; phone opens the Study tab.

## Oct 18: "voice is good but not working properly" → read-aloud rebuilt
Three bugs found from the server log + code:
1. **Overlapping/late audio.** `speak()` fetched the audio, then played it even if Stop (or a newer line) had happened while it was being generated. Fix: a generation counter; `stopSpeaking()` bumps it and stale audio is dropped.
2. **Random 502s.** Kokoro's phonemizer (espeak) isn't thread-safe; two requests at once (prefetch + current) crashed one. Fix: a lock around Kokoro synthesis. Test: 3 simultaneous requests → 200/200/200.
3. **One failure = robotic voice for the rest of the session.** Any non-OK reply flipped a global "no TTS" flag. Now only a 404 ("no voice in this mode") does; a failed line just falls back for that line.
Also: whole pages were sent as one request (long silent wait, and cut at 600 characters).

New read-aloud (`reading.ts`): every sentence / step / key term / table cell on a page is a `[data-say]` unit. Start reading → reads the visible page(s) sentence by sentence, highlights the current sentence, prefetches the next one while the current one plays (audio cached per sentence), turns the page by itself and stops at the end of the chapter. Tap any sentence to put the reading cursor there (blue bar); Start reads from the cursor, and tapping while reading jumps there. Stop leaves the cursor where you were, so Start resumes. Volume slider (remembered) applies to Kokoro/ElevenLabs audio and the browser voice. Per-sentence latency with Kokoro: 1.0-2.1 s for the first sentence, then near-continuous thanks to prefetch.
- **Timer is manual now** (Niki: "just cuz the page is open doesn't mean I am reading"). Start / Pause in the top-bar hourglass and in the Timer tab, plus Reset. Stored as `banked seconds + startedAt` timestamps instead of 1-second ticks, so it stays correct across reloads, background tabs and a sleeping laptop. Blob sleeps (nightcap) while the timer is paused, has coffee while it runs.
- **Dark mode:** follows the system until the learner presses the moon/sun toggle (top bar and onboarding), then remembers it; applied before React renders so there's no flash. Same colour coding with darker soft fills, light ink for borders and hard shadows (still brutalist), grain switches to `screen` blending, key-term boxes use the soft yellow, and Blob's eyes/specs/cap use a fixed dark `--blob-face` so they read on the coloured body in both themes.
- **The Blob squad:** each colour is a speaking skill with a named Blob: Clara (blue, clarity, specs), Sage (green, structure, grad cap), Sunny (yellow, confidence), Rio (coral, voice & energy, mic), Lull (lavender, pace & pauses, nightcap), Echo (teal, listening & audience, headphones), Ember (orange, nerves & tough questions), Kiki (pink, curiosity & small talk). Each chapter is "taught by" the Blob for its skill: shown on the chapter cover, the course cards, the next-step card and the conversation intro. A named Blob keeps its colour; its mood only changes the eyes.
- **About page** (`/about`, in the top nav on tablet/laptop, linked from Progress and the welcome screen): what the app is, read/talk/grow, the squad with names, skills and what they teach, and the open tools/sources.
- **Dark mode v2 (Niki: near-black strained her eyes):** switched to warm mid-greys in layers like the light theme: page #3a3835, deep #44423e, cards/pages #4a4844, text #ece7df (not pure white); soft fills lifted to match, grain uses soft-light.

## Eval set (Oct 18)
- 20 hand-written samples in `eval/samples/` (Days 1-3; 6 good, 6 partial, 4 bad, 4 tricky; 2 multi-turn), 67 rubric labels. Draft labels written while authoring; Niki's labels in `eval/labels.csv` will be the reference. Tricky cases target signal-word matching (circular "because", empty "for example", three identical reasons, off-topic third reason, unconnected story hook). Not run through any model yet; regenerate with `eval/make_samples.py`.

## Feedback corner (Oct 18)
- Optional card after a chapter's quick check and after a practice conversation, plus "Give feedback" in the top bar and on Progress (`/feedback`). Questions: usefulness 1-5, would you pay $5/month (yes/maybe/no), what next, anything confusing or broken, optional first name.
- **Anonymous by construction:** the client sends its user id only so the server can look up worlds and metrics; the stored row has no user id, audio or transcript. Before/after = first attempt (baseline when there is one) vs latest: fillers/min, wpm, rubric score. Collection `feedback` (Mongo in hosted mode).
- `/admin/feedback`: password from `ADMIN_PASSWORD` sent as an `X-Admin-Password` header and checked with `secrets.compare_digest`; empty password = endpoint returns 404. Password lives in page state only. Summary: average rating, % yes/maybe/no, before/after averages over learners with 2+ attempts.
- Tested with a temp store: empty answer 400, rating 9 422, no/wrong password 401, summary maths right, no user id or transcript in rows.

## Hosted mode, first end-to-end run (Oct 18)
- `DO_MODEL=gemma-4-31B-it`: the only Gemma on our DigitalOcean serverless inference account (82 models listed). No thinking-token problem: "reply with exactly: ready" came back in 1.5 s with `finish_reason=stop`, JSON mode clean in 0.5 s. `reasoning_effort` is still only sent to Ollama.
- Flow tested through the real API (FastAPI TestClient against Atlas, DO, ElevenLabs): new user → Day 1 PREP conversation with Dana (strict interviewer) → two spoken turns → grade → Explain that → TTS → feedback corner. Learner audio was ElevenLabs speech transcoded to **webm/opus (turn 1) and mp4/aac (turn 2)**, the two formats real phones send. Test user and all its documents deleted from Atlas afterwards.
- Scribe kept the filler ("because, um, when a team is lost") and punctuation. Grader: 4/4 used, every quote passed the validator on the first pass (no retry), feedback 2 sentences, one fix, rewrite. 
- TTS: all three calls answered by `eleven_v4` (no fallback to flash), mp3.
- Latency (s): turn 1 3.8, turn 2 2.8 (STT + partner reply), grading 5.1, Explain 1.6, TTS 2.1. Compare local gemma3:1b stepwise grading: tens of seconds.
- WPM 181 here is ElevenLabs' speaking speed, not a person's; ignore it.
- **Bug found: "Explain that" returned an empty answer.** The plain-English fallback reused `_first_sentences`, which drops questions (right for feedback), but partner lines are almost always questions, so the rewording was thrown away. Now `keep_questions=True` there, empty → null, and the card says "No slang or idioms in this line" instead of a blank "In other words:".
- Atlas `chunks` is empty: the runtime never does a vector search (chapters come from `course/*.json`, synced into Atlas `lessons` at boot). Ingest is only needed to build chapters 4-7 against Atlas.

## Chapters 4-7 on hosted Gemma (Oct 18, branch `design`)
- **Atlas ingest:** `scripts/push_chunks_to_atlas.py` copies the 1,138 already-embedded chunks from `data/chunks.jsonl` (exploring 619, stand 519) instead of re-embedding the PDFs (the local ingest peaked at 5 GB RAM). Vector index `chunks_vector` was queryable 30 s after creation. Only course building reads it.
- **Build:** `build_course.py 4 5 6 7` with `gemma-4-31B-it` on DigitalOcean: 24-34 s per chapter, ~3.1-3.9k input / 1.3-1.6k output tokens each (local gemma4:e4b took minutes per chapter and needed 200-word excerpts to fit Ollama's 4k context).
- **Bug: Day 5 failed "steps count" three times.** Not the step count: DigitalOcean's JSON mode (`response_format: json_object`) answered the Day 5 prompt with a bare `{}` (3 output tokens) in 5 of 6 runs; the same prompt without JSON mode gave a full fenced chapter 6 of 6. The grader prompt was fine (6/6 full rubrics in JSON mode). Fix in `llm.chat_json`: if JSON mode returns `{}`, retry once without it. Main (deployed) doesn't have this fix; its grader isn't affected.
- **Hand review** (`scripts/review_edits.py`, re-run after any rebuild):
  - Day 4: before/after was a sandwich recipe, not a spoken answer → a teammate asking how the weekly report gets made. Table called good signposts "simplistic" → without/with signposts.
  - Day 5: before/after marked pauses as "(pause)" → `[pause]`, the marker the transcript and rubric use.
  - Day 6: steps dropped "keep the same core message" (a rubric item) → Ask who / Keep the core / Adjust the words. The "New Deal" example said younger adults may not know history terms (an age generalisation) → jargon vs plain words for a non-technical friend; table and two quiz questions rewritten to match.
  - Day 7: key term "Regulators" (gestures) was off-topic → Active listening. The job-seeker example answered an employment-gap question while the scenario asks about changing industries → rewritten. New here opening had the partner call the learner's home country's way "completely inefficient", against the New here tone rule (different, not worse) → "Why did you leave a good job back home to start over here?", still a tough question.
- Days 1, 3, 101 are byte-identical after re-running the edits (the edits are idempotent).
- Not done yet: speaking through a 4-7 conversation on hosted. Testing design-branch code must not use the shared Atlas db `italk`: app startup upserts `course/*.json` into `lessons`, which would show 4-7 on the deployed main app.

## Landing page (Oct 18, branch `design`)
- New visitors land on `/` (pages/Landing.tsx) before onboarding: running head "A daily speaking course / Chapter 1", huge headline (clamp 3rem-8.5rem; 51px at 375), "Have you ever..." cards that fade in on scroll (IntersectionObserver, instant with reduced motion or no observer; two columns on laptop), pull quote "Speaking well isn't a personality. It's a skill.", Read -> Talk -> Grow numbered diagram (arrows down on phone, right on laptop), "Start Chapter 1, free" (to `/welcome`). Copy is a stand-in in one `COPY` object: Niki's draft didn't come through in the message.
- **"I've been here before"**: there are no accounts, only an anonymous id in localStorage, so someone on the same browser never sees the landing page. The link is for a new device or cleared storage: it takes a **resume code** (the user id), shown with a copy button at the bottom of Progress. Checked: malformed code, unknown code, valid code (case-insensitive) signs in.
- **Bug found while checking the landing page (also on main):** coloured cards (`card bg-read-soft` etc.) rendered plain: the `card` utility's background won over the tint. Fixed with Tailwind's important modifier (`bg-read-soft!`) on About, Overview, Talk, FeedbackView, the feedback corner and admin. Also `bg-good-soft`/`bg-good` never existed (the palette registers that colour as `leaf`), so About's "Grow" box and the admin pay bar's green were blank.
- Checked at 375x812 (no sideways scroll, CTA on one line) and wide (dark mode), light and dark.
- **"Why this exists" figure** (between "Have you ever..." and the pull quote): "Nobody teaches this. Everyone is judged on it." as a textbook Figure 1 table with bars and numbered source footnotes. Sources checked before publishing:
  - WES 41%: confirmed in the report PDF, p. 10 ("41% of international students say it is difficult to form close friendships with domestic students"); 2019 survey of international students at U.S. institutions, 1,921 responses.
  - Coach $100-300/hour: VocalImage's coach page ("typically runs $100-300 per hour"). It's a speaking-app company, which the footnote says; Yoodli (also an app) says ~$150/hour.
  - NACE: now uses the draft's 98.7% / 55.4% (Job Outlook 2026). The report itself is members-only, so the footnote cites Purdue Global's summary, which gives the same pair (Jobscan's 2026 write-up matches too). Fallback if that page goes: NACE's public Job Outlook 2025 figures, 96.1% / 53.5% (NACE article, Jan 13 2025).
