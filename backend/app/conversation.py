"""Practice partner: Gemma plays the other person (interviewer, professor, customer...) for a few turns,
steering the learner toward the lesson's technique. Replies are kept to 1-2 short sentences."""
import re

from . import llm
from .course_plan import NEW_HERE_TONE, plan_for

MAX_USER_TURNS = 3
BASELINE_USER_TURNS = 2

PARTNER_SYSTEM = """You are {partner}, {role}. You are in a short spoken role-play with a learner.
Scene: {setup}
Your goal in this conversation: {push}
Rules:
- Stay in character. Talk like a real person, warm but natural.
- Reply with 1 or 2 short sentences only. Usually end with ONE question.
- React to what the learner actually said, then ask your next question.
- Never coach, grade, or mention techniques or feedback.
- No stage directions, no quotation marks, no name labels."""

CLOSING_NOTE = "This is your LAST line. React briefly to what they said and wrap up warmly in 1 sentence. Do not ask a question."


def max_turns(day: int) -> int:
    return BASELINE_USER_TURNS if day == 0 else MAX_USER_TURNS


def _clean(text: str, name: str) -> str:
    text = re.sub(r"^\s*\**" + re.escape(name) + r"\**\s*:\s*", "", text.strip(), flags=re.I)
    text = re.sub(r"\([^)]*\)|\*[^*]*\*", "", text)  # stage directions
    text = text.replace('"', "").replace("“", "").replace("”", "").strip()
    sents = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return " ".join(sents[:2]) or "I see. Tell me more."


def partner_reply(scenario: dict, day: int, turns: list[dict], closing: bool) -> tuple[str, dict]:
    plan = plan_for(day)
    system = PARTNER_SYSTEM.format(partner=scenario["partner"], role=scenario["role"], setup=scenario["setup"],
                                   push=plan["partner_push"])
    if scenario.get("country_name"):
        system += (f"\n- You live in {scenario['country_name']}. Talk like a friendly local: use one or two everyday "
                   f"expressions common in {scenario['country_name']} naturally. {NEW_HERE_TONE}")
    msgs = [{"role": "system", "content": system}]
    for t in turns:
        msgs.append({"role": "assistant" if t["speaker"] == "partner" else "user", "content": t["text"]})
    if closing:
        msgs.append({"role": "system", "content": CLOSING_NOTE})
    out = llm.chat(msgs, temperature=0.7, max_tokens=90, operation="partner_turn")
    return _clean(out["text"], scenario["partner"]), out
