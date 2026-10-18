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


def day101(l):
    # generated comparison table had one row and the before/after were descriptions, not spoken lines
    table = next(pg for pg in l["pages"] if pg["kind"] == "table")
    table.update({"title": "A greeting, not a real question", "columns": ["You hear", "A good short answer"],
                  "rows": [["How's it going?", "Good, thanks! How about you?"],
                           ["Busy week?", "A bit! First week of classes. You?"],
                           ["Nice weather today.", "So nice. Perfect for a walk."]]})
    ba = next(pg for pg in l["pages"] if pg["kind"] == "before_after")
    ba.update({"situation": "A neighbour asks how you're settling in.", "before": "Fine.",
               "after": "Pretty good, thanks! Still unpacking. Have you lived here long?",
               "why": "A short answer, one small detail and a question back keeps it going."})
    # Wiktionary definitions: trim to the everyday sense, fix "how are you?." punctuation
    trims = {"no worries": "A general reassurance not to be concerned further.", "reckon": "To think; to suppose.",
             "how are you going": "How are you doing? (A greeting.)", "how's it going": "How are you? (A greeting.)"}
    for t in l["country_tables"].values():
        for row in t["rows"]:
            term = row[0].strip("“”")
            if term in trims:
                row[1] = trims[term]
            row[1] = row[1][0].upper() + row[1][1:]


def _page(l, kind):
    return next(pg for pg in l["pages"] if pg["kind"] == kind)


def day4(l):
    # generated before/after was a sandwich recipe, not a spoken answer; table called good signposts "simplistic"
    _page(l, "before_after").update({
        "situation": "A new teammate asks how the weekly report gets made.",
        "before": "So you pull the numbers and there's the dashboard thing and then someone checks it, and it goes out, and also you have to tag the team lead.",
        "after": "There are three steps. First, pull the numbers from the dashboard. Next, ask the team lead to check them. Finally, send it out on Friday. So: pull, check, send.",
        "why": "A preview, an ordering word before each step and a one-line sum-up.",
    })
    _page(l, "table").update({
        "title": "Lost listener vs. guided listener",
        "columns": ["Without signposts", "With signposts"],
        "rows": [["Starts with step one, no warning", "\"There are three steps.\""],
                 ["\"And then... and also...\"", "\"First... next... finally...\""],
                 ["Just stops", "\"So: pull, check, send.\""]],
    })


def day5(l):
    # the app and rubric mark pauses as [pause]; the generated after line used "(pause)"
    _page(l, "before_after")["after"] = "The deadline is [pause] tomorrow. [pause] We need to finish the slides tonight."


def day6(l):
    # steps skipped "keep the same core message" (a rubric item); the New Deal example generalised about
    # "younger adults"; the teachers/non-teachers table and two quiz questions were weak
    _page(l, "steps")["steps"] = [
        {"label": "Ask who", "text": "Who is listening, and what do they already know about this?"},
        {"label": "Keep the core", "text": "Decide the one message that stays the same for every listener."},
        {"label": "Adjust the words", "text": "Change vocabulary, detail and examples so they fit what this listener knows."},
    ]
    _page(l, "table").update({
        "title": "Same message, two listeners",
        "columns": ["For an expert", "For a beginner"],
        "rows": [["\"I refactored the API to cut latency.\"", "\"I rebuilt how the app talks to the server.\""],
                 ["\"p95 dropped from 800 to 300 ms.\"", "\"Pages now load about twice as fast.\""],
                 ["Skip the basics", "One everyday comparison"]],
    })
    _page(l, "before_after").update({
        "situation": "A friend with no tech background asks what you worked on.",
        "before": "I refactored our API layer so the p95 latency dropped a lot.",
        "after": "I rebuilt how our app talks to the server, so pages now load about twice as fast.",
        "why": "Same core message, with the jargon swapped for words this listener already knows.",
    })
    l["quiz"][0] = {
        "q": "You are about to explain your job to a room of high school students. What should you work out first?",
        "options": ["Which technical terms sound most impressive", "What they already know about your field",
                    "How to fit in every detail"],
        "answer": 1, "explain": "Start from who is listening and what they already know.",
    }
    l["quiz"][2] = {
        "q": "You explain the same project to your manager and then to your grandmother. What should stay the same?",
        "options": ["The core message", "The vocabulary", "The level of detail"],
        "answer": 0, "explain": "Words and detail change for each listener; the core message doesn't.",
    }


def day7(l):
    # "Regulators" (gestures) was off-topic; job-seeker example answered a different question than the scenario;
    # the New here opening called the learner's home country's way "completely inefficient" (tone rule)
    _page(l, "steps")["steps"] = [
        {"label": "Acknowledge", "text": "Show you heard the question, or the worry behind it."},
        {"label": "Bridge", "text": "Use a phrase like 'what I can tell you is' to move to your answer."},
        {"label": "Answer", "text": "Short and direct. If you don't know, say so honestly. Don't dodge."},
    ]
    _page(l, "terms")["terms"] = [
        {"term": "Active listening", "meaning": "Paying full attention to the question before you answer it."},
        {"term": "Transitions", "meaning": "Phrases used to tie different messages together."},
    ]
    l["examples"]["job_seeker"] = ("That's a fair question, and I can see why three industries looks like drifting. What I can tell "
                                   "you is that each move built one skill: analysing customers. That's exactly the skill this role needs.")
    l["scenarios"]["new_here"]["opening"] = ("Can I ask you something honestly? Why did you leave a good job back home "
                                             "to start over here? That seems like a big risk.")


edit(1, day1)
edit(3, day3)
edit(4, day4)
edit(5, day5)
edit(6, day6)
edit(7, day7)
edit(101, day101)
