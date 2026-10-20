from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from fastapi.responses import Response

from ..voice_slng import SlngClient, VoiceUpstreamError

router = APIRouter()
NOT_CONFIGURED = "voice provider not configured"
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def _client(request: Request) -> SlngClient:
    s = request.app.state.settings
    if not s.voice_configured:
        raise HTTPException(503, NOT_CONFIGURED)
    return SlngClient(s.slng_api_key, s.slng_base_url, s.slng_stt_model, s.slng_tts_model,
                      transport=getattr(request.app.state, "voice_transport", None))


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    lang: str = Field(default="hi", pattern="^[a-z]{2}(-[A-Z]{2})?$")


@router.get("/voice/status")
def status(request: Request):
    s = request.app.state.settings
    return {"provider": "slng" if s.voice_configured else "browser", "configured": s.voice_configured}


@router.post("/voice/stt")
def stt(request: Request, audio: UploadFile = File(...), lang: str = Form("hi")):
    client = _client(request)
    data = audio.file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "audio too large")
    try:
        text = client.stt(data, audio.filename or "audio", audio.content_type or "application/octet-stream", lang)
    except VoiceUpstreamError:
        raise HTTPException(502, "voice provider error")
    return {"text": text}


@router.post("/voice/tts")
def tts(body: TtsIn, request: Request):
    client = _client(request)
    try:
        content, ctype = client.tts(body.text, body.lang)
    except VoiceUpstreamError:
        raise HTTPException(502, "voice provider error")
    return Response(content, media_type=ctype)
