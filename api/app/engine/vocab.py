"""Load data/schema/vocab.json and expose band lookup helpers."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path


def data_dir() -> Path:
    env = os.environ.get("HAQDAR_DATA_DIR")
    if env:
        return Path(env)
    # api/app/engine/vocab.py -> repo root is parents[3]
    return Path(__file__).resolve().parents[3] / "data"


@lru_cache(maxsize=1)
def load_vocab() -> dict:
    with open(data_dir() / "schema" / "vocab.json", encoding="utf-8") as f:
        return json.load(f)


PREDICATE_TO_PROFILE: dict[str, str] = dict(load_vocab()["predicate_fields"])
BAND_FIELDS: frozenset[str] = frozenset(load_vocab()["bands"])


def band(field: str, value: str) -> tuple[float, float | None]:
    """Return (lo, hi) for a band value; hi None means unbounded."""
    lo, hi = load_vocab()["bands"][field][value]
    return lo, hi
