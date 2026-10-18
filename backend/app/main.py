import asyncio
import re
import secrets
import mimetypes
import threading
import json
import uuid
from datetime import date, datetime, timedelta
from typing import Literal

import sentry_sdk
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, conversation, feedback, llm, metrics, stt, voices
from .course_plan import (BADGES, COUNTRIES, EXPRESSIONS, MINUTES_PER_LESSON, NEW_HERE_PLAN, NEW_HERE_WORLD, PLAN, SETTINGS, WEEKS,
                          WORLDS, all_plans, plan_for)
from . import wiktionary
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
    if not config.HOSTED and voices.kokoro_available():
        # first Kokoro call loads the model (~12 s); do it now so the partner's first line isn't slow
        threading.Thread(target=lambda: voices.kokoro_tts("Hello.", "narrator"), daemon=True).start()


@app.get("/api/health")
def health():
    return {"ok": True, "mode": config.MODE, "llm": config.LLM_PROVIDER, "model": llm.model_name(),
            "grader": config.GRADER, "stt": config.STT_PROVIDER, "tts": voices.tts_enabled(),
            "tts_engine": ("elevenlabs " + voices.ELEVEN_MODEL) if config.HOSTED and config.ELEVENLABS_API_KEY
            else "kokoro" if voices.kokoro_available() else "browser",
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
    new_here = [{"day": p["day"], "title": p["title"], "technique": p["technique"], "learn": p["learn"],
                 "available": p["day"] in lessons, "pro": False, "minutes": MINUTES_PER_LESSON,
                 "pages": len(lessons.get(p["day"], {}).get("pages", []))} for p in NEW_HERE_PLAN]
    return {
        "tracks": [{"id": NEW_HERE_WORLD, "title": "New here", "summary": "Small talk, slang and making friends in a new place.",
                    "days": new_here, "countries": COUNTRIES, "settings": SETTINGS}],
        "weeks": WEEKS, "days": days, "worlds": WORLDS, "badges": BADGES, "targets": TARGETS,
        "overview": {"lessons": len(lesson_days), "minutes_total": sum(d["minutes"] for d in lesson_days) + 3,
                     "minutes_per_lesson": MINUTES_PER_LESSON},
    }


@app.get("/api/lessons/{day}")
def lesson(day: int, user_id: str | None = None, world: str | None = None):
    l = _lesson(day)
    user = _normalize(store().get_user(user_id)) if user_id else None
    if l.get("track") == NEW_HERE_WORLD:
        country, setting = _new_here(user)
        pages = [l["country_tables"][country] if pg["kind"] == "expressions"
                 else dict(pg, body=l["examples"].get(setting, "")) if pg["kind"] == "example" else pg
                 for pg in l.get("pages", [])]
        return {
            "day": l["day"], "technique": l["technique"], "title": l["title"], "learn": l.get("learn", ""),
            "pages": pages, "quiz": [{"q": q["q"], "options": q["options"]} for q in l.get("quiz", [])],
            "scenario": _local_scenario(l, country, setting), "world": NEW_HERE_WORLD, "worlds": [],
            "rubric": l["rubric"], "citations": l.get("citations", []), "track": NEW_HERE_WORLD,
            "country": country, "setting": setting,
        }
    w = _pick_world(user, l, world) if user else (world if world in l.get("scenarios", {}) else "everyday")
    pages = [dict(pg, body=l["examples"].get(w, "")) if pg["kind"] == "example" else pg for pg in l.get("pages", [])]
    return {
        "day": l["day"], "technique": l["technique"], "title": l["title"], "learn": l.get("learn", ""),
        "pages": pages, "quiz": [{"q": q["q"], "options": q["options"]} for q in l.get("quiz", [])],
        "scenario": l.get("scenarios", {}).get(w), "world": w, "rubric": l["rubric"], "citations": l.get("citations", []),
        "worlds": [x for x in (user["worlds"] if user else []) if x in l.get("scenarios", {})],
    }


# ---------- users ----------

class NewHere(BaseModel):
    country: str = "US"
    setting: str = "social"


class NewUser(BaseModel):
    name: str
    worlds: list[str]
    goals: list[str] = []
    new_here: NewHere | None = None


class UserPatch(BaseModel):
    worlds: list[str] | None = None
    goals: list[str] | None = None
    new_here: NewHere | None = None


def _clean_new_here(nh: NewHere | None) -> dict:
    nh = nh or NewHere()
    return {"country": nh.country if nh.country in COUNTRIES else "US",
            "setting": nh.setting if nh.setting in SETTINGS else "social"}


def _new_here(user: dict | None) -> tuple[str, str]:
    nh = (user or {}).get("new_here") or {}
    return nh.get("country", "US"), nh.get("setting", "social")


def _local_scenario(lesson: dict, country: str, setting: str) -> dict:
    return {**lesson["scenarios"][setting], "country": country, "country_name": COUNTRIES[country]}


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
    if NEW_HERE_WORLD in worlds:
        user["new_here"] = _clean_new_here(body.new_here)
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
    if body.new_here is not None:
        u["new_here"] = _clean_new_here(body.new_here)
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
    user = _normalize(store().get_user(user_id)) or {}
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
    for p in all_plans():
        d = p["day"]
        if p.get("track"):
            unlocked = d in built and p["track"] in user.get("worlds", [])
        else:
            prev_done = d <= 1 or (d - 1) in best
            unlocked = d in built and (d == 0 and 1 in read or d > 0 and prev_done)
        days[d] = {"read": d in read, "practiced": d in best, "unlocked": unlocked,
                   "best_score": best[d].get("rubric_score") if d in best else None}
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
        "lessons_done": len([d for d in best if 0 < d < 100]), "lessons_total": len(PLAN) - 1,
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
            "voice": voices.voice_info(c.get("voice", "friendly")),
            "turns": [{"speaker": t["speaker"], "text": t["text"]} for t in c["turns"]],
            "max_user_turns": c["max_user_turns"],
            "user_turns": sum(1 for t in c["turns"] if t["speaker"] == "user")}


