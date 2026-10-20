"""12 hand-made personas. Fixture class always runs; real-data class is marked `data`."""
import pytest

from app import schemes as schemes_mod
from app.engine import vocab
from app.engine.evaluate import evaluate
from tests.fixtures import fx_schemes  # noqa: F401


def eligible(results):
    return {r["scheme_id"] for r in results if r["verdict"] == "eligible"}


def verdicts(results):
    return {r["scheme_id"]: r["verdict"] for r in results}


# (name, profile, ids that MUST be eligible, ids that must NOT be eligible)
FIXTURE_PERSONAS = [
    ("widow_hr_52_low_income",
     {"state": "HR", "age": 52, "gender": "female", "marital_status": "widowed", "income_band": "lt_1l"},
     {"fx-widow-pension-hr", "fx-health-cover"}, {"fx-old-age-pension", "fx-farmer-income"}),
    ("small_farmer",
     {"state": "HR", "age": 40, "gender": "male", "occupation": "farmer", "land_band": "lt_2_5", "income_band": "1l_2_5l"},
     {"fx-farmer-income", "fx-health-cover"}, {"fx-widow-pension-hr", "fx-adult-skill"}),
    ("class11_low_income_student",
     {"state": "BR", "age": 16, "student_level": "school_11_12", "income_band": "1l_2_5l", "occupation": "student"},
     {"fx-scholarship"}, {"fx-adult-skill", "fx-old-age-pension"}),
    ("senior_65_bpl",
     {"state": "UP", "age": 65, "bpl": True},
     {"fx-old-age-pension"}, {"fx-adult-skill", "fx-widow-pension-hr"}),
    ("disability_40_plus_bpl",
     {"state": "DL", "age": 30, "disability": "yes_80_plus", "bpl": True},
     {"fx-disability-pension", "fx-adult-skill"}, {"fx-old-age-pension"}),
    ("delhi_gig_worker",
     {"state": "DL", "age": 28, "occupation": "gig_worker", "income_band": "2_5l_5l"},
     {"fx-gig-health-dl", "fx-adult-skill"}, {"fx-farmer-income"}),
    ("pregnant_woman",
     {"state": "MH", "age": 26, "gender": "female", "pregnant_or_new_mother": True},
     {"fx-maternity", "fx-adult-skill"}, {"fx-gig-health-dl"}),
    ("family_with_daughter_under_10",
     {"state": "HR", "age": 33, "girl_child_under_10": True, "income_band": "1l_2_5l"},
     {"fx-girl-child"}, set()),
    ("high_income_salaried_man",
     {"state": "DL", "age": 45, "gender": "male", "occupation": "private_salaried", "income_band": "gt_8l"},
     set(), {"fx-health-cover", "fx-scholarship", "fx-girl-child", "fx-widow-pension-hr", "fx-old-age-pension"}),
    ("empty_profile", {}, set(), set()),
    ("state_BR_central_only",
     {"state": "BR", "age": 70, "bpl": True, "occupation": "gig_worker"},
     {"fx-old-age-pension"}, {"fx-gig-health-dl", "fx-widow-pension-hr"}),
    ("minor_age_17",
     {"state": "DL", "age": 17},
     set(), {"fx-adult-skill", "fx-old-age-pension", "fx-widow-pension-hr"}),
]


