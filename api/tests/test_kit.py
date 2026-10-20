from app import kit as kitmod
from app.ics import build_ics
from tests.conftest import SCHEMES


def test_kit_pdf_requires_auth_and_returns_pdf(client, auth):
    assert client.post("/kit/test-pension").status_code == 401
    client.put("/me", json={"profile": {"state": "HR", "age": 65}}, headers=auth)
    r = client.post("/kit/test-pension", headers=auth)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert client.post("/kit/missing", headers=auth).status_code == 404


def test_kit_hindi_request_falls_back_without_shaping(client, auth, monkeypatch):
    monkeypatch.setattr(kitmod, "shaping_available", lambda: False)
    r = client.post("/kit/test-pension?lang=hi", headers=auth)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert r.headers["x-kit-language"] == "en"


def test_pdf_handles_rupee_and_empty_profile():
    pdf = kitmod.build_pdf({}, SCHEMES[0], "en")
    assert pdf.startswith(b"%PDF")


def _pdf_text(pdf: bytes) -> bytes:
    import re
    import zlib
    out = pdf
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
        try:
            out += zlib.decompress(m.group(1))
        except zlib.error:
            pass
    return out


def test_pdf_text_has_disclaimer_and_source():
    text = _pdf_text(kitmod.build_pdf({"state": "HR"}, SCHEMES[0], "en"))
    assert kitmod.DISCLAIMER.encode() in text
    assert SCHEMES[0]["source_url"].encode() in text


def test_pdf_hindi_path_when_shaping_available():
    import pytest
    pytest.importorskip("uharfbuzz")
    assert kitmod.build_pdf({"state": "HR"}, SCHEMES[0], "hi").startswith(b"%PDF")


def test_reminder_404_without_deadline_and_ics_with(client, auth):
    assert client.get("/reminder/test-pension.ics", headers=auth).status_code == 404
    assert client.get("/reminder/test-deadline.ics").status_code == 401
    r = client.get("/reminder/test-deadline.ics", headers=auth)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
    assert "DTSTART;VALUE=DATE:20270331" in r.text and "BEGIN:VCALENDAR" in r.text


def test_build_ics_none_without_deadline():
    assert build_ics(SCHEMES[0]) is None
    assert build_ics({**SCHEMES[1], "deadline": "garbage"}) is None
    assert all(len(l.encode()) <= 75 for l in build_ics(SCHEMES[1]).split("\r\n"))


def test_pdf_hindi_mixed_script_no_crash_with_forced_support(monkeypatch):
    """Exercises the per-script font switching even where uharfbuzz is absent (glyphs unshaped)."""
    import fpdf
    monkeypatch.setattr(kitmod, "hindi_supported", lambda: True)
    monkeypatch.setattr(fpdf.FPDF, "set_text_shaping", lambda self, *a, **k: None)
    pdf = kitmod.build_pdf({"state": "HR", "age": 65, "bpl": True}, SCHEMES[0], "hi")
    assert pdf.startswith(b"%PDF")


def test_csc_locator_in_pdf():
    text = _pdf_text(kitmod.build_pdf({"state": "HR"}, SCHEMES[0], "en"))
    assert kitmod.CSC_LOCATOR_URL.encode() in text


def test_hindi_pdf_real_scheme_larger_than_english():
    import pytest
    pytest.importorskip("uharfbuzz")
    from pathlib import Path
    from app.schemes import load_schemes
    schemes = load_schemes(Path(__file__).resolve().parents[2] / "data" / "schemes")
    if not schemes:
        pytest.skip("no real schemes")
    assert kitmod.hindi_supported()
    profile = {"state": "HR", "age": 65, "bpl": True}
    hi = kitmod.build_pdf(profile, schemes[0], "hi")
    en = kitmod.build_pdf(profile, schemes[0], "en")
    assert hi.startswith(b"%PDF") and len(hi) > len(en)


def test_font_absent_falls_back_to_english(monkeypatch, client, auth):
    monkeypatch.delenv("HAQDAR_DEVANAGARI_FONT", raising=False)
    monkeypatch.setattr(kitmod, "FONT_CANDIDATES", [])
    assert kitmod.resolve_font() is None and not kitmod.hindi_supported()
    assert kitmod.build_pdf({"state": "HR"}, SCHEMES[0], "hi").startswith(b"%PDF")
    r = client.post("/kit/test-pension?lang=hi", headers=auth)
    assert r.status_code == 200 and r.headers["x-kit-language"] == "en"


def test_env_font_override(monkeypatch, tmp_path):
    f = tmp_path / "f.ttf"
    f.write_bytes(b"x")
    monkeypatch.setenv("HAQDAR_DEVANAGARI_FONT", str(f))
    assert kitmod.resolve_font() == f


def test_ics_escapes_semicolon_and_carriage_returns():
    import warnings
    ics = build_ics({**SCHEMES[1], "name": {"en": "Evil; one\r\nATTENDEE:mailto:x@y.z"}})
    assert "\r" not in ics.replace("\r\n", "")
    assert "\nATTENDEE" not in ics.replace("\r\n", "\n").replace("\\n", "")
    assert "Evil\\; one" in ics
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        from pathlib import Path
        compile(Path(build_ics.__code__.co_filename).read_text(), "ics.py", "exec")
