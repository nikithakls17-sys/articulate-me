# PRD — Articulate Me

**A daily speaking course, like Duolingo for talking. Read one real technique from an open public speaking textbook,
practice it in a short spoken conversation in your own world, and get feedback on whether you actually used it.**

Hackathon: DEV Hacktoberfest Open-Source AI Challenge, Week 2 "Side Hustle"
Hard deadline: Sun Oct 18, 11:59 PM PDT (= Mon Oct 19, 12:29 PM IST). Target: submitted by Sun Oct 18, 9:00 PM IST.
Builder: Niki, building with Claude Code. Build log: `NOTES.md`.

---

## 1. Problem

Everyone is told "stop saying um," "get to the point," "be confident." Nobody teaches *how*. Communication skills
decide interviews, grades, sales, patient trust and auditions, but practice only happens in the real, high-stakes
moment. Public speaking courses are expensive, scheduled and generic; generic chatbots give generic advice.

## 2. Solution (after the Oct 17 redesign)

1. **Onboarding:** pick one or more worlds (student, job seeker, customer-facing, creator, everyday) and goals.
2. **Course overview** before anything else: number of chapters, time per day, module list, targets, badges.
3. **Read:** each lesson is a short illustrated chapter (step-flow diagram, key terms, comparison table,
   before/after, why it works, an example from your world), written from the textbooks via RAG, with citation chips.
4. **Quick check:** 3 multiple-choice questions at the end of each chapter (answers checked on the server).
5. **Baseline after chapter 1:** "Let's see where you're starting" — a 2-reply conversation, no technique needed.
6. **Talk:** a 3-reply spoken conversation. Gemma plays the other person (interviewer, professor, customer…) and
   steers you toward the chapter's technique.
7. **Feedback:** metrics, rubric checklist with your own words quoted as evidence (grounding validator), one fix,
   a rewritten line you can hear, retry, attempt-vs-attempt comparison, full transcript.
8. **Notes:** highlight any chapter text to save it; the Notes tab groups highlights by lesson with citations and
   your own comments.
9. **Progress:** chapters read, conversations done, streak, Day 0 vs now, targets, badges.

Tabs: Course, Textbook, Practice, Notes, Progress. Sources & privacy is reachable from Progress and Textbook.
Style: warm, high contrast, big touch targets, line icons, no emojis. Works at 375 px and installs to the home screen.

## 3. Worlds

| World | Typical partner | Example scenarios |
|---|---|---|
| Student | professor, classmate | class presentation, group project, asking for help |
| Job seeker | interviewer, hiring manager | "tell me about yourself," behavioral questions |
| Customer-facing | customer, patient | nervous patient, upset customer, pitching |
| Creator / performer | casting director, podcast host | video intro, storytelling, audition |
| Everyday | friend, someone new | small talk, saying no, a toast |

## 4. Side hustle model

- **Free:** baseline + chapters/conversations 1–3.
- **Pro ($5/month):** full course, unlimited retries, custom scenarios, weekly report.
- **Prep Pack ($3 one-time):** a 3-day mini-course for one event.
- Local mode costs $0 per lesson. Honest limit: the textbooks are CC BY-NC-SA (NonCommercial), fine for the free
  tier and demo; a paid tier needs original lessons.

## 5. Why open source matters

Privacy (local mode: nothing leaves the laptop), cost ($0 per lesson locally), grounded teaching (RAG over CC
textbooks with citations), swappable models (same prompts on Ollama or DigitalOcean via one env var).

## 6. Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, lucide line icons, PWA manifest |
| Backend | FastAPI, one service serving API + built frontend |
| LLM | Gemma via one OpenAI-compatible client. Local: `gemma3:1b` (fits in ~1 GB, stepwise grader). Hosted: bigger Gemma on DigitalOcean (one-call JSON grader). Course building: `gemma4:e4b` offline. |
| STT | Local: faster-whisper. Hosted: ElevenLabs Scribe. Accepts webm/opus and mp4/aac (iPhone). |
| TTS | Hosted: ElevenLabs. Local: browser speechSynthesis. |
| Embeddings | fastembed `BAAI/bge-small-en-v1.5` |
| Data | MongoDB Atlas + Atlas Vector Search (hosted); JSON files + numpy cosine (local) |
| Observability | Sentry gen_ai spans; validator failures as issues |
| Hosting | Render Blueprint (`render.yaml`), .tech domain |

## 7. Knowledge base

1. *Stand up, Speak out* (UWM edition, CC BY-NC-SA 4.0) — 515 pages → 519 chunks
2. *Exploring Public Speaking*, 4th ed. (Tucker et al., CC BY-NC-SA 4.0) — 788 pages → 619 chunks

`scripts/ingest_books.py` chunks (~400 tokens, 60 overlap) and embeds. `scripts/build_course.py` writes each
chapter (pages, quiz, per-world example and conversation scenario) from several focused searches per technique,
following a hand-written technique outline; output goes to `course/day_N.json` for hand review.

## 8. Course — Week 1 "Say it clearly"

| Day | Technique | Partner pushes for |
|---|---|---|
| 0 | Baseline (after chapter 1) | "Tell me about yourself" + one follow-up |
| 1 | PREP (Point, Reason, Example, Point) | open questions needing a clear answer with a reason |
| 2 | Rule of three | "Convince me" |
| 3 | Open strong | "Make it memorable" |
| 4 | Signposting | "Walk me through it step by step" |
| 5 | The deliberate pause | "What's the one thing I should remember?" |
| 6 | Know your audience | "Now explain it to a 10-year-old" |
| 7 | Handling a tough question | one challenging question + one push-back |

Weeks 2–3 ("Delivery", "Persuasion") show as locked.

## 9. Feedback engine

1. **Deterministic metrics** across the learner's turns (turns stitched so partner time isn't counted): WPM,
   fillers/min, pauses > 0.7 s, longest pause.
2. **Technique check** against hand-written rubrics: used / partly / missing, evidence quoted from the learner's lines.
3. **Grounding validator:** every quote must match a same-length run of the learner's words at ≥ 90% (word level,
   fillers ignored); one retry naming the bad quote, then "couldn't verify". Feedback ≤ 2 sentences, exactly one fix.
   Every failure is a Sentry issue tagged with prompt version and rubric id.
4. **Retry** with attempt-vs-attempt comparison.

## 10. Badges and targets

Badges: First chapter, Starting line, Conversation starter, PREP in action, Smooth talker (< 3 fillers/min),
3-day streak, Sharp reader (perfect quick check), Note taker (3 notes), Said it clearly (Week 1 done).
Targets: finish Week 1, under 3 fillers/min, 80%+ on 3 lessons, 3-day streak.

## 11. Evaluation, users, post

Unchanged from the original plan: ~20 hand-labelled transcripts in `eval/`, v1 vs v2 prompt table, 2–3 friends
doing baseline → Day 2, DEV post with demo video, eval table, Sentry screenshots and honest limits.
