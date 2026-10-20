"""Test-owned fixture schemes (independent of data/schemes). Import `fx_schemes` into a test module."""
import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent
SCHEMES_DIR = FIXTURES / "schemes"
BAD_DIR = FIXTURES / "bad_schemes"


def load_fixture_schemes() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(SCHEMES_DIR.glob("*.json"))]


@pytest.fixture(scope="session")
def fx_schemes():
    return load_fixture_schemes()
