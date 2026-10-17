import asyncio
import mimetypes
import json
import uuid
from datetime import date, datetime, timedelta

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, conversation, feedback, llm, metrics, stt
from .course_plan import BADGES, MINUTES_PER_LESSON, PLAN, WEEKS, WORLDS
from .observability import init_sentry
from .store import now_iso, store

mimetypes.add_type("application/manifest+json", ".webmanifest")
init_sentry()
app = FastAPI(title="Articulate Me")
_sessions = asyncio.Semaphore(config.MAX_CONCURRENT_SESSIONS)
FREE_DAYS = 3  # Days 1-3 (+ baseline) are free; the rest is Pro (unlocked for the hackathon demo)


@app.on_event("startup")
def load_course():
    """course/*.json is the hand-reviewed source of truth; sync it into the store on boot."""
    for f in sorted(config.COURSE_DIR.glob("day_*.json")):
        store().upsert_lesson(json.loads(f.read_text(encoding="utf-8")))


@app.get("/api/health")
def health():
    return {"ok": True, "mode": config.MODE, "llm": config.LLM_PROVIDER, "model": llm.model_name(),
            "grader": config.GRADER, "stt": config.STT_PROVIDER, "tts": config.TTS_ENABLED,
            "store": type(store()).__name__, "max_recording_sec": config.MAX_RECORDING_SEC}


def _today(local_date: str | None) -> str:
    try:
        return datetime.strptime(local_date, "%Y-%m-%d").date().isoformat() if local_date else date.today().isoformat()
    except ValueError:
        raise HTTPException(400, "local_date must be YYYY-MM-DD")


def _lesson(day: int) -> dict:
    l = store().get_lesson(day)
    if not l:
        raise HTTPException(404, "This chapter isn't written yet")
    return l


def _pick_world(user: dict, lesson: dict, requested: str | None = None) -> str:
    worlds = [w for w in user["worlds"] if w in lesson.get("scenarios", {})] or list(lesson.get("scenarios", {})) or ["everyday"]
    if requested in worlds:
        return requested
    return worlds[lesson["day"] % len(worlds)]  # rotate through the learner's worlds day by day


# ---------- course ----------

TARGETS = [
    {"id": "week_1", "title": "Finish Week 1", "goal": 7, "unit": "conversations"},
    {"id": "low_fillers", "title": "Under 3 filler words per minute", "goal": 3, "unit": "fillers/min", "lower": True},
    {"id": "score_80", "title": "Score 80%+ on 3 lessons", "goal": 3, "unit": "lessons"},
    {"id": "streak_3", "title": "Practice 3 days in a row", "goal": 3, "unit": "days"},
]


@app.get("/api/course")
def course():
    lessons = {l["day"]: l for l in store().list_lessons()}
    days = [{"day": p["day"], "title": p["title"], "technique": p["technique"], "learn": p["learn"],
             "available": p["day"] in lessons and (p["day"] == 0 or bool(lessons[p["day"]].get("pages"))),
             "pro": p["day"] > FREE_DAYS, "minutes": MINUTES_PER_LESSON if p["day"] else 3,
             "pages": len(lessons.get(p["day"], {}).get("pages", []))} for p in PLAN]
    lesson_days = [d for d in days if d["day"] > 0]
    return {
        "weeks": WEEKS, "days": days, "worlds": WORLDS, "badges": BADGES, "targets": TARGETS,
        "overview": {"lessons": len(lesson_days), "minutes_total": sum(d["minutes"] for d in lesson_days) + 3,
                     "minutes_per_lesson": MINUTES_PER_LESSON},
    }


@app.get("/api/lessons/{day}")
def lesson(day: int, user_id: str | None = None, world: str | None = None):
    l = _lesson(day)
    user = store().get_user(user_id) if user_id else None
    w = _pick_world(_normalize(user), l, world) if user else (world if world in l.get("scenarios", {}) else "everyday")
    pages = [dict(pg, body=l["examples"].get(w, "")) if pg["kind"] == "example" else pg for pg in l.get("pages", [])]
    return {
        "day": l["day"], "technique": l["technique"], "title": l["title"], "learn": l.get("learn", ""),
        "pages": pages, "quiz": [{"q": q["q"], "options": q["options"]} for q in l.get("quiz", [])],
        "scenario": l.get("scenarios", {}).get(w), "world": w, "rubric": l["rubric"], "citations": l.get("citations", []),
        "worlds": [x for x in (user["worlds"] if user else []) if x in l.get("scenarios", {})],
    }


