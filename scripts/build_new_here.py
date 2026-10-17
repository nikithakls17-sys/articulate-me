"""Build the "New here" chapter(s): pages from Wikipedia (CC BY-SA), expression tables from Wiktionary (CC BY-SA).

Usage:  BUILD_MODEL=gemma4:e4b .venv/Scripts/python scripts/build_new_here.py
"""
import json
import os
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
if os.getenv("BUILD_MODEL"):
    os.environ["OLLAMA_MODEL"] = os.environ["BUILD_MODEL"]

from app import config, llm  # noqa: E402
from app.course_plan import (COUNTRIES, EXPRESSIONS, NEW_HERE_PLAN, NEW_HERE_SCENARIOS, NEW_HERE_TONE,  # noqa: E402
                             SETTINGS)
from app.wiktionary import HEADERS, lookup  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_course import QUIZ_PROMPT, _check_pages, _check_quiz  # noqa: E402

WIKI = "https://en.wikipedia.org/w/api.php"

PAGES_PROMPT = """You are writing one short chapter of a speaking course for people who are new to a country
(international students, immigrants, people who just moved). Topic: {title}. Goal: {learn}
How this course teaches it: {outline}

Tone rules (important): {tone}

Use ONLY the encyclopedia excerpts below; do not add claims they don't support. Leave out any generalisations
about genders or nationalities. Plain, warm language for an adult whose first language may not be English.
Each field has a word limit; stay under it.

EXCERPTS (Wikipedia, "{article}"):
{excerpts}

Return JSON:
{{
  "intro": "why this matters for someone new here, max 35 words",
  "steps": [{{"label": "1-3 word step name", "text": "max 20 words", "src": <excerpt number>}}],
  "key_terms": [{{"term": "...", "meaning": "max 15 words", "src": <excerpt number>}}],
  "table": {{"title": "a comparison, e.g. Small talk question vs real question", "columns": ["2 short headers"],
            "rows": [["short cell", "short cell"]], "src": <excerpt number>}},
  "before_after": {{"situation": "max 12 words", "before": "a reply that ends the conversation, max 25 words",
                   "after": "a reply that keeps it going, max 30 words", "why": "max 20 words"}},
  "why_it_works": "max 35 words",
  "src_why": <excerpt number>
}}
steps: 3 items (greeting, conversation, closing). key_terms: 2 to 3. table rows: 2 to 4."""

EXAMPLES_PROMPT = """Write one short example of good small talk for each setting below: 2-4 sentences of natural
speech by someone new to the area who greets, answers briefly, shares one small detail and asks something back.
Tone rules: {tone}
Settings: {settings}
Return JSON: {{"<setting key>": "...", ...}} with keys exactly: {keys}"""


def wikipedia(title: str) -> dict:
    r = httpx.get(WIKI, headers=HEADERS, timeout=20, params={
        "action": "query", "prop": "extracts|revisions", "rvprop": "ids", "explaintext": 1, "titles": title,
        "format": "json", "formatversion": 2})
    r.raise_for_status()
    page = r.json()["query"]["pages"][0]
    return {"title": page["title"], "text": page["extract"], "revid": page["revisions"][0]["revid"],
            "url": f"https://en.wikipedia.org/w/index.php?title={title.replace(' ', '_')}&oldid={page['revisions'][0]['revid']}"}


def chunks(text: str, words: int = 170, keep: int = 6) -> list[str]:
    paras = [p.strip() for p in text.split("\n") if p.strip() and not p.startswith("==")]
    out, buf = [], []
    for p in paras:
        buf += p.split()
        if len(buf) >= words:
            out.append(" ".join(buf[:words]))
            buf = buf[words:]
    if buf:
        out.append(" ".join(buf))
    return out[:keep]


