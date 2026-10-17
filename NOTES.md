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
