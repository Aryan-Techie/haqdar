import pytest
from fastapi.testclient import TestClient

from app.main import create_app

SCHEMES = [
    {
        "id": "test-pension", "name": {"en": "Test Old Age Pension", "hi": "परीक्षण पेंशन"},
        "category": "pension", "level": "central", "states": ["*"],
        "benefit": {"en": "Rs 500 per month", "hi": "₹500 प्रति माह"}, "benefit_weight": 5,
        "description": {"en": "d"},
        "eligibility": {"field": "age", "op": "gte", "value": 60},
        "eligibility_plain": {"en": "Age 60 or more", "hi": "60 वर्ष या अधिक"},
        "documents": [{"name": {"en": "Aadhaar card ₹", "hi": "आधार कार्ड"}, "required": True},
                      {"name": {"en": "Bank passbook"}, "required": False, "note": {"en": "any bank"}}],
        "how_to_apply": {"en": ["Visit the office", "Submit form"], "hi": ["कार्यालय जाएँ"]},
        "apply_url": "https://example.gov.in/apply", "source_url": "https://example.gov.in/pension",
        "deadline": None, "last_verified": "2026-10-01", "rule_version": "2026-10-01", "tags": ["pension"],
        "verification": {"status": "sourced", "by": "test"},
    },
    {
        "id": "test-deadline", "name": {"en": "Test Deadline Scheme", "hi": "परीक्षण"},
        "category": "farm", "level": "central", "states": ["*"],
        "benefit": {"en": "b", "hi": "b"}, "benefit_weight": 1, "description": {"en": "d"},
        "eligibility": {"field": "occupation", "op": "eq", "value": "farmer"},
        "eligibility_plain": {"en": "Farmers", "hi": "किसान"},
        "documents": [], "how_to_apply": {"en": ["Apply online"]},
        "apply_url": "https://example.gov.in/a", "source_url": "https://example.gov.in/d",
        "deadline": "2027-03-31", "last_verified": "2026-10-01", "rule_version": "2026-10-01", "tags": [],
        "verification": {"status": "sourced", "by": "test"},
    },
]


@pytest.fixture
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("HAQDAR_DATABASE_URL", f"sqlite:///{tmp_path}/t.db")
    monkeypatch.setenv("HAQDAR_SECRET", "test-secret")
    monkeypatch.delenv("SLNG_API_KEY", raising=False)
    monkeypatch.delenv("HAQDAR_RATE_LIMIT", raising=False)
    monkeypatch.delenv("HAQDAR_DEV_OTP", raising=False)
    return monkeypatch


@pytest.fixture
def app(env):
    return create_app(schemes=[dict(s) for s in SCHEMES])


@pytest.fixture
def client(app):
    return TestClient(app)


CONSENT = {"version": "v1", "accepted": True}


def login(client, phone="9876543210"):
    client.post("/auth/otp", json={"phone": phone})
    r = client.post("/auth/verify", json={"phone": phone, "code": "123456", "consent": CONSENT})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


@pytest.fixture
def auth(client):
    return login(client)[0]
