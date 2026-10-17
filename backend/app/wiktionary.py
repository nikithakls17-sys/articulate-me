"""Grounded meanings for slang and idioms from Wiktionary (CC BY-SA 4.0), with attribution links.
Only the expression itself is sent to Wiktionary, never anything the learner said."""
import html
import json
import re
from urllib.parse import quote

import httpx

from .store import now_iso, store

API = "https://en.wiktionary.org/api/rest_v1/page/definition/{}"
HEADERS = {"User-Agent": "ArticulateMe/0.1 (https://github.com/nikithakls17-sys/articulate-me) httpx"}
REGION_WORDS = {"US": ("US", "American"), "UK": ("UK", "British", "Britain", "England"), "Canada": ("Canada", "Canadian"),
                "Australia": ("Australia", "Australian")}


def _clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "").replace("‎", "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def page_url(term: str) -> str:
    return "https://en.wiktionary.org/wiki/" + quote(term.replace(" ", "_"))


def lookup(term: str, country: str | None = None, hint: str | None = None) -> dict | None:
    """{term, meaning, labels, url, source, license} or None. Cached in the store."""
    key = term.strip().lower()
    cache_id = f"wikt:{key}:{hint or ''}"
    hit = store().get("glossary", cache_id)
    if hit:
        return hit if hit.get("meaning") else None
    entry = None
    try:
        r = httpx.get(API.format(quote(key.replace(" ", "_"))), headers=HEADERS, timeout=8)
        if r.status_code == 200:
            senses = []
            for block in r.json().get("en", []):
                for d in block.get("definitions", []):
                    text = _clean(d.get("definition", ""))
                    # skip dictionary noise like "ISO 639-3 language code for Wawonii" (for "wow")
                    if text and not re.search(r"ISO 639|language code|initialism of|abbreviation of|surname|given name", text, re.I):
                        senses.append(text)
            if senses:
                # prefer a sense labelled for the learner's country, then any informal/idiomatic sense
                hinted = [s for s in senses if hint and re.search(hint, s, re.I)]
                regional = [s for s in senses if country and any(w in s for w in REGION_WORDS.get(country, ()))]
                informal = [s for s in senses if re.search(r"informal|colloquial|slang|idiomatic", s, re.I)]
                meaning = (hinted or regional or informal or senses)[0]
                informal = bool(re.search(r"informal|colloquial|slang|idiomatic|Australia|Britain|UK|US|Canada", meaning))
                labels = re.findall(r"^\(([^)]*)\)", meaning)
                meaning = re.sub(r"^\([^)]*\)\s*", "", meaning)
                entry = {"term": term, "meaning": meaning[:240], "labels": labels[0] if labels else "", "informal": informal,
                         "url": page_url(key), "source": "Wiktionary", "license": "CC BY-SA 4.0"}
    except httpx.HTTPError:
        return None  # offline: don't cache, try again next time
    store().insert("glossary", {"id": cache_id, "created_at": now_iso(), **(entry or {"term": term})})
    return entry


if __name__ == "__main__":
    import sys

    for t in sys.argv[1:] or ["no worries", "arvo", "cuppa", "knackered", "toque", "what's up", "hang out", "catch up", "cheers", "reckon"]:
        print(json.dumps(lookup(t, "Australia"), ensure_ascii=False))
