"""Three-valued rule tree evaluation. Pure: no IO, no clock."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from . import vocab

Tri = Literal["pass", "fail", "unknown"]
Pred = dict  # {"field", "op", "value"} plus optional "negated": True (predicate sits under a `not`)


@dataclass
class RuleResult:
    tri: Tri
    passed: list[Pred] = field(default_factory=list)
    failed: list[Pred] = field(default_factory=list)
    unknown_fields: list[str] = field(default_factory=list)
    # For tri == "fail": the predicates that actually decided the failure
    # (first failing child under `all`, every alternative under `any`).
    blame: list[Pred] = field(default_factory=list)


def _dedupe(items: list) -> list:
    out: list = []
    for i in items:
        if i not in out:
            out.append(i)
    return out


def _interval(pred_field: str, raw) -> tuple[float, float | None] | None:
    """Interval for the profile value, or None if it cannot be interpreted."""
    profile_field = vocab.PREDICATE_TO_PROFILE[pred_field]
    if profile_field in vocab.BAND_FIELDS:
        try:
            return vocab.band(profile_field, raw)
        except (KeyError, TypeError):
            return None
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return None
    return float(raw), float(raw)


def _eval_predicate(pred: dict, profile: dict) -> str:
    name = pred["field"]
    op = pred["op"]
    value = pred.get("value")
    raw = profile.get(vocab.PREDICATE_TO_PROFILE[name])
    if raw is None:
        return "unknown"
    if op == "exists":
        return "pass"
    profile_field = vocab.PREDICATE_TO_PROFILE[name]
    if op in ("gte", "lte", "between"):
        iv = _interval(name, raw)
        if iv is None:
            return "unknown"
        lo, hi = iv
        if op == "lte":
            if hi is not None and hi <= value:
                return "pass"
            return "fail" if lo > value else "unknown"
        if op == "gte":
            if lo >= value:
                return "pass"
            return "fail" if hi is not None and hi < value else "unknown"
        a, b = value
        if lo >= a and hi is not None and hi <= b:
            return "pass"
        if (hi is not None and hi < a) or lo > b:
            return "fail"
        return "unknown"
    # eq / in
    if profile_field in vocab.BAND_FIELDS:
        iv = _interval(name, raw)
        if iv is None:
            return "unknown"
        lo, hi = iv
        targets = value if op == "in" else [value]
        if hi is not None and lo == hi:
            return "pass" if lo in targets else "fail"
        if all(t < lo or (hi is not None and t > hi) for t in targets):
            return "fail"
        return "unknown"
    if op == "eq":
        return "pass" if raw == value else "fail"
    if op == "in":
        return "pass" if raw in value else "fail"
    raise ValueError(f"unknown op {op!r}")


def _flip(p: Pred) -> Pred:
    q = dict(p)
    if q.pop("negated", False):
        return q
    q["negated"] = True
    return q


def eval_rule(rule: dict, profile: dict) -> RuleResult:
    if "all" in rule or "any" in rule:
        is_all = "all" in rule
        kids = [eval_rule(r, profile) for r in rule["all" if is_all else "any"]]
        tris = [k.tri for k in kids]
        if is_all:
            tri: Tri = "fail" if "fail" in tris else "unknown" if "unknown" in tris else "pass"
        else:
            tri = "pass" if "pass" in tris else "unknown" if "unknown" in tris else "fail"
        if tri == "pass" and not is_all:
            kids = [k for k in kids if k.tri == "pass"]
        passed = _dedupe([p for k in kids for p in k.passed])
        # Only decisive failures are recorded: failing children under `all`; under `any`
        # only when every alternative failed.
        if is_all:
            failing = [k for k in kids if k.tri == "fail"]
        else:
            failing = kids if tri == "fail" else []
        failed = _dedupe([p for k in failing for p in k.failed])
        if tri == "pass" and not is_all:
            unknown: list[str] = []
        else:
            unknown = _dedupe([u for k in kids for u in k.unknown_fields])
        if tri != "fail":
            blame: list[Pred] = []
        elif is_all:
            blame = list(failing[0].blame)
        else:
            blame = _dedupe([p for k in failing for p in k.blame])
        return RuleResult(tri, passed, failed, unknown, blame)
    if "not" in rule:
        k = eval_rule(rule["not"], profile)
        tri = {"pass": "fail", "fail": "pass", "unknown": "unknown"}[k.tri]
        # A passing child lands in the outer failed list, a failing child in the outer passed
        # list, each flagged negated so the text reads "must NOT be ...".
        passed = [_flip(p) for p in k.failed]
        failed = [_flip(p) for p in k.passed]
        blame = list(failed) if tri == "fail" else []
        return RuleResult(tri, passed, failed, k.unknown_fields, blame)  # type: ignore[arg-type]
    pred = {"field": rule["field"], "op": rule["op"], "value": rule.get("value")}
    tri = _eval_predicate(rule, profile)  # type: ignore[assignment]
    if tri == "pass":
        return RuleResult("pass", [pred], [], [])
    if tri == "fail":
        return RuleResult("fail", [], [pred], [], [pred])
    return RuleResult("unknown", [], [], [rule["field"]])


_OPS = {"eq", "in", "gte", "lte", "between", "exists"}


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _scalar_ok(kind: str, options: set, v) -> bool:
    if kind == "number":
        return _num(v)
    if kind == "boolean":
        return isinstance(v, bool)
    return isinstance(v, str) and v in options


def validate_rule(rule, path: str = "eligibility") -> None:
    """Raise ValueError (naming the offending path) for any rule the engine could not evaluate safely."""
    if not isinstance(rule, dict):
        raise ValueError(f"{path}: rule must be an object")
    keys = {"all", "any", "not"} & set(rule)
    if keys:
        if len(rule) != 1:
            raise ValueError(f"{path}: combinator must be the only key")
        key = next(iter(keys))
        if key == "not":
            return validate_rule(rule["not"], f"{path}/not")
        kids = rule[key]
        if not isinstance(kids, list) or not kids:
            raise ValueError(f"{path}/{key}: must be a non-empty array")
        for i, kid in enumerate(kids):
            validate_rule(kid, f"{path}/{key}/{i}")
        return None
    name, op = rule.get("field"), rule.get("op")
    if name not in vocab.PREDICATE_TO_PROFILE:
        raise ValueError(f"{path}: unknown predicate field {name!r}")
    if op not in _OPS:
        raise ValueError(f"{path}: unknown op {op!r}")
    unexpected = set(rule) - {"field", "op", "value"}
    if unexpected:
        raise ValueError(f"{path}: unexpected keys {sorted(unexpected)}")
    pf = vocab.PREDICATE_TO_PROFILE[name]
    spec = vocab.load_vocab()["fields"][pf]
    if pf in vocab.BAND_FIELDS or spec["type"] == "integer":
        kind, options = "number", set()
    elif spec["type"] == "boolean":
        kind, options = "boolean", set()
    else:
        kind, options = "enum", {o["id"] for o in spec["options"]}
    where = f"{path} ({name} {op})"
    if op == "exists":
        if "value" in rule:
            raise ValueError(f"{where}: exists takes no value")
        return None
    if "value" not in rule:
        raise ValueError(f"{where}: missing value")
    v = rule["value"]
    if op in ("gte", "lte"):
        if kind != "number" or not _num(v):
            raise ValueError(f"{where}: value must be a number on a numeric field, got {v!r}")
    elif op == "between":
        if (kind != "number" or not isinstance(v, list) or len(v) != 2 or not all(_num(x) for x in v)
                or v[0] > v[1]):
            raise ValueError(f"{where}: value must be exactly two numbers [low, high] (use gte for an open "
                             f"upper bound), got {v!r}")
    elif op == "in":
        if not isinstance(v, list) or not v or not all(_scalar_ok(kind, options, x) for x in v):
            raise ValueError(f"{where}: value must be a non-empty array of valid {kind} values, got {v!r}")
    elif not _scalar_ok(kind, options, v):  # eq
        raise ValueError(f"{where}: value must be a valid {kind} value, got {v!r}")
    return None
