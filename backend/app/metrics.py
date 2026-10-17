"""Deterministic speech metrics from a transcript + word timestamps. No LLM involved."""
import re

PAUSE_SEC = 0.7
ALWAYS_FILLERS = {"um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm", "mm", "basically", "actually", "literally"}
PHRASE_FILLERS = [("you", "know"), ("i", "mean"), ("kind", "of"), ("sort", "of")]


def _norm(w: str) -> str:
    return re.sub(r"[^a-z']", "", w.lower())


def count_fillers(tokens: list[str]) -> tuple[int, dict]:
    """tokens keep their punctuation, which we use to tell filler 'like'/'so' from real ones."""
    found: dict[str, int] = {}
    n = [_norm(t) for t in tokens]
    i = 0
    while i < len(n):
        w = n[i]
        prev_raw = tokens[i - 1] if i else "."
        sentence_start = prev_raw.endswith((".", "?", "!", ","))
        if i + 1 < len(n) and (w, n[i + 1]) in PHRASE_FILLERS:
            # "you know" only counts as filler when it isn't followed by a clause ("you know what I did?")
            if (w, n[i + 1]) != ("you", "know") or tokens[i + 1].endswith((",", ".")) or i + 2 >= len(n):
                key = f"{w} {n[i + 1]}"
                found[key] = found.get(key, 0) + 1
                i += 2
                continue
        if w in ALWAYS_FILLERS:
            found[w] = found.get(w, 0) + 1
        elif w == "like" and (tokens[i].endswith(",") or prev_raw.endswith(",")):
            found[w] = found.get(w, 0) + 1
        elif w == "so" and sentence_start and tokens[i].endswith(","):
            found[w] = found.get(w, 0) + 1
        i += 1
    return sum(found.values()), found


def compute(words: list[dict], text: str, time_limit_sec: int = 60) -> dict:
    tokens = [w["word"] for w in words] if words else text.split()
    word_count = len([t for t in tokens if _norm(t)])
    if words:
        start, end = words[0]["start"], words[-1]["end"]
        duration = max(end, 0.1)
        speaking = max(end - start, 0.1)
        gaps = [round(b["start"] - a["end"], 2) for a, b in zip(words, words[1:])]
        long_pauses = [g for g in gaps if g > PAUSE_SEC]
    else:  # text-only (eval transcripts): estimate at 150 wpm
        duration = speaking = word_count / 150 * 60
        long_pauses = []
    filler_count, fillers = count_fillers(tokens)
    minutes = speaking / 60
    first_end = next((i for i, t in enumerate(tokens) if t.endswith((".", "?", "!"))), len(tokens) - 1)
    return {
        "duration_sec": round(duration, 1),
        "time_limit_sec": time_limit_sec,
        "over_time": bool(duration > time_limit_sec + 5),
        "word_count": word_count,
        "wpm": round(word_count / minutes) if minutes else 0,
        "filler_count": filler_count,
        "fillers_per_min": round(filler_count / minutes, 1) if minutes else 0,
        "fillers": fillers,
        "pauses_over_0_7s": len(long_pauses),
        "longest_pause_sec": max(long_pauses, default=0.0),
        "words_to_first_sentence_end": first_end + 1 if tokens else 0,
    }


def marked_transcript(words: list[dict], text: str) -> str:
    """Transcript with [pause] markers where the speaker was silent > 0.7 s (lets Gemma 'see' pauses)."""
    if not words:
        return text
    out = [words[0]["word"]]
    for a, b in zip(words, words[1:]):
        if b["start"] - a["end"] > PAUSE_SEC:
            out.append("[pause]")
        out.append(b["word"])
    return " ".join(out)
