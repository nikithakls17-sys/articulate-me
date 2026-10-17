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
