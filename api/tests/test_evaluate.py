from tests.fixtures import fx_schemes  # noqa: F401
from app.engine.evaluate import evaluate, next_fields

PROFILE_FIELDS = ["state", "age", "gender"]


def by_id(results):
    return {r["scheme_id"]: r for r in results}


def test_empty_profile_never_eligible(fx_schemes):
    results = evaluate({}, fx_schemes)
    assert len(results) == len(fx_schemes)
    assert all(r["verdict"] in ("maybe", "ineligible") for r in results)
    assert not any(r["verdict"] == "eligible" for r in results)


def test_result_shape(fx_schemes):
    r = evaluate({"age": 70, "bpl": True}, fx_schemes)[0]
    assert set(r) == {"scheme_id", "verdict", "rank", "passed", "failed", "unknown_fields",
                      "reason", "rule_version", "source_url", "profile_hash"}
    assert set(r["reason"]) == {"code", "detail"}


def test_state_scoping(fx_schemes):
    r = by_id(evaluate({"state": "HR", "occupation": "gig_worker"}, fx_schemes))["fx-gig-health-dl"]
    assert r["verdict"] == "ineligible" and r["reason"]["code"] == "state_unavailable"
    r = by_id(evaluate({"occupation": "gig_worker"}, fx_schemes))["fx-gig-health-dl"]
    assert r["verdict"] == "maybe" and "state" in r["unknown_fields"]
    r = by_id(evaluate({"state": "DL", "occupation": "gig_worker"}, fx_schemes))["fx-gig-health-dl"]
    assert r["verdict"] == "eligible"


def test_central_scheme_any_state(fx_schemes):
    for st in ("BR", "KL", "DL"):
        r = by_id(evaluate({"state": st, "age": 65, "bpl": True}, fx_schemes))["fx-old-age-pension"]
        assert r["verdict"] == "eligible" and r["reason"]["code"] == "all_rules_pass"


def test_rule_failed_detail(fx_schemes):
    r = by_id(evaluate({"age": 30, "bpl": True}, fx_schemes))["fx-old-age-pension"]
    assert r["verdict"] == "ineligible" and r["reason"]["code"] == "rule_failed"
    assert "age" in r["reason"]["detail"]


def test_ranking_order(fx_schemes):
    profile = {"state": "DL", "age": 65, "bpl": True, "income_band": "lt_1l", "occupation": "gig_worker"}
    results = evaluate(profile, fx_schemes)
    order = {"eligible": 0, "maybe": 1, "ineligible": 2}
    assert [order[r["verdict"]] for r in results] == sorted(order[r["verdict"]] for r in results)
    assert [r["rank"] for r in results] == list(range(1, len(results) + 1))
    sw = {s["id"]: s["benefit_weight"] for s in fx_schemes}
    elig = [r for r in results if r["verdict"] == "eligible"]
    assert len(elig) >= 3
    assert [sw[r["scheme_id"]] for r in elig] == sorted((sw[r["scheme_id"]] for r in elig), reverse=True)


def test_interests_break_ties(fx_schemes):
    a = {**fx_schemes[0], "id": "tie-a", "category": "pension", "benefit_weight": 10}
    b = {**fx_schemes[0], "id": "tie-b", "category": "farm", "benefit_weight": 10}
    profile = {"age": 70, "bpl": True}
    assert [r["scheme_id"] for r in evaluate(profile, [a, b])] == ["tie-a", "tie-b"]
    assert [r["scheme_id"] for r in evaluate(profile, [a, b], interests=("farm",))] == ["tie-b", "tie-a"]


def test_profile_hash_stable(fx_schemes):
    h = lambda p: evaluate(p, fx_schemes)[0]["profile_hash"]
    assert h({"age": 65, "state": "DL"}) == h({"state": "DL", "age": 65})
    assert h({"age": 65, "state": "DL"}) != h({"age": 66, "state": "DL"})
    assert len(h({})) == 16


def test_next_fields_orders_by_resolved_maybes(fx_schemes):
    # age known; bpl unresolved for pension (maybe), disability (maybe) etc.
    s = [x for x in fx_schemes if x["id"] in ("fx-old-age-pension", "fx-disability-pension", "fx-girl-child")]
    nf = next_fields({"age": 70}, s)
    assert nf[0] == "bpl"  # resolves 2 maybes
    assert set(nf) == {"bpl", "disability", "girl_child_under_10"}
    assert nf.index("disability") < nf.index("girl_child_under_10")  # tie by candidate order


def test_next_fields_excludes_answered(fx_schemes):
    nf = next_fields({"bpl": True}, fx_schemes)
    assert "bpl" not in nf
    assert next_fields({"bpl": True, "age": 70, "gender": "female"}, [s for s in fx_schemes if s["id"] == "fx-old-age-pension"]) == []


def test_band_edge_gives_maybe(fx_schemes):
    s = [x for x in fx_schemes if x["id"] == "fx-scholarship"]
    p = {"student_level": "undergrad"}
    assert evaluate({**p, "income_band": "1l_2_5l"}, s)[0]["verdict"] == "eligible"
    assert evaluate({**p, "income_band": "2_5l_5l"}, s)[0]["verdict"] == "maybe"
    assert evaluate({**p, "income_band": "5l_8l"}, s)[0]["verdict"] == "ineligible"
    hc = [x for x in fx_schemes if x["id"] == "fx-health-cover"]
    assert evaluate({"income_band": "2_5l_5l"}, hc)[0]["verdict"] == "eligible"
    assert evaluate({"income_band": "5l_8l"}, hc)[0]["verdict"] == "maybe"  # band starts exactly at the limit
    assert evaluate({"income_band": "gt_8l"}, hc)[0]["verdict"] == "ineligible"
    w = [x for x in fx_schemes if x["id"] == "fx-widow-pension-hr"]
    full = {"state": "HR", "gender": "female", "marital_status": "widowed", "age": 52}
    assert evaluate({**full, "income_band": "2_5l_5l"}, w)[0]["verdict"] == "maybe"  # limit 3L inside band