# ---------- users ----------

class NewUser(BaseModel):
    name: str
    worlds: list[str]
    goals: list[str] = []


class UserPatch(BaseModel):
    worlds: list[str] | None = None
    goals: list[str] | None = None


def _normalize(user: dict | None) -> dict | None:
    if user and "worlds" not in user:  # users created before multi-world onboarding
        user = {**user, "worlds": [user.get("world", "everyday")], "goals": [g for g in [user.get("goal")] if g]}
    return user


def _user(user_id: str) -> dict:
    u = _normalize(store().get_user(user_id))
    if not u:
        raise HTTPException(404, "user not found")
    return u


@app.post("/api/users")
def create_user(body: NewUser):
    worlds = [w for w in dict.fromkeys(body.worlds) if w in WORLDS]
    if not worlds:
        raise HTTPException(400, "pick at least one world")
    user = {"id": uuid.uuid4().hex, "name": body.name.strip()[:40] or "friend", "worlds": worlds,
            "goals": [g.strip()[:60] for g in body.goals][:6], "created_at": now_iso()}
    store().upsert_user(user)
    return user


@app.patch("/api/users/{user_id}")
def update_user(user_id: str, body: UserPatch):
    u = _user(user_id)
    if body.worlds is not None:
        worlds = [w for w in dict.fromkeys(body.worlds) if w in WORLDS]
        if not worlds:
            raise HTTPException(400, "pick at least one world")
        u["worlds"] = worlds
    if body.goals is not None:
        u["goals"] = [g.strip()[:60] for g in body.goals][:6]
    u.pop("world", None)
    u.pop("goal", None)
    store().upsert_user(u)
    return u


def _best_by_day(attempts: list[dict]) -> dict[int, dict]:
    best = {}
    for a in attempts:
        cur = best.get(a["day"])
        if not cur or (a.get("rubric_score") or 0) >= (cur.get("rubric_score") or 0):
            best[a["day"]] = a
    return best


def _streaks(dates: set[str], today: str) -> tuple[int, int]:
    """(current streak, longest streak)."""
    d = date.fromisoformat(today)
    if today not in dates:
        d -= timedelta(days=1)  # streak survives until the end of today
    cur = 0
    while d.isoformat() in dates:
        cur += 1
        d -= timedelta(days=1)
    longest, run, prev = 0, 0, None
    for x in sorted(dates):
        dx = date.fromisoformat(x)
        run = run + 1 if prev and (dx - prev).days == 1 else 1
        longest, prev = max(longest, run), dx
    return cur, longest


def _state(user_id: str, today: str) -> dict:
    attempts = store().list_attempts(user_id)
    quizzes = store().find("quiz_results", user_id=user_id)
    notes = store().find("notes", user_id=user_id)
    best = _best_by_day(attempts)
    read = {q["day"] for q in quizzes}
    built = {l["day"] for l in store().list_lessons() if l["day"] == 0 or l.get("pages")}
    cur, longest = _streaks({a["local_date"] for a in attempts} | {q["local_date"] for q in quizzes}, today)

    next_step = None
    for p in PLAN[1:]:
        d = p["day"]
        if d not in built:
            break
        if d not in read:
            next_step = {"kind": "read", "day": d}
            break
        if d == 1 and 0 not in best and 0 in built:
            next_step = {"kind": "baseline", "day": 0}
            break
        if d not in best:
            next_step = {"kind": "practice", "day": d}
            break

    days = {}
    for p in PLAN:
        d = p["day"]
        prev_done = d <= 1 or (d - 1) in best
        days[d] = {"read": d in read, "practiced": d in best, "best_score": best[d].get("rubric_score") if d in best else None,
                   "unlocked": d in built and (d == 0 and 1 in read or d > 0 and prev_done)}
    return {"attempts": attempts, "quizzes": quizzes, "notes": notes, "best": best, "days": days,
            "streak": cur, "longest_streak": longest, "next_step": next_step}


