import sqlite3

import pytest
from tests.conftest import login

BAD_PROFILES = [
    {"age": -1}, {"age": 121}, {"age": 65.5}, {"age": "abc"}, {"age": True},
    {"unknown_key": 1}, {"state": "ZZ"}, {"bpl": "yes"}, {"income_band": 5},
]


def test_me_roundtrip_encrypts(client, auth, tmp_path):
    prof = {"state": "HR", "age": 65, "bpl": True, "gender": "female"}
    r = client.put("/me", json={"profile": prof, "language": "hi"}, headers=auth)
    assert r.status_code == 200
    me = client.get("/me", headers=auth).json()
    assert me["profile"] == prof and me["language"] == "hi" and me["phone"] == "+919876543210"
    raw = sqlite3.connect(tmp_path / "t.db").execute("select profile_enc from users").fetchone()[0]
    assert "state" not in raw and "female" not in raw  # short strings like "HR" can appear in base64 by chance


def test_me_defaults_empty(client, auth):
    me = client.get("/me", headers=auth).json()
    assert me["profile"] == {} and me["language"] == "en"


def test_me_requires_auth(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer junk"}).status_code == 401


@pytest.mark.parametrize("bad", BAD_PROFILES)
def test_me_rejects_invalid_profile_422(client, auth, bad):
    assert client.put("/me", json={"profile": bad}, headers=auth).status_code == 422


def test_me_rejects_non_object_profile(client, auth):
    assert client.put("/me", json={"profile": [1]}, headers=auth).status_code == 422


def test_delete_me_invalidates_token_and_data(client):
    h, user = login(client)
    client.put("/me", json={"profile": {"state": "HR"}}, headers=h)
    client.put("/me/saved/test-pension", headers=h)
    r = client.post("/evaluate", json={"profile": {"age": 70}}, headers=h)
    assert r.status_code == 200
    assert client.delete("/me", headers=h).status_code == 200
    assert client.get("/me", headers=h).status_code == 401
    assert client.get("/me/saved", headers=h).status_code == 401

    h2, user2 = login(client)
    assert user2["id"] != user["id"]
    assert client.get("/me/saved", headers=h2).json() == {"scheme_ids": []}
    assert client.get("/me", headers=h2).json()["profile"] == {}
    # old token still dead even though same phone re-registered
    assert client.get("/me", headers=h).status_code == 401

    from app.models import Audit, Consent
    with client.app.state.session_factory() as db:
        rows = db.query(Audit).all()
        assert rows and all(a.user_id is None for a in rows)
        assert db.query(Consent).filter(Consent.user_id == user["id"]).count() == 0


def test_export_contains_profile_saved_consent(client, auth):
    client.put("/me", json={"profile": {"state": "DL"}}, headers=auth)
    client.put("/me/saved/test-pension", headers=auth)
    ex = client.get("/me/export", headers=auth).json()
    assert ex["profile"] == {"state": "DL"}
    assert ex["saved"] == ["test-pension"]
    assert ex["consents"][0]["version"] == "v1"
    assert ex["user"]["phone"] == "+919876543210"
