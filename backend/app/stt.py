"""Speech-to-text with word timestamps. Local: faster-whisper. Hosted: ElevenLabs Scribe.
Returns {"text": str, "words": [{"word", "start", "end"}], "provider": str, "latency_ms": int}."""
import os
import tempfile
import time
from functools import lru_cache

import httpx
import sentry_sdk

from . import config

# Whisper "cleans up" disfluencies unless the prompt itself is disfluent, which would hide the
# filler words we want to count. A messy initial prompt nudges it to transcribe verbatim.
VERBATIM_PROMPT = "Umm, so, uh, I was like, you know, hmm... I mean, basically, uh, okay so, um."


@lru_cache(maxsize=1)
def _whisper():
    from faster_whisper import WhisperModel

    return WhisperModel(config.WHISPER_MODEL, device="cpu", compute_type="int8")


def _decode_16k_mono(path: str):
    """Decode any browser recording (webm/opus, mp4/aac, wav) to 16 kHz mono float32.
    We do this ourselves because faster-whisper's decoder passes an av.open() argument PyAV 15+ removed."""
    import av
    import numpy as np

    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    chunks = []
    with av.open(path) as container:
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def _transcribe_whisper(path: str) -> dict:
    segments, _ = _whisper().transcribe(_decode_16k_mono(path), word_timestamps=True, initial_prompt=VERBATIM_PROMPT,
                                        language="en", vad_filter=False, condition_on_previous_text=False)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"word": w.word.strip(), "start": round(float(w.start), 2), "end": round(float(w.end), 2)})
    return {"text": " ".join(w["word"] for w in words), "words": words}


def _transcribe_elevenlabs(path: str, content_type: str) -> dict:
    if not config.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")
    with open(path, "rb") as f:
        r = httpx.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": config.ELEVENLABS_API_KEY},
            data={"model_id": os.getenv("ELEVENLABS_STT_MODEL", "scribe_v1"), "language_code": "en",
                  "timestamps_granularity": "word", "tag_audio_events": "false"},
            files={"file": (f"answer{_suffix(content_type)}", f, content_type or "audio/webm")},
            timeout=120,
        )
    r.raise_for_status()
    body = r.json()
    words = [{"word": w["text"].strip(), "start": w.get("start", 0.0), "end": w.get("end", 0.0)}
             for w in body.get("words", []) if w.get("type", "word") == "word" and w["text"].strip()]
    return {"text": body.get("text", "").strip(), "words": words}


def _suffix(content_type: str) -> str:
    """iPhone Safari records audio/mp4 (AAC); Chrome/Android/Firefox record audio/webm (Opus)."""
    ct = (content_type or "").lower()
    if any(k in ct for k in ("mp4", "m4a", "aac")):
        return ".mp4"
    if "wav" in ct:
        return ".wav"
    if "ogg" in ct:
        return ".ogg"
    return ".webm"


def transcribe(audio: bytes, content_type: str = "audio/webm") -> dict:
    suffix = _suffix(content_type)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio)
        path = tmp.name
    try:
        with sentry_sdk.start_span(op="ai.transcribe", name=f"stt {config.STT_PROVIDER}") as span:
            t0 = time.perf_counter()
            if config.STT_PROVIDER == "elevenlabs":
                out = _transcribe_elevenlabs(path, content_type)
            else:
                out = _transcribe_whisper(path)
            out["latency_ms"] = int((time.perf_counter() - t0) * 1000)
            out["provider"] = config.STT_PROVIDER
            span.set_data("words", len(out["words"]))
            span.set_data("latency_ms", out["latency_ms"])
        return out
    finally:
        os.unlink(path)
