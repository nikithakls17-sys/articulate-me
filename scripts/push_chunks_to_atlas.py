"""Copy the already-embedded textbook chunks (data/chunks.jsonl, written by ingest_books.py in local mode) into
MongoDB Atlas and create the vector index. Same vectors, no re-embedding, so it is fast and light on RAM.

Usage (from repo root, MONGODB_URI set):  .venv/Scripts/python scripts/push_chunks_to_atlas.py
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app import config  # noqa: E402
from app.embeddings import EMBED_DIMS  # noqa: E402
from app.store import VECTOR_INDEX, MongoStore, store  # noqa: E402


def main():
    s = store()
    if not isinstance(s, MongoStore):
        sys.exit("MONGODB_URI is not set; nothing to push.")
    src = config.DATA_DIR / "chunks.jsonl"
    rows = [json.loads(l) for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]
    by_book: dict[str, list[dict]] = {}
    for r in rows:
        assert len(r["embedding"]) == EMBED_DIMS, r["id"]
        by_book.setdefault(r["book"], []).append(r)
    for book, chunks in by_book.items():
        s.replace_chunks(book, chunks)
        print(f"{book}: {len(chunks)} chunks", flush=True)
    created = s.ensure_vector_index(EMBED_DIMS)
    print("created vector index" if created else "vector index already exists", flush=True)
    t0 = time.time()
    while time.time() - t0 < 600:
        idx = next((i for i in s.db.chunks.list_search_indexes() if i["name"] == VECTOR_INDEX), {})
        if idx.get("queryable"):
            print(f"index queryable after {time.time() - t0:.0f}s (status {idx.get('status')})", flush=True)
            return
        time.sleep(10)
    sys.exit("index still not queryable after 10 min; check Atlas")


if __name__ == "__main__":
    main()
