"""Tokens (stdlib HMAC), Fernet profile encryption, in-memory rate limiter."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from collections import deque
from collections.abc import Callable

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

log = logging.getLogger("haqdar.security")
TOKEN_TTL_SECONDS = 7 * 24 * 3600


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sig(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_token(user_id: int, secret: str | None = None, now: float | None = None) -> str:
    secret = secret or get_settings().secret
    expiry = int((time.time() if now is None else now) + TOKEN_TTL_SECONDS)
    payload = _b64(f"{user_id}.{expiry}".encode())
    return f"{payload}.{_sig(payload, secret)}"


def read_token(token: str, secret: str | None = None, now: float | None = None) -> int | None:
    """Return the user id, or None for malformed, tampered or expired tokens."""
    secret = secret or get_settings().secret
    try:
        payload, sig = token.split(".")
        if not hmac.compare_digest(sig.encode(), _sig(payload, secret).encode()):
            return None
        uid, expiry = _unb64(payload).decode().split(".")
        if int(expiry) < (time.time() if now is None else now):
            return None
        return int(uid)
    except (ValueError, TypeError, UnicodeError):
        return None


def get_fernet(fernet_key: str | None, secret: str) -> Fernet:
    """Use HAQDAR_FERNET_KEY if set, else derive a key from the secret (dev only)."""
    if fernet_key:
        return Fernet(fernet_key.encode())
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(b"fernet:" + secret.encode()).digest()))


def encrypt_profile(f: Fernet, profile: dict) -> str:
    return f.encrypt(json.dumps(profile, sort_keys=True).encode()).decode()


def decrypt_profile(f: Fernet, blob: str | None) -> dict:
    if not blob:
        return {}
    try:
        return json.loads(f.decrypt(blob.encode()))
    except InvalidToken:
        log.error("stored profile could not be decrypted (was HAQDAR_SECRET / HAQDAR_FERNET_KEY rotated?); treating as empty")
        return {}


class RateLimiter:
    """Sliding window, per key, in memory."""

    def __init__(self, limit: int, window: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit, self.window, self.clock = limit, window, clock
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        now = self.clock()
        q = self._hits.setdefault(key, deque())
        while q and q[0] <= now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        if len(self._hits) > 10_000:  # bound memory
            for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - self.window]:
                self._hits.pop(k, None)
        return True
