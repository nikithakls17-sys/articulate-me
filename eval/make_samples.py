"""Writes eval/samples/*.json, eval/labels.csv and eval/samples/README.md. No models are run."""
import csv
import json
from pathlib import Path

ROOT = Path(r"C:\Users\nikit\i-talk-you-listen")
OUT = ROOT / "eval" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

course = {d: json.loads((ROOT / "course" / f"day_{d}.json").read_text(encoding="utf-8")) for d in (1, 2, 3)}

U, P, M = "used", "partly", "missing"

# (id, day, world, category, learner turns (partner follow-ups interleaved as ("P", text)), draft labels, why)
S = [
    # ---------------- Day 1: PREP (point_first, reason, example, point_again) ----------------
    ("d1-01", 1, "job_seeker", "good",
     ["My most valuable skill is turning messy projects into plans people can actually follow. Because when a team is lost, someone has to say, okay, here's what we do on Monday. For example, last semester our capstone was three weeks behind, so I set up weekly check-ins and a shared board, and we shipped on time and got an A. So, um, organizing chaos, that's what I'd bring to your team."],
     dict(point_first=U, reason=U, example=U, point_again=U), "Textbook PREP with one natural filler."),
    ("d1-02", 1, "student", "good",
     ["I think the main argument should be cost, not convenience. Because cost is what the council actually votes on.",
      ("P", "Hmm. But isn't convenience what students complain about most?"),
      "It is, but like, our own survey showed seventy percent of residents ranked taxes first, and only twelve percent said convenience. So yeah, I'd still lead with cost."],
     dict(point_first=U, reason=U, example=U, point_again=U), "PREP spread across two turns; example arrives in the second reply."),
    ("d1-03", 1, "everyday", "partial",
     ["Honestly, I'm not going to come tonight. I have an exam at nine tomorrow and I really need to sleep."],
     dict(point_first=U, reason=U, example=M, point_again=M), "Clear point and reason, but no example and no closing point."),
    ("d1-04", 1, "customer_facing", "partial",
     ["Okay, so, um, I totally understand, these charges can be really confusing, and our system changed last month and a lot of people have been calling about it, and, uh, what I can do is refund the duplicate charge today. Because the system charged you twice. So, the refund today, that's what I'll do."],
     dict(point_first=P, reason=U, example=M, point_again=U), "The point is buried after a ramble; good reason and restatement; no example."),
    ("d1-05", 1, "creator", "bad",
     ["So, um, the show is kind of about a lot of things, like, friendship and growing up and also, uh, cooking a bit, and there's this one character who, I mean, it depends on the episode really. There's a lot going on. I think people will like it."],
     dict(point_first=M, reason=M, example=M, point_again=M), "Rambling with no single takeaway."),
    ("d1-06", 1, "job_seeker", "bad",
     ["Uh, I'd say I'm a hard worker, a team player, good with people, I learn fast, I'm passionate about, you know, everything really."],
     dict(point_first=P, reason=M, example=M, point_again=M), "A list of adjectives instead of one point; nothing supports it."),
    ("d1-07", 1, "student", "tricky",
     ["We should focus on cost. Because cost is important. For example, things cost money. So, cost."],
     dict(point_first=U, reason=P, example=M, point_again=U),
     "Uses the signal words (because, for example) with a circular reason and an empty example. A grader that pattern-matches will over-score this."),

    # ---------------- Day 2: Rule of three (three_reasons, clearly_separated, tied_to_case) ----------------
    ("d2-01", 2, "job_seeker", "good",
     ["There are three reasons. First, I've already done this job: two years running the help desk on my campus. Second, I learn tools fast, I picked up your CRM over a weekend just for this interview.",
      ("P", "Okay. And the third?"),
      "Third, I stay calm with upset customers. My satisfaction score was four point eight out of five. So, experience, speed, and calm."],
     dict(three_reasons=U, clearly_separated=U, tied_to_case=U), "Previews the count, signposts each reason, sums up; split across two turns."),
    ("d2-02", 2, "everyday", "good",
     ["Okay, three reasons I'm staying in. One, I'm broke until Friday. Two, I have a presentation at nine. And three, honestly, I'm exhausted. Next week, I'm all yours."],
     dict(three_reasons=U, clearly_separated=U, tied_to_case=U), "Short, casual, clearly counted."),
    ("d2-03", 2, "customer_facing", "partial",
     ["I'm really sorry about the wait. It's because we're short two staff today, and the system went down for an hour this morning. We're getting through everyone as fast as we can."],
     dict(three_reasons=M, clearly_separated=P, tied_to_case=U), "Only two reasons."),
    ("d2-04", 2, "creator", "partial",
     ["It'll work because the cast is great, the budget's realistic, the locations are cheap, we already have a social following, and the timing with the festival is perfect, and also streaming platforms want this genre right now."],
     dict(three_reasons=M, clearly_separated=P, tied_to_case=U), "Six reasons in one breath: too many to remember."),
    ("d2-05", 2, "student", "bad",
     ["I just think it's better? Like, everyone's using it now and, um, the old one is kind of annoying. I don't know, it's just better."],
     dict(three_reasons=M, clearly_separated=M, tied_to_case=P), "Opinion with two vague half-reasons."),
    ("d2-06", 2, "job_seeker", "tricky",
     ["Three reasons. First, I work hard. Second, I put in a lot of effort. Third, I'm really hardworking."],
     dict(three_reasons=P, clearly_separated=U, tied_to_case=U),
     "Perfect structure, but the three reasons are the same reason three times. Tests 'distinct'."),
    ("d2-07", 2, "student", "tricky",
     ["First, the new software saves us time, because it formats the citations for us. Second, it's free with our student login. Third, my roommate uses it for gaming and it's super fun."],
     dict(three_reasons=U, clearly_separated=U, tied_to_case=P), "Three clear reasons, but the third has nothing to do with the project."),

    # ---------------- Day 3: Open strong (hook_first, hook_connects, who_you_are) ----------------
    ("d3-01", 3, "job_seeker", "good",
     ["What happens when a hospital's scheduling app crashes at two in the morning? I found out, because I was the intern on call. I'm Priya, a software developer, and since that night I've been obsessed with building systems that don't fail when people need them most."],
     dict(hook_first=U, hook_connects=U, who_you_are=U), "Question hook that leads straight into who she is."),
    ("d3-02", 3, "everyday", "good",
     ["I moved eleven times before I turned twenty. So I'm kind of a professional at being the new person. I'm Leo, I just started at the design studio downtown."],
     dict(hook_first=U, hook_connects=U, who_you_are=U), "Surprising-fact hook."),
    ("d3-03", 3, "student", "partial",
     ["Hi, my name is Aisha, I'm a third-year biology student. Um, did you know that most of the food waste on campus comes from just one dining hall? My project is about fixing that."],
     dict(hook_first=M, hook_connects=U, who_you_are=U), "Good hook, but it comes second, after 'Hi, my name is'."),
    ("d3-04", 3, "creator", "partial",
     ["Have you ever eaten a whole pizza by yourself? Anyway, my series is a documentary about small-town libraries closing. I'm Sam, I've directed two short films."],
     dict(hook_first=U, hook_connects=M, who_you_are=U), "Hook first, but it has nothing to do with the pitch."),
    ("d3-05", 3, "customer_facing", "bad",
     ["Um, okay, so, I'm from the billing team and I'll look into it. Can you give me your account number?"],
     dict(hook_first=M, hook_connects=M, who_you_are=U), "No hook at all."),
    ("d3-06", 3, "everyday", "tricky",
     ["So last week, um, I was at the bus stop and this lady, she, um, she had like a parrot, an actual parrot, on her shoulder, and the parrot said hi to me and I said hi back and, uh, yeah. Anyway. I'm Mei, I'm, um, new in the area."],
     dict(hook_first=P, hook_connects=M, who_you_are=U), "Starts with a story, but it rambles and never connects to who she is."),
]