@app.get("/api/users/{user_id}")
def get_user(user_id: str, today: str | None = None):
    user = _user(user_id)
    s = _state(user_id, _today(today))
    return {
        **user,
        "xp": sum(a.get("xp", 0) for a in s["attempts"]) + sum(q.get("xp", 0) for q in s["quizzes"]),
        "streak": s["streak"], "days": s["days"], "next_step": s["next_step"],
        "done_today": any(a["local_date"] == _today(today) for a in s["attempts"]),
    }


def _summary(a: dict) -> dict:
    keep = ("id", "day", "attempt_no", "created_at", "local_date", "rubric_score", "metrics", "transcript")
    return {k: a.get(k) for k in keep}


def _badges(s: dict) -> list[dict]:
    attempts, best = s["attempts"], s["best"]
    earned = {
        "first_chapter": bool(s["quizzes"]),
        "baseline": 0 in best,
        "first_convo": any(a["day"] > 0 for a in attempts),
        "prep_in_convo": (best.get(1, {}).get("rubric_score") or 0) >= 75,
        "low_fillers": any(a["metrics"]["fillers_per_min"] < 3 and a["metrics"]["word_count"] >= 20 for a in attempts),
        "streak_3": s["longest_streak"] >= 3,
        "perfect_quiz": any(q["correct"] == q["total"] for q in s["quizzes"]),
        "note_taker": len(s["notes"]) >= 3,
        "week_1": all(d in best for d in range(1, 8)),
    }
    return [{**b, "earned": earned.get(b["id"], False)} for b in BADGES]


def _targets(s: dict) -> list[dict]:
    attempts, best = s["attempts"], s["best"]
    fillers = [a["metrics"]["fillers_per_min"] for a in attempts if a["day"] > 0] or \
              [a["metrics"]["fillers_per_min"] for a in attempts]
    current = {
        "week_1": len([d for d in best if d > 0]),
        "low_fillers": fillers[-1] if fillers else None,
        "score_80": len([d for d, a in best.items() if d > 0 and (a.get("rubric_score") or 0) >= 80]),
        "streak_3": s["streak"],
    }
    out = []
    for t in TARGETS:
        c = current[t["id"]]
        done = c is not None and (c < t["goal"] if t.get("lower") else c >= t["goal"])
        out.append({**t, "current": c, "done": done})
    return out


@app.get("/api/users/{user_id}/progress")
def progress(user_id: str, today: str | None = None):
    _user(user_id)
    s = _state(user_id, _today(today))
    attempts, best = s["attempts"], s["best"]
    baseline = next((a for a in attempts if a["day"] == 0), None)
    latest = attempts[-1] if attempts else None
    return {
        "baseline": _summary(baseline) if baseline else None,
        "latest": _summary(latest) if latest else None,
        "by_day": [_summary(best[d]) for d in sorted(best)],
        "history": [_summary(a) for a in attempts],
        "lessons_done": len([d for d in best if d > 0]), "lessons_total": len(PLAN) - 1,
        "chapters_read": len({q["day"] for q in s["quizzes"]}),
        "streak": s["streak"], "longest_streak": s["longest_streak"],
        "badges": _badges(s), "targets": _targets(s),
    }


# ---------- quick check ----------

class QuizBody(BaseModel):
    user_id: str
    answers: list[int]
    local_date: str


@app.post("/api/lessons/{day}/quiz")
def submit_quiz(day: int, body: QuizBody):
    _user(body.user_id)
    quiz = _lesson(day).get("quiz", [])
    results = [{"correct": i < len(body.answers) and body.answers[i] == q["answer"], "answer": q["answer"],
                "explain": q.get("explain", "")} for i, q in enumerate(quiz)]
    correct = sum(r["correct"] for r in results)
    store().insert("quiz_results", {"id": uuid.uuid4().hex, "user_id": body.user_id, "day": day, "correct": correct,
                                    "total": len(quiz), "xp": 5 * correct, "local_date": _today(body.local_date),
                                    "created_at": now_iso()})
    return {"results": results, "correct": correct, "total": len(quiz), "xp": 5 * correct}


