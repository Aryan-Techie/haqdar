from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from ..ics import build_ics
from ..kit import build_pdf, hindi_supported
from ..models import User
from ..security import decrypt_profile
from pydantic import BaseModel, ConfigDict

from .deps import current_user

router = APIRouter()


class KitRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lang: Optional[Literal["en", "hi"]] = None


def _scheme(request: Request, scheme_id: str) -> dict:
    for s in request.app.state.schemes:
        if s["id"] == scheme_id:
            return s
    raise HTTPException(404, "scheme not found")


@router.post("/kit/{scheme_id}")
def kit(scheme_id: str, request: Request, lang: str | None = Query(None, pattern="^(en|hi)$"),
        body: KitRequest | None = None, user: User = Depends(current_user)):
    scheme = _scheme(request, scheme_id)
    lang = (body.lang if body else None) or lang or user.language or "en"
    profile = decrypt_profile(request.app.state.fernet, user.profile_enc)
    pdf = build_pdf(profile, scheme, lang)
    actual = "hi" if lang == "hi" and hindi_supported() else "en"
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="haqdar-{scheme_id}.pdf"',
                             "X-Kit-Language": actual})


@router.get("/reminder/{scheme_id}.ics")
def reminder(scheme_id: str, request: Request, user: User = Depends(current_user)):
    ics = build_ics(_scheme(request, scheme_id))
    if ics is None:
        raise HTTPException(404, "scheme has no deadline")
    return Response(ics, media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="{scheme_id}.ics"'})
