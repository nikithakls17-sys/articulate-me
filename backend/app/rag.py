from .embeddings import embed_query
from .store import store


def retrieve(query: str, k: int = 6) -> list[dict]:
    return store().vector_search(embed_query(query), k=k)
