from __future__ import annotations

import json
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

from .config import DEV_SECRET, get_settings
from .engine.rules import validate_rule
from .db import init_db, make_engine
from .models import Audit
from .routers.deps import user_id_from_request
from .security import RateLimiter, get_fernet

log = logging.getLogger("haqdar")
audit_log = logging.getLogger("haqdar.audit")


def create_app(database_url: str | None = None, *, schemes: list[dict] | None = None) -> FastAPI:
    from .routers import auth, health, kit, me, saved, voice
    from .routers import evaluate as evaluate_router
    from .routers import schemes as schemes_router
    from .schemes import load_schemes

    settings = get_settings(database_url)
    if settings.is_production:
        log.info("HAQDAR_ENV=production: dev OTP disabled, real secrets required")
    else:
        log.warning("HAQDAR_ENV=%s: DEV MODE. Demo OTP 123456 is accepted for requested OTPs and secrets may be "
                    "insecure defaults. NEVER run this in production (set HAQDAR_ENV=production).", settings.env)
        if settings.secret == DEV_SECRET:
            log.warning("HAQDAR_SECRET not set: using an insecure dev secret")

    app = FastAPI(title="Haqdar API")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.session_factory = init_db(app.state.engine)
    app.state.fernet = get_fernet(settings.fernet_key, settings.secret)
    app.state.schemes = schemes if schemes is not None else load_schemes(settings.data_dir / "schemes")
    for sc in app.state.schemes:  # fail closed: a malformed rule must stop startup, not 500 /evaluate
        try:
            validate_rule(sc["eligibility"])
        except ValueError as e:
            raise ValueError(f"scheme {sc.get('id')!r}: invalid eligibility rule: {e}") from e
    app.state.otps = {}
    app.state.rate_limiter = RateLimiter(settings.rate_limit)

    # Middleware: the last one registered is outermost (request id wraps all).
    @app.middleware("http")
    async def audit_evaluate(request: Request, call_next):
        response = await call_next(request)
        if request.method == "POST" and request.url.path == "/evaluate" and response.status_code == 200:
            body = b"".join([chunk async for chunk in response.body_iterator])
            try:
                await run_in_threadpool(_write_audit, request, json.loads(body))
            except Exception:  # audit failure must not break the citizen's answer, but must be loud
                log.exception("audit write failed")
            return Response(content=body, status_code=response.status_code,
                            headers=dict(response.headers), media_type=response.media_type)
        return response

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        ip = client_ip(request, settings.trusted_proxy_hops)
        if not app.state.rate_limiter.allow(ip):
            return JSONResponse({"detail": "rate limit exceeded"}, status_code=429, headers={"Retry-After": "60"})
        return await call_next(request)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    for r in (health, auth, me, saved, kit, voice):
        app.include_router(r.router)
    app.include_router(evaluate_router.router)
    app.include_router(schemes_router.router)
    return app


def client_ip(request: Request, hops: int) -> str:
    """Socket peer, or with hops=N>0 the Nth-from-right X-Forwarded-For entry (the one our own
    trusted proxy appended). Entries further left are client-controlled and ignored."""
    peer = request.client.host if request.client else "unknown"
    if hops <= 0:
        return peer
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    return parts[-hops] if len(parts) >= hops else peer


def _write_audit(request: Request, payload: dict) -> None:
    results = payload.get("results") or []
    uid = user_id_from_request(request)  # never raises
    with request.app.state.session_factory() as db:
        for r in results:
            db.add(Audit(user_id=uid, scheme_id=r["scheme_id"], rule_version=str(r["rule_version"]),
                         profile_hash=r["profile_hash"], verdict=r["verdict"]))
        db.commit()
    for r in results:
        audit_log.info(json.dumps({"request_id": getattr(request.state, "request_id", None),
                                   "scheme_id": r["scheme_id"], "rule_version": r["rule_version"],
                                   "profile_hash": r["profile_hash"], "verdict": r["verdict"]}))


def __getattr__(name: str):  # lazy `app.main:app` for `uvicorn app.main:app`
    if name == "app":
        global app
        app = create_app()
        return app
    raise AttributeError(name)
