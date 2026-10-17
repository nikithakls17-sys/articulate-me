# Articulate Me

A daily 5-minute speaking course, like Duolingo for talking. Learn one real technique from open public speaking
textbooks, practice it out loud in your own world (student, job seeker, customer-facing, creator, everyday), and
get feedback on whether you actually used it, with your own words quoted as evidence.

- **Gemma** teaches (lessons built from the textbooks with RAG) and grades (rubric + one fix + rewritten line)
- A **grounding validator** rejects any "evidence" quote that isn't really in your transcript
- **Local mode** runs fully offline: Ollama Gemma + faster-whisper + browser speech. Recordings never leave your laptop.
- **Hosted mode**: Gemma on DigitalOcean serverless inference, ElevenLabs speech-to-text and voice, MongoDB Atlas, Sentry, Render.

## Run it locally (nothing leaves your machine)

Requirements: Python 3.12, Node 20+, [Ollama](https://ollama.com).

```bash
ollama pull gemma4:e4b
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements-local.txt   # macOS/Linux: .venv/bin/python
cp .env.example .env                                                   # MODE=local is the default
cd frontend && npm install && npm run build && cd ..
cd backend && ../.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Open http://localhost:8000. For frontend dev with hot reload, also run `npm run dev` in `frontend/` (proxies `/api`).

Low on RAM? Set `WHISPER_MODEL=tiny.en` in `.env` (Gemma + Whisper `base.en` didn't fit beside Chrome on a 16 GB laptop).

## Build the course from the textbooks

1. Download both PDFs into `data/books/` (file names must contain `stand` / `exploring`):
   - *Stand up, Speak out* (UWM edition): https://wisconsin.pressbooks.pub/uwmpublicspeaking/
   - *Exploring Public Speaking*, 4th ed.: https://open.maricopa.edu/exploringpublicspeaking/
2. `.venv/Scripts/python scripts/ingest_books.py` (chunks + embeds into Atlas, or `data/chunks.jsonl` without `MONGODB_URI`)
3. `.venv/Scripts/python scripts/build_course.py 1 2 3` writes `course/day_N.json`. Review them by hand; the app loads `course/` on startup.

## Deploy (Render)

`render.yaml` is a one-service Blueprint (Docker). Set `DO_MODEL`, `DO_MODEL_ACCESS_KEY`, `ELEVENLABS_API_KEY`,
`MONGODB_URI` and `SENTRY_DSN` in the Render dashboard. Credit limits: `MAX_RECORDING_SEC`, `MAX_ATTEMPTS_PER_DAY`,
`MAX_CONCURRENT_SESSIONS`.

## Layout

| Path | What |
|---|---|
| `backend/app/llm.py` | The only LLM client. `LLM_PROVIDER=ollama \| digitalocean` |
| `backend/app/feedback.py` | Gemma rubric grading + grounding validator + retry |
| `backend/app/metrics.py` | WPM, fillers/min, pauses, no LLM |
| `backend/app/stt.py` | faster-whisper (local) / ElevenLabs Scribe (hosted) |
| `backend/app/course_plan.py` | Week 1 plan + hand-written rubrics |
| `scripts/` | Book ingestion, course builder |
| `course/` | Generated, hand-reviewed lessons |
| `NOTES.md` | Build log: decisions, bugs, numbers |

## License and attribution

Code: MIT. Lesson content is adapted from the two textbooks above (CC BY-NC-SA 4.0), is not endorsed by their
authors, and is shared under the same license.
