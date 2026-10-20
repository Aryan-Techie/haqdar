"""SLNG (Sarvam Saaras/Bulbul) proxy. Key stays server-side."""
from __future__ import annotations

import httpx

# TODO(confirm against docs.slng.ai): the speech-to-text route and body are unconfirmed.
STT_PATH = "/v1/stt/{model}"
# Per SLNG docs: TTS route with the model in the path, Bearer auth, JSON body.
TTS_PATH = "/v1/tts/{model}"


class VoiceUpstreamError(Exception):
    pass


class SlngClient:
    def __init__(self, api_key: str, base_url: str, stt_model: str, tts_model: str,
                 transport: httpx.BaseTransport | None = None, timeout: float = 30.0):
        self.api_key, self.base_url = api_key, base_url.rstrip("/")
        self.stt_model, self.tts_model = stt_model, tts_model
        self._transport, self._timeout = transport, timeout

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, transport=self._transport, timeout=self._timeout,
                            headers={"Authorization": f"Bearer {self.api_key}"})

    def stt(self, audio: bytes, filename: str, content_type: str, lang: str) -> str:
        try:
            with self._client() as c:
                r = c.post(STT_PATH.format(model=self.stt_model),
                           files={"audio": (filename, audio, content_type)},
                           data={"lang": lang, "model": self.stt_model})
        except httpx.HTTPError as e:
            raise VoiceUpstreamError(str(e)) from e
        if r.status_code >= 400:
            raise VoiceUpstreamError(f"upstream {r.status_code}")
        try:
            data = r.json()
            return data.get("text") or data.get("transcript") or ""
        except (ValueError, AttributeError) as e:
            raise VoiceUpstreamError("upstream returned an unreadable body") from e

    def tts(self, text: str, lang: str) -> tuple[bytes, str]:
        try:
            with self._client() as c:
                r = c.post(TTS_PATH.format(model=self.tts_model),
                           json={"text": text, "lang": lang, "model": self.tts_model})
        except httpx.HTTPError as e:
            raise VoiceUpstreamError(str(e)) from e
        if r.status_code >= 400:
            raise VoiceUpstreamError(f"upstream {r.status_code}")
        return r.content, r.headers.get("content-type", "audio/mpeg")
