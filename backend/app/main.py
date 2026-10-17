import asyncio
import json
import uuid
from datetime import date, datetime, timedelta

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, feedback, llm, metrics, stt
from .course_plan import PLAN, WEEKS, WORLDS
from .observability import init_sentry
from .store import now_iso, store

init_sentry()
app = FastAPI(title="I Talk, You Listen")
_sessions = asyncio.Semaphore(config.MAX_CONCURRENT_SESSIONS)
FREE_DAYS = 3  # Day 0 + Days 1-3 are free; the rest is Pro (unlocked for the hackathon demo)


@app.on_event("startup")
def load_course():
    """course/*.json is the hand-reviewed source of truth; sync it into the store on boot."""
    for f in sorted(config.COURSE_DIR.glob("day_*.json")):
        store().upsert_lesson(json.loads(f.read_text(encoding="utf-8")))


@app.get("/api/health")
def health():
    return {"ok": True, "mode": config.MODE, "llm": config.LLM_PROVIDER, "model": llm.model_name(),
            "stt": config.STT_PROVIDER, "tts": config.TTS_ENABLED, "store": type(store()).__name__,
            "max_recording_sec": config.MAX_RECORDING_SEC}


# ---------- course ----------

@app.get("/api/course")
def course():
    built = {l["day"] for l in store().list_lessons()}
    return {
        "weeks": WEEKS,
        "days": [{"day": p["day"], "title": p["title"], "technique": p["technique"], "available": p["day"] in built,
                  "pro": p["day"] > FREE_DAYS} for p in PLAN],
        "worlds": WORLDS,
    }


@app.get("/api/lessons/{day}")
def lesson(day: int, world: str = "everyday"):
    l = store().get_lesson(day)
    if not l:
        raise HTTPException(404, "Lesson not built yet")
    world = world if world in WORLDS else "everyday"
    return {
        "day": l["day"], "technique": l["technique"], "title": l["title"], "teach": l["teach"],
        "why_it_works": l["why_it_works"], "example": l["examples"].get(world, ""),
        "drill": l["drills"][world][0], "rubric": l["rubric"], "citations": l["citations"], "world": world,
    }


# ---------- users & progress ----------

class NewUser(BaseModel):
    name: str
    world: str
    goal: str = ""


@app.post("/api/users")
def create_user(body: NewUser):
    if body.world not in WORLDS:
        raise HTTPException(400, "unknown world")
    user = {"id": uuid.uuid4().hex, "name": body.name.strip()[:40] or "friend", "world": body.world,
            "goal": body.goal.strip()[:200], "created_at": now_iso()}
    store().upsert_user(user)
    return user


def _best_by_day(attempts: list[dict]) -> dict[int, dict]:
    best = {}
    for a in attempts:
        cur = best.get(a["day"])
        if not cur or (a.get("rubric_score") or 0) >= (cur.get("rubric_score") or 0):
            best[a["day"]] = a
    return best


def _streak(dates: set[str], today: str) -> int:
    d = date.fromisoformat(today)
    if today not in dates:
        d -= timedelta(days=1)  # streak survives until the end of today
    n = 0
    while d.isoformat() in dates:
        n += 1
        d -= timedelta(days=1)
    return n


def _summary(a: dict) -> dict:
    keep = ("id", "day", "attempt_no", "created_at", "local_date", "rubric_score", "metrics", "transcript")
    return {k: a.get(k) for k in keep}


@app.get("/api/users/{user_id}")
def get_user(user_id: str, today: str | None = None):
    user = store().get_user(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    attempts = store().list_attempts(user_id)
    today = today or date.today().isoformat()
    best = _best_by_day(attempts)
    completed = sorted(best)
    built = {l["day"] for l in store().list_lessons()}
    next_day = next((p["day"] for p in PLAN if p["day"] not in best and p["day"] in built), None)
    return {
        **user,
        "xp": sum(a.get("xp", 0) for a in attempts),
        "streak": _streak({a["local_date"] for a in attempts}, today),
        "completed_days": completed,
        "next_day": next_day,
        "done_today": any(a["local_date"] == today for a in attempts),
    }


@app.get("/api/users/{user_id}/progress")
def progress(user_id: str):
    attempts = store().list_attempts(user_id)
    best = _best_by_day(attempts)
    baseline = next((a for a in attempts if a["day"] == 0), None)
    latest = attempts[-1] if attempts else None
    return {
        "baseline": _summary(baseline) if baseline else None,
        "latest": _summary(latest) if latest else None,
        "by_day": [_summary(best[d]) for d in sorted(best)],
        "history": [_summary(a) for a in attempts],
    }


# ---------- practice ----------

def _xp(result: dict) -> int:
    return 10 + 5 * sum(1 for r in result["rubric"] if r["status"] == "used")


def _run_attempt(user: dict, day: int, audio: bytes, content_type: str, local_date: str) -> dict:
    l = store().get_lesson(day)
    if not l:
        raise HTTPException(404, "Lesson not built yet")
    drill = l["drills"][user["world"]][0]
    heard = stt.transcribe(audio, content_type)
    if len(heard["words"]) < 5 and len(heard["text"].split()) < 5:
        raise HTTPException(422, "I couldn't hear enough. Try again a little closer to the mic.")
    if heard["words"] and heard["words"][-1]["end"] > config.MAX_RECORDING_SEC + 5:
        raise HTTPException(413, f"Recordings are capped at {config.MAX_RECORDING_SEC} seconds.")
    m = metrics.compute(heard["words"], heard["text"], drill["time_limit_sec"])
    marked = metrics.marked_transcript(heard["words"], heard["text"])
    try:
        result = feedback.evaluate(l, user["world"], drill["prompt"], marked)
    except feedback.GradingFailed as e:
        raise HTTPException(503, str(e))
    previous = [a for a in store().list_attempts(user["id"]) if a["day"] == day]
    attempt = {
        "id": uuid.uuid4().hex, "user_id": user["id"], "day": day, "attempt_no": len(previous) + 1,
        "created_at": now_iso(), "local_date": local_date, "world": user["world"], "drill": drill["prompt"],
        "transcript": heard["text"], "marked_transcript": marked, "metrics": m, **result,
        "stt": {"provider": heard["provider"], "latency_ms": heard["latency_ms"]},
    }
    attempt["xp"] = _xp(result)
    store().add_attempt(attempt)
    attempt["previous"] = _summary(previous[-1]) | {"rubric": previous[-1]["rubric"]} if previous else None
    return attempt


@app.post("/api/attempts")
async def create_attempt(user_id: str = Form(...), day: int = Form(...), local_date: str = Form(...),
                         audio: UploadFile = File(...)):
    user = store().get_user(user_id)
    if not user:
        raise HTTPException(404, "user not found")
    try:
        datetime.strptime(local_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "local_date must be YYYY-MM-DD")
    todays = [a for a in store().list_attempts(user_id) if a["local_date"] == local_date]
    if len(todays) >= config.MAX_ATTEMPTS_PER_DAY:
        raise HTTPException(429, "That's a lot of practice for one day! Come back tomorrow.")
    data = await audio.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Recording too large")
    if _sessions.locked():
        raise HTTPException(503, "The coach is busy with other learners. Try again in a few seconds.")
    async with _sessions:
        return await run_in_threadpool(_run_attempt, user, day, data, audio.content_type or "audio/webm", local_date)


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
