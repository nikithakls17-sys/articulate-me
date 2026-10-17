"""Week 1 course plan. Rubrics are hand-written (they are the grading spec); lesson text is
generated from the textbooks by scripts/build_course.py and reviewed by hand."""

WORLDS = {
    "student": "a student (class presentations, group projects, asking a professor for help)",
    "job_seeker": "a job seeker (\"tell me about yourself\", behavioral questions, networking intros)",
    "customer_facing": "someone in a customer-facing job (retail, healthcare, sales: nervous patients, upset customers, pitches)",
    "creator": "a creator or performer (YouTube intros, storytelling, audition monologue setups)",
    "everyday": "everyday life (small talk, saying no, standing up for yourself, giving a toast)",
}

WEEKS = [
    {"week": 1, "title": "Say it clearly", "locked": False},
    {"week": 2, "title": "Delivery", "locked": True},
    {"week": 3, "title": "Persuasion", "locked": True},
]

PLAN = [
    {
        "day": 0, "technique": "Baseline", "title": "Your starting line",
        "query": "", "drill_idea": "Introduce yourself in 60 seconds",
        "rubric": [
            {"id": "who_you_are", "check": "Says who they are or what they do in the first two sentences"},
            {"id": "concrete_detail", "check": "Gives at least one specific, concrete detail (a name, number, place or example) rather than only general claims"},
        ],
    },
    {
        "day": 1, "technique": "PREP", "title": "Get to the point",
        "query": "stating the main point first, thesis statement, supporting reasons with evidence and examples, restating the point in the conclusion",
        "drill_idea": "Answer one question using PREP: Point, Reason, Example, Point",
        "rubric": [
            {"id": "point_first", "check": "States their main point or answer in the first 1-2 sentences"},
            {"id": "reason", "check": "Gives a reason for the point (often signalled by 'because' or 'the reason is')"},
            {"id": "example", "check": "Gives a specific example, story or piece of evidence that supports the reason"},
            {"id": "point_again", "check": "Ends by restating the main point"},
        ],
    },
    {
        "day": 2, "technique": "Rule of three", "title": "Three reasons",
        "query": "organizing main points, limiting to two to five main points, groups of three, parallel structure, memorable lists",
        "drill_idea": "Make a case with exactly three reasons",
        "rubric": [
            {"id": "three_reasons", "check": "Gives exactly three distinct reasons or points (not two, not four or more)"},
            {"id": "clearly_separated", "check": "The three reasons are clearly separated so a listener could count them"},
            {"id": "tied_to_case", "check": "Each reason clearly supports the one case they are making"},
        ],
    },
    {
        "day": 3, "technique": "Open strong", "title": "Open strong",
        "query": "attention getters in introductions, opening with a question, story, anecdote, startling statistic or surprising fact",
        "drill_idea": "Redo your Day 0 introduction, but open with a hook",
        "rubric": [
            {"id": "hook_first", "check": "The very first sentence is a hook: a question, a short story, or a surprising fact (not 'Hi, my name is')"},
            {"id": "hook_connects", "check": "The hook connects to what they say next about themselves"},
            {"id": "who_you_are", "check": "Still makes clear who they are or what they do"},
        ],
    },
    {
        "day": 4, "technique": "Signposting", "title": "Signposts",
        "query": "transitions, signposts, internal previews and summaries, first next finally, guiding the audience between points",
        "drill_idea": "Explain a process in clear steps",
        "rubric": [
            {"id": "preview", "check": "Previews how many steps or parts there are, or what is coming"},
            {"id": "signposts", "check": "Uses ordering words between steps (e.g. 'first', 'next', 'then', 'finally')"},
            {"id": "steps_in_order", "check": "The steps are in a logical order a listener could follow"},
        ],
    },
    {
        "day": 5, "technique": "The deliberate pause", "title": "The pause",
        "query": "vocal delivery, pauses for emphasis, rate of speech, vocalized pauses and filler words",
        "drill_idea": "Deliver a key line with a pause before and after it",
        "rubric": [
            {"id": "key_line", "check": "Has one clear key line or message that stands out"},
            {"id": "pause_marked", "check": "The transcript shows a pause around the key line (a pause marker [pause] next to it)"},
            {"id": "few_fillers", "check": "Uses silence instead of filler words (um, uh, like) around the key line"},
        ],
    },
    {
        "day": 6, "technique": "Know your audience", "title": "Know your audience",
        "query": "audience analysis, adapting a message to the audience, demographics, prior knowledge, word choice for different listeners",
        "drill_idea": "Explain the same thing to two different listeners",
        "rubric": [
            {"id": "two_versions", "check": "Gives two separate explanations for two named or clearly different listeners"},
            {"id": "word_choice_changes", "check": "Word choice or detail level clearly changes between the two versions"},
            {"id": "same_core", "check": "Both versions keep the same core message"},
        ],
    },
    {
        "day": 7, "technique": "Handling a tough question", "title": "Tough questions",
        "query": "question and answer session, responding to difficult or hostile questions, acknowledging the question, staying on message",
        "drill_idea": "Respond to a challenging question: acknowledge, bridge, answer",
        "rubric": [
            {"id": "acknowledge", "check": "Acknowledges the question or the concern behind it before answering"},
            {"id": "bridge", "check": "Uses a bridge phrase to move to their answer (e.g. 'what I can tell you is', 'the way I see it')"},
            {"id": "answer", "check": "Gives a direct, specific answer rather than dodging"},
        ],
    },
]


def plan_for(day: int) -> dict | None:
    return next((p for p in PLAN if p["day"] == day), None)
