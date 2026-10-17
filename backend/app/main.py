from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, llm
from .observability import init_sentry

init_sentry()
app = FastAPI(title="I Talk, You Listen")


@app.get("/api/health")
def health():
    return {"ok": True, "mode": config.MODE, "llm": config.LLM_PROVIDER, "model": llm.model_name(),
            "stt": config.STT_PROVIDER, "tts": config.TTS_ENABLED}


if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = config.FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(config.FRONTEND_DIST / "index.html")
