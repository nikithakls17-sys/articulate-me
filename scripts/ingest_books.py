"""Ingest the CC-licensed public speaking textbooks into the vector store.

Usage (from repo root):  .venv/Scripts/python scripts/ingest_books.py
Reads data/books/*.pdf. Uses the PDF outline (bookmarks) to label chapter/section per page.
"""
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from pypdf import PdfReader  # noqa: E402

from app import config  # noqa: E402
from app.embeddings import EMBED_DIMS, embed  # noqa: E402
from app.store import store  # noqa: E402

BOOKS = {
    "stand": {
        "title": "Stand up, Speak out: The Practice and Ethics of Public Speaking (UWM edition)",
        "url": "https://wisconsin.pressbooks.pub/uwmpublicspeaking/",
        "license": "CC BY-NC-SA 4.0",
    },
    "exploring": {
        "title": "Exploring Public Speaking, 4th ed. (Tucker et al.)",
        "url": "https://open.maricopa.edu/exploringpublicspeaking/",
        "license": "CC BY-NC-SA 4.0",
    },
}

CHUNK_WORDS = 300   # ~400 tokens
OVERLAP_WORDS = 45  # ~60 tokens
SKIP_SECTIONS = re.compile(r"\b(references|bibliography|index|glossary|works cited|notes|acknowledg|about the|"
                           r"copyright|licen[cs]e|table of contents|contents|preface|dedication|"
                           r"media attributions|feedback)\b", re.I)


def book_key(pdf: Path) -> str:
    name = pdf.stem.lower()
    if "stand" in name or "uwm" in name or "speak-out" in name:
        return "stand"
    if "explor" in name or "tucker" in name:
        return "exploring"
    return name


def outline_map(reader: PdfReader) -> list[tuple[int, int, str]]:
    """[(page_index, depth, title)] sorted by page."""
    out = []

    def walk(items, depth):
        for it in items:
            if isinstance(it, list):
                walk(it, depth + 1)
                continue
            try:
                out.append((reader.get_destination_page_number(it), depth, it.title.strip()))
            except Exception:
                pass

    try:
        walk(reader.outline, 0)
    except Exception:
        pass
    return sorted(out)


def labels_for_pages(reader: PdfReader):
    marks = outline_map(reader)
    chapter, section, labels = "", "", []
    mi = 0
    for p in range(len(reader.pages)):
        while mi < len(marks) and marks[mi][0] <= p:
            _, depth, title = marks[mi]
            if depth == 0:
                chapter, section = title, ""
            else:
                section = title
            mi += 1
        labels.append((chapter, section))
    return labels


def clean(text: str) -> str:
    text = re.sub(r"-\n(\w)", r"\1", text)          # de-hyphenate line breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n\n", text)
    return text.strip()


def is_main_content(chapter: str, section: str) -> bool:
    if not chapter:
        return False
    if SKIP_SECTIONS.search(chapter) or (section and SKIP_SECTIONS.search(section)):
        return False
    return True


def chunk_pages(pages: list[dict]) -> list[dict]:
    """Chunk within each section so a chunk never straddles two topics."""
    chunks, buf, meta = [], [], None

    def flush(final=False):
        nonlocal buf
        while len(buf) >= CHUNK_WORDS or (final and buf):
            words = buf[:CHUNK_WORDS]
            chunks.append({**meta, "page": words[0][1], "text": " ".join(w for w, _ in words)})
            if final and len(buf) <= CHUNK_WORDS:
                buf = []
                break
            buf = buf[CHUNK_WORDS - OVERLAP_WORDS:]

    for pg in pages:
        key = (pg["chapter"], pg["section"])
        if meta and (meta["chapter"], meta["section"]) != key:
            flush(final=True)
        meta = {"chapter": pg["chapter"], "section": pg["section"]}
        buf.extend((w, pg["page"]) for w in pg["text"].split())
        flush()
    if meta:
        flush(final=True)
    return [c for c in chunks if len(c["text"].split()) >= 40]


def ingest(pdf: Path):
    t0 = time.perf_counter()
    key = book_key(pdf)
    info = BOOKS.get(key, {"title": pdf.stem, "url": "", "license": ""})
    reader = PdfReader(str(pdf))
    labels = labels_for_pages(reader)
    pages = []
    for i, page in enumerate(reader.pages):
        chapter, section = labels[i]
        if not is_main_content(chapter, section):
            continue
        text = clean(page.extract_text() or "")
        if text:
            pages.append({"page": i + 1, "chapter": chapter, "section": section, "text": text})
    chunks = chunk_pages(pages)
    t_parse = time.perf_counter() - t0
    vectors = embed([f"{c['chapter']} — {c['section']}\n{c['text']}" for c in chunks])
    for i, (c, v) in enumerate(zip(chunks, vectors)):
        c.update({"id": f"{key}-{i:04d}", "book": key, "book_title": info["title"], "license": info["license"],
                  "url": info["url"], "embedding": v})
    store().replace_chunks(key, chunks)
    took = time.perf_counter() - t0
    print(f"{pdf.name}: {len(reader.pages)} pages, {len(pages)} kept, {len(chunks)} chunks | "
          f"parse {t_parse:.1f}s, total {took:.1f}s")
    return len(chunks)


def main():
    pdfs = sorted((config.DATA_DIR / "books").glob("*.pdf"))
    if not pdfs:
        sys.exit("No PDFs in data/books/. Download both textbooks there first (see README).")
    total = sum(ingest(p) for p in pdfs)
    created = store().ensure_vector_index(EMBED_DIMS)
    print(f"total chunks: {total}" + (" | created Atlas vector index (takes ~1 min to build)" if created else ""))


if __name__ == "__main__":
    main()
