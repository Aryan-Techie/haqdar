from __future__ import annotations

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .models import Base


def make_engine(url: str) -> Engine:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _fk(dbapi_conn, _):  # noqa: ANN001
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return engine


def init_db(engine: Engine) -> sessionmaker[Session]:
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session
