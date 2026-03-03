from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Depends

from app.core.auth import require_admin_user
from app.core.db import get_db
from app.models.admin import AdminJobOut, AdminSummaryOut, AdminUserOut, AdminUserRolePatch
from app.utils.ai import get_inference_status
from app.utils.mongo import oid_str

router = APIRouter()

ALLOWED_MANAGED_ROLES = {"user", "team", "admin", "owner"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize_user(doc: dict) -> AdminUserOut:
    return AdminUserOut(
        id=oid_str(doc["_id"]),
        email=doc.get("email", ""),
        username=doc.get("username", ""),
        role=doc.get("role", "user"),
        created_at=doc.get("created_at"),
    )


def serialize_job(doc: dict) -> AdminJobOut:
    return AdminJobOut(
        id=oid_str(doc["_id"]),
        title=doc.get("title", ""),
        company=doc.get("company", ""),
        location=doc.get("location", ""),
        source=doc.get("source", ""),
        description_excerpt=doc.get("description_excerpt", ""),
        moderation_status=doc.get("moderation_status", "pending"),
        moderation_reason=doc.get("moderation_reason"),
        role_ids=doc.get("role_ids", []) or [],
        required_skills=doc.get("required_skills", []) or [],
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


@router.get("/summary", response_model=AdminSummaryOut)
async def admin_summary(_user=Depends(require_admin_user)):
    db = get_db()
    status = get_inference_status()
    collections = {
        "users": await db["users"].count_documents({}),
        "skills": await db["skills"].count_documents({}),
        "projects": await db["projects"].count_documents({}),
        "evidence": await db["evidence"].count_documents({}),
        "jobs": await db["jobs"].count_documents({}),
        "tailored_resumes": await db["tailored_resumes"].count_documents({}),
        "job_match_runs": await db["job_match_runs"].count_documents({}),
    }
    team_members = await db["users"].count_documents({"role": {"$in": ["team", "admin", "owner"]}})
    pending_jobs = await db["jobs"].count_documents({"moderation_status": "pending"})
    return AdminSummaryOut(
        total_users=collections["users"],
        team_members=team_members,
        projects=collections["projects"],
        evidence=collections["evidence"],
        jobs=collections["jobs"],
        pending_jobs=pending_jobs,
        skills=collections["skills"],
        tailored_resumes=collections["tailored_resumes"],
        provider_mode=status.get("provider_mode", "unknown"),
        collections=collections,
    )


@router.get("/users", response_model=list[AdminUserOut])
async def admin_list_users(limit: int = Query(default=250, ge=1, le=1000), _user=Depends(require_admin_user)):
    db = get_db()
    docs = await db["users"].find({}, {"email": 1, "username": 1, "role": 1, "created_at": 1}).sort("created_at", -1).limit(limit).to_list(length=limit)
    return [serialize_user(doc) for doc in docs]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def admin_update_user_role(user_id: str, payload: AdminUserRolePatch, current_user=Depends(require_admin_user)):
    db = get_db()
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    next_role = str(payload.role or "").strip().lower()
    if next_role not in ALLOWED_MANAGED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    target = await db["users"].find_one({"_id": user_oid}, {"email": 1, "username": 1, "role": 1, "created_at": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if oid_str(target["_id"]) == oid_str(current_user["_id"]) and next_role not in {"owner", "admin"}:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access")

    await db["users"].update_one({"_id": user_oid}, {"$set": {"role": next_role, "updated_at": now_utc()}})
    updated = await db["users"].find_one({"_id": user_oid}, {"email": 1, "username": 1, "role": 1, "created_at": 1})
    return serialize_user(updated)


@router.get("/jobs", response_model=list[AdminJobOut])
async def admin_list_jobs(
    status: str | None = Query(default=None, description="pending|approved|rejected"),
    limit: int = Query(default=200, ge=1, le=1000),
    _user=Depends(require_admin_user),
):
    db = get_db()
    query: dict = {}
    if status:
        query["moderation_status"] = status
    docs = await (
        db["jobs"]
        .find(query, {"title": 1, "company": 1, "location": 1, "source": 1, "description_excerpt": 1, "moderation_status": 1, "moderation_reason": 1, "role_ids": 1, "required_skills": 1, "created_at": 1, "updated_at": 1})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [serialize_job(doc) for doc in docs]


@router.patch("/jobs/{job_id}/moderation", response_model=AdminJobOut)
async def admin_moderate_job(job_id: str, payload: dict, _user=Depends(require_admin_user)):
    db = get_db()
    try:
        job_oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    next_status = str(payload.get("moderation_status") or "").strip().lower()
    if next_status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid moderation_status")

    updates = {
        "moderation_status": next_status,
        "moderation_reason": payload.get("moderation_reason"),
        "updated_at": now_utc(),
    }
    result = await db["jobs"].update_one({"_id": job_oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")

    updated = await db["jobs"].find_one({"_id": job_oid})
    return serialize_job(updated)
