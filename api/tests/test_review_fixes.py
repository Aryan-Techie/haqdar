"""Regression tests for the independent API review (C1, I1-I6, minors)."""
import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app import schemes as schemes_mod
from app.engine import vocab
from app.engine.evaluate import evaluate
from app.engine.rules import eval_rule, validate_rule
from app.main import create_app
from app.security import make_token, read_token
from tests.conftest import CONSENT, SCHEMES

PHONE = "9876543210"
E164 = "+919876543210"


def P(field, op, value=None):
    return {"field": field, "op": op, "value": value}


def verify(c, code, phone=PHONE):
    return c.post("/auth/verify", json={"phone": phone, "code": code, "consent": CONSENT})


# ---- C1: production guard ----------------------------------------------------
def _prod(env, **over):
    env.setenv("HAQDAR_ENV", "production")
    env.setenv("HAQDAR_SECRET", "a-real-random-secret")
    from cryptography.fernet import Fernet
    env.setenv("HAQDAR_FERNET_KEY", Fernet.generate_key().decode())
    for k, v in over.items():
        if v is None:
            env.delenv(k, raising=False)
        else:
            env.setenv(k, v)


@pytest.mark.parametrize("bad", [
    {"HAQDAR_SECRET": None}, {"HAQDAR_SECRET": "change-me"},
    {"HAQDAR_SECRET": "dev-insecure-secret-change-me"},
    {"HAQDAR_FERNET_KEY": None}, {"HAQDAR_FERNET_KEY": "change-me"},
])
def test_production_refuses_insecure_config(env, bad):
    _prod(env, **bad)
    with pytest.raises(RuntimeError):
        create_app(schemes=[])


def test_production_forces_dev_otp_off(env):
    _prod(env, HAQDAR_DEV_OTP="1")
    c = TestClient(create_app(schemes=[]))
    assert c.post("/auth/otp", json={"phone": PHONE}).json() == {"sent": True}
    assert verify(c, "123456").status_code == 401
    code = c.app.state.otps[E164]["code"]
    assert verify(c, code).status_code == 200


def test_dev_code_without_requested_otp_is_401(client):
    assert verify(client, "123456").status_code == 401
    client.post("/auth/otp", json={"phone": PHONE})
    assert verify(client, "123456", phone="9123456789").status_code == 401  # other phone
    assert verify(client, "123456").status_code == 200


def test_dev_mode_logs_loud_warning(env, caplog):
    with caplog.at_level("WARNING", logger="haqdar"):
        create_app(schemes=[])
    assert any("DEV MODE" in r.message for r in caplog.records)


# ---- I2 / I3: not + decisive reason on real data ---------------------------------
@pytest.fixture(scope="module")
def real():
    return {s["id"]: s for s in schemes_mod.load_schemes()}


def _res(real, sid, profile):
    return evaluate(profile, [real[sid]])[0]


def test_not_government_employee_says_must_not(real):
    r = _res(real, "pm-kisan-maandhan",
             {"state": "HR", "age": 30, "occupation": "government_employee", "land_band": "lt_2_5"})
    assert r["verdict"] == "ineligible"
    assert "must NOT be" in r["reason"]["detail"] and "government_employee" in r["reason"]["detail"]
    assert any(p["field"] == "occupation" and p.get("negated") for p in r["failed"])


def test_eligible_farmer_marks_occupation_negated(real):
    r = _res(real, "pm-kisan-maandhan",
             {"state": "HR", "age": 30, "occupation": "farmer", "land_band": "lt_2_5"})
    assert r["verdict"] == "eligible"
    occ = [p for p in r["passed"] if p["field"] == "occupation"]
    assert occ and all(p.get("negated") for p in occ)
    assert not any(p["field"] == "occupation" for p in r["failed"])


def test_not_swaps_lists_and_double_negation_cancels():
    r = eval_rule({"not": P("category", "eq", "general")}, {"category": "general"})
    assert r.tri == "fail" and r.failed == [{**P("category", "eq", "general"), "negated": True}]
    r = eval_rule({"not": {"not": P("category", "eq", "general")}}, {"category": "general"})
    assert r.tri == "pass" and r.passed == [P("category", "eq", "general")]


