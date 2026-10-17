"""Generate course lessons from the textbooks (RAG) with Gemma, write course/day_N.json for hand review.

Usage:  .venv/Scripts/python scripts/build_course.py 0 1 2 3      (days to build; default all)
Runtime never invents lessons: the app only serves what is in course/.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app import config, llm  # noqa: E402
from app.course_plan import PLAN, WORLDS, plan_for  # noqa: E402
from app.rag import retrieve  # noqa: E402

DAY0_DRILLS = {
    "student": "Introduce yourself to a new class as if it's the first day of a seminar.",
    "job_seeker": "An interviewer says: \"So, tell me about yourself.\" Answer.",
    "customer_facing": "Introduce yourself to a new customer or patient and say how you'll help them today.",
    "creator": "Record the opening of a video where you introduce yourself to new viewers.",
    "everyday": "You're at a friend's party and meet someone new. Introduce yourself.",
}

TEACH_PROMPT = """You are writing one short lesson for a daily speaking course, like Duolingo for talking.
Technique of the day: {technique} ("{title}"). Drill idea: {drill_idea}.

Use ONLY the textbook excerpts below. Do not add advice that is not supported by them.
Plain language for an adult beginner. No jargon without explaining it.

EXCERPTS:
{excerpts}

Return JSON:
{{
  "teach": ["3 to 5 short cards, each 1-3 sentences, teaching how to do the technique step by step"],
  "why_it_works": "1-2 sentences on why it works for listeners",
  "used_excerpts": [list of excerpt numbers you actually used]
}}"""

WORLD_PROMPT = """You are writing examples and practice drills for a speaking course lesson.
Technique: {technique} ("{title}"). How it works:
{teach}

For EACH world below, write:
- "example": a short spoken example (2-5 sentences, sounds like real speech) of someone in that world using the technique well.
- "drill": a practice prompt the learner will answer out loud in about 60 seconds. It must REQUIRE the technique ({drill_idea}). Address the learner as "you" and give a concrete situation.

Worlds:
{worlds}

Return JSON: {{"<world_key>": {{"example": "...", "drill": "..."}}, ...}} with keys exactly: {keys}"""


def excerpts_text(chunks):
    return "\n\n".join(f"[{i + 1}] ({c['book_title']}, {c['chapter']} / {c['section']}, p.{c['page']})\n{c['text']}"
                       for i, c in enumerate(chunks))


def build_day0():
    p = plan_for(0)
    return {
        "day": 0, "technique": p["technique"], "title": p["title"], "teach": [], "why_it_works": "",
        "examples": {}, "drills": {w: [{"prompt": d, "time_limit_sec": 60}] for w, d in DAY0_DRILLS.items()},
        "rubric": p["rubric"], "citations": [],
    }


def build_day(day: int, retries: int = 2):
    p = plan_for(day)
    chunks = retrieve(p["query"], k=6)
    if not chunks:
        sys.exit("Vector store is empty. Run scripts/ingest_books.py first.")
    stats = {"input_tokens": 0, "output_tokens": 0, "latency_ms": 0}

    def call(prompt, check):
        for attempt in range(retries + 1):
            data, out = llm.chat_json([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=2500,
                                      operation="build_course")
            for k in stats:
                stats[k] += out[k]
            problem = check(data)
            if not problem:
                return data
            print(f"  day {day}: retry {attempt + 1} ({problem})")
        raise RuntimeError(f"day {day}: {problem}")

    teach = call(TEACH_PROMPT.format(excerpts=excerpts_text(chunks), **p),
                 lambda d: None if 3 <= len(d.get("teach", [])) <= 5 and d.get("why_it_works") else "bad teach shape")
    worlds_txt = "\n".join(f"- {k}: {v}" for k, v in WORLDS.items())
    per_world = call(WORLD_PROMPT.format(teach="\n".join(teach["teach"]), worlds=worlds_txt, keys=", ".join(WORLDS), **p),
                     lambda d: None if all(isinstance(d.get(w), dict) and d[w].get("example") and d[w].get("drill")
                                           for w in WORLDS) else "missing world")
    used = [i for i in teach.get("used_excerpts", []) if isinstance(i, int) and 1 <= i <= len(chunks)] or [1]
    citations, seen = [], set()
    for i in used:
        c = chunks[i - 1]
        key = (c["book"], c["chapter"], c["page"])
        if key not in seen:
            seen.add(key)
            citations.append({"book": c["book_title"], "chapter": c["chapter"], "section": c["section"],
                              "page": c["page"], "url": c["url"], "chunk_id": c["id"]})
    lesson = {
        "day": day, "technique": p["technique"], "title": p["title"],
        "teach": teach["teach"], "why_it_works": teach["why_it_works"],
        "examples": {w: per_world[w]["example"] for w in WORLDS},
        "drills": {w: [{"prompt": per_world[w]["drill"], "time_limit_sec": 60}] for w in WORLDS},
        "rubric": p["rubric"], "citations": citations,
        "generated": {"model": llm.model_name(), "prompt_version": config.PROMPT_VERSION, **stats},
    }
    return lesson


def main():
    days = [int(a) for a in sys.argv[1:]] or [p["day"] for p in PLAN]
    config.COURSE_DIR.mkdir(exist_ok=True)
    for day in days:
        t0 = time.perf_counter()
        lesson = build_day0() if day == 0 else build_day(day)
        out = config.COURSE_DIR / f"day_{day}.json"
        out.write_text(json.dumps(lesson, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"day {day}: wrote {out.name} in {time.perf_counter() - t0:.1f}s")
    print("Review the files in course/ by hand, then restart the app (it loads course/ on startup).")


if __name__ == "__main__":
    main()
