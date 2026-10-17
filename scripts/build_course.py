"""Generate course chapters from the textbooks (RAG) with Gemma, write course/day_N.json for hand review.

Usage:  .venv/Scripts/python scripts/build_course.py 0 1 2 3      (days to build; default all)
Set BUILD_MODEL to use a bigger Gemma for this one-off step than the app uses at runtime.
Runtime never invents lessons: the app only serves what is in course/.
"""
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

if os.getenv("BUILD_MODEL"):
    os.environ["OLLAMA_MODEL"] = os.environ["BUILD_MODEL"]

from app import config, llm  # noqa: E402
from app.course_plan import BASELINE_SCENARIOS, PARTNERS, PLAN, WORLDS, plan_for  # noqa: E402
from app.rag import retrieve  # noqa: E402

PAGES_PROMPT = """You are writing one short chapter of a speaking course, like a friendly illustrated textbook.
Technique: {technique} ("{title}"). Goal: {learn}
The technique, as this course teaches it: {outline}

The "steps" must follow that outline. Explain and support everything with the textbook excerpts below; do not
add advice they don't support. The before/after must be an everyday spoken answer, not a speech about a speech. Plain language for an adult
beginner, short sentences, no walls of text. Each field has a word limit; stay under it.

EXCERPTS:
{excerpts}

Return JSON:
{{
  "intro": "why this matters, max 35 words",
  "steps": [{{"label": "1-3 word step name", "text": "max 20 words", "src": <excerpt number>}}],
  "key_terms": [{{"term": "...", "meaning": "max 15 words", "src": <excerpt number>}}],
  "table": {{"title": "a comparison, e.g. Do vs Don't", "columns": ["2 or 3 short headers"],
            "rows": [["short cell", "short cell"]], "src": <excerpt number>}},
  "before_after": {{"situation": "max 12 words", "before": "a weak spoken line, max 30 words",
                   "after": "the same line using the technique, max 35 words", "why": "max 20 words"}},
  "why_it_works": "max 35 words",
  "src_why": <excerpt number>
}}
steps: 2 to 5 items in order. key_terms: 2 to 4. table rows: 2 to 4."""

QUIZ_PROMPT = """Write a quick check for this speaking lesson: exactly 3 multiple-choice questions.
Test understanding of how to USE the technique, not trivia. 3 options each, exactly one correct.
Make wrong options plausible. Use only this lesson content:

{lesson}

Return JSON: {{"quiz": [{{"q": "max 25 words", "options": ["...", "...", "..."], "answer": <index 0-2>,
"explain": "why, max 20 words"}}]}}"""

WORLD_PROMPT = """You are writing practice material for a speaking course lesson.
Technique: {technique} ("{title}"). How it works: {steps}

For EACH world below write:
- "example": 2-4 sentences of natural speech by someone in that world using the technique well.
- "scenario": a short role-play where the learner talks with the partner listed for that world. The partner's
  questions must make the learner need this technique. Partner behaviour: {partner_push}
  Fields: "partner" (a first name or title), "role" (who they are, max 8 words), "setup" (max 20 words,
  addressed to the learner as "you"), "opening" (the FIRST thing the partner says TO the learner, max 30 words,
  spoken by the partner, calling the learner "you". It must be a question or request that calls for the technique.
  Never start it with the partner's own name.)

Worlds (with typical partners):
{worlds}

Return JSON: {{"<world_key>": {{"example": "...", "scenario": {{"partner": "...", "role": "...", "setup": "...",
"opening": "..."}}}}, ...}} with keys exactly: {keys}"""


def excerpts_text(chunks):
    return "\n\n".join(f"[{i + 1}] ({c['book_title']}, {c['chapter']} / {c['section']}, p.{c['page']})\n{c['text']}"
                       for i, c in enumerate(chunks))


def build_day0():
    p = plan_for(0)
    return {"day": 0, "technique": p["technique"], "title": p["title"], "learn": p["learn"], "pages": [], "quiz": [],
            "examples": {}, "scenarios": BASELINE_SCENARIOS, "rubric": p["rubric"], "citations": []}


def _check_pages(d):
    if not (2 <= len(d.get("steps", [])) <= 5):
        return "steps count"
    if not (1 <= len(d.get("key_terms", [])) <= 5):
        return "key_terms count"
    t = d.get("table") or {}
    if not t.get("columns") or not t.get("rows") or any(len(r) != len(t["columns"]) for r in t["rows"]):
        return "table shape"
    ba = d.get("before_after") or {}
    if not all(ba.get(k) for k in ("before", "after")):
        return "before_after"
    if not d.get("intro") or not d.get("why_it_works"):
        return "intro/why"
    return None


def _check_quiz(d):
    q = d.get("quiz", [])
    if len(q) < 2:
        return "quiz count"
    for item in q:
        if len(item.get("options", [])) < 2 or not isinstance(item.get("answer"), int) \
                or not 0 <= item["answer"] < len(item["options"]):
            return "quiz item"
    return None


def _check_worlds(d):
    for w in WORLDS:
        x = d.get(w)
        if not (isinstance(x, dict) and x.get("example") and isinstance(x.get("scenario"), dict)):
            return f"missing world {w}"
        sc = x["scenario"]
        if not all(sc.get(k) for k in ("partner", "role", "setup", "opening")):
            return f"incomplete scenario {w}"
        first = sc["partner"].split()[-1].lower().strip(".,")
        if sc["opening"].lower().lstrip("\"' ").startswith((sc["partner"].lower(), first)):
            return f"opening for {w} is addressed to the partner, not the learner"
    return None


