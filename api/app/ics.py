from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta


def _esc(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> list[str]:
    raw = line.encode()
    if len(raw) <= 75:
        return [line]
    out, cur = [], ""
    for ch in line:
        limit = 75 if not out else 74
        if len((cur + ch).encode()) > limit:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    out.append(cur)
    return [out[0]] + [" " + p for p in out[1:]]


def build_ics(scheme: dict) -> str | None:
    """All-day deadline reminder; None when the scheme has no deadline."""
    deadline = scheme.get("deadline")
    if not deadline or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", deadline):
        return None
    try:
        d = date.fromisoformat(deadline)
    except ValueError:
        return None
    name = scheme["name"]["en"]
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Haqdar//Scheme reminder//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{scheme['id']}-deadline@haqdar",
        f"DTSTAMP:{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}",
        f"DTEND;VALUE=DATE:{(d + timedelta(days=1)).strftime('%Y%m%d')}",
        f"SUMMARY:{_esc('Deadline: ' + name)}",
        f"DESCRIPTION:{_esc('Official source: ' + scheme.get('source_url', ''))}",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        f"DESCRIPTION:{_esc('Deadline in 7 days: ' + name)}",
        "TRIGGER:-P7D",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    folded = [p for line in lines for p in _fold(line)]
    return "\r\n".join(folded) + "\r\n"