def test_reason_names_deciding_predicate_not_open_any_branch(real):
    r = _res(real, "dl-merit-scholarship-sc-st-obc", {"state": "DL", "category": "obc", "student_level": "not_student"})
    assert r["verdict"] == "ineligible"
    assert "student_level" in r["reason"]["detail"] and "category" not in r["reason"]["detail"]
    assert not any(p["field"] == "category" for p in r["failed"])


def test_any_failure_names_all_alternatives():
    rule = {"all": [P("age", "gte", 18), {"any": [P("category", "eq", "sc"), P("category", "eq", "st")]}]}
    sc = dict(SCHEMES[0], id="x", eligibility=rule)
    r = evaluate({"age": 30, "category": "obc"}, [sc])[0]
    assert r["reason"]["detail"].count("category") == 2 and " or " in r["reason"]["detail"]


def test_all_failed_excludes_unknown_any_siblings():
    rule = {"all": [{"any": [P("category", "eq", "sc"), P("gender", "eq", "female")]}, P("age", "gte", 60)]}
    r = eval_rule(rule, {"age": 30, "category": "sc"})
    assert r.tri == "fail" and [p["field"] for p in r.failed] == ["age"]


# ---- I1: malformed values ---------------------------------------------------------
BAD_RULES = [
    P("age", "between", [60, None]),
    P("age", "between", [60]),
    P("annual_income", "in", ["lt_1l"]),
    P("age", "gte", "60"),
    P("bpl", "eq", 1),
    {"field": "age", "op": "exists", "value": 3},
    P("age", "in", []),
    P("occupation", "eq", "astronaut"),
    {"all": [P("age", "gte", 1), P("age", "lte", None)]},
]


@pytest.mark.parametrize("rule", BAD_RULES)
def test_validate_rule_rejects(rule):
    with pytest.raises(ValueError):
        validate_rule(rule)


@pytest.mark.parametrize("rule", BAD_RULES[:6])
def test_create_app_fails_closed_on_bad_rule(env, rule):
    with pytest.raises(ValueError, match="bad-one"):
        create_app(schemes=[dict(SCHEMES[0], id="bad-one", eligibility=rule)])


@pytest.mark.parametrize("rule", BAD_RULES[:5])
def test_load_schemes_names_file_for_bad_rule(tmp_path, rule):
    rec = json.loads((vocab.data_dir() / "schemes" / "pm-kisan-maandhan.json").read_text(encoding="utf-8"))
    rec["eligibility"] = {k: v for k, v in rule.items() if not (k == "value" and v is None)}
    (tmp_path / "broken.json").write_text(json.dumps(rec), encoding="utf-8")
    with pytest.raises(ValueError, match="broken.json"):
        schemes_mod.load_schemes(tmp_path)


def test_all_real_records_load():
    assert len(schemes_mod.load_schemes()) == 42


# ---- I4: OTP brute force ----------------------------------------------------------------
def _nondev(env):
    env.setenv("HAQDAR_DEV_OTP", "0")
    return TestClient(create_app(schemes=[]))


def test_attempts_survive_otp_rerequest(env):
    c = _nondev(env)
    c.post("/auth/otp", json={"phone": PHONE})
    for _ in range(3):
        assert verify(c, "000000").status_code == 401
    c.post("/auth/otp", json={"phone": PHONE})
    assert c.app.state.otps[E164]["tries"] == 3
    assert verify(c, "000001").status_code == 401
    assert verify(c, "000002").status_code == 401
    # budget (5) exhausted: even the right code is refused now
    right = c.app.state.otps[E164]["code"]
    assert verify(c, right).status_code == 429


