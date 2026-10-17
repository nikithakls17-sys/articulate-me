"""Week 1 course plan. Rubrics are hand-written (they are the grading spec); chapter pages, quizzes and
conversation scenarios are generated from the textbooks by scripts/build_course.py and reviewed by hand."""

WORLDS = {
    "student": "a student (class presentations, group projects, asking a professor for help)",
    "job_seeker": "a job seeker (\"tell me about yourself\", behavioral questions, networking intros)",
    "customer_facing": "someone in a customer-facing job (retail, healthcare, sales: nervous patients, upset customers, pitches)",
    "creator": "a creator or performer (YouTube intros, storytelling, audition monologue setups)",
    "everyday": "everyday life (small talk, saying no, standing up for yourself, giving a toast)",
}

PARTNERS = {
    "student": "a professor or classmate",
    "job_seeker": "an interviewer or hiring manager",
    "customer_facing": "a customer or patient",
    "creator": "a casting director, collaborator or viewer",
    "everyday": "a friend, neighbour or someone new at a party",
}

WEEKS = [
    {"week": 1, "title": "Say it clearly", "locked": False,
     "summary": "Get to the point, structure what you say, open strong and handle tough questions."},
    {"week": 2, "title": "Delivery", "locked": True, "summary": "Voice, pace, eye contact and nerves."},
    {"week": 3, "title": "Persuasion", "locked": True, "summary": "Evidence, stories and asking for what you want."},
]

MINUTES_PER_LESSON = 8  # ~3 min reading + quiz, ~5 min conversation

