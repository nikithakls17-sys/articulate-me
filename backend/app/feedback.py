"""Technique check (Gemma) + grounding validator.

Gemma grades each rubric item used|partly|missing with a quote copied from the transcript, plus ONE fix
and ONE rewritten line. The validator refuses quotes that aren't really in the transcript."""
import re
import time

import sentry_sdk
from rapidfuzz import fuzz

from . import config, llm
from .course_plan import WORLDS
from .observability import report_issue

STATUSES = {"used", "partly", "missing"}
MATCH_THRESHOLD = 90
GENERIC = re.compile(r"^\W*(great|good|nice|awesome|amazing|excellent|well done|fantastic)( job| work| effort)?\W*$", re.I)

SYSTEM_V1 = """You are a warm, specific speaking coach. You check whether a learner used today's technique.
Rules:
- Grade every rubric item as "used", "partly" or "missing".
- For "used" or "partly", "evidence" MUST be words copied exactly from the transcript (5-25 words). Never paraphrase.
- For "missing", "evidence" is "".
- "feedback": at most 2 sentences. Encouraging and specific. Quote the learner's own words. "Great job!" alone is banned.
- "fix": exactly ONE thing to change next time, one sentence.
- "rewrite": one line the learner could have said instead, showing that fix.
Return only JSON."""

SYSTEM_V2 = SYSTEM_V1 + """
- Judge only what is in the transcript; the transcript is speech-to-text, so ignore spelling and punctuation.
- "[pause]" marks a silence longer than 0.7 seconds. Do not include "[pause]" in evidence.
- Be strict: "used" means a listener would clearly notice the technique. If unsure, choose "partly".
- The fix must target the weakest rubric item."""

PROMPTS = {"v1": SYSTEM_V1, "v2": SYSTEM_V2}

USER_TMPL = """Today's technique: {technique} ("{title}")
How it works:
{teach}

Learner's world: {world}
Drill they answered: {drill}

Rubric:
{rubric}

Transcript:
\"\"\"{transcript}\"\"\"

Return JSON:
{{"rubric": [{{"id": "<rubric id>", "status": "used|partly|missing", "evidence": "<exact quote or empty>"}}],
  "feedback": "...", "fix": "...", "rewrite": "..."}}"""


class GradingFailed(RuntimeError):
    pass


def _norm(s: str) -> str:
    s = s.replace("[pause]", " ").lower()
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def quote_in_transcript(quote: str, transcript: str) -> bool:
    q, t = _norm(quote), _norm(transcript)
    if not q:
        return False
    return q in t or fuzz.partial_ratio(q, t) >= MATCH_THRESHOLD


def _split_sentences(s: str) -> list[str]:
    return [x for x in re.split(r"(?<=[.!?])\s+", s.strip()) if x]


def validate(result: dict, rubric: list[dict], transcript: str) -> list[dict]:
    """Returns a list of problems: {"kind", "rubric_id", "detail"}."""
    problems = []
    by_id = {r.get("id"): r for r in result.get("rubric", []) if isinstance(r, dict)}
    for item in rubric:
        r = by_id.get(item["id"])
        if not r:
            problems.append({"kind": "missing_item", "rubric_id": item["id"], "detail": "no grade"})
            continue
        if r.get("status") not in STATUSES:
            problems.append({"kind": "bad_status", "rubric_id": item["id"], "detail": str(r.get("status"))})
        elif r["status"] in ("used", "partly") and not quote_in_transcript(r.get("evidence", ""), transcript):
            problems.append({"kind": "ungrounded_quote", "rubric_id": item["id"], "detail": r.get("evidence", "")})
    fb = (result.get("feedback") or "").strip()
    if not fb or len(_split_sentences(fb)) > 2 or GENERIC.match(fb):
        problems.append({"kind": "feedback_format", "rubric_id": "-", "detail": fb[:200]})
    fix = (result.get("fix") or "").strip()
    if not fix or len(_split_sentences(fix)) > 2 or re.search(r"(^|\n)\s*(\d+[.)]|[-*•])\s", fix):
        problems.append({"kind": "fix_not_single", "rubric_id": "-", "detail": fix[:200]})
    if not (result.get("rewrite") or "").strip():
        problems.append({"kind": "missing_rewrite", "rubric_id": "-", "detail": ""})
    return problems


