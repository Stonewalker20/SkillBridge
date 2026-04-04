"""Admin-only routes for user management, moderation, and platform-level operational summaries."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Depends, Request

from app.core.auth import require_admin_user
from app.core.db import get_db
from app.models.admin import (
    AdminHelpRequestOut,
    AdminHelpRequestPatch,
    AdminMlflowDatasetOut,
    AdminMlflowExportLaunchIn,
    AdminJobOut,
    AdminSkillOut,
    AdminMlflowLocalOptionsOut,
    AdminMlflowOverviewOut,
    AdminMlflowJobOut,
    AdminMlflowRunDetailOut,
    AdminMlflowRunLaunchIn,
    AdminMlflowRunOut,
    AdminSummaryOut,
    AdminUserOut,
    AdminUserRolePatch,
)
from app.models.help import HelpRequestStatus
from app.utils.ai import get_inference_status
from app.utils.help_requests import refresh_user_help_unread_count
from app.utils.job_records import derive_required_skills, hydrate_job_doc, linked_job_ingest_oid, normalize_extracted_skills
from app.utils.role_weights import refresh_role_weights
from app.utils.security import record_admin_audit_event
from app.utils.mlflow_admin import (
    MlflowAdminUnavailable,
    get_mlflow_experiment_runs,
    get_mlflow_job,
    get_mlflow_overview,
    get_mlflow_run_detail,
    get_local_model_options,
    launch_eval_export_job,
    launch_mlflow_experiment_job,
    list_available_eval_datasets,
    list_mlflow_jobs,
)
from app.utils.mongo import oid_str, try_object_id

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
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at"),
        deactivated_at=doc.get("deactivated_at"),
    )


def serialize_job(doc: dict) -> AdminJobOut:
    return AdminJobOut(
        id=oid_str(doc["_id"]),
        title=str(doc.get("title") or ""),
        company=str(doc.get("company") or ""),
        location=str(doc.get("location") or ""),
        source=str(doc.get("source") or ""),
        description_excerpt=str(doc.get("description_excerpt") or ""),
        description_full=str(doc.get("description_full") or "").strip() or None,
        moderation_status=doc.get("moderation_status", "pending"),
        moderation_reason=doc.get("moderation_reason"),
        submitted_by_user_id=oid_str(doc.get("submitted_by_user_id")) if doc.get("submitted_by_user_id") is not None else None,
        role_ids=[oid_str(value) for value in (doc.get("role_ids") or []) if oid_str(value)],
        required_skills=[str(value) for value in (doc.get("required_skills") or [])],
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


def serialize_help_request(doc: dict) -> AdminHelpRequestOut:
    return AdminHelpRequestOut(
        id=oid_str(doc.get("_id")),
        user_id=oid_str(doc.get("user_id")),
        user_email=str(doc.get("user_email_snapshot") or "").strip() or None,
        username=str(doc.get("username_snapshot") or "").strip() or None,
        category=str(doc.get("category") or ""),
        subject=str(doc.get("subject") or ""),
        message=str(doc.get("message") or ""),
        page=str(doc.get("page") or "").strip() or None,
        status=str(doc.get("status") or "open"),
        admin_response=str(doc.get("admin_response") or "").strip() or None,
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


def serialize_skill(doc: dict) -> AdminSkillOut:
    return AdminSkillOut(
        id=oid_str(doc.get("_id")),
        name=str(doc.get("name") or ""),
        category=str(doc.get("category") or ""),
        aliases=[str(value) for value in (doc.get("aliases") or []) if str(value or "").strip()],
        tags=[str(value) for value in (doc.get("tags") or []) if str(value or "").strip()],
        origin=str(doc.get("origin") or "default"),
        hidden=bool(doc.get("hidden")),
        created_by_user_id=oid_str(doc.get("created_by_user_id")) if doc.get("created_by_user_id") is not None else None,
        evidence_count=int(doc.get("evidence_count") or 0),
        project_link_count=int(doc.get("project_link_count") or 0),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


def _normalize_job_text_preview(text: str, limit: int = 220) -> str:
    preview = " ".join(str(text or "").strip().split())
    if len(preview) > limit:
        return preview[:limit] + "..."
    return preview


async def backfill_job_moderation_records(db) -> int:
    duplicate_groups = await (
        db["jobs"]
        .aggregate(
            [
                {"$match": {"job_ingest_id": {"$exists": True}}},
                {"$group": {"_id": "$job_ingest_id", "doc_ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
                {"$match": {"count": {"$gt": 1}}},
            ]
        )
        .to_list(length=5000)
    )
    for group in duplicate_groups:
        docs = await (
            db["jobs"]
            .find({"_id": {"$in": group.get("doc_ids") or []}})
            .sort([("moderation_status", 1), ("updated_at", -1), ("created_at", -1), ("_id", 1)])
            .to_list(length=50)
        )
        stale_ids = [doc["_id"] for doc in docs[1:]]
        if stale_ids:
            await db["jobs"].delete_many({"_id": {"$in": stale_ids}})

    existing_refs = [value for value in await db["jobs"].distinct("job_ingest_id") if value is not None]
    existing_object_ids = [value for value in existing_refs if isinstance(value, ObjectId)]
    existing_id_strings = {oid_str(value) for value in existing_refs if oid_str(value)}

    query: dict = {}
    if existing_object_ids:
        query["_id"] = {"$nin": existing_object_ids}

    ingests = await db["job_ingests"].find(
        query,
        {
            "user_id": 1,
            "title": 1,
            "company": 1,
            "location": 1,
            "text": 1,
            "extracted_skills": 1,
            "created_at": 1,
        },
    ).to_list(length=5000)

    created = 0
    for ingest in ingests:
        ingest_id = ingest.get("_id")
        ingest_id_str = oid_str(ingest_id)
        if not ingest_id_str or ingest_id_str in existing_id_strings:
            continue

        extracted = normalize_extracted_skills(entry for entry in (ingest.get("extracted_skills") or []) if isinstance(entry, dict))
        required_skills, required_skill_ids = derive_required_skills(extracted)
        text = str(ingest.get("text") or "").strip()
        submitted_by = ingest.get("user_id")
        submitted_by_oid = try_object_id(submitted_by)

        await db["jobs"].insert_one(
            {
                "title": str(ingest.get("title") or "").strip(),
                "company": str(ingest.get("company") or "").strip(),
                "location": str(ingest.get("location") or "").strip(),
                "source": "job-match submission",
                "description_excerpt": _normalize_job_text_preview(text),
                "description_full": text,
                "required_skills": required_skills,
                "required_skill_ids": required_skill_ids,
                "role_ids": [],
                "moderation_status": "pending",
                "moderation_reason": None,
                "submitted_by_user_id": submitted_by_oid or submitted_by,
                "job_ingest_id": ingest_id,
                "created_at": ingest.get("created_at") or now_utc(),
                "updated_at": now_utc(),
            }
        )
        existing_id_strings.add(ingest_id_str)
        created += 1

    return created


@router.get("/summary", response_model=AdminSummaryOut)
async def admin_summary(_user=Depends(require_admin_user)):
    db = get_db()
    await backfill_job_moderation_records(db)
    status = get_inference_status()
    collections = {
        "users": await db["users"].count_documents({}),
        "skills": await db["skills"].count_documents({}),
        "projects": await db["projects"].count_documents({}),
        "evidence": await db["evidence"].count_documents({}),
        "jobs": await db["jobs"].count_documents({}),
        "help_requests": await db["help_requests"].count_documents({}),
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
    docs = await (
        db["users"]
        .find({}, {"email": 1, "username": 1, "role": 1, "is_active": 1, "created_at": 1, "deactivated_at": 1})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [serialize_user(doc) for doc in docs]


@router.get("/skills", response_model=list[AdminSkillOut])
async def admin_list_skills(
    q: str | None = Query(default=None, description="Search skill name, alias, or category"),
    include_hidden: bool = Query(default=True),
    limit: int = Query(default=250, ge=1, le=1000),
    _user=Depends(require_admin_user),
):
    db = get_db()
    docs = await (
        db["skills"]
        .find(
            {},
            {
                "name": 1,
                "category": 1,
                "aliases": 1,
                "tags": 1,
                "origin": 1,
                "hidden": 1,
                "created_by_user_id": 1,
                "created_at": 1,
                "updated_at": 1,
            },
        )
        .sort([("updated_at", -1), ("created_at", -1), ("name", 1)])
        .to_list(length=5000)
    )

    term = str(q or "").strip().lower()
    rows: list[dict] = []
    for doc in docs:
        if not include_hidden and doc.get("hidden") is True:
            continue
        haystack = " ".join(
            [
                str(doc.get("name") or ""),
                str(doc.get("category") or ""),
                " ".join(str(value or "") for value in (doc.get("aliases") or [])),
                " ".join(str(value or "") for value in (doc.get("tags") or [])),
            ]
        ).lower()
        if term and term not in haystack:
            continue
        skill_ref = [doc.get("_id"), oid_str(doc.get("_id"))]
        evidence_count = await db["evidence"].count_documents({"skill_ids": {"$in": skill_ref}})
        project_link_count = await db["project_skill_links"].count_documents({"skill_id": {"$in": skill_ref}})
        rows.append(
            {
                **doc,
                "evidence_count": evidence_count,
                "project_link_count": project_link_count,
            }
        )
        if len(rows) >= limit:
            break
    return [serialize_skill(doc) for doc in rows]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def admin_update_user_role(
    user_id: str,
    payload: AdminUserRolePatch,
    request: Request,
    current_user=Depends(require_admin_user),
):
    db = get_db()
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    next_role = str(payload.role or "").strip().lower()
    if next_role not in ALLOWED_MANAGED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    target = await db["users"].find_one({"_id": user_oid}, {"email": 1, "username": 1, "role": 1, "is_active": 1, "created_at": 1, "deactivated_at": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if oid_str(target["_id"]) == oid_str(current_user["_id"]) and next_role not in {"owner", "admin"}:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin access")

    await db["users"].update_one({"_id": user_oid}, {"$set": {"role": next_role, "updated_at": now_utc()}})
    updated = await db["users"].find_one({"_id": user_oid}, {"email": 1, "username": 1, "role": 1, "is_active": 1, "created_at": 1, "deactivated_at": 1})
    await record_admin_audit_event(
        db,
        actor=current_user,
        action="admin.user.role_updated",
        target_type="user",
        target_id=user_id,
        details={"role": next_role},
        request=request,
    )
    return serialize_user(updated)


@router.get("/help-requests", response_model=list[AdminHelpRequestOut])
async def admin_list_help_requests(
    status: HelpRequestStatus | None = Query(default=None, description="open|in_review|resolved"),
    limit: int = Query(default=200, ge=1, le=1000),
    _user=Depends(require_admin_user),
):
    db = get_db()
    query: dict = {}
    if status:
        query["status"] = status
    docs = await (
        db["help_requests"]
        .find(query)
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [serialize_help_request(doc) for doc in docs]


@router.patch("/help-requests/{request_id}", response_model=AdminHelpRequestOut)
async def admin_update_help_request(
    request_id: str,
    payload: AdminHelpRequestPatch,
    request: Request,
    current_user=Depends(require_admin_user),
):
    db = get_db()
    try:
        request_oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request_id")

    existing = await db["help_requests"].find_one({"_id": request_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Help request not found")

    next_status = str(payload.status or "").strip().lower()
    if next_status not in {"open", "in_review", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid help request status")

    next_response = str(payload.admin_response or "").strip() or None
    response_changed = next_response != (str(existing.get("admin_response") or "").strip() or None)
    updates = {
        "status": next_status,
        "admin_response": next_response,
        "updated_at": now_utc(),
    }
    if next_response and response_changed:
        updates["admin_responded_at"] = now_utc()
        updates["user_acknowledged_response_at"] = None
        updates["user_has_unread_response"] = True
    elif not next_response:
        updates["user_has_unread_response"] = False
        updates["admin_responded_at"] = None
        updates["user_acknowledged_response_at"] = None

    await db["help_requests"].update_one({"_id": request_oid}, {"$set": updates})
    if existing.get("user_id") is not None:
        await refresh_user_help_unread_count(db, existing["user_id"])

    updated = await db["help_requests"].find_one({"_id": request_oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Help request not found")
    await record_admin_audit_event(
        db,
        actor=current_user,
        action="admin.help_request.updated",
        target_type="help_request",
        target_id=request_id,
        details={"status": next_status},
        request=request,
    )
    return serialize_help_request(updated)


@router.delete("/users/{user_id}")
async def admin_deactivate_user(user_id: str, request: Request, current_user=Depends(require_admin_user)):
    db = get_db()
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    target = await db["users"].find_one({"_id": user_oid}, {"role": 1, "is_active": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if oid_str(target["_id"]) == oid_str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if target.get("is_active", True) is False:
        return {"ok": True}

    await db["users"].update_one(
        {"_id": user_oid},
        {"$set": {"is_active": False, "deactivated_at": now_utc(), "updated_at": now_utc()}},
    )
    await db["sessions"].delete_many({"user_id": user_oid})
    await record_admin_audit_event(
        db,
        actor=current_user,
        action="admin.user.deactivated",
        target_type="user",
        target_id=user_id,
        details={"was_active": True},
        request=request,
    )
    return {"ok": True}


@router.get("/jobs", response_model=list[AdminJobOut])
async def admin_list_jobs(
    status: str | None = Query(default=None, description="pending|approved|rejected"),
    limit: int = Query(default=200, ge=1, le=1000),
    _user=Depends(require_admin_user),
):
    db = get_db()
    await backfill_job_moderation_records(db)
    query: dict = {}
    if status:
        query["moderation_status"] = status
    docs = await (
        db["jobs"]
        .find(query, {"title": 1, "company": 1, "location": 1, "source": 1, "description_excerpt": 1, "description_full": 1, "moderation_status": 1, "moderation_reason": 1, "submitted_by_user_id": 1, "role_ids": 1, "required_skills": 1, "required_skill_ids": 1, "job_ingest_id": 1, "created_at": 1, "updated_at": 1})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    ingest_ids = [linked_job_ingest_oid(doc) for doc in docs]
    ingests = await db["job_ingests"].find({"_id": {"$in": [oid for oid in ingest_ids if oid is not None]}}).to_list(length=len(ingest_ids) or 1)
    ingests_by_id = {oid_str(doc.get("_id")): doc for doc in ingests}
    return [serialize_job(hydrate_job_doc(doc, ingests_by_id.get(oid_str(linked_job_ingest_oid(doc))))) for doc in docs]


@router.patch("/jobs/{job_id}/moderation", response_model=AdminJobOut)
async def admin_moderate_job(job_id: str, payload: dict, request: Request, _user=Depends(require_admin_user)):
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
    if not updated:
        raise HTTPException(status_code=404, detail="Job not found")
    for role_id in sorted({oid_str(role_id) for role_id in (updated.get("role_ids") or []) if oid_str(role_id)}):
        await refresh_role_weights(db, role_id)
    await record_admin_audit_event(
        db,
        actor=_user,
        action="admin.job.moderation_updated",
        target_type="job",
        target_id=job_id,
        details={"moderation_status": next_status},
        request=request,
    )
    ingest = None
    ingest_oid = linked_job_ingest_oid(updated)
    if ingest_oid is not None:
        ingest = await db["job_ingests"].find_one({"_id": ingest_oid})
    return serialize_job(hydrate_job_doc(updated, ingest))


@router.get("/mlflow/overview", response_model=AdminMlflowOverviewOut)
async def admin_mlflow_overview(_user=Depends(require_admin_user)):
    return AdminMlflowOverviewOut(**get_mlflow_overview())


@router.get("/mlflow/experiments/{experiment_id}/runs", response_model=list[AdminMlflowRunOut])
async def admin_mlflow_experiment_runs(
    experiment_id: str,
    limit: int = Query(default=25, ge=1, le=100),
    _user=Depends(require_admin_user),
):
    try:
        runs = get_mlflow_experiment_runs(experiment_id=experiment_id, limit=limit)
    except MlflowAdminUnavailable as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to query MLflow runs: {exc}") from exc
    return [AdminMlflowRunOut(**run) for run in runs]


@router.get("/mlflow/experiments/{experiment_id}/runs/{run_id}", response_model=AdminMlflowRunDetailOut)
async def admin_mlflow_run_detail(experiment_id: str, run_id: str, _user=Depends(require_admin_user)):
    try:
        detail = get_mlflow_run_detail(experiment_id=experiment_id, run_id=run_id)
    except MlflowAdminUnavailable as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to query MLflow run detail: {exc}") from exc
    return AdminMlflowRunDetailOut(**detail)


@router.get("/mlflow/datasets", response_model=list[AdminMlflowDatasetOut])
async def admin_mlflow_datasets(_user=Depends(require_admin_user)):
    return [AdminMlflowDatasetOut(**dataset) for dataset in list_available_eval_datasets()]


@router.get("/mlflow/local-options", response_model=AdminMlflowLocalOptionsOut)
async def admin_mlflow_local_options(_user=Depends(require_admin_user)):
    return AdminMlflowLocalOptionsOut(**get_local_model_options())


@router.get("/mlflow/jobs", response_model=list[AdminMlflowJobOut])
async def admin_mlflow_jobs(limit: int = Query(default=20, ge=1, le=100), _user=Depends(require_admin_user)):
    return [AdminMlflowJobOut(**job) for job in list_mlflow_jobs(limit=limit)]


@router.get("/mlflow/jobs/{job_id}", response_model=AdminMlflowJobOut)
async def admin_mlflow_job(job_id: str, _user=Depends(require_admin_user)):
    try:
        return AdminMlflowJobOut(**get_mlflow_job(job_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="MLflow job not found") from exc


@router.post("/mlflow/datasets/export", response_model=AdminMlflowJobOut)
async def admin_launch_mlflow_dataset_export(payload: AdminMlflowExportLaunchIn, request: Request, _user=Depends(require_admin_user)):
    try:
        result = AdminMlflowJobOut(**launch_eval_export_job(payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to launch dataset export: {exc}") from exc
    db = get_db()
    await record_admin_audit_event(
        db,
        actor=_user,
        action="admin.mlflow.dataset_export_launched",
        target_type="mlflow_job",
        target_id=result.id,
        details={"max_users": payload.max_users, "max_per_user": payload.max_per_user, "negative_count": payload.negative_count},
        request=request,
    )
    return result


@router.post("/mlflow/experiments/run", response_model=AdminMlflowJobOut)
async def admin_launch_mlflow_experiment(payload: AdminMlflowRunLaunchIn, request: Request, _user=Depends(require_admin_user)):
    try:
        result = AdminMlflowJobOut(**launch_mlflow_experiment_job(payload.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to launch MLflow experiment: {exc}") from exc
    db = get_db()
    await record_admin_audit_event(
        db,
        actor=_user,
        action="admin.mlflow.experiment_launched",
        target_type="mlflow_job",
        target_id=result.id,
        details={"experiment_name": payload.experiment_name, "dataset_id": payload.dataset_id},
        request=request,
    )
    return result
