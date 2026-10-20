from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Saved, User
from .deps import current_user

router = APIRouter()


@router.get("/me/saved")
def list_saved(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = db.scalars(select(Saved.scheme_id).where(Saved.user_id == user.id).order_by(Saved.id)).all()
    return {"scheme_ids": list(ids)}


@router.put("/me/saved/{scheme_id}")
def put_saved(scheme_id: str, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not any(s["id"] == scheme_id for s in request.app.state.schemes):
        raise HTTPException(404, "scheme not found")
    exists = db.scalar(select(Saved.id).where(Saved.user_id == user.id, Saved.scheme_id == scheme_id))
    if exists is None:
        db.add(Saved(user_id=user.id, scheme_id=scheme_id))
        db.commit()
    return {"saved": True}


@router.delete("/me/saved/{scheme_id}")
def delete_saved(scheme_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Saved).where(Saved.user_id == user.id, Saved.scheme_id == scheme_id))
    db.commit()
    return {"saved": False}
