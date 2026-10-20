"""Final-review fixes: maternity gender gate, state coverage, kit language."""
import pytest
from fastapi.testclient import TestClient

from app import kit as kitmod
from app.engine.evaluate import evaluate, next_fields
from app.main import create_app
from app.schemes import load_schemes
from tests.conftest import login

MATERNITY = {"pmsma", "janani-suraksha-yojana", "janani-suraksha-yojana-lps", "pm-matru-vandana-yojana"}


@pytest.fixture(scope="module")
def real_schemes():
    return load_schemes()


@pytest.fixture
def real_client(env):
    return TestClient(create_app(schemes=load_schemes()))


@pytest.mark.data
@pytest.mark.parametrize("state", ["UP", "BR", "HR", "DL", "KA"])
def test_man_saying_pregnant_is_never_eligible_for_maternity(real_schemes, state):
    profile = {"state": state, "age": 30, "gender": "male", "income_band": "lt_1l", "category": "sc",
               "bpl": True, "pregnant_or_new_mother": True}
    got = {r["scheme_id"]: r["verdict"] for r in evaluate(profile, real_schemes)}
    for sid in MATERNITY:
        assert got[sid] == "ineligible", sid


@pytest.mark.data
def test_woman_saying_pregnant_is_still_eligible(real_schemes):
    profile = {"state": "UP", "age": 26, "gender": "female", "pregnant_or_new_mother": True}
    got = {r["scheme_id"]: r["verdict"] for r in evaluate(profile, real_schemes)}
    assert got["pmsma"] == "eligible" and got["janani-suraksha-yojana-lps"] == "eligible"


@pytest.mark.data
def test_next_fields_never_asks_pregnancy_of_a_man(real_schemes):
    man = {"state": "UP", "age": 70, "gender": "male", "occupation": "retired", "income_band": "lt_1l",
           "category": "general"}
    assert "pregnant_or_new_mother" not in next_fields(man, real_schemes)
    woman = dict(man, gender="female", age=26)
    assert "pregnant_or_new_mother" in next_fields(woman, real_schemes)


@pytest.mark.data
def test_evaluate_route_man_gets_no_pregnancy_question(real_client):
    r = real_client.post("/evaluate", json={"profile": {
        "state": "UP", "age": 70, "gender": "male", "occupation": "retired",
        "income_band": "lt_1l", "category": "general"}})
    assert "pregnant_or_new_mother" not in r.json()["next_fields"]


@pytest.mark.data
@pytest.mark.parametrize("state,expected", [("UP", False), ("BR", False), ("DL", True), ("HR", True)])
def test_has_state_schemes_real_data(real_client, state, expected):
    r = real_client.post("/evaluate", json={"profile": {"state": state}})
    assert r.json()["coverage"]["has_state_schemes"] is expected


def test_kit_lang_in_post_body_is_used(client, auth):
    r = client.post("/kit/test-pension", json={"lang": "hi"}, headers=auth)
    assert r.status_code == 200
    assert r.headers["x-kit-language"] == ("hi" if kitmod.hindi_supported() else "en")
    r = client.post("/kit/test-pension", json={"lang": "en"}, headers=auth)
    assert r.headers["x-kit-language"] == "en"
    assert client.post("/kit/test-pension", json={"lang": "xx"}, headers=auth).status_code == 422


def test_kit_body_lang_beats_saved_user_language(client, auth, monkeypatch):
    monkeypatch.setattr(kitmod, "hindi_supported", lambda: True)
    from app.routers import kit as kit_router
    monkeypatch.setattr(kit_router, "hindi_supported", lambda: True)
    seen = {}
    monkeypatch.setattr(kit_router, "build_pdf", lambda p, s, lang: seen.setdefault("lang", lang) and b"%PDF")
    client.post("/kit/test-pension", json={"lang": "hi"}, headers=auth)
    assert seen["lang"] == "hi"