def call(prompt, check, max_tokens=1800, retries=2):
    problem = "no output"
    for attempt in range(retries + 1):
        try:
            data, out = llm.chat_json([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=max_tokens,
                                      operation="build_course")
        except ValueError as e:
            problem = f"unparseable: {e}"
            print(f"  retry {attempt + 1} ({problem})")
            continue
        problem = check(data)
        if not problem:
            return data
        print(f"  retry {attempt + 1} ({problem})")
    raise RuntimeError(problem)


def build(p: dict) -> dict:
    t0 = time.perf_counter()
    wiki = wikipedia("Small talk")
    ex = chunks(wiki["text"])
    excerpts = "\n\n".join(f"[{i + 1}] {c}" for i, c in enumerate(ex))
    wcite = {"book": "Wikipedia", "chapter": wiki["title"], "section": f"revision {wiki['revid']}", "page": 0,
             "url": wiki["url"], "license": "CC BY-SA 4.0"}

    pg = call(PAGES_PROMPT.format(excerpts=excerpts, tone=NEW_HERE_TONE, article=wiki["title"], **p), _check_pages)

    tables = {}
    for country, items in EXPRESSIONS.items():
        rows, links = [], []
        for term, hint in items:
            e = lookup(term, country, hint)
            if e:
                rows.append([f"“{term}”", e["meaning"].rstrip(".") + "."])
                links.append({"term": term, "url": e["url"]})
        tables[country] = {"kind": "table", "title": f"Everyday expressions you'll hear in {COUNTRIES[country]}",
                           "columns": ["Expression", "What it usually means"], "rows": rows,
                           "cite": {"book": "Wiktionary", "chapter": ", ".join(l["term"] for l in links), "section": "",
                                    "page": 0, "url": links[0]["url"] if links else "", "license": "CC BY-SA 4.0"},
                           "links": links}
        print(f"  {country}: {len(rows)}/{len(items)} expressions from Wiktionary")

    pages = [
        {"kind": "intro", "title": p["title"], "body": pg["intro"], "learn": p["learn"]},
        {"kind": "steps", "title": "Greeting, conversation, closing",
         "steps": [{"label": s["label"], "text": s["text"]} for s in pg["steps"]], "cite": wcite},
        {"kind": "terms", "title": "Key terms", "terms": [{"term": t["term"], "meaning": t["meaning"]} for t in pg["key_terms"]],
         "cite": wcite},
        {"kind": "expressions", "title": "Everyday expressions"},  # replaced per country at request time
        {"kind": "table", "title": pg["table"].get("title") or "Compare", "columns": pg["table"]["columns"],
         "rows": pg["table"]["rows"], "cite": wcite},
        {"kind": "before_after", "title": "Before and after",
         **{k: pg["before_after"].get(k, "") for k in ("situation", "before", "after", "why")}},
        {"kind": "why", "title": "Why it works", "body": pg["why_it_works"], "cite": wcite},
        {"kind": "example", "title": "Hear it in your setting"},
    ]
    lesson_text = json.dumps({k: v for k, v in pg.items() if k != "table"}, ensure_ascii=False)
    quiz = call(QUIZ_PROMPT.format(lesson=lesson_text), _check_quiz, max_tokens=1200)["quiz"][:3]
    examples = call(EXAMPLES_PROMPT.format(tone=NEW_HERE_TONE, keys=", ".join(SETTINGS),
                                           settings="\n".join(f"- {k}: {v}" for k, v in SETTINGS.items())),
                    lambda d: None if all(isinstance(d.get(k), str) and d[k] for k in SETTINGS) else "missing setting",
                    max_tokens=900)
    print(f"  built in {time.perf_counter() - t0:.0f}s")
    return {
        "day": p["day"], "track": p["track"], "technique": p["technique"], "title": p["title"], "learn": p["learn"],
        "pages": pages, "quiz": quiz, "country_tables": tables,
        "examples": {k: examples[k] for k in SETTINGS}, "scenarios": NEW_HERE_SCENARIOS,
        "rubric": p["rubric"], "citations": [wcite] + [t["cite"] for t in tables.values()],
        "sources": [{"name": f"Wikipedia: {wiki['title']}", "url": wiki["url"], "license": "CC BY-SA 4.0"},
                    {"name": "Wiktionary", "url": "https://en.wiktionary.org/", "license": "CC BY-SA 4.0"}],
        "generated": {"model": llm.model_name(), "prompt_version": config.PROMPT_VERSION},
    }


if __name__ == "__main__":
    for plan in NEW_HERE_PLAN:
        lesson = build(plan)
        out = config.COURSE_DIR / f"day_{plan['day']}.json"
        out.write_text(json.dumps(lesson, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
        print("wrote", out.name)
