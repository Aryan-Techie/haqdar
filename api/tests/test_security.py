import pytest
from fastapi.testclient import TestClient

from app import security
from app.main import create_app


def test_token_roundtrip_tamper_expiry():
    t = security.make_token(42, "s")
    assert security.read_token(t, "s") == 42
    assert security.read_token(t, "other") is None
    assert security.read_token(t + "x", "s") is None
    assert security.read_token("garbage", "s") is None
    assert security.read_token("", "s") is None
    p, sig = t.split(".")
    assert security.read_token(security.make_token(43, "s").split(".")[0] + "." + sig, "s") is None
    assert security.read_token(t, "s", now=1e12) is None


def test_fernet_roundtrip_and_ciphertext():
    f = security.get_fernet(None, "s")
    blob = security.encrypt_profile(f, {"state": "HR"})
    assert "HR" not in blob and security.decrypt_profile(f, blob) == {"state": "HR"}
    assert security.decrypt_profile(security.get_fernet(None, "other"), blob) == {}
    assert security.decrypt_profile(f, None) == {}


def test_rate_limiter_window():
    now = [0.0]
    rl = security.RateLimiter(2, 60, clock=lambda: now[0])
    assert rl.allow("a") and rl.allow("a") and not rl.allow("a")
    assert rl.allow("b")
    now[0] = 61
    assert rl.allow("a")


def test_rate_limit_429(env):
    env.setenv("HAQDAR_RATE_LIMIT", "3")
    c = TestClient(create_app(schemes=[]))
    codes = [c.get("/health").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert c.get("/health").headers["x-request-id"]


def test_audit_logged_on_evaluate(client):
    r = client.post("/evaluate", json={"profile": {"age": 70}})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 2
    from app.models import Audit
    with client.app.state.session_factory() as db:
        rows = db.query(Audit).all()
    assert {a.scheme_id for a in rows} == {x["scheme_id"] for x in results}
    for a in rows:
        src = next(x for x in results if x["scheme_id"] == a.scheme_id)
        assert (a.rule_version, a.profile_hash, a.verdict) == (src["rule_version"], src["profile_hash"], src["verdict"])
        assert a.user_id is None


def test_audit_records_user_when_token_given(client, auth):
    client.post("/evaluate", json={"profile": {"age": 70}}, headers=auth)
    from app.models import Audit
    with client.app.state.session_factory() as db:
        assert all(a.user_id is not None for a in db.query(Audit).all())


def test_invalid_evaluate_not_audited(client):
    r = client.post("/evaluate", json={"profile": {"age": -1}})
    assert r.status_code == 422
    from app.models import Audit
    with client.app.state.session_factory() as db:
        assert db.query(Audit).count() == 0
