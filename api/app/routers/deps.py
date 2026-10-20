from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import read_token


def user_id_from_request(request: Request) -> int | None:
    """Never raises: any oddity in the header means anonymous."""
    try:
        h = request.headers.get("authorization", "")
        if not h.lower().startswith("bearer "):
            return None
        return read_token(h[7:].strip(), request.app.state.settings.secret)
    except Exception:
        return None


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    uid = user_id_from_request(request)
    user = db.get(User, uid) if uid is not None else None
    if user is None:
        raise HTTPException(401, "not authenticated")
    return user
