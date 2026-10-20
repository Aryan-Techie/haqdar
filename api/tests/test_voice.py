import httpx
from fastapi.testclient import TestClient

from app import voice_slng
from app.main import create_app


def test_voice_status_and_503_without_key(client):
    assert client.get("/voice/status").json() == {"provider": "browser", "configured": False}
    r = client.post("/voice/stt", files={"audio": ("a.wav", b"x", "audio/wav")}, data={"lang": "hi"})
    assert r.status_code == 503 and r.json() == {"detail": "voice provider not configured"}
    r = client.post("/voice/tts", json={"text": "namaste", "lang": "hi"})
    assert r.status_code == 503 and r.json() == {"detail": "voice provider not configured"}


def _slng_app(env, handler):
    env.setenv("SLNG_API_KEY", "k-123")
    app = create_app(schemes=[])
    app.state.voice_transport = httpx.MockTransport(handler)
    return TestClient(app)


def test_slng_stt_calls_upstream_with_bearer(env):
    seen = {}

    def handler(req: httpx.Request):
        seen["req"], seen["body"] = req, req.read()
        return httpx.Response(200, json={"text": "pachaas"})

    c = _slng_app(env, handler)
    assert c.get("/voice/status").json() == {"provider": "slng", "configured": True}
    r = c.post("/voice/stt", files={"audio": ("a.wav", b"RIFFdata", "audio/wav")}, data={"lang": "hi"})
    assert r.status_code == 200 and r.json() == {"text": "pachaas"}
    req = seen["req"]
    assert req.headers["authorization"] == "Bearer k-123"
    assert req.url.path == voice_slng.STT_PATH.format(model="sarvam/saaras:v3")
    assert b"sarvam/saaras:v3" in seen["body"] or "saaras" in req.url.path
    assert b"RIFFdata" in seen["body"]


def test_slng_tts_proxies_audio(env):
    def handler(req: httpx.Request):
        assert req.headers["authorization"] == "Bearer k-123"
        assert req.url.path == "/v1/tts/sarvam/bulbul:v3"
        return httpx.Response(200, content=b"AUDIO", headers={"content-type": "audio/mpeg"})

    r = _slng_app(env, handler).post("/voice/tts", json={"text": "hello", "lang": "hi"})
    assert r.status_code == 200 and r.content == b"AUDIO" and r.headers["content-type"] == "audio/mpeg"


def test_slng_upstream_error_502(env):
    c = _slng_app(env, lambda req: httpx.Response(500))
    assert c.post("/voice/tts", json={"text": "x", "lang": "hi"}).status_code == 502


def test_slng_stt_non_json_upstream_is_502(env):
    c = _slng_app(env, lambda req: httpx.Response(200, text="<html>oops</html>"))
    r = c.post("/voice/stt", files={"audio": ("a.wav", b"x", "audio/wav")}, data={"lang": "hi"})
    assert r.status_code == 502
