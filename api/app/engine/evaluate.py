"""evaluate(): verdicts, ranking, next_fields. Pure function."""
from __future__ import annotations

import hashlib
import hmac
import json

from . import vocab
from .rules import eval_rule

_VERDICT_ORDER = {"eligible": 0, "maybe": 1, "ineligible": 2}
_OPS = {"eq": "must be", "in": "must be one of", "gte": "must be at least", "lte": "must be at most",
        "between": "must be between", "exists": "must be provided"}


def profile_hash(profile: dict, key: bytes = b"") -> str:
    """Keyed (HMAC-SHA256) when a server key is given, so retained audit hashes cannot be brute-forced."""
    blob = json.dumps(profile, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if key:
        return hmac.new(key, blob, hashlib.sha256).hexdigest()[:16]
    return hashlib.sha256(blob).hexdigest()[:16]


def _describe(pred: dict) -> str:
    op = _OPS.get(pred["op"], pred["op"])
    if pred.get("negated"):
        op = op.replace("must be", "must NOT be", 1)
    text = f"{pred['field']} {op}"
    if pred["op"] != "exists":
        text += f" {pred.get('value')}"
    return text


def _one(profile: dict, scheme: dict, phash: str) -> dict:
    states = scheme.get("states", ["*"])
    state = profile.get("state")
    base = {"scheme_id": scheme["id"], "rule_version": scheme["rule_version"],
            "source_url": scheme["source_url"], "profile_hash": phash}
    if "*" not in states and state is not None and state not in states:
        return {**base, "verdict": "ineligible", "passed": [], "failed": [], "unknown_fields": [],
                "reason": {"code": "state_unavailable",
                           "detail": f"This scheme is only available in {', '.join(states)}; your state is {state}."}}
    res = eval_rule(scheme["eligibility"], profile)
    unknown = list(res.unknown_fields)
    state_unknown = "*" not in states and state is None
    if res.tri == "fail":
        verdict, code = "ineligible", "rule_failed"
        blame = res.blame or res.failed[:1]
        detail = ("Rule not met: " + " or ".join(_describe(p) for p in blame) + "."
                  if blame else "A required rule is not met.")
        unknown = []
    elif res.tri == "unknown" or state_unknown:
        if state_unknown and "state" not in unknown:
            unknown.append("state")
        verdict, code = "maybe", "missing_info"
        detail = "More information needed: " + ", ".join(unknown) + "."
    else:
        verdict, code, detail = "eligible", "all_rules_pass", "All eligibility rules pass."
    return {**base, "verdict": verdict, "passed": res.passed, "failed": res.failed,
            "unknown_fields": unknown, "reason": {"code": code, "detail": detail}}


def evaluate(profile: dict, schemes: list[dict], interests: tuple[str, ...] = (),
             hash_key: bytes = b"") -> list[dict]:
    phash = profile_hash(profile, hash_key)
    by_id = {s["id"]: s for s in schemes}
    results = [_one(profile, s, phash) for s in schemes]

    def key(r: dict):
        s = by_id[r["scheme_id"]]
        return (_VERDICT_ORDER[r["verdict"]], -s["benefit_weight"],
                0 if s["category"] in interests else 1,
                s.get("deadline") or "9999-99-99", s["id"])

    results.sort(key=key)
    for i, r in enumerate(results, 1):
        r["rank"] = i
    return results


def next_fields(profile: dict, schemes: list[dict]) -> list[str]:
    candidates = vocab.load_vocab()["candidate_fields"]
    counts = {f: 0 for f in candidates}
    to_pred: dict[str, list[str]] = {}
    for pred, pf in vocab.PREDICATE_TO_PROFILE.items():
        to_pred.setdefault(pf, []).append(pred)
    maybes = [r for r in evaluate(profile, schemes) if r["verdict"] == "maybe"]
    for r in maybes:
        for f in candidates:
            if profile.get(f) is None and any(p in r["unknown_fields"] for p in to_pred.get(f, [])):
                counts[f] += 1
    ordered = sorted((f for f in candidates if counts[f] > 0), key=lambda f: -counts[f])  # stable
    return ordered