# ---------- notes ----------

class NewNote(BaseModel):
    user_id: str
    day: int
    page_title: str = ""
    text: str
    citation: dict | None = None


class NotePatch(BaseModel):
    comment: str


@app.get("/api/users/{user_id}/notes")
def list_notes(user_id: str):
    return store().find("notes", user_id=user_id)


@app.post("/api/notes")
def add_note(body: NewNote):
    _user(body.user_id)
    text = body.text.strip()[:600]
    if not text:
        raise HTTPException(400, "empty highlight")
    l = store().get_lesson(body.day)
    note = {"id": uuid.uuid4().hex, "user_id": body.user_id, "day": body.day,
            "lesson_title": l["title"] if l else f"Day {body.day}", "page_title": body.page_title[:80], "text": text,
            "citation": body.citation, "comment": "", "created_at": now_iso()}
    store().insert("notes", note)
    return note


@app.patch("/api/notes/{note_id}")
def edit_note(note_id: str, body: NotePatch):
    if not store().get("notes", note_id):
        raise HTTPException(404, "note not found")
    store().update("notes", note_id, {"comment": body.comment[:1000]})
    return store().get("notes", note_id)


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str):
    store().delete("notes", note_id)
    return {"ok": True}


# ---------- conversation practice ----------

class NewConversation(BaseModel):
    user_id: str
    day: int
    world: str | None = None


def _public_convo(c: dict) -> dict:
    return {"id": c["id"], "day": c["day"], "world": c["world"], "scenario": c["scenario"], "status": c["status"],
            "turns": [{"speaker": t["speaker"], "text": t["text"]} for t in c["turns"]],
            "max_user_turns": c["max_user_turns"],
            "user_turns": sum(1 for t in c["turns"] if t["speaker"] == "user")}


@app.post("/api/conversations")
def start_conversation(body: NewConversation):
    user = _user(body.user_id)
    l = _lesson(body.day)
    world = _pick_world(user, l, body.world)
    scenario = l["scenarios"][world]
    c = {"id": uuid.uuid4().hex, "user_id": user["id"], "day": body.day, "world": world, "scenario": scenario,
         "status": "active", "max_user_turns": conversation.max_turns(body.day), "created_at": now_iso(),
         "turns": [{"speaker": "partner", "text": scenario["opening"]}], "llm": []}
    store().insert("conversations", c)
    return _public_convo(c)


def _take_turn(c: dict, audio: bytes, content_type: str) -> dict:
    heard = stt.transcribe(audio, content_type)
    if len(heard["text"].split()) < 2:
        raise HTTPException(422, "I couldn't hear that. Tap the mic and try again a little closer.")
    if heard["words"] and heard["words"][-1]["end"] > config.MAX_RECORDING_SEC + 5:
        raise HTTPException(413, f"Answers are capped at {config.MAX_RECORDING_SEC} seconds.")
    turns = c["turns"] + [{"speaker": "user", "text": heard["text"], "words": heard["words"],
                           "stt_ms": heard["latency_ms"]}]
    user_turns = sum(1 for t in turns if t["speaker"] == "user")
    closing = user_turns >= c["max_user_turns"]
    reply, out = conversation.partner_reply(c["scenario"], c["day"], turns, closing)
    turns.append({"speaker": "partner", "text": reply})
    status = "ready" if closing else "active"
    store().update("conversations", c["id"], {"turns": turns, "status": status,
                                              "llm": c.get("llm", []) + [{k: out[k] for k in ("input_tokens", "output_tokens", "latency_ms")}]})
    return {"user_text": heard["text"], "partner_text": reply, "done": closing, "user_turns": user_turns,
            "max_user_turns": c["max_user_turns"]}


