"""App data + vector search. MongoDB Atlas when MONGODB_URI is set, JSON files on disk otherwise."""
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import config

VECTOR_INDEX = "chunks_vector"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MongoStore:
    def __init__(self, uri: str, db: str):
        from pymongo import MongoClient

        self.db = MongoClient(uri, appname="i-talk-you-listen")[db]
        self.db.attempts.create_index([("user_id", 1), ("created_at", -1)])

    def get_lesson(self, day: int):
        return self.db.lessons.find_one({"day": day}, {"_id": 0})

    def list_lessons(self):
        return list(self.db.lessons.find({}, {"_id": 0}).sort("day", 1))

    def upsert_lesson(self, lesson: dict):
        self.db.lessons.replace_one({"day": lesson["day"]}, lesson, upsert=True)

    def get_user(self, user_id: str):
        return self.db.users.find_one({"id": user_id}, {"_id": 0})

    def upsert_user(self, user: dict):
        self.db.users.replace_one({"id": user["id"]}, user, upsert=True)

    def add_attempt(self, attempt: dict):
        self.db.attempts.insert_one(dict(attempt))

    def list_attempts(self, user_id: str):
        return list(self.db.attempts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1))

    def replace_chunks(self, book: str, chunks: list[dict]):
        self.db.chunks.delete_many({"book": book})
        if chunks:
            self.db.chunks.insert_many([dict(c) for c in chunks])

    def vector_search(self, vector: list[float], k: int = 6):
        pipeline = [
            {"$vectorSearch": {"index": VECTOR_INDEX, "path": "embedding", "queryVector": vector,
                               "numCandidates": k * 20, "limit": k}},
            {"$project": {"_id": 0, "embedding": 0, "score": {"$meta": "vectorSearchScore"}}},
        ]
        return list(self.db.chunks.aggregate(pipeline))

    def ensure_vector_index(self, dims: int):
        from pymongo.operations import SearchIndexModel

        existing = [i["name"] for i in self.db.chunks.list_search_indexes()]
        if VECTOR_INDEX in existing:
            return False
        self.db.chunks.create_search_index(SearchIndexModel(
            name=VECTOR_INDEX, type="vectorSearch",
            definition={"fields": [{"type": "vector", "path": "embedding", "numDimensions": dims,
                                    "similarity": "cosine"}]},
        ))
        return True


class LocalStore:
    """Single-process JSON store. Good enough for local mode and dev; hosted uses Mongo."""

    def __init__(self, root: Path):
        self.root = root / "local_store"
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self._chunks = None

    def _load(self, name: str) -> list:
        p = self.root / f"{name}.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def _save(self, name: str, rows: list):
        (self.root / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")

    def get_lesson(self, day: int):
        return next((l for l in self._load("lessons") if l["day"] == day), None)

    def list_lessons(self):
        return sorted(self._load("lessons"), key=lambda l: l["day"])

    def upsert_lesson(self, lesson: dict):
        with self.lock:
            rows = [l for l in self._load("lessons") if l["day"] != lesson["day"]] + [lesson]
            self._save("lessons", rows)

    def get_user(self, user_id: str):
        return next((u for u in self._load("users") if u["id"] == user_id), None)

    def upsert_user(self, user: dict):
        with self.lock:
            rows = [u for u in self._load("users") if u["id"] != user["id"]] + [user]
            self._save("users", rows)

    def add_attempt(self, attempt: dict):
        with self.lock:
            self._save("attempts", self._load("attempts") + [attempt])

    def list_attempts(self, user_id: str):
        return sorted([a for a in self._load("attempts") if a["user_id"] == user_id], key=lambda a: a["created_at"])

    def _chunk_file(self) -> Path:
        return config.DATA_DIR / "chunks.jsonl"

    def replace_chunks(self, book: str, chunks: list[dict]):
        p = self._chunk_file()
        keep = []
        if p.exists():
            keep = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
            keep = [c for c in keep if c["book"] != book]
        with p.open("w", encoding="utf-8") as f:
            for c in keep + chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        self._chunks = None

    def vector_search(self, vector: list[float], k: int = 6):
        if self._chunks is None:
            p = self._chunk_file()
            rows = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []
            mat = np.array([r["embedding"] for r in rows], dtype=np.float32) if rows else np.zeros((0, 1))
            self._chunks = (rows, mat)
        rows, mat = self._chunks
        if not rows:
            return []
        q = np.array(vector, dtype=np.float32)
        scores = mat @ q / (np.linalg.norm(mat, axis=1) * np.linalg.norm(q) + 1e-9)
        out = []
        for i in np.argsort(-scores)[:k]:
            r = {k2: v for k2, v in rows[i].items() if k2 != "embedding"}
            r["score"] = float(scores[i])
            out.append(r)
        return out

    def ensure_vector_index(self, dims: int):
        return False


_store = None


def store():
    global _store
    if _store is None:
        _store = MongoStore(config.MONGODB_URI, config.MONGODB_DB) if config.MONGODB_URI else LocalStore(config.DATA_DIR)
    return _store
