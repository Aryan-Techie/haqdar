from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Audit, Consent, Saved, User
from ..profile_validation import validate_profile
from ..security import decrypt_profile, encrypt_profile
from .deps import current_user

router = APIRouter()


class MeIn(BaseModel):
    profile: dict
    language: Literal["en", "hi"] | None = None


def _profile(request: Request, user: User) -> dict:
    return decrypt_profile(request.app.state.fernet, user.profile_enc)


@router.get("/me")
def get_me(request: Request, user: User = Depends(current_user)):
    return {"id": user.id, "phone": user.phone, "profile": _profile(request, user), "language": user.language}


@router.put("/me")
def put_me(body: MeIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = validate_profile(body.profile)
    user.profile_enc = encrypt_profile(request.app.state.fernet, profile)
    if body.language:
        user.language = body.language
    db.add(user)
    db.commit()
    return {"id": user.id, "phone": user.phone, "profile": profile, "language": user.language}


@router.delete("/me")
def delete_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Audit).where(Audit.user_id == user.id).values(user_id=None))
    db.execute(delete(Saved).where(Saved.user_id == user.id))
    db.execute(delete(Consent).where(Consent.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()
    return {"deleted": True}


@router.get("/me/export")
def export_me(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    saved = db.scalars(select(Saved.scheme_id).where(Saved.user_id == user.id).order_by(Saved.id)).all()
    consents = db.scalars(select(Consent).where(Consent.user_id == user.id).order_by(Consent.id)).all()
    return {
        "user": {"id": user.id, "phone": user.phone, "language": user.language,
                 "created_at": user.created_at.isoformat() if user.created_at else None},
        "profile": _profile(request, user),
        "saved": list(saved),
        "consents": [{"version": c.version, "accepted_at": c.accepted_at.isoformat()} for c in consents],
    }