@app.post("/api/conversations/{conv_id}/turns")
async def conversation_turn(conv_id: str, audio: UploadFile = File(...)):
    c = store().get("conversations", conv_id)
    if not c:
        raise HTTPException(404, "conversation not found")
    if c["status"] != "active":
        raise HTTPException(409, "This conversation is over")
    data = await audio.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Recording too large")
    if _sessions.locked():
        raise HTTPException(503, "The coach is busy with other learners. Try again in a few seconds.")
    async with _sessions:
        return await run_in_threadpool(_take_turn, c, data, audio.content_type or "audio/webm")


def _xp(result: dict) -> int:
    return 10 + 5 * sum(1 for r in result["rubric"] if r["status"] == "used")


def _finish(c: dict, local_date: str) -> dict:
    l = _lesson(c["day"])
    user_turns = [t for t in c["turns"] if t["speaker"] == "user"]
    if not user_turns:
        raise HTTPException(400, "Say something first!")
    words, said = metrics.join_turns(user_turns)
    m = metrics.compute(words, said, time_limit_sec=60 * len(user_turns))
    marked = " ".join(metrics.marked_transcript(t.get("words") or [], t["text"]) for t in user_turns)
    partner = c["scenario"]["partner"]
    dialogue = "\n".join(f"{partner if t['speaker'] == 'partner' else 'Learner'}: {t['text']}" for t in c["turns"])
    situation = f"{c['scenario']['setup']} The learner talks with {partner}, {c['scenario']['role']}."
    try:
        result = feedback.evaluate(l, c["world"], situation, marked, conversation=dialogue)
    except feedback.GradingFailed as e:
        raise HTTPException(503, str(e))
    previous = [a for a in store().list_attempts(c["user_id"]) if a["day"] == c["day"]]
    attempt = {
        "id": uuid.uuid4().hex, "user_id": c["user_id"], "day": c["day"], "kind": "conversation",
        "conversation_id": c["id"], "attempt_no": len(previous) + 1, "created_at": now_iso(), "local_date": local_date,
        "world": c["world"], "scenario": c["scenario"], "turns": [{"speaker": t["speaker"], "text": t["text"]} for t in c["turns"]],
        "transcript": said, "marked_transcript": marked, "metrics": m, **result,
    }
    attempt["xp"] = _xp(result)
    store().add_attempt(attempt)
    store().update("conversations", c["id"], {"status": "graded", "attempt_id": attempt["id"]})
    attempt["previous"] = _summary(previous[-1]) | {"rubric": previous[-1]["rubric"]} if previous else None
    return attempt


class FinishBody(BaseModel):
    local_date: str


@app.post("/api/conversations/{conv_id}/finish")
async def finish_conversation(conv_id: str, body: FinishBody):
    c = store().get("conversations", conv_id)
    if not c:
        raise HTTPException(404, "conversation not found")
    if c["status"] == "graded":
        raise HTTPException(409, "Already graded")
    local_date = _today(body.local_date)
    todays = [a for a in store().list_attempts(c["user_id"]) if a["local_date"] == local_date]
    if len(todays) >= config.MAX_ATTEMPTS_PER_DAY:
        raise HTTPException(429, "That's a lot of practice for one day! Come back tomorrow.")
    if _sessions.locked():
        raise HTTPException(503, "The coach is busy with other learners. Try again in a few seconds.")
    async with _sessions:
        return await run_in_threadpool(_finish, c, local_date)


# ---------- voice ----------

class TTSBody(BaseModel):
    text: str


@app.post("/api/tts")
def tts(body: TTSBody):
    if not config.TTS_ENABLED:
        raise HTTPException(404, "TTS off in this mode; use browser speech")
    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}",
        headers={"xi-api-key": config.ELEVENLABS_API_KEY, "accept": "audio/mpeg"},
        json={"text": body.text[:1200], "model_id": "eleven_flash_v2_5"},
        timeout=60,
    )
    if r.status_code != 200:
        raise HTTPException(502, "TTS failed")
    return Response(r.content, media_type="audio/mpeg")


# ---------- frontend ----------

if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = config.FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(config.FRONTEND_DIST / "index.html")
