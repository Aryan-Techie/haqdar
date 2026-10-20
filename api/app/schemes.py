"""Load and validate data/schemes/*.json; search."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

from .engine import vocab
from .engine.rules import validate_rule


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    path = vocab.data_dir() / "schema" / "scheme.schema.json"
    return Draft202012Validator(json.loads(path.read_text(encoding="utf-8")))


def load_schemes(data_dir: Path | None = None) -> list[dict]:
    """Load every *.json in `data_dir` (default: <data>/schemes), validate each.

    Raises ValueError naming the offending file on schema or duplicate-id failure.
    A missing or empty directory yields [].
    """
    directory = Path(data_dir) if data_dir is not None else vocab.data_dir() / "schemes"
    if not directory.is_dir():
        return []
    out: list[dict] = []
    seen: dict[str, str] = {}
    for path in sorted(directory.glob("*.json")):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ValueError(f"{path.name}: invalid JSON: {e}") from e
        e = best_match(_validator().iter_errors(record))
        if e is not None:
            where = "/".join(str(p) for p in e.absolute_path) or "(root)"
            raise ValueError(f"{path.name}: schema error at {where}: {e.message}")
        try:
            validate_rule(record["eligibility"])
        except ValueError as err:
            raise ValueError(f"{path.name}: invalid eligibility rule: {err}") from err
        if record["id"] in seen:
            raise ValueError(f"{path.name}: duplicate scheme id {record['id']!r} (also in {seen[record['id']]})")
        seen[record["id"]] = path.name
        out.append(record)
    return out


def _haystack(s: dict) -> str:
    parts: list[str] = []
    for key in ("name", "benefit"):
        parts += [v for v in s.get(key, {}).values()]
    parts += s.get("tags", [])
    return "\n".join(parts).casefold()


def search(q: str, schemes: list[dict]) -> list[str]:
    needle = q.strip().casefold()
    if not needle:
        return []
    return [s["id"] for s in schemes if needle in _haystack(s)]