rows = []
for sid, day, world, cat, turns_in, labels, why in S:
    sc = course[day]["scenarios"][world]
    turns = [{"speaker": "partner", "text": sc["opening"]}]
    for t in turns_in:
        turns.append({"speaker": "partner", "text": t[1]} if isinstance(t, tuple) else {"speaker": "user", "text": t})
    rubric = course[day]["rubric"]
    assert set(labels) == {r["id"] for r in rubric}, sid
    sample = {
        "id": sid, "day": day, "technique": course[day]["technique"], "world": world, "category": cat,
        "partner": sc["partner"], "role": sc["role"], "turns": turns,
        "transcript": " ".join(t["text"] for t in turns if t["speaker"] == "user"),
        "rubric": rubric,
        "draft_labels": labels,           # written by Claude while authoring the sample
        "niki_labels": {r["id"]: None for r in rubric},  # fill in: used | partly | missing
        "why": why,
    }
    (OUT / f"{sid}.json").write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    for r in rubric:
        rows.append({"id": sid, "day": day, "category": cat, "rubric_id": r["id"], "check": r["check"],
                     "draft_label": labels[r["id"]], "niki_label": ""})

with (ROOT / "eval" / "labels.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

cats = {}
for s in S:
    cats.setdefault(s[1], {}).setdefault(s[3], 0)
    cats[s[1]][s[3]] += 1
print(len(S), "samples,", len(rows), "rubric labels")
print(cats)
