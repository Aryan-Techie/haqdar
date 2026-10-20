from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
def health(request: Request):
    return {"status": "ok", "schemes": len(request.app.state.schemes)}
