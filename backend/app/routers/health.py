from fastapi import APIRouter
from app.core.db import get_db

router = APIRouter()

@router.get("/health")
async def health():
    db = get_db()
    cols = await db.list_collection_names()
    return {"status": "ok", "db": db.name, "collections": cols}