class TestFixturePersonas:
    @pytest.mark.parametrize("name,profile,must,must_not", FIXTURE_PERSONAS, ids=[p[0] for p in FIXTURE_PERSONAS])
    def test_persona(self, fx_schemes, name, profile, must, must_not):
        results = evaluate(profile, fx_schemes)
        got = eligible(results)
        assert must <= got, f"{name}: missing {must - got}"
        assert not (must_not & got), f"{name}: wrongly eligible {must_not & got}"

    def test_empty_profile_has_no_eligible(self, fx_schemes):
        assert eligible(evaluate({}, fx_schemes)) == set()

    def test_state_br_state_schemes_ineligible(self, fx_schemes):
        v = verdicts(evaluate({"state": "BR"}, fx_schemes))
        assert v["fx-gig-health-dl"] == "ineligible" and v["fx-widow-pension-hr"] == "ineligible"

    def test_minor_is_ineligible_for_age_gated(self, fx_schemes):
        v = verdicts(evaluate({"state": "DL", "age": 17}, fx_schemes))
        assert v["fx-adult-skill"] == "ineligible" and v["fx-old-age-pension"] == "ineligible"

    def test_high_income_few_eligible(self, fx_schemes):
        profile = dict(FIXTURE_PERSONAS[8][1])
        assert len(eligible(evaluate(profile, fx_schemes))) <= 1

    def test_every_result_cites_source(self, fx_schemes):
        for r in evaluate({"state": "DL", "age": 65}, fx_schemes):
            assert r["source_url"].startswith("https://") and r["rule_version"] and len(r["profile_hash"]) == 16


# ---- Real data -----------------------------------------------------------
# The lead fills REAL_ANCHORS at integration: (persona name, profile, anchor scheme ids that must be eligible).
REAL_ANCHORS: list[tuple[str, dict, set[str]]] = [
    ("small_farmer_hr",
     {"state": "HR", "age": 40, "gender": "male", "occupation": "farmer", "land_band": "lt_2_5",
      "income_band": "1l_2_5l", "category": "general"},
     {"pm-kisan", "pmfby", "kisan-credit-card"}),
    ("sc_student_class11_dl",
     {"state": "DL", "age": 16, "gender": "female", "occupation": "student", "student_level": "school_11_12",
      "income_band": "1l_2_5l", "category": "sc"},
     {"sc-post-matric-scholarship"}),
    ("pregnant_bpl_woman",
     {"state": "MH", "age": 26, "gender": "female", "pregnant_or_new_mother": True, "bpl": True,
      "income_band": "lt_1l"},
     {"janani-suraksha-yojana", "pmsma"}),
    ("mother_of_daughter_under_10",
     {"state": "HR", "age": 33, "gender": "female", "girl_child_under_10": True, "income_band": "1l_2_5l"},
     {"sukanya-samriddhi-yojana"}),
    ("senior_65_bpl_up",
     {"state": "UP", "age": 65, "bpl": True, "income_band": "lt_1l"},
     {"pmsby", "ayushman-bharat-pmjay", "nsap-ignoaps"}),
    ("widow_hr_52_bpl",
     {"state": "HR", "age": 52, "gender": "female", "marital_status": "widowed", "income_band": "lt_1l", "bpl": True},
     {"nsap-ignwps", "hr-widow-destitute-women-pension"}),
]


@pytest.fixture(scope="module")
def real_schemes():
    try:
        loaded = schemes_mod.load_schemes()
    except ValueError:
        raise  # a malformed record is a real failure, not a skip
    if not loaded:
        pytest.skip(f"no scheme files in {vocab.data_dir() / 'schemes'}")
    return loaded


@pytest.mark.data
class TestRealDataPersonas:
    def test_real_schemes_load_and_validate(self, real_schemes):
        assert all(s["source_url"] and s["last_verified"] for s in real_schemes)

    def test_empty_profile_never_eligible_real(self, real_schemes):
        assert eligible(evaluate({}, real_schemes)) == set()

    def test_state_br_never_gets_state_schemes_real(self, real_schemes):
        for r in evaluate({"state": "BR", "age": 30}, real_schemes):
            s = next(x for x in real_schemes if x["id"] == r["scheme_id"])
            if "*" not in s["states"] and "BR" not in s["states"]:
                assert r["verdict"] == "ineligible" and r["reason"]["code"] == "state_unavailable"

    @pytest.mark.parametrize("name,profile,anchors", REAL_ANCHORS, ids=[a[0] for a in REAL_ANCHORS])
    def test_anchor(self, real_schemes, name, profile, anchors):
        ids = {s["id"] for s in real_schemes}
        assert anchors <= ids, f"{name}: anchor ids not in data: {anchors - ids}"
        assert anchors <= eligible(evaluate(profile, real_schemes)), name
