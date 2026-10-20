"""Environment settings. Read at create_app() time so tests can monkeypatch env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEV_SECRET = "dev-insecure-secret-change-me"
INSECURE_VALUES = {"", DEV_SECRET, "change-me"}


def _flag(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    secret: str
    fernet_key: str | None
    dev_otp: bool
    env: str
    trusted_proxy_hops: int
    slng_api_key: str | None
    slng_base_url: str
    slng_stt_model: str
    slng_tts_model: str
    rate_limit: int
    data_dir: Path

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def voice_configured(self) -> bool:
        return bool(self.slng_api_key)


def get_settings(database_url: str | None = None) -> Settings:
    env = (os.environ.get("HAQDAR_ENV") or "dev").strip().lower()
    if env == "production":
        secret = (os.environ.get("HAQDAR_SECRET") or "").strip()
        fernet = (os.environ.get("HAQDAR_FERNET_KEY") or "").strip()
        if secret in INSECURE_VALUES:
            raise RuntimeError("HAQDAR_ENV=production requires a real HAQDAR_SECRET (not unset, 'change-me' or the dev secret)")
        if fernet in INSECURE_VALUES:
            raise RuntimeError("HAQDAR_ENV=production requires HAQDAR_FERNET_KEY (a real Fernet key)")
    root = Path(__file__).resolve().parents[2]
    return Settings(
        database_url=database_url
        or os.environ.get("HAQDAR_DATABASE_URL")
        or "sqlite:///./haqdar.db",
        secret=os.environ.get("HAQDAR_SECRET") or DEV_SECRET,
        fernet_key=os.environ.get("HAQDAR_FERNET_KEY") or None,
        # Dev OTP is forced off in production regardless of HAQDAR_DEV_OTP.
        dev_otp=_flag("HAQDAR_DEV_OTP", True) and env != "production",
        env=env,
        trusted_proxy_hops=max(0, int(os.environ.get("HAQDAR_TRUSTED_PROXY_HOPS") or 0)),
        slng_api_key=os.environ.get("SLNG_API_KEY") or None,
        slng_base_url=os.environ.get("SLNG_BASE_URL") or "https://api.slng.ai",
        slng_stt_model=os.environ.get("SLNG_STT_MODEL") or "sarvam/saaras:v3",
        slng_tts_model=os.environ.get("SLNG_TTS_MODEL") or "sarvam/bulbul:v3",
        rate_limit=int(os.environ.get("HAQDAR_RATE_LIMIT") or 120),
        data_dir=Path(os.environ.get("HAQDAR_DATA_DIR") or root / "data"),
    )