def _retry_message(problems: list[dict]) -> str:
    lines = []
    for p in problems:
        if p["kind"] == "ungrounded_quote":
            lines.append(f'- Rubric "{p["rubric_id"]}": the evidence "{p["detail"]}" is NOT in the transcript. '
                         "Copy words exactly from the transcript, or mark it missing.")
        elif p["kind"] == "feedback_format":
            lines.append("- feedback must be 1-2 specific sentences quoting the learner.")
        elif p["kind"] == "fix_not_single":
            lines.append("- fix must be exactly one change, one sentence, no list.")
        else:
            lines.append(f'- {p["kind"]} for "{p["rubric_id"]}". Grade every rubric item with a valid status.')
    return "Your JSON had problems:\n" + "\n".join(lines) + "\nReturn the corrected full JSON."


def _finalize(result: dict, rubric: list[dict], problems: list[dict]) -> dict:
    bad_quotes = {p["rubric_id"] for p in problems if p["kind"] == "ungrounded_quote"}
    by_id = {r.get("id"): r for r in result.get("rubric", []) if isinstance(r, dict)}
    graded = []
    for item in rubric:
        r = by_id.get(item["id"], {})
        status = r.get("status") if r.get("status") in STATUSES else "unverified"
        evidence = (r.get("evidence") or "").strip()
        if item["id"] in bad_quotes:
            status, evidence = "unverified", ""
        if status == "missing":
            evidence = ""
        graded.append({"id": item["id"], "check": item["check"], "status": status, "evidence": evidence})
    fb = " ".join(_split_sentences((result.get("feedback") or "").strip())[:2])
    fix = (result.get("fix") or "").strip().split("\n")[0]
    points = {"used": 1.0, "partly": 0.5, "missing": 0.0}
    scored = [points[g["status"]] for g in graded if g["status"] in points]
    return {
        "rubric": graded,
        "feedback": fb,
        "fix": fix,
        "rewrite": (result.get("rewrite") or "").strip(),
        "rubric_score": round(100 * sum(scored) / len(scored)) if scored else None,
    }


def evaluate(lesson: dict, world: str, drill: str, transcript: str, prompt_version: str | None = None) -> dict:
    pv = prompt_version or config.PROMPT_VERSION
    system = PROMPTS.get(pv, SYSTEM_V1)
    rubric = lesson["rubric"]
    teach = "\n".join(f"- {t}" for t in lesson.get("teach", [])) or "- (baseline: no technique taught yet)"
    user = USER_TMPL.format(
        technique=lesson["technique"], title=lesson["title"], teach=teach, world=WORLDS.get(world, world),
        drill=drill, rubric="\n".join(f'- {r["id"]}: {r["check"]}' for r in rubric), transcript=transcript,
    )
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    stats = {"llm_calls": 0, "input_tokens": 0, "output_tokens": 0, "llm_latency_ms": 0}
    t0 = time.perf_counter()

    def call(msgs):
        try:
            data, out = llm.chat_json(msgs, temperature=0.2, max_tokens=900, operation="grade_technique")
        except ValueError as e:
            # unparseable output (or an empty reply when the box is out of memory): treat as a failed pass
            report_issue("llm: unparseable grading output", kind="unparseable", day=lesson["day"], error=str(e)[:80])
            data, out = {}, {"text": "", "input_tokens": 0, "output_tokens": 0, "latency_ms": 0}
        stats["llm_calls"] += 1
        stats["input_tokens"] += out["input_tokens"]
        stats["output_tokens"] += out["output_tokens"]
        stats["llm_latency_ms"] += out["latency_ms"]
        return data, out["text"]

    with sentry_sdk.start_span(op="gen_ai.invoke_agent", name=f"coach day {lesson['day']}") as span:
        span.set_data("gen_ai.agent.name", "speaking-coach")
        span.set_data("prompt_version", pv)
        result, raw = call(messages)
        problems = validate(result, rubric, transcript)
        first_problems = list(problems)
        if problems:
            messages += [{"role": "assistant", "content": raw or "{}"},
                         {"role": "user", "content": _retry_message(problems)}]
            retry, _ = call(messages)
            retry_problems = validate(retry, rubric, transcript)
            if len(retry_problems) <= len(problems):
                result, problems = retry, retry_problems
        for p in problems:
            report_issue(f"validator: {p['kind']}", rubric_id=p["rubric_id"], day=lesson["day"], kind=p["kind"])
        span.set_data("validator.first_pass_problems", len(first_problems))
        span.set_data("validator.final_problems", len(problems))

    if not any(isinstance(r, dict) for r in result.get("rubric", [])):
        raise GradingFailed("The coach couldn't grade that one. Please try again.")
    final = _finalize(result, rubric, problems)
    final["validator"] = {"first_pass": [p["kind"] for p in first_problems], "final": [p["kind"] for p in problems],
                          "retried": bool(first_problems)}
    final["stats"] = {**stats, "total_ms": int((time.perf_counter() - t0) * 1000), "prompt_version": pv,
                      "model": llm.model_name()}
    return final
