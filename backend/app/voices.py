"""Voices: each conversation persona gets its own voice and mood, so a strict interviewer sounds different
from a friendly classmate or an upset customer.

Hosted: ElevenLabs `eleven_v4` (their most emotive model) with an audio tag for the mood, e.g.
"[frustrated sigh] I've already explained this twice." Local: Kokoro (open-source, ~88 MB int8 ONNX), which
has no emotion tags, so mood is approximated with voice choice and speaking speed."""
import io
import json
import os
import re
import threading
import time
import wave
from functools import lru_cache

import httpx
import numpy as np
import sentry_sdk

from . import config

# key: (ElevenLabs voice id, ElevenLabs mood tag, Kokoro voice, speed, label)
PERSONAS = {
    "narrator":   ("XrExE9yKIg1WjnnlVkGX", "[warm, clear, unhurried]", "af_heart", 0.95, "calm narrator"),
    "friendly":   ("cgSgspJ2msm6clMCkdW9", "[warm, cheerful]", "af_bella", 1.02, "friendly classmate"),
    "strict":     ("JBFqnCBsd6RMkjVDRZzb", "[calm, serious, a little skeptical]", "am_michael", 0.94, "strict interviewer"),
    "upset":      ("nPczCjzI2devNBz1zQrb", "[frustrated sigh]", "am_adam", 1.08, "upset customer"),
    "curious":    ("Xb7hH8MSUJpSbSDYk0k2", "[curious]", "bf_emma", 0.98, "curious professor"),
    "excited":    ("FGY2WhTYpPnrIDTdsKH5", "[excited]", "af_nicole", 1.06, "excited creator"),
    "casual":     ("TX3LPaxmHKxFdv7VOQHJ", "[relaxed, friendly]", "am_puck", 1.0, "easygoing friend"),
    # New here: locals with the accent of the learner's new country
    "local_uk":   ("JBFqnCBsd6RMkjVDRZzb", "[warm, chatty]", "bm_george", 1.0, "friendly local (British)"),
    "local_au":   ("IKne3meq5aSn9XLyUdCD", "[relaxed, cheerful]", "am_puck", 1.02, "friendly local (Australian)"),
    "local_ca":   ("cgSgspJ2msm6clMCkdW9", "[warm, cheerful]", "af_bella", 1.0, "friendly local (Canadian)"),
    "local_us":   ("TX3LPaxmHKxFdv7VOQHJ", "[relaxed, friendly]", "am_puck", 1.02, "friendly local (American)"),
}
# Voice ids are ElevenLabs default library voices; override any of them with ELEVENLABS_VOICES='{"strict": "<id>"}'
_overrides = json.loads(os.getenv("ELEVENLABS_VOICES", "{}") or "{}")
ELEVEN_MODEL = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_v4")
ELEVEN_FALLBACK_MODEL = "eleven_flash_v2_5"  # fastest; no audio tags


def persona_for(scenario: dict | None, world: str = "") -> str:
    """Pick a persona from who the partner is."""
    if not scenario:
        return "narrator"
    if scenario.get("country"):
        return {"UK": "local_uk", "Australia": "local_au", "Canada": "local_ca"}.get(scenario["country"], "local_us")
    who = f"{scenario.get('role', '')} {scenario.get('setup', '')}".lower()
    if re.search(r"upset|frustrat|angry|annoyed|complain|third call|wait", who):
        return "upset"
    if re.search(r"interview|hiring|manager|recruit|casting director", who):
        return "strict"
    if re.search(r"professor|teacher|instructor|lecturer", who):
        return "curious"
    if re.search(r"podcast|host|creator|producer", who):
        return "excited"
    if re.search(r"friend|party|classmate|neighbo|coworker|acquaintance", who):
        return "friendly" if "classmate" in who or "party" in who else "casual"
    return {"job_seeker": "strict", "customer_facing": "upset", "student": "curious", "creator": "excited"}.get(world, "friendly")


def voice_info(key: str) -> dict:
    v = PERSONAS.get(key, PERSONAS["narrator"])
    return {"key": key if key in PERSONAS else "narrator", "label": v[4]}


# ---------- ElevenLabs ----------

def eleven_tts(text: str, key: str) -> tuple[bytes, str]:
    voice_id, tag, _, speed, _ = PERSONAS.get(key, PERSONAS["narrator"])
    voice_id = _overrides.get(key, voice_id)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": config.ELEVENLABS_API_KEY, "accept": "audio/mpeg"}
    body = {"text": f"{tag} {text}"[:1500], "model_id": ELEVEN_MODEL, "voice_settings": {"speed": speed}}
    with sentry_sdk.start_span(op="ai.tts", name=f"tts elevenlabs {ELEVEN_MODEL}") as span:
        span.set_data("persona", key)
        r = httpx.post(url, headers=headers, json=body, timeout=60)
        if r.status_code >= 400 and ELEVEN_MODEL != ELEVEN_FALLBACK_MODEL:
            # expressive model unavailable on this plan/voice: fall back to the fast model without tags
            span.set_data("fallback", r.status_code)
            body = {"text": text[:1500], "model_id": ELEVEN_FALLBACK_MODEL, "voice_settings": {"speed": speed}}
            r = httpx.post(url, headers=headers, json=body, timeout=60)
    r.raise_for_status()
    return r.content, "audio/mpeg"


# ---------- Kokoro (local) ----------

MODEL_DIR = config.DATA_DIR / "models"


def kokoro_available() -> bool:
    if os.getenv("LOCAL_TTS", "kokoro") != "kokoro":
        return False
    try:
        import kokoro_onnx  # noqa: F401
    except ImportError:
        return False
    return (MODEL_DIR / "kokoro-v1.0.int8.onnx").exists() and (MODEL_DIR / "voices-v1.0.bin").exists()


# espeak (Kokoro's phonemizer) is not thread-safe: two requests at once crashed one of them (502)
_kokoro_lock = threading.Lock()


@lru_cache(maxsize=1)
def _kokoro():
    from kokoro_onnx import Kokoro

    return Kokoro(str(MODEL_DIR / "kokoro-v1.0.int8.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))


def kokoro_tts(text: str, key: str) -> tuple[bytes, str]:
    _, _, voice, speed, _ = PERSONAS.get(key, PERSONAS["narrator"])
    lang = "en-gb" if voice.startswith("b") else "en-us"
    with sentry_sdk.start_span(op="ai.tts", name="tts kokoro") as span:
        t0 = time.perf_counter()
        with _kokoro_lock:
            samples, rate = _kokoro().create(text[:1000], voice=voice, speed=speed, lang=lang)
        span.set_data("latency_ms", int((time.perf_counter() - t0) * 1000))
        span.set_data("persona", key)
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue(), "audio/wav"


def tts_enabled() -> bool:
    return bool(config.ELEVENLABS_API_KEY and config.HOSTED) or kokoro_available()


def synthesize(text: str, key: str) -> tuple[bytes, str]:
    if config.HOSTED and config.ELEVENLABS_API_KEY:
        return eleven_tts(text, key)
    return kokoro_tts(text, key)
