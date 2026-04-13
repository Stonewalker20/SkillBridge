"""Health-check routes used to validate API and database availability."""

from fastapi import APIRouter, Depends
from app.core.db import get_db
from app.core.auth import require_admin_user

router = APIRouter()

@router.get("/")
async def health():
    get_db()
    return {"status": "ok"}

@router.get("/db_counts", dependencies=[Depends(require_admin_user)])
async def db_counts():
    db = get_db()
    return {
        "skills": await db["skills"].count_documents({}),
        "resume_snapshots": await db["resume_snapshots"].count_documents({}),
        "evidence": await db["evidence"].count_documents({}),
        "jobs": await db["jobs"].count_documents({}),
    }


