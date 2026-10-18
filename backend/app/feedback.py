"""Technique check (Gemma) + grounding validator.

Gemma grades each rubric item used|partly|missing with a quote copied from the transcript, plus ONE fix
and ONE rewritten line. The validator refuses quotes that aren't really in the transcript."""
import re
import time

import sentry_sdk
from rapidfuzz.distance import Indel

from . import config, llm
from .course_plan import WORLDS
from .observability import report_issue

STATUSES = {"used", "partly", "missing"}
CHATTER = re.compile(r"\*\*|here (are|is) (a|some|the)|option \d|feedback sentences", re.I)
MATCH_THRESHOLD = 90
QUOTE_FILLERS = {"um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm"}
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
Situation: {drill}

Rubric:
{rubric}

What was said:
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
    """True if the quote matches some same-length run of transcript words at >= 90% similarity.
    (partial_ratio over the whole transcript was too lenient: it accepted paraphrases.)"""
    qw = [w for w in _norm(quote).replace("'", "").split() if w not in QUOTE_FILLERS]
    tw = [w for w in _norm(transcript).replace("'", "").split() if w not in QUOTE_FILLERS]
    if not qw:
        return False
    # word-level similarity: one changed word in a 10-word quote is ~90%; a paraphrase is not
    n, best = len(qw), 0.0
    for size in {max(1, n - 1), n, n + 1}:
        for i in range(0, max(1, len(tw) - size + 1)):
            best = max(best, Indel.normalized_similarity(qw, tw[i : i + size]) * 100)
    return best >= MATCH_THRESHOLD


def _split_sentences(s: str) -> list[str]:
    # line breaks count as breaks too, so multi-line "Option 1:" style chatter fails the 2-sentence rule
    return [x for x in re.split(r"(?<=[.!?])\s+|\n+", s.strip()) if x.strip()]


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
    if not fb or len(_split_sentences(fb)) > 2 or GENERIC.match(fb) or CHATTER.search(fb):
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


def technique_summary(lesson: dict) -> str:
    steps = next((pg.get("steps") for pg in lesson.get("pages", []) if pg.get("kind") == "steps"), None)
    if steps:
        return "\n".join(f"- {s['label']}: {s['text']}" for s in steps)
    return "- (baseline: no technique taught yet)"


def _first_sentences(text: str, n: int, keep_questions: bool = False) -> str:
    """Keep the first n real sentences, dropping chatter lines like 'Here are some options:' and markdown.
    Questions are dropped too (feedback shouldn't ask things), unless keep_questions."""
    lines = [l for l in re.split(r"\n+", text or "") if l.strip() and not CHATTER.search(l)]
    text = re.sub(r"[*“”]|-{2,}", "", " ".join(lines))
    text = re.sub(r"^.{0,160}?\bhere(?: are| is|'s|’s)[^:]{0,120}:\s*", "", text, flags=re.I)  # "Okay, here are two...:"
    sents = [x for x in _split_sentences(text) if keep_questions or not x.rstrip().endswith("?")]
    return " ".join(sents[:n]).strip().strip('"\u201c\u201d ')