@app.post("/api/conversations")
def start_conversation(body: NewConversation):
    user = _user(body.user_id)
    l = _lesson(body.day)
    if l.get("track") == NEW_HERE_WORLD:
        world, scenario = NEW_HERE_WORLD, _local_scenario(l, *_new_here(user))
    else:
        world = _pick_world(user, l, body.world)
        scenario = l["scenarios"][world]
    c = {"id": uuid.uuid4().hex, "user_id": user["id"], "day": body.day, "world": world, "scenario": scenario,
         "voice": voices.persona_for(scenario, world),
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


class ExplainBody(BaseModel):
    turn: int


EXPLAIN_SKIP = {"hey", "hi", "hello", "wow", "oh", "okay", "ok", "yeah", "yes", "no", "so", "well", "um", "uh"}


@app.post("/api/conversations/{conv_id}/explain")
def explain(conv_id: str, body: ExplainBody):
    """'Explain that': slang, idioms and references in one of the partner's lines, grounded in Wiktionary
    where possible. Doesn't touch the conversation itself."""
    c = store().get("conversations", conv_id)
    if not c or not 0 <= body.turn < len(c["turns"]) or c["turns"][body.turn]["speaker"] != "partner":
        raise HTTPException(404, "line not found")
    line = c["turns"][body.turn]["text"]
    country = c["scenario"].get("country", "US")
    place = COUNTRIES.get(country, "this country")
    raw = llm.chat([{"role": "user", "content":
                     f'Sentence: "{line}"\n\nList any slang, idioms, informal expressions or cultural references in '
                     f"this sentence that someone new to {place} might not know. Copy each one exactly from the sentence, "
                     "one per line, nothing else. If there are none, write NONE."}],
                   temperature=0.1, max_tokens=60, operation="explain_find")["text"]
    low = line.lower()
    # 1) known local expressions, matched in code (reliable even with a 1B model)
    phrases = list(dict.fromkeys(t for items in EXPRESSIONS.values() for t, _ in items if re.search(r"\b" + re.escape(t) + r"\b", low)))
    # 2) whatever else the model flagged: short phrases that really are in the line, minus filler words
    for p in raw.splitlines():
        p = p.strip(" -*•\"'“”.,!?").strip()
        if (p and p.upper() != "NONE" and 1 <= len(p.split()) <= 4 and p.lower() in low
                and p.lower() not in EXPLAIN_SKIP and p.lower() not in [x.lower() for x in phrases]):
            phrases.append(p)
    known = {t for items_ in EXPRESSIONS.values() for t, _ in items_}
    items = []
    for p in phrases:
        if len(items) == 3:
            break
        e = wiktionary.lookup(p, country)
        # model-picked phrases must be real idioms/slang: a Wiktionary entry that is multi-word or marked informal
        if e and (p in known or len(p.split()) > 1 or e.get("informal")):
            items.append({"phrase": p, "meaning": e["meaning"], "source": "Wiktionary", "url": e["url"], "license": e["license"]})
    plain = None
    if not items:
        plain = llm.chat([{"role": "user", "content": f'Say this in simpler everyday English, one sentence: "{line}"'}],
                         temperature=0.2, max_tokens=60, operation="explain_plain")["text"]
        # partner lines are usually questions, so the rewording is too: keep them
        plain = feedback._first_sentences(plain, 2, keep_questions=True) or None
    return {"items": items, "plain": plain}


# ---------- feedback corner ----------

class FeedbackBody(BaseModel):
    user_id: str | None = None  # only used to look up worlds and metrics; never stored
    context: Literal["lesson", "practice", "menu"] = "menu"
    day: int | None = None
    rating: int | None = Field(None, ge=1, le=5)
    pay: Literal["yes", "maybe", "no"] | None = None
    want_next: str = Field("", max_length=500)
    confusing: str = Field("", max_length=500)
    first_name: str = Field("", max_length=40)


METRIC_KEYS = ("fillers_per_min", "wpm", "rubric_score")


def _metric_snapshot(a: dict | None) -> dict | None:
    if not a:
        return None
    return {"fillers_per_min": a["metrics"].get("fillers_per_min"), "wpm": a["metrics"].get("wpm"),
            "rubric_score": a.get("rubric_score")}


@app.post("/api/feedback")
def send_feedback(body: FeedbackBody):
    """Anonymous: no user id, audio or transcripts are stored, only numbers from the first and latest attempt."""
    want, confusing, name = body.want_next.strip(), body.confusing.strip(), body.first_name.strip()
    if body.rating is None and body.pay is None and not want and not confusing:
        raise HTTPException(400, "Answer at least one question first")
    user = _normalize(store().get_user(body.user_id)) if body.user_id else None
    attempts = store().list_attempts(body.user_id) if user else []
    first = next((a for a in attempts if a["day"] == 0), attempts[0] if attempts else None)
    latest = attempts[-1] if attempts and attempts[-1] is not first else None
    plan = plan_for(body.day) if body.day is not None else None
    doc = {
        "id": uuid.uuid4().hex, "created_at": now_iso(), "context": body.context, "day": body.day,
        "lesson": plan["technique"] if plan else None, "worlds": user["worlds"] if user else [],
        "rating": body.rating, "pay": body.pay, "want_next": want, "confusing": confusing, "first_name": name,
        "attempts": len(attempts), "before": _metric_snapshot(first), "after": _metric_snapshot(latest),
    }
    store().insert("feedback", doc)
    return {"ok": True}


def _avg(xs: list) -> float | None:
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(sum(xs) / len(xs), 1) if xs else None


@app.get("/api/admin/feedback")
def admin_feedback(x_admin_password: str = Header("")):
    if not config.ADMIN_PASSWORD:
        raise HTTPException(404, "Admin page is off. Set ADMIN_PASSWORD to turn it on.")
    if not secrets.compare_digest(x_admin_password.encode(), config.ADMIN_PASSWORD.encode()):
        raise HTTPException(401, "Wrong password")
    rows = sorted(store().find("feedback"), key=lambda d: d["created_at"], reverse=True)
    paid = [r["pay"] for r in rows if r.get("pay")]
    paired = [r for r in rows if r.get("before") and r.get("after")]
    return {
        "summary": {
            "responses": len(rows),
            "avg_rating": _avg([r.get("rating") for r in rows]),
            "ratings": len([r for r in rows if r.get("rating")]),
            "pay": {k: round(100 * paid.count(k) / len(paid)) if paid else 0 for k in ("yes", "maybe", "no")},
            "pay_answers": len(paid),
            "with_progress": len(paired),
            "before": {k: _avg([r["before"].get(k) for r in paired]) for k in METRIC_KEYS},
            "after": {k: _avg([r["after"].get(k) for r in paired]) for k in METRIC_KEYS},
        },
        "responses": rows,
    }


# ---------- voice ----------

class TTSBody(BaseModel):
    text: str
    voice: str = "narrator"


@app.post("/api/tts")
def tts(body: TTSBody):
    """Hosted: ElevenLabs eleven_v4 with a persona voice + mood tag. Local: Kokoro. Otherwise 404 and the
    browser falls back to its own speechSynthesis."""
    if not voices.tts_enabled():
        raise HTTPException(404, "TTS off in this mode; use browser speech")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "empty text")
    try:
        audio, media = voices.synthesize(text, body.voice)
    except Exception as e:  # noqa: BLE001
        sentry_sdk.capture_exception(e)
        print(f"TTS failed ({body.voice}): {e!r}", flush=True)
        raise HTTPException(502, "TTS failed")
    return Response(audio, media_type=media, headers={"Cache-Control": "private, max-age=86400"})


# ---------- frontend ----------

if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = config.FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(config.FRONTEND_DIST / "index.html")
