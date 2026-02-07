from fastapi import APIRouter
from app.core.db import get_db
from app.models.skill import SkillIn, SkillOut
from app.utils.mongo import oid_str

router = APIRouter()

@router.get("/", response_model=list[SkillOut])
async def list_skills():
    db = get_db()
    cursor = db["skills"].find({}, {"name": 1, "category": 1, "aliases": 1})
    docs = await cursor.to_list(length=500)
    return [{"id": oid_str(d["_id"]), "name": d["name"], "category": d["category"], "aliases": d.get("aliases", [])} for d in docs]

@router.post("/", response_model=SkillOut)
async def create_skill(payload: SkillIn):
    db = get_db()
    doc = payload.model_dump()
    res = await db["skills"].insert_one(doc)
    return {"id": oid_str(res.inserted_id), **doc}

