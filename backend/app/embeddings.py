from functools import lru_cache

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
EMBED_DIMS = 384


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding

    return TextEmbedding(EMBED_MODEL)


def embed(texts: list[str]) -> list[list[float]]:
    # small batches: embedding all 1,138 book chunks at once peaked at ~5 GB RAM
    return [v.tolist() for v in _model().embed(texts, batch_size=16)]


def embed_query(text: str) -> list[float]:
    # bge models expect this instruction prefix on queries (not on passages)
    return embed(["Represent this sentence for searching relevant passages: " + text])[0]