PLAN = [
    {
        "day": 0, "technique": "Baseline", "title": "Where you're starting",
        "query": "", "learn": "A short conversation so we can measure your starting point.",
        "partner_push": "Ask them to introduce themselves, then ask one natural follow-up about what they said.",
        "rubric": [
            {"id": "who_you_are", "check": "Says who they are or what they do early in their first answer"},
            {"id": "concrete_detail", "check": "Gives at least one specific, concrete detail (a name, number, place or example) rather than only general claims"},
        ],
    },
    {
        "day": 1, "technique": "PREP", "title": "Get to the point",
        "queries": ["stating your main point or thesis clearly at the start", "supporting a claim with reasons and evidence", "using examples and stories as supporting material", "restating the main idea in the conclusion"],
        "outline": "Point: say your answer in one sentence. Reason: say why (because...). Example: one specific example, story or number. Point: say your answer again to finish.",
        "query": "stating the main point first, thesis statement, supporting reasons with evidence and examples, restating the point in the conclusion",
        "learn": "Answer any question with Point, Reason, Example, Point.",
        "partner_push": "Ask open questions that need a clear answer with a reason (\"Why should we...\", \"What do you think about...\"). If they ramble, ask \"So what's your answer?\"",
        "rubric": [
            {"id": "point_first", "check": "States their main point or answer in the first 1-2 sentences of an answer"},
            {"id": "reason", "check": "Gives a reason for the point (often signalled by 'because' or 'the reason is')"},
            {"id": "example", "check": "Gives a specific example, story or piece of evidence that supports the reason"},
            {"id": "point_again", "check": "Ends an answer by restating the main point"},
        ],
    },
    {
        "day": 2, "technique": "Rule of three", "title": "Three reasons",
        "queries": ["limit a speech to two to five main points", "organizing main points so the audience can follow and remember", "parallel structure and memorable lists of three"],
        "outline": "Pick exactly three reasons. Say how many are coming. Give each its own sentence, in a clear order. Tie each back to your one case.",
        "query": "organizing main points, limiting to two to five main points, groups of three, parallel structure, memorable lists",
        "learn": "Make a case with exactly three clear reasons.",
        "partner_push": "Be a little skeptical and ask them to convince you (\"Why should I...?\", \"Give me your reasons.\").",
        "rubric": [
            {"id": "three_reasons", "check": "Gives exactly three distinct reasons or points (not two, not four or more)"},
            {"id": "clearly_separated", "check": "The three reasons are clearly separated so a listener could count them"},
            {"id": "tied_to_case", "check": "Each reason clearly supports the one case they are making"},
        ],
    },
    {
        "day": 3, "technique": "Open strong", "title": "Open strong",
        "queries": ["attention getter in the introduction", "opening a speech with a question or rhetorical question", "opening with a story, anecdote or startling statistic"],
        "outline": "Skip 'Hi, my name is'. Open with a question, a 1-2 sentence story, or a surprising fact. Then connect it to who you are or your point.",
        "query": "attention getters in introductions, opening with a question, story, anecdote, startling statistic or surprising fact",
        "learn": "Start with a hook: a question, a short story or a surprising fact.",
        "partner_push": "Ask them to introduce themselves or their idea, and say you've heard a lot of people today so make it memorable.",
        "rubric": [
            {"id": "hook_first", "check": "Their first sentence is a hook: a question, a short story, or a surprising fact (not 'Hi, my name is')"},
            {"id": "hook_connects", "check": "The hook connects to what they say next"},
            {"id": "who_you_are", "check": "Still makes clear who they are or what their idea is"},
        ],
    },
    {
        "day": 4, "technique": "Signposting", "title": "Signposts",
        "queries": ["transitions and signposts between main points", "internal previews and internal summaries", "helping the audience follow the organization of a speech"],
        "outline": "Preview: say how many steps. Signpost each step: first, next, then, finally. Keep the steps in order. Sum up at the end.",
        "query": "transitions, signposts, internal previews and summaries, first next finally, guiding the audience between points",
        "learn": "Guide your listener with \"first, next, finally.\"",
        "partner_push": "Ask them to walk you through how to do something step by step, and say you get lost easily.",
        "rubric": [
            {"id": "preview", "check": "Previews how many steps or parts there are, or what is coming"},
            {"id": "signposts", "check": "Uses ordering words between steps (e.g. 'first', 'next', 'then', 'finally')"},
            {"id": "steps_in_order", "check": "The steps are in a logical order a listener could follow"},
        ],
    },
    {
        "day": 5, "technique": "The deliberate pause", "title": "The pause",
        "queries": ["using pauses for emphasis in vocal delivery", "rate of speech and speaking too fast", "vocalized pauses and filler words like um and uh"],
        "outline": "Decide your one key line. Pause for a beat before it, say it slowly, pause after it. When you need to think, stay silent instead of saying um.",
        "query": "vocal delivery, pauses for emphasis, rate of speech, vocalized pauses and filler words",
        "learn": "Use silence, not \"um,\" to make your key line land.",
        "partner_push": "Ask them for the one thing they most want you to remember.",
        "rubric": [
            {"id": "key_line", "check": "Has one clear key line or message that stands out"},
            {"id": "pause_marked", "check": "The transcript shows a pause around the key line (a pause marker [pause] next to it)"},
            {"id": "few_fillers", "check": "Uses silence instead of filler words (um, uh, like) around the key line"},
        ],
    },
    {
        "day": 6, "technique": "Know your audience", "title": "Know your audience",
        "queries": ["audience analysis and adapting to your audience", "audience prior knowledge and demographics", "choosing words and examples the audience will understand"],
        "outline": "Ask who is listening and what they already know. Keep the same core message. Change the words, detail and examples to fit them.",
        "query": "audience analysis, adapting a message to the audience, demographics, prior knowledge, word choice for different listeners",
        "learn": "Say the same thing differently for different listeners.",
        "partner_push": "Ask them to explain something from their world, then ask them to explain it again for someone completely new to it (e.g. a 10-year-old or a grandparent).",
        "rubric": [
            {"id": "two_versions", "check": "Gives two explanations aimed at clearly different listeners"},
            {"id": "word_choice_changes", "check": "Word choice or detail level clearly changes between the two versions"},
            {"id": "same_core", "check": "Both versions keep the same core message"},
        ],
    },
    {
        "day": 7, "technique": "Handling a tough question", "title": "Tough questions",
        "queries": ["handling questions and answers after a speech", "responding to difficult or hostile audience questions", "staying calm and on message when challenged"],
        "outline": "Acknowledge the question or the worry behind it. Bridge with a phrase like 'what I can tell you is'. Answer directly and briefly. Do not dodge.",
        "query": "question and answer session, responding to difficult or hostile questions, acknowledging the question, staying on message",
        "learn": "Acknowledge, bridge, answer.",
        "partner_push": "Ask one challenging or slightly unfair question about their situation, then push back once on their answer.",
        "rubric": [
            {"id": "acknowledge", "check": "Acknowledges the question or the concern behind it before answering"},
            {"id": "bridge", "check": "Uses a bridge phrase to move to their answer (e.g. 'what I can tell you is', 'the way I see it')"},
            {"id": "answer", "check": "Gives a direct, specific answer rather than dodging"},
        ],
    },
]

# Day 0 baseline is a conversation too; hand-written so it works before any course is built.
BASELINE_SCENARIOS = {
    "student": {"partner": "Professor Lee", "role": "your new seminar professor",
                "setup": "First day of a seminar. The professor goes around the room.",
                "opening": "Welcome! Before we start, tell me a bit about yourself and why you took this class."},
    "job_seeker": {"partner": "Sam", "role": "a hiring manager",
                   "setup": "The first minute of a job interview.",
                   "opening": "Thanks for coming in. So, tell me about yourself."},
    "customer_facing": {"partner": "Mrs. Patel", "role": "a new customer",
                        "setup": "A customer walks up to you for the first time.",
                        "opening": "Hi, I haven't been here before. Who are you, and can you help me?"},
    "creator": {"partner": "Jordan", "role": "a podcast host",
                "setup": "You're a guest on a small podcast.",
                "opening": "Welcome to the show! For listeners who don't know you yet, who are you and what do you make?"},
    "everyday": {"partner": "Alex", "role": "someone you just met at a party",
                 "setup": "A friend's party. Someone new says hi.",
                 "opening": "Hey! I don't think we've met. How do you know everyone here?"},
}

