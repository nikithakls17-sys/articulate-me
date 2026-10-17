# Build notes

Running log of decisions, bugs and fixes. Feeds the "How I Built It" section of the post.

## Decisions
- **Python 3.12 for the backend**, not the 3.14 default on the laptop: wheels for onnxruntime (fastembed) and ctranslate2 (faster-whisper) are safest on 3.12. Docker image uses python:3.12-slim too.
- **Local store fallback.** If `MONGODB_URI` is empty, users/attempts/lessons go to JSON files in `data/local_store/` and vector search is a numpy cosine over `data/chunks.jsonl`. Makes local mode truly offline and let me build before having Atlas keys. Hosted mode uses Atlas + Atlas Vector Search.

## Bugs hit
- **Gemma 4 returned empty content.** `gemma4:e4b` on Ollama thinks by default: 100/100 completion tokens went to `reasoning`, `content=''`, `finish_reason=length`. `extra_body={"think": False}` did nothing on the OpenAI-compatible endpoint; `{"reasoning_effort": "none"}` fixed it (12 tokens, 4.1 s vs 9.0 s and nothing). Only sent for the Ollama provider.
