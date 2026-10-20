from typing import Any, Literal, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, create_model

from ..engine import vocab
from ..engine.evaluate import evaluate, next_fields

router = APIRouter()


def _build_profile_model() -> type[BaseModel]:
    v = vocab.load_vocab()
    fields: dict[str, Any] = {}
    for name, spec in v["fields"].items():
        if spec["type"] == "enum":
            ann: Any = Literal[tuple(o["id"] for o in spec["options"])]  # type: ignore[valid-type]
            default: Any = None
        elif spec["type"] == "integer":
            ann = Field(default=None, ge=spec["min"], le=spec["max"])
            fields[name] = (Optional[StrictInt], ann)
            continue
        else:
            ann = StrictBool
            default = None
        fields[name] = (Optional[ann], default)
    return create_model("Profile", __config__=ConfigDict(extra="forbid", strict=True), **fields)


Profile = _build_profile_model()
Category = Literal[tuple(c["id"] for c in vocab.load_vocab()["categories"])]  # type: ignore[valid-type]


class EvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile: Profile  # type: ignore[valid-type]
    interests: list[Category] = []  # type: ignore[valid-type]


def _hash_key(request: Request) -> bytes:
    settings = getattr(request.app.state, "settings", None)
    return b"audit:" + settings.secret.encode() if settings else b""


@router.post("/evaluate")
def post_evaluate(body: EvaluateRequest, request: Request):
    profile = body.profile.model_dump(exclude_none=True)
    schemes = request.app.state.schemes
    state = profile.get("state")
    return {
        "results": evaluate(profile, schemes, tuple(body.interests),
                            _hash_key(request)),
        "next_fields": next_fields(profile, schemes),
        "coverage": {
            "state": state,
            "has_state_schemes": state is not None and any(
                s.get("level") == "state" and state in s["states"] for s in schemes),
        },
    }
