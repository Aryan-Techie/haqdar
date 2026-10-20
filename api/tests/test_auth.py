from tests.conftest import CONSENT


def test_otp_flow(client):
    assert client.post("/auth/otp", json={"phone": "9876543210"}).json() == {"sent": True, "dev_hint": "123456"}
    r = client.post("/auth/verify", json={"phone": "9876543210", "code": "123456", "consent": CONSENT})
    assert r.status_code == 200
    body = r.json()
    assert body["token"] and body["user"]["phone"] == "+919876543210"


def test_verify_requires_consent_422(client):
    base = {"phone": "9876543210", "code": "123456"}
    assert client.post("/auth/verify", json=base).status_code == 422
    r = client.post("/auth/verify", json={**base, "consent": {"version": "v1", "accepted": False}})
    assert r.status_code == 422


def test_wrong_code_401(client):
    r = client.post("/auth/verify", json={"phone": "9876543210", "code": "000000", "consent": CONSENT})
    assert r.status_code == 401


def test_bad_phone_422(client):
    assert client.post("/auth/otp", json={"phone": "abc"}).status_code == 422


def test_non_dev_otp_random_code(env):
    from fastapi.testclient import TestClient
    from app.main import create_app
    env.setenv("HAQDAR_DEV_OTP", "0")
    c = TestClient(create_app(schemes=[]))
    c.post("/auth/otp", json={"phone": "9876543210"})
    r = c.post("/auth/verify", json={"phone": "9876543210", "code": "123456", "consent": CONSENT})
    assert r.status_code == 401
    code = c.app.state.otps["+919876543210"]["code"]
    r = c.post("/auth/verify", json={"phone": "9876543210", "code": code, "consent": CONSENT})
    assert r.status_code == 200


def test_otp_has_no_hint_when_dev_off(env):
    from fastapi.testclient import TestClient
    from app.main import create_app
    env.setenv("HAQDAR_DEV_OTP", "0")
    c = TestClient(create_app(schemes=[]))
    assert c.post("/auth/otp", json={"phone": "9876543210"}).json() == {"sent": True}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "schemes": 2}


def test_request_id_header(client):
    assert client.get("/health", headers={"X-Request-ID": "abc"}).headers["x-request-id"] == "abc"
    assert client.get("/health").headers["x-request-id"]
