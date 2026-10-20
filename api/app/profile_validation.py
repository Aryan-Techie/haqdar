"""Profile validation built from data/schema/vocab.json (shared contract)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException

from .config import get_settings


@lru_cache(maxsize=4)
def _vocab(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_vocab() -> dict:
    return _vocab(str(get_settings().data_dir / "schema" / "vocab.json"))


def validate_profile(d: dict) -> dict:
    """Return a cleaned profile or raise HTTPException(422). None values are dropped."""
    if not isinstance(d, dict):
        raise HTTPException(422, "profile must be an object")
    vocab = load_vocab()
    fields = vocab["fields"]
    errors: list[str] = []
    out: dict = {}
    for key, val in d.items():
        spec = fields.get(key)
        if spec is None:
            errors.append(f"unknown field: {key}")
            continue
        if val is None:
            continue
        t = spec["type"]
        if t == "integer":
            if isinstance(val, bool) or not isinstance(val, int) or not spec["min"] <= val <= spec["max"]:
                errors.append(f"{key} must be an integer {spec['min']} to {spec['max']}")
                continue
        elif t == "boolean":
            if not isinstance(val, bool):
                errors.append(f"{key} must be true or false")
                continue
        else:
            ids = {o["id"] for o in spec["options"]}
            if not isinstance(val, str) or val not in ids:
                errors.append(f"{key} must be one of {sorted(ids)}")
                continue
        out[key] = val
    if errors:
        raise HTTPException(422, "; ".join(errors))
    return out
