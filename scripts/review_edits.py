"""Hand-review edits applied on top of generated chapters (logged in NOTES.md). Re-run after rebuilding a day."""
import json
from pathlib import Path

COURSE = Path(__file__).resolve().parents[1] / "course"


def edit(day, fn):
    p = COURSE / f"day_{day}.json"
    lesson = json.loads(p.read_text(encoding="utf-8"))
    fn(lesson)
    p.write_text(json.dumps(lesson, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    print("edited day", day)


def day1(l):
    table = next(pg for pg in l["pages"] if pg["kind"] == "table")
    steps = next(pg for pg in l["pages"] if pg["kind"] == "steps")
    # generated table compared "good vs bad sources" (U.S. Dept of Labor vs Wikipedia): off-topic for PREP
    table.update({
        "title": "PREP, one line at a time",
        "columns": ["Step", "What it sounds like"],
        "rows": [["Point", "\"I'd choose the evening class.\""],
                 ["Reason", "\"Because I focus better after work.\""],
                 ["Example", "\"Last term my evening grades were a full letter higher.\""],
                 ["Point", "\"So the evening class is my pick.\""]],
        "cite": steps.get("cite"),
    })
    names = {"student": "Professor Okafor", "job_seeker": "Dana", "customer_facing": "Mr. Reyes",
             "creator": "Priya", "everyday": "Sam"}
    for w, n in names.items():
        l["scenarios"][w]["partner"] = n


def day3(l):
    # generated opening had the customer saying "I can see you're frustrated" to the learner
    l["scenarios"]["customer_facing"].update({
        "role": "a frustrated customer on their third call",
        "setup": "A customer has already explained their problem to two people today. Now it's your turn.",
        "opening": "I've already explained this twice today. Before I go through it again, why should I believe you're the one who can fix it?",
    })


edit(1, day1)
edit(3, day3)