def build_day(day: int, retries: int = 2):
    p = plan_for(day)
    # several focused searches beat one long query (one long query pulled only "conclusions" chunks for PREP)
    chunks, seen_ids = [], set()
    for q in p.get("queries") or [p["query"]]:
        for c in retrieve(q, k=2):
            if c["id"] not in seen_ids and len(chunks) < 6:
                seen_ids.add(c["id"])
                chunks.append(c)
    if not chunks:
        sys.exit("Vector store is empty. Run scripts/ingest_books.py first.")
    stats = {"input_tokens": 0, "output_tokens": 0, "latency_ms": 0}

    def call(prompt, check, max_tokens=2000):
        problem = "no output"
        for attempt in range(retries + 1):
            try:
                data, out = llm.chat_json([{"role": "user", "content": prompt}], temperature=0.4,
                                          max_tokens=max_tokens, operation="build_course")
            except ValueError as e:
                problem = f"unparseable: {e}"
                print(f"  day {day}: retry {attempt + 1} ({problem})")
                continue
            for k in stats:
                stats[k] += out[k]
            problem = check(data)
            if not problem:
                return data
            print(f"  day {day}: retry {attempt + 1} ({problem})")
        raise RuntimeError(f"day {day}: {problem}")

    pg = call(PAGES_PROMPT.format(excerpts=excerpts_text(chunks), **p), _check_pages)

    def cite(n):
        if isinstance(n, int) and 1 <= n <= len(chunks):
            c = chunks[n - 1]
            return {"book": c["book_title"], "chapter": c["chapter"], "section": c["section"], "page": c["page"],
                    "url": c["url"], "chunk_id": c["id"]}
        return None

    first_src = next((s["src"] for s in pg["steps"] if isinstance(s.get("src"), int)), 1)
    pages = [
        {"kind": "intro", "title": p["title"], "body": pg["intro"], "learn": p["learn"]},
        {"kind": "steps", "title": f"How {p['technique']} works",
         "steps": [{"label": s["label"], "text": s["text"]} for s in pg["steps"]], "cite": cite(first_src)},
        {"kind": "terms", "title": "Key terms",
         "terms": [{"term": t["term"], "meaning": t["meaning"]} for t in pg["key_terms"]],
         "cite": cite((pg["key_terms"][0] or {}).get("src"))},
        {"kind": "table", "title": pg["table"].get("title") or "Compare", "columns": pg["table"]["columns"],
         "rows": pg["table"]["rows"], "cite": cite(pg["table"].get("src"))},
        {"kind": "before_after", "title": "Before and after",
         **{k: pg["before_after"].get(k, "") for k in ("situation", "before", "after", "why")}},
        {"kind": "why", "title": "Why it works", "body": pg["why_it_works"], "cite": cite(pg.get("src_why"))},
        {"kind": "example", "title": "Hear it in your world"},
    ]
    lesson_text = json.dumps({k: v for k, v in pg.items() if k != "table"}, ensure_ascii=False)
    quiz = call(QUIZ_PROMPT.format(lesson=lesson_text), _check_quiz, max_tokens=1200)["quiz"][:3]

    worlds_txt = "\n".join(f"- {k}: {v}. Partner: {PARTNERS[k]}" for k, v in WORLDS.items())
    steps_txt = "; ".join(f"{s['label']}: {s['text']}" for s in pg["steps"])
    per_world = call(
        WORLD_PROMPT.format(steps=steps_txt, worlds=worlds_txt, keys=", ".join(WORLDS), **p),
        lambda d: _check_worlds(d),
        max_tokens=2500,
    )
    citations, seen = [], set()
    for pgx in pages:
        c = pgx.get("cite")
        if c and c["chunk_id"] not in seen:
            seen.add(c["chunk_id"])
            citations.append(c)
    return {
        "day": day, "technique": p["technique"], "title": p["title"], "learn": p["learn"],
        "pages": pages, "quiz": quiz,
        "examples": {w: per_world[w]["example"] for w in WORLDS},
        "scenarios": {w: per_world[w]["scenario"] for w in WORLDS},
        "rubric": p["rubric"], "citations": citations,
        "generated": {"model": llm.model_name(), "prompt_version": config.PROMPT_VERSION, **stats},
    }


def main():
    days = [int(a) for a in sys.argv[1:]] or [p["day"] for p in PLAN]
    config.COURSE_DIR.mkdir(exist_ok=True)
    for day in days:
        t0 = time.perf_counter()
        lesson = build_day0() if day == 0 else build_day(day)
        out = config.COURSE_DIR / f"day_{day}.json"
        out.write_text(json.dumps(lesson, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
        g = lesson.get("generated", {})
        print(f"day {day}: wrote {out.name} in {time.perf_counter() - t0:.1f}s "
              f"({g.get('input_tokens', 0)} in / {g.get('output_tokens', 0)} out tokens)")
    print("Review the files in course/ by hand, then restart the app (it loads course/ on startup).")


if __name__ == "__main__":
    main()
