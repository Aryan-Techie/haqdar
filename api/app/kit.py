"""Pre-filled application preparation sheet (PDF) via fpdf2."""
from __future__ import annotations

import os
import re
from pathlib import Path

from fpdf import FPDF

from .profile_validation import load_vocab

BUNDLED_FONT = Path(__file__).parent / "assets" / "NotoSansDevanagari.ttf"
# Ordered candidates after the HAQDAR_DEVANAGARI_FONT env var (TrueType only; fpdf2 cannot read .ttc).
FONT_CANDIDATES = [
    BUNDLED_FONT,
    Path("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"),
    Path("/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
]
DISCLAIMER = "This is a preparation sheet, not an official government form."
CSC_LOCATOR_URL = "https://locator.csccloud.in/"

_HI = {
    "title": "आवेदन तैयारी पत्रक",
    "disclaimer": "यह एक तैयारी पत्रक है, सरकारी आधिकारिक फ़ॉर्म नहीं है।",
    "benefit": "लाभ", "citizen": "आपकी जानकारी", "docs": "दस्तावेज़ों की सूची",
    "steps": "आवेदन कैसे करें", "deadline": "अंतिम तिथि", "source": "आधिकारिक स्रोत",
    "verified": "अंतिम जाँच", "apply": "आवेदन लिंक", "office": "नज़दीकी केंद्र खोजें",
    "must": "ज़रूरी", "ifapp": "यदि लागू हो", "none": "कोई तय तिथि नहीं",
}
_EN = {
    "title": "Application preparation sheet", "disclaimer": DISCLAIMER,
    "benefit": "Benefit", "citizen": "Your details", "docs": "Document checklist",
    "steps": "How to apply", "deadline": "Deadline", "source": "Official source",
    "verified": "Last verified", "apply": "Apply link", "office": "Find a nearby centre",
    "must": "must have", "ifapp": "if applicable", "none": "No fixed deadline",
}


def shaping_available() -> bool:
    try:
        import uharfbuzz  # noqa: F401
    except ImportError:
        return False
    return True


def resolve_font() -> Path | None:
    """First existing Devanagari font: env override, then the ordered candidates."""
    env = os.environ.get("HAQDAR_DEVANAGARI_FONT")
    for p in ([Path(env)] if env else []) + FONT_CANDIDATES:
        if p.is_file():
            return p
    return None


def hindi_supported() -> bool:
    """Devanagari needs a font AND text shaping, else conjuncts render wrongly."""
    return resolve_font() is not None and shaping_available()


def _latin(s: str) -> str:
    """Make text safe for the built-in Latin-1 font (English-only fallback)."""
    s = (s.replace("₹", "Rs ").replace("–", "-").replace("—", "-").replace("‘", "'")
         .replace("’", "'").replace("“", '"').replace("”", '"').replace("•", "-"))
    return s.encode("latin-1", "replace").decode("latin-1")


def _pick(obj: dict | None, lang: str):
    if not obj:
        return ""
    return obj.get(lang) or obj.get("en") or ""


def _label(vocab: dict, field: str, value, lang: str) -> str:
    spec = vocab["fields"][field]
    if spec["type"] == "boolean":
        return ("हाँ" if value else "नहीं") if lang == "hi" else ("Yes" if value else "No")
    if spec["type"] == "integer":
        return str(value)
    for o in spec["options"]:
        if o["id"] == value:
            return o.get(lang) or o["en"]
    return str(value)


def build_pdf(profile: dict, scheme: dict, lang: str) -> bytes:
    font = resolve_font() if lang == "hi" and hindi_supported() else None
    use_hi = font is not None
    lang = "hi" if use_hi else "en"
    T = _HI if use_hi else _EN
    vocab = load_vocab()

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(True, margin=15)
    pdf.set_margins(15, 15, 15)
    if use_hi:
        pdf.add_font("Noto", "", str(font))
        pdf.set_text_shaping(True)
    pdf.add_page()

    def para(s: str, size: int = 11, bold: bool = False, indent: float = 0):
        pdf.set_x(15 + indent)
        h = size * 0.55
        if not use_hi:
            pdf.set_font("Helvetica", "B" if bold else "", size)
            pdf.multi_cell(0, h, _latin(s), new_x="LMARGIN", new_y="NEXT")
            return
        # Noto Sans Devanagari has no Latin glyphs: write each script run in its own font.
        for run in re.findall(r"[\u0900-\u097F]+(?:[\s\u0900-\u097F]*[\u0900-\u097F])?|[^\u0900-\u097F]+", s):
            if re.match(r"[\u0900-\u097F]", run):
                pdf.set_font("Noto", "", size)
                pdf.write(h, run)
            else:
                pdf.set_font("Helvetica", "B" if bold else "", size)
                pdf.write(h, _latin(run))
        pdf.ln(h)

    def heading(s: str):
        pdf.ln(3)
        para(s, 13, True)

    para(T["title"], 18, True)
    para(_pick(scheme["name"], lang), 15, True)
    para(T["disclaimer"], 10)

    heading(T["benefit"])
    para(_pick(scheme.get("benefit"), lang))

    heading(T["citizen"])
    shown = False
    for field in vocab["fixed_order"] + vocab["candidate_fields"]:
        if field in profile and profile[field] is not None:
            q = _pick(vocab["fields"][field]["question"], lang)
            para(f"{q}  {_label(vocab, field, profile[field], lang)}", 10, indent=2)
            shown = True
    if not shown:
        para("-", 10, indent=2)

    heading(T["docs"])
    for doc in scheme.get("documents", []):
        tag = T["must"] if doc.get("required") else T["ifapp"]
        line = f"[  ] {_pick(doc['name'], lang)} ({tag})"
        note = _pick(doc.get("note"), lang)
        para(line + (f" - {note}" if note else ""), 10, indent=2)

    heading(T["steps"])
    steps = scheme.get("how_to_apply") or {}
    for i, step in enumerate(steps.get(lang) or steps.get("en") or [], 1):
        para(f"{i}. {step}", 10, indent=2)

    heading(T["deadline"])
    para(scheme.get("deadline") or T["none"], 10, indent=2)

    heading(T["source"])
    para(scheme.get("source_url", ""), 10, indent=2)
    para(f"{T['verified']}: {scheme.get('last_verified', '-')}", 10, indent=2)
    if scheme.get("apply_url"):
        para(f"{T['apply']}: {scheme['apply_url']}", 10, indent=2)
    para(f"{T['office']}: {CSC_LOCATOR_URL}", 10, indent=2)

    pdf.ln(4)
    para(T["disclaimer"], 9)
    return bytes(pdf.output())