BADGES = [
    {"id": "first_chapter", "title": "First chapter", "desc": "Finish your first chapter and its quick check."},
    {"id": "baseline", "title": "Starting line", "desc": "Record your baseline conversation."},
    {"id": "first_convo", "title": "Conversation starter", "desc": "Finish a practice conversation."},
    {"id": "prep_in_convo", "title": "PREP in action", "desc": "Use PREP in a conversation (75%+ on Day 1)."},
    {"id": "low_fillers", "title": "Smooth talker", "desc": "Under 3 filler words per minute in a conversation."},
    {"id": "streak_3", "title": "3-day streak", "desc": "Practice three days in a row."},
    {"id": "perfect_quiz", "title": "Sharp reader", "desc": "Get every quick-check question right."},
    {"id": "note_taker", "title": "Note taker", "desc": "Save 3 notes from the textbook."},
    {"id": "week_1", "title": "Said it clearly", "desc": "Finish every Week 1 conversation."},
]


def plan_for(day: int) -> dict | None:
    return next((p for p in PLAN if p["day"] == day), None)


# ---------------- New here: fitting into a new place ----------------
# A separate track for international students, immigrants and anyone who just moved. Chapters are grounded in
# Wikipedia (CC BY-SA) and expressions in Wiktionary (CC BY-SA). Tone: describe common habits, never stereotypes;
# "many people here", not "Americans always"; respect the learner's own culture.

NEW_HERE_WORLD = "new_here"
WORLDS[NEW_HERE_WORLD] = "someone new to the country (international student, immigrant or recently moved)"
PARTNERS[NEW_HERE_WORLD] = "a classmate, coworker, neighbour or someone at a social event"

COUNTRIES = {"US": "the United States", "UK": "the United Kingdom", "Canada": "Canada", "Australia": "Australia"}
SETTINGS = {"campus": "on campus", "workplace": "at work", "neighbourhood": "in the neighbourhood", "social": "at social events"}

# (expression, Wiktionary sense hint) per country; meanings are fetched from Wiktionary at build time
EXPRESSIONS = {
    "US": [("how's it going", "greet"), ("what's up", "greet"), ("hang out", "spend time"), ("catch up", "news"), ("no worries", None)],
    "UK": [("cheers", "thank"), ("fancy", "want|desire|like"), ("cuppa", None), ("knackered", None), ("mate", "friend")],
    "Canada": [("how's it going", "greet"), ("eh", "question|confirm|agree"), ("toque", None), ("loonie", None), ("no worries", None)],
    "Australia": [("how are you going", "greet"), ("arvo", None), ("heaps", "lot|great"), ("reckon", "think|believe"), ("no worries", None)],
}

NEW_HERE_TONE = ("Describe common habits, never stereotypes. Say 'many people here' or 'it's common to', never "
                 "'Americans always' or 'British people never'. Don't generalise about genders or groups. "
                 "Treat the learner's own culture with respect: these are differences, not better or worse ways.")

NEW_HERE_PLAN = [
    {
        "day": 101, "track": NEW_HERE_WORLD, "technique": "Small talk", "title": "How small talk works here",
        "learn": "Open, keep and close a light conversation the way many people here do.",
        "outline": "Greeting: a light 'how's it going?' is a hello, not a real question. Conversation: pick a safe "
                   "shared topic, answer briefly, then ask something back. Closing: end warmly with a reason and a "
                   "see-you ('I'd better grab a coffee, good to meet you').",
        "partner_push": "Make light small talk. Use one or two everyday local expressions naturally. Answer briefly and "
                        "leave room for them; notice if they ask you something back.",
        "rubric": [
            {"id": "asks_back", "check": "Asks the other person at least one question back"},
            {"id": "builds_on", "check": "Picks up something the other person said and responds to it"},
            {"id": "shares_detail", "check": "Shares one small, friendly detail about themselves"},
        ],
    },
]

NEW_HERE_SCENARIOS = {
    "campus": {"partner": "Jordan", "role": "a classmate at a welcome party",
               "setup": "It's the first week of term. You're at a welcome party and a classmate comes over with two drinks.",
               "opening": "Hey, how's it going? I think we're in the same seminar. Are you settling in okay?"},
    "workplace": {"partner": "Sam", "role": "a coworker at lunch",
                  "setup": "It's your second week at a new job. A coworker sits down next to you in the break room.",
                  "opening": "Mind if I sit here? I don't think we've properly met yet. How are you finding it so far?"},
    "neighbourhood": {"partner": "Alex", "role": "your next-door neighbour",
                      "setup": "You're carrying groceries in and your neighbour is watering their plants.",
                      "opening": "Oh hi, you must be the new neighbour! How are you settling in? Lots of boxes?"},
    "social": {"partner": "Riley", "role": "a friend of a friend at a barbecue",
               "setup": "A friend brought you to a weekend barbecue. Someone you don't know comes over to say hi.",
               "opening": "Hey! I'm Riley, I know Chris from uni. How do you know everyone here?"},
}


def all_plans() -> list[dict]:
    return PLAN + NEW_HERE_PLAN


def plan_for(day: int) -> dict | None:  # noqa: F811  (redefined to include the New here track)
    return next((p for p in all_plans() if p["day"] == day), None)
