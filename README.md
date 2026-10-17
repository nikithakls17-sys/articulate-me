# Articulate Me

A daily speaking course, like Duolingo for talking. Read one real technique in a short illustrated chapter written
from open public speaking textbooks, then practice it in a short **spoken conversation**: Gemma plays the interviewer,
professor, customer or friend and pushes you to use the technique. You get feedback with your own words quoted as
evidence, one fix, and a retry.

- **Gemma** writes the chapters from the textbooks (RAG, with citations), plays your conversation partner, and grades
  whether you used the technique
- A **grounding validator** rejects any "evidence" quote that isn't really in what you said
- **Pick several worlds** (student, job seeker, customer-facing, creator, everyday); examples and partners adapt
- Highlight-to-notes, quick checks, streaks, targets and badges; installs to your phone's home screen
- **Local mode** runs fully offline on about 1 GB of RAM: `gemma3:1b` + faster-whisper + browser speech
- **Hosted mode**: Gemma on DigitalOcean serverless inference, ElevenLabs speech-to-text and voice, MongoDB Atlas,
  Sentry, Render

## Run it locally (nothing leaves your machine)

Requirements: Python 3.12, Node 20+, [Ollama](https://ollama.com).

```bash
ollama pull gemma3:1b        # the app at runtime (~1 GB RAM)
ollama pull gemma4:e4b        # only for building the course chapters (optional)
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements-local.txt   # macOS/Linux: .venv/bin/python
cp .env.example .env                                                   # MODE=local is the default
cd frontend && npm install && npm run build && cd ..
cd backend && ../.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

Open http://localhost:8000. For frontend dev with hot reload, also run `npm run dev` in `frontend/` (proxies `/api`).

Low on RAM? Set `WHISPER_MODEL=tiny.en` in `.env`. More RAM (~6 GB free)? `OLLAMA_MODEL=gemma4:e4b` and
`GRADER=json` give noticeably better grading than the 1B model (see `NOTES.md`).

## Build the course from the textbooks

1. Download both PDFs into `data/books/` (file names must contain `stand` / `exploring`; the sites block scripts, so use a browser):
   - *Stand up, Speak out* (UWM edition): https://wisconsin.pressbooks.pub/uwmpublicspeaking/
   - *Exploring Public Speaking*, 4th ed.: https://open.maricopa.edu/exploringpublicspeaking/
2. `.venv/Scripts/python scripts/ingest_books.py` (chunks + embeds into Atlas, or `data/chunks.jsonl` without `MONGODB_URI`)
3. `BUILD_MODEL=gemma4:e4b .venv/Scripts/python scripts/build_course.py 1 2 3` writes `course/day_N.json`
   (pages, quick check, an example and a conversation scenario per world). Review them by hand; the app loads
   `course/` on startup.

## Deploy (Render)

`render.yaml` is a one-service Blueprint (Docker). Set `DO_MODEL`, `DO_MODEL_ACCESS_KEY`, `ELEVENLABS_API_KEY`,
`MONGODB_URI` and `SENTRY_DSN` in the Render dashboard. Credit limits: `MAX_RECORDING_SEC`, `MAX_ATTEMPTS_PER_DAY`,
`MAX_CONCURRENT_SESSIONS`.

## Layout

| Path | What |
|---|---|
| `backend/app/llm.py` | The only LLM client. `LLM_PROVIDER=ollama \| digitalocean` |
| `backend/app/feedback.py` | Rubric grading (one-call JSON or stepwise for tiny models) + grounding validator |
| `backend/app/conversation.py` | Gemma as the practice partner |
| `backend/app/metrics.py` | WPM, fillers/min, pauses, no LLM |
| `backend/app/stt.py` | faster-whisper (local) / ElevenLabs Scribe (hosted) |
| `backend/app/course_plan.py` | Week 1 plan, technique outlines, rubrics, baseline scenarios, badges |
| `scripts/` | Book ingestion, course builder |
| `course/` | Generated, hand-reviewed lessons |
| `NOTES.md` | Build log: decisions, bugs, numbers |
| `PRD.md` | Product spec |

## License and attribution

Code: MIT. Lesson content is adapted from the two textbooks above (CC BY-NC-SA 4.0), is not endorsed by their
authors, and is shared under the same license.
