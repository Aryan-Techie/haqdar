from fastapi import APIRouter, HTTPException, Request

from ..schemes import search

router = APIRouter()


@router.get("/schemes")
def list_schemes(request: Request):
    return {"schemes": request.app.state.schemes}


@router.get("/schemes/{scheme_id}")
def get_scheme(scheme_id: str, request: Request):
    for s in request.app.state.schemes:
        if s["id"] == scheme_id:
            return s
    raise HTTPException(status_code=404, detail="scheme not found")


@router.get("/search")
def search_schemes(request: Request, q: str = ""):
    return {"ids": search(q, request.app.state.schemes)}
