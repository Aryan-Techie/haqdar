from app.engine import vocab
from app.engine.rules import eval_rule


def P(field, op, value=None):
    return {"field": field, "op": op, "value": value}


def test_all_pass():
    r = eval_rule({"all": [P("age", "gte", 60), P("gender", "eq", "female")]}, {"age": 70, "gender": "female"})
    assert r.tri == "pass" and len(r.passed) == 2 and not r.failed and not r.unknown_fields


def test_any_one_unknown_rest_fail_is_unknown():
    rule = {"any": [P("gender", "eq", "female"), P("age", "gte", 60)]}
    r = eval_rule(rule, {"gender": "male"})
    assert r.tri == "unknown" and r.unknown_fields == ["age"]
    assert eval_rule(rule, {"gender": "male", "age": 30}).tri == "fail"
    assert eval_rule(rule, {"gender": "female"}).tri == "pass"


def test_all_fail_beats_unknown():
    r = eval_rule({"all": [P("age", "gte", 60), P("gender", "eq", "female")]}, {"age": 30})
    assert r.tri == "fail" and r.failed[0]["field"] == "age"


def test_not_keeps_unknown():
    rule = {"not": P("category", "eq", "general")}
    assert eval_rule(rule, {}).tri == "unknown"
    assert eval_rule(rule, {"category": "obc"}).tri == "pass"
    assert eval_rule(rule, {"category": "general"}).tri == "fail"


def test_age_lte_boundary_inclusive():
    assert eval_rule(P("age", "gte", 60), {"age": 60}).tri == "pass"
    assert eval_rule(P("age", "lte", 60), {"age": 60}).tri == "pass"
    assert eval_rule(P("age", "lte", 60), {"age": 61}).tri == "fail"
    assert eval_rule(P("age", "gte", 60), {"age": 59}).tri == "fail"


def test_income_lte_bands():
    rule = P("annual_income", "lte", 100000)
    assert eval_rule(rule, {"income_band": "lt_1l"}).tri == "pass"
    assert eval_rule(rule, {"income_band": "1l_2_5l"}).tri == "unknown"
    assert eval_rule(rule, {"income_band": "2_5l_5l"}).tri == "fail"


def test_income_between():
    rule = P("annual_income", "between", [0, 250000])
    assert eval_rule(rule, {"income_band": "gt_8l"}).tri == "fail"
    assert eval_rule(rule, {"income_band": "lt_1l"}).tri == "pass"
    assert eval_rule(rule, {"income_band": "1l_2_5l"}).tri == "pass"
    assert eval_rule(rule, {"income_band": "2_5l_5l"}).tri == "unknown"


def test_income_gte_open_ended_band():
    rule = P("annual_income", "gte", 800000)
    assert eval_rule(rule, {"income_band": "gt_8l"}).tri == "pass"
    assert eval_rule(rule, {"income_band": "5l_8l"}).tri == "unknown"
    assert eval_rule(rule, {"income_band": "lt_1l"}).tri == "fail"


def test_land_bands():
    rule = P("land_acres", "lte", 2.5)
    assert eval_rule(rule, {"land_band": "lt_2_5"}).tri == "pass"
    assert eval_rule(rule, {"land_band": "none"}).tri == "pass"
    assert eval_rule(rule, {"land_band": "2_5_5"}).tri == "unknown"
    assert eval_rule(rule, {"land_band": "gt_5"}).tri == "fail"


def test_exists_passes_only_when_known():
    assert eval_rule(P("bpl", "exists"), {"bpl": False}).tri == "pass"
    r = eval_rule(P("bpl", "exists"), {})
    assert r.tri == "unknown" and r.unknown_fields == ["bpl"]


def test_in_and_bool_eq():
    assert eval_rule(P("occupation", "in", ["farmer", "farm_labourer"]), {"occupation": "farmer"}).tri == "pass"
    assert eval_rule(P("occupation", "in", ["farmer"]), {"occupation": "student"}).tri == "fail"
    assert eval_rule(P("bpl", "eq", True), {"bpl": False}).tri == "fail"


def test_vocab_band():
    assert vocab.band("income_band", "gt_8l") == (800000, None)
    assert vocab.PREDICATE_TO_PROFILE["annual_income"] == "income_band"
