"""Job submission and moderation routes that manage saved job postings and their approval lifecycle."""

from __future__ import annotations

from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timezone
from bson import ObjectId
from app.core.db import get_db
from app.models.job import JobIn, JobOut, JobModerationIn, JobRoleTagIn
from app.utils.job_records import hydrate_job_doc, linked_job_ingest_oid
from app.utils.mongo import canonical_object_ref, canonical_object_refs, oid_str, ref_values
from app.utils.role_weights import refresh_role_weights

router = APIRouter()

def now_utc():
    return datetime.now(timezone.utc)


def serialize_job(doc: dict) -> dict:
    return {
        "id": oid_str(doc["_id"]),
        "title": str(doc.get("title") or ""),
        "company": str(doc.get("company") or ""),
        "location": str(doc.get("location") or ""),
        "source": str(doc.get("source") or ""),
        "description_excerpt": str(doc.get("description_excerpt") or ""),
        "required_skills": [str(value) for value in (doc.get("required_skills") or [])],
        "required_skill_ids": [oid_str(value) for value in (doc.get("required_skill_ids") or []) if oid_str(value)],
        "role_ids": [oid_str(value) for value in (doc.get("role_ids") or []) if oid_str(value)],
        "moderation_status": doc.get("moderation_status", "approved"),
        "moderation_reason": doc.get("moderation_reason"),
        "submitted_by_user_id": oid_str(doc.get("submitted_by_user_id")) if doc.get("submitted_by_user_id") is not None else None,
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

@router.get("/", response_model=list[JobOut])
async def list_jobs(
    status: str | None = Query(default=None, description="pending|approved|rejected"),
    role_id: str | None = Query(default=None),
):
    db = get_db()
    q: dict = {}
    if status:
        q["moderation_status"] = status
    if role_id:
        q["role_ids"] = {"$in": ref_values(role_id)}

    cursor = db["jobs"].find(
        q,
        {
            "title": 1,
            "company": 1,
            "location": 1,
            "source": 1,
            "description_excerpt": 1,
            "description_full": 1,
            "required_skills": 1,
            "required_skill_ids": 1,
            "role_ids": 1,
            "job_ingest_id": 1,
            "moderation_status": 1,
            "moderation_reason": 1,
            "submitted_by_user_id": 1,
            "created_at": 1,
            "updated_at": 1,
        },
    ).sort("created_at", -1)

    docs = await cursor.to_list(length=500)
    ingest_ids = [linked_job_ingest_oid(doc) for doc in docs]
    ingests = await db["job_ingests"].find({"_id": {"$in": [oid for oid in ingest_ids if oid is not None]}}).to_list(length=len(ingest_ids) or 1)
    ingests_by_id = {oid_str(doc.get("_id")): doc for doc in ingests}
    return [serialize_job(hydrate_job_doc(doc, ingests_by_id.get(oid_str(linked_job_ingest_oid(doc))))) for doc in docs]

# Community submission (defaults to pending)
@router.post("/submit", response_model=JobOut)
async def submit_job(payload: JobIn):
    db = get_db()
    now = now_utc()
    doc = payload.model_dump()
    doc["required_skill_ids"] = canonical_object_refs(doc.get("required_skill_ids") or [])
    doc["role_ids"] = canonical_object_refs(doc.get("role_ids") or [])
    submitted_by = canonical_object_ref(doc.get("submitted_by_user_id"))
    doc["submitted_by_user_id"] = submitted_by if submitted_by is not None else None
    doc["moderation_status"] = "pending"
    doc["moderation_reason"] = None
    doc["created_at"] = now
    doc["updated_at"] = now
    res = await db["jobs"].insert_one(doc)
    return serialize_job({"_id": res.inserted_id, **doc})

# Direct create (admin/system) defaults to approved (keeps your original POST /jobs behavior but safer)
@router.post("/", response_model=JobOut)
async def create_job(payload: JobIn):
    db = get_db()
    now = now_utc()
    doc = payload.model_dump()
    doc["required_skill_ids"] = canonical_object_refs(doc.get("required_skill_ids") or [])
    doc["role_ids"] = canonical_object_refs(doc.get("role_ids") or [])
    submitted_by = canonical_object_ref(doc.get("submitted_by_user_id"))
    doc["submitted_by_user_id"] = submitted_by if submitted_by is not None else None
    doc["moderation_status"] = "approved"
    doc["moderation_reason"] = None
    doc["created_at"] = now
    doc["updated_at"] = now
    res = await db["jobs"].insert_one(doc)
    return serialize_job({"_id": res.inserted_id, **doc})

# UC 4.1 – Moderate job postings (approve/reject)
@router.patch("/{job_id}/moderate", response_model=JobOut)
async def moderate_job(job_id: str, payload: JobModerationIn):
    db = get_db()
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    updates = {
        "moderation_status": payload.moderation_status,
        "moderation_reason": payload.moderation_reason,
        "updated_at": now_utc(),
    }
    res = await db["jobs"].update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")

    d = await db["jobs"].find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Job not found")
    ingest = None
    ingest_oid = linked_job_ingest_oid(d)
    if ingest_oid is not None:
        ingest = await db["job_ingests"].find_one({"_id": ingest_oid})
    return serialize_job(hydrate_job_doc(d, ingest))

# UC 4.2 – Tag a posting by role (role_id)
@router.post("/{job_id}/roles", response_model=JobOut)
async def add_role_tag(job_id: str, payload: JobRoleTagIn):
    db = get_db()
    try:
        oid = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    try:
        role_oid = ObjectId(payload.role_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role_id")

    if not await db["roles"].find_one({"_id": role_oid}):
        raise HTTPException(status_code=404, detail="Role not found")

    await db["jobs"].update_one({"_id": oid}, {"$addToSet": {"role_ids": role_oid}, "$set": {"updated_at": now_utc()}})
    await refresh_role_weights(db, payload.role_id)
    d = await db["jobs"].find_one({"_id": oid})
    if not d:
        raise HTTPException(status_code=404, detail="Job not found")
    ingest = None
    ingest_oid = linked_job_ingest_oid(d)
    if ingest_oid is not None:
        ingest = await db["job_ingests"].find_one({"_id": ingest_oid})
    return serialize_job(hydrate_job_doc(d, ingest))