def test_otp_request_throttle_per_phone(env):
    c = _nondev(env)
    codes = [c.post("/auth/otp", json={"phone": PHONE}).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert c.post("/auth/otp", json={"phone": "9123456789"}).status_code == 200


# ---- I5: trusted proxy hops ----------------------------------------------------------------
def test_xff_ignored_by_default(env):
    env.setenv("HAQDAR_RATE_LIMIT", "2")
    c = TestClient(create_app(schemes=[]))
    codes = [c.get("/health", headers={"X-Forwarded-For": f"1.1.1.{i}"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]


def test_trusted_hops_uses_nth_from_right_and_ignores_spoofed_left(env):
    env.setenv("HAQDAR_RATE_LIMIT", "2")
    env.setenv("HAQDAR_TRUSTED_PROXY_HOPS", "1")
    c = TestClient(create_app(schemes=[]))
    hdr = lambda spoof: {"X-Forwarded-For": f"{spoof}, 10.0.0.9"}  # noqa: E731
    # same real client (rightmost) with a different spoofed leftmost each time: one bucket
    assert [c.get("/health", headers=hdr(f"6.6.6.{i}")).status_code for i in range(3)] == [200, 200, 429]
    # a different real client gets its own bucket
    assert c.get("/health", headers={"X-Forwarded-For": "1.2.3.4, 10.0.0.77"}).status_code == 200


def test_hops_two_and_short_header_falls_back_to_peer(env):
    from types import SimpleNamespace
    from app.main import client_ip
    req = lambda xff: SimpleNamespace(client=SimpleNamespace(host="peer"),  # noqa: E731
                                      headers={"x-forwarded-for": xff} if xff else {})
    assert client_ip(req("a, b, c"), 2) == "b"
    assert client_ip(req("a"), 2) == "peer"
    assert client_ip(req(None), 1) == "peer"
    assert client_ip(req("a, b"), 0) == "peer"


# ---- I6: non-ASCII ----------------------------------------------------------------------------
def test_non_ascii_token_is_401_not_500(client):
    assert read_token("a.\xe9", "s") is None
    r = client.get("/me", headers={"Authorization": "Bearer a.\xe9".encode("latin-1")})
    assert r.status_code == 401


def test_non_ascii_otp_code_is_401(client):
    client.post("/auth/otp", json={"phone": PHONE})
    assert verify(client, "é").status_code == 401
    assert verify(client, "١٢٣٤٥٦").status_code == 401


def test_audit_still_written_with_odd_auth_header(client):
    r = client.post("/evaluate", json={"profile": {"age": 70}},
                    headers={"Authorization": "Bearer a.\xe9".encode("latin-1")})
    assert r.status_code == 200
    from app.models import Audit
    with client.app.state.session_factory() as db:
        assert db.query(Audit).count() == len(r.json()["results"]) > 0


# ---- minors --------------------------------------------------------------------------------------
def test_phone_normalised_to_one_account(client):
    ids = set()
    for ph in ("9999999999", "+919999999999", "919999999999"):  # 3 OTP requests = throttle limit
        client.post("/auth/otp", json={"phone": ph})
        r = verify(client, "123456", phone=ph)
        assert r.status_code == 200, ph
        ids.add(r.json()["user"]["id"])
    assert len(ids) == 1
    from app.routers.auth import _phone
    assert _phone("09999999999") == _phone("99999 99999") == _phone("+91-99999-99999") == "+919999999999"


def test_consent_version_constrained(client):
    client.post("/auth/otp", json={"phone": PHONE})
    for v in ("", "x" * 41):
        r = client.post("/auth/verify", json={"phone": PHONE, "code": "123456",
                                              "consent": {"version": v, "accepted": True}})
        assert r.status_code == 422


def test_otp_not_logged_when_dev_off(env, caplog):
    c = _nondev(env)
    with caplog.at_level("INFO"):
        c.post("/auth/otp", json={"phone": PHONE})
    code = c.app.state.otps[E164]["code"]
    assert code not in caplog.text and PHONE not in caplog.text


def test_profile_hash_is_keyed(client):
    h = client.post("/evaluate", json={"profile": {"age": 70}}).json()["results"][0]["profile_hash"]
    from app.engine.evaluate import profile_hash
    assert h != profile_hash({"age": 70})


def test_undecryptable_profile_logs_error(caplog):
    from app import security
    blob = security.encrypt_profile(security.get_fernet(None, "a"), {"age": 1})
    with caplog.at_level("ERROR"):
        assert security.decrypt_profile(security.get_fernet(None, "b"), blob) == {}
    assert "could not be decrypted" in caplog.text
