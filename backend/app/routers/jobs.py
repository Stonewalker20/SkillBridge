from fastapi import APIRouter
from app.core.db import get_db
from app.models.job import JobIn, JobOut
from app.utils.mongo import oid_str

router = APIRouter()

@router.get("/", response_model=list[JobOut])
async def list_jobs():
    db = get_db()
    cursor = db["jobs"].find({}, {"title": 1, "company": 1, "location": 1, "source": 1, "description_excerpt": 1, "required_skills": 1})
    docs = await cursor.to_list(length=500)
    out = []
    for d in docs:
        out.append({
            "id": oid_str(d["_id"]),
            "title": d["title"],
            "company": d["company"],
            "location": d["location"],
            "source": d["source"],
            "description_excerpt": d["description_excerpt"],
            "required_skills": d.get("required_skills", []),
        })
    return out

@router.post("/", response_model=JobOut)
async def create_job(payload: JobIn):
    db = get_db()
    doc = payload.model_dump()
    res = await db["jobs"].insert_one(doc)
    return {"id": oid_str(res.inserted_id), **doc}

