from fastapi import APIRouter, Query
from app.core.db import get_db
from app.models.evidence import EvidenceIn, EvidenceOut
from app.utils.mongo import oid_str

router = APIRouter()

@router.get("/", response_model=list[EvidenceOut])
async def list_evidence(user_email: str | None = Query(default=None)):
    db = get_db()
    q = {}
    if user_email:
        q["user_email"] = user_email

    cursor = db["evidence"].find(q, {"user_email": 1, "type": 1, "title": 1, "source": 1, "text_excerpt": 1, "tags": 1})
    docs = await cursor.to_list(length=500)
    out = []
    for d in docs:
        out.append({
            "id": oid_str(d["_id"]),
            "user_email": d["user_email"],
            "type": d["type"],
            "title": d["title"],
            "source": d["source"],
            "text_excerpt": d["text_excerpt"],
            "tags": d.get("tags", []),
        })
    return out

@router.post("/", response_model=EvidenceOut)
async def create_evidence(payload: EvidenceIn):
    db = get_db()
    doc = payload.model_dump()
    res = await db["evidence"].insert_one(doc)
    return {"id": oid_str(res.inserted_id), **doc}