def _grade_stepwise(rubric: list[dict], said: str, call_text) -> dict:
    """For small local models (gemma3:1b): one plain-text question per call, JSON assembled here.
    Tiny models echo JSON templates back but answer YES/NO and 'copy the sentence' reliably."""
    ctx = f'What the learner said:\n"""{said}"""\n\n'
    graded = []
    for r in rubric:
        a = call_text(ctx + f"Did the learner do this: {r['check']}?\nAnswer NO if they were vague or general. "
                      "Reply with exactly one word: YES, PARTLY, or NO.", 5).upper()
        status = "used" if "YES" in a else "partly" if "PART" in a else "missing"
        evidence = ""
        if status != "missing":
            ask = (ctx + f"Copy, word for word, the ONE sentence the learner said that shows this: {r['check']}. "
                   "Reply with only that sentence.")
            evidence = call_text(ask, 60).strip('"\u201c\u201d\' ')
            if not quote_in_transcript(evidence, said):
                evidence = call_text(ask + " Do not change any words.", 60).strip('"\u201c\u201d\' ')
        graded.append({"id": r["id"], "status": status, "evidence": evidence})
    weakest = next((r for r, g in zip(rubric, graded) if g["status"] != "used"), None)
    target = weakest["check"] if weakest else "sounding even more confident and direct"
    fix = _first_sentences(call_text(
        ctx + f"Talking to the learner as 'you', give ONE short sentence starting with a verb on how to improve at: {target}", 50), 1)
    rewrite = _first_sentences(call_text(
        ctx + f"Write ONE better sentence the learner could have said that shows: {target}. Reply with only the sentence.", 60), 1)
    fb = _first_sentences(call_text(
        ctx + "Talking to the learner as 'you', write 1 or 2 short, kind, specific sentences about what worked. "
        "Quote a few of their exact words. Do not ask questions.", 80), 2)
    return {"rubric": graded, "feedback": fb, "fix": fix, "rewrite": rewrite}


def evaluate(lesson: dict, world: str, situation: str, transcript: str, conversation: str | None = None,
             prompt_version: str | None = None) -> dict:
    """transcript = only the learner's words (what evidence is checked against).
    conversation = optional full dialogue, so the grader sees what the partner asked."""
    pv = prompt_version or config.PROMPT_VERSION
    rubric = lesson["rubric"]
    stats = {"llm_calls": 0, "input_tokens": 0, "output_tokens": 0, "llm_latency_ms": 0}
    t0 = time.perf_counter()

    def tally(out):
        stats["llm_calls"] += 1
        stats["input_tokens"] += out["input_tokens"]
        stats["output_tokens"] += out["output_tokens"]
        stats["llm_latency_ms"] += out["latency_ms"]

    def call(msgs):
        try:
            data, out = llm.chat_json(msgs, temperature=0.2, max_tokens=900, operation="grade_technique")
        except ValueError as e:
            # unparseable output (or an empty reply when the box is out of memory): treat as a failed pass
            report_issue("llm: unparseable grading output", kind="unparseable", day=lesson["day"], error=str(e)[:80])
            data, out = {}, {"text": "", "input_tokens": 0, "output_tokens": 0, "latency_ms": 0}
        tally(out)
        return data, out["text"]

    def call_text(prompt, max_tokens):
        out = llm.chat([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=max_tokens,
                       operation="grade_step")
        tally(out)
        return out["text"].strip()

    with sentry_sdk.start_span(op="gen_ai.invoke_agent", name=f"coach day {lesson['day']}") as span:
        span.set_data("gen_ai.agent.name", "speaking-coach")
        span.set_data("prompt_version", pv)
        span.set_data("grader", config.GRADER)
        if config.GRADER == "stepwise":
            result = _grade_stepwise(rubric, transcript, call_text)
            problems = validate(result, rubric, transcript)
            first_problems = list(problems)
        else:
            heard = transcript if not conversation else (
                f"{conversation}\n\nThe learner's lines only (evidence must be copied from these):\n{transcript}")
            user = USER_TMPL.format(
                technique=lesson["technique"], title=lesson["title"], teach=technique_summary(lesson),
                world=WORLDS.get(world, world), drill=situation,
                rubric="\n".join(f'- {r["id"]}: {r["check"]}' for r in rubric), transcript=heard,
            )
            messages = [{"role": "system", "content": PROMPTS.get(pv, SYSTEM_V1)}, {"role": "user", "content": user}]
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
                          "retried": bool(first_problems) and config.GRADER != "stepwise"}
    final["stats"] = {**stats, "total_ms": int((time.perf_counter() - t0) * 1000), "prompt_version": pv,
                      "model": llm.model_name(), "grader": config.GRADER}
    return final
