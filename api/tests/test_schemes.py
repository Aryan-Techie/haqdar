import json
import shutil

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import schemes as schemes_mod
from app.routers import evaluate as evaluate_router
from app.routers import schemes as schemes_router
from tests.fixtures import BAD_DIR, SCHEMES_DIR, fx_schemes  # noqa: F401


def make_client(schemes):
    app = FastAPI()
    app.state.schemes = schemes
    app.include_router(evaluate_router.router)
    app.include_router(schemes_router.router)
    return TestClient(app)


@pytest.fixture()
def client(fx_schemes):
    return make_client(fx_schemes)


def test_load_fixture_schemes():
    loaded = schemes_mod.load_schemes(SCHEMES_DIR)
    assert len(loaded) == 10 and all("id" in s for s in loaded)


def test_load_schemes_validates():
    with pytest.raises(Exception) as e:
        schemes_mod.load_schemes(BAD_DIR)
    assert "fx-bad.json" in str(e.value)


def test_load_schemes_rejects_duplicate_ids(tmp_path):
    for n in ("a.json", "b.json"):
        shutil.copy(SCHEMES_DIR / "fx-old-age-pension.json", tmp_path / n)
    with pytest.raises(Exception) as e:
        schemes_mod.load_schemes(tmp_path)
    assert "fx-old-age-pension" in str(e.value)


def test_load_schemes_empty_dir(tmp_path):
    assert schemes_mod.load_schemes(tmp_path) == []
    assert schemes_mod.load_schemes(tmp_path / "missing") == []


def test_search_matches_hindi_and_tags(fx_schemes):
    assert "fx-widow-pension-hr" in schemes_mod.search("WIDOW", fx_schemes)  # tag + english, case-insens
    assert schemes_mod.search("पेंशन", fx_schemes)  # hindi name
    assert schemes_mod.search("kisan", fx_schemes) == ["fx-farmer-income"]  # tag only
    assert "fx-maternity" in schemes_mod.search("maternity benefit benefit", fx_schemes)  # benefit text
    assert schemes_mod.search("zzzz", fx_schemes) == []
    assert schemes_mod.search("  ", fx_schemes) == []


def test_evaluate_contract_shape(client):
    r = client.post("/evaluate", json={"profile": {"state": "DL", "age": 65, "bpl": True}, "interests": ["pension"]})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"results", "next_fields", "coverage"}
    assert body["coverage"] == {"state": "DL", "has_state_schemes": True}
    assert body["results"][0]["rank"] == 1
    assert {x["scheme_id"]: x["verdict"] for x in body["results"]}["fx-old-age-pension"] == "eligible"
    assert isinstance(body["next_fields"], list)


def test_evaluate_empty_profile_ok(client):
    r = client.post("/evaluate", json={"profile": {}})
    assert r.status_code == 200
    assert not any(x["verdict"] == "eligible" for x in r.json()["results"])
    assert r.json()["coverage"] == {"state": None, "has_state_schemes": False}


@pytest.mark.parametrize("bad", [
    {"age": -1}, {"age": 121}, {"age": 65.5}, {"age": "abc"}, {"age": True}, {"nope": 1},
    {"state": "XX"}, {"income_band": "rich"}, {"bpl": "yes"}, {"gender": 3},
])
def test_evaluate_invalid_profile_422(client, bad):
    assert client.post("/evaluate", json={"profile": bad}).status_code == 422


def test_evaluate_invalid_body_and_interests_422(client):
    assert client.post("/evaluate", json={}).status_code == 422
    assert client.post("/evaluate", json={"profile": {}, "interests": ["bogus"]}).status_code == 422
    assert client.post("/evaluate", json={"profile": {}, "extra": 1}).status_code == 422


def test_age_bounds_accepted(client):
    for a in (0, 120):
        assert client.post("/evaluate", json={"profile": {"age": a}}).status_code == 200


def test_coverage_has_state_schemes(client):
    assert client.post("/evaluate", json={"profile": {"state": "BR"}}).json()["coverage"] == {"state": "BR", "has_state_schemes": False}
    assert client.post("/evaluate", json={"profile": {"state": "DL"}}).json()["coverage"]["has_state_schemes"] is True
    assert client.post("/evaluate", json={"profile": {"state": "HR"}}).json()["coverage"]["has_state_schemes"] is True


def test_schemes_list_and_detail(client, fx_schemes):
    r = client.get("/schemes")
    assert r.status_code == 200 and len(r.json()["schemes"]) == len(fx_schemes)
    d = client.get("/schemes/fx-old-age-pension")
    assert d.status_code == 200 and d.json()["id"] == "fx-old-age-pension"
    assert client.get("/schemes/nope").status_code == 404


def test_search_route(client):
    r = client.get("/search", params={"q": "WIDOW"})
    assert r.status_code == 200 and "fx-widow-pension-hr" in r.json()["ids"]
    assert client.get("/search", params={"q": "पेंशन"}).json()["ids"]
    assert client.get("/search").json() == {"ids": []}
