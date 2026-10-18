import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, "").strip() or default


MODE = _env("MODE", "local")
HOSTED = MODE == "hosted"

LLM_PROVIDER = _env("LLM_PROVIDER", "digitalocean" if HOSTED else "ollama")
OLLAMA_BASE_URL = _env("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL = _env("OLLAMA_MODEL", "gemma3:1b")
DO_INFERENCE_BASE_URL = _env("DO_INFERENCE_BASE_URL", "https://inference.do-ai.run/v1")
DO_MODEL_ACCESS_KEY = _env("DO_MODEL_ACCESS_KEY")
DO_MODEL = _env("DO_MODEL")
PROMPT_VERSION = _env("PROMPT_VERSION", "v1")
# json = one call returns the whole grade (Gemma 4 / hosted); stepwise = one plain-text question per call (tiny models)
GRADER = _env("GRADER", "json" if HOSTED else "stepwise")

STT_PROVIDER = _env("STT_PROVIDER", "elevenlabs" if HOSTED else "whisper")
WHISPER_MODEL = _env("WHISPER_MODEL", "base.en")
ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = _env("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
TTS_ENABLED = bool(ELEVENLABS_API_KEY) and HOSTED

MONGODB_URI = _env("MONGODB_URI")
MONGODB_DB = _env("MONGODB_DB", "italk")

ADMIN_PASSWORD = _env("ADMIN_PASSWORD")  # /admin/feedback; empty = page disabled

SENTRY_DSN = _env("SENTRY_DSN")
SENTRY_ENVIRONMENT = _env("SENTRY_ENVIRONMENT", "dev")

MAX_RECORDING_SEC = int(_env("MAX_RECORDING_SEC", "90"))
MAX_ATTEMPTS_PER_DAY = int(_env("MAX_ATTEMPTS_PER_DAY", "30"))
MAX_CONCURRENT_SESSIONS = int(_env("MAX_CONCURRENT_SESSIONS", "4"))

DATA_DIR = ROOT / "data"
COURSE_DIR = ROOT / "course"
FRONTEND_DIST = ROOT / "frontend" / "dist"
