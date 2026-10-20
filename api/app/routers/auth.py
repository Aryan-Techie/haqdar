from __future__ import annotations

import logging
import re
import secrets
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Consent, User
from ..security import RateLimiter, make_token

router = APIRouter()
log = logging.getLogger("haqdar.auth")
OTP_TTL = 300
MAX_ATTEMPTS = 5            # wrong guesses per phone per ATTEMPT_WINDOW, across OTP re-requests
ATTEMPT_WINDOW = 3600
OTP_REQUESTS = 3            # POST /auth/otp per phone per OTP_REQUEST_WINDOW
OTP_REQUEST_WINDOW = 600


def _phone(v: str) -> str:
    v = re.sub(r"[\s-]", "", v)
    if not re.fullmatch(r"\+?[0-9]{10,13}", v):
        raise ValueError("invalid phone number")
    digits = v.lstrip("+")
    if v.startswith("+"):
        return "+" + digits
    # Normalise to E.164 (India default) so one person is one account.
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        return "+91" + digits
    return "+" + digits


class OtpIn(BaseModel):
    phone: str

    _p = field_validator("phone")(_phone)


class Consent_(BaseModel):
    version: str = Field(min_length=1, max_length=40)
    accepted: Literal[True]


class VerifyIn(BaseModel):
    phone: str
    code: str = Field(max_length=32)
    consent: Consent_

    _p = field_validator("phone")(_phone)


def _state(request: Request):
    st = request.app.state
    if not hasattr(st, "otp_attempts"):
        st.otp_attempts = {}  # phone -> [wrong_guesses, window_start]
        st.otp_limiter = RateLimiter(OTP_REQUESTS, OTP_REQUEST_WINDOW)
    return st


def _attempts(st, phone: str) -> list:
    rec = st.otp_attempts.get(phone)
    now = time.time()
    if rec is None or now - rec[1] >= ATTEMPT_WINDOW:
        rec = st.otp_attempts[phone] = [0, now]
    return rec


@router.post("/auth/otp")
def send_otp(body: OtpIn, request: Request):
    s = request.app.state.settings
    st = _state(request)
    if not st.otp_limiter.allow(body.phone):
        raise HTTPException(429, "too many OTP requests, try again later", headers={"Retry-After": "600"})
    code = "123456" if s.dev_otp else f"{secrets.randbelow(10**6):06d}"
    # tries is per phone and survives re-requesting an OTP, so the guess budget cannot be reset.
    st.otps[body.phone] = {"code": code, "exp": time.time() + OTP_TTL, "tries": _attempts(st, body.phone)[0]}
    # SMS provider interface stand-in: the code goes to the log in dev only.
    if s.dev_otp:
        log.info("dev OTP for ***%s: %s", body.phone[-4:], code)
    return {"sent": True, "dev_hint": code} if s.dev_otp else {"sent": True}


@router.post("/auth/verify")
def verify(body: VerifyIn, request: Request, db: Session = Depends(get_db)):
    s = request.app.state.settings
    st = _state(request)
    otps = st.otps
    entry = otps.get(body.phone)
    att = _attempts(st, body.phone)
    if att[0] >= MAX_ATTEMPTS:
        raise HTTPException(429, "too many wrong codes, try again later", headers={"Retry-After": "3600"})
    # The dev code 123456 is only ever the issued code of an outstanding request: there is no
    # separate "accept 123456 for any phone" path.
    ok = False
    if entry and entry["exp"] >= time.time():
        ok = secrets.compare_digest(body.code.encode(), entry["code"].encode())
        if not ok:
            att[0] += 1
            entry["tries"] = att[0]
    if not ok:
        raise HTTPException(401, "invalid code")
    st.otp_attempts.pop(body.phone, None)
    otps.pop(body.phone, None)
    user = db.scalar(select(User).where(User.phone == body.phone))
    if user is None:
        user = User(phone=body.phone)
        db.add(user)
        db.flush()
    db.add(Consent(user_id=user.id, version=body.consent.version))
    db.commit()
    return {"token": make_token(user.id, s.secret), "user": {"id": user.id, "phone": user.phone}}
