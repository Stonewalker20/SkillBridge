"""Admin-only routes for user management, moderation, and platform-level operational summaries."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Depends, Request

from app.core.auth import require_admin_user
from app.core.db import get_db
from app.models.admin import (
    AdminMlflowDatasetOut,
    AdminMlflowExportLaunchIn,
    AdminJobOut,
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
from app.utils.ai import get_inference_status
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
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at"),
        deactivated_at=doc.get("deactivated_at"),
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
    docs = await (
        db["users"]
        .find({}, {"email": 1, "username": 1, "role": 1, "is_active": 1, "created_at": 1, "deactivated_at": 1})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [serialize_user(doc) for doc in docs]


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
    for role_id in sorted({str(role_id).strip() for role_id in (updated.get("role_ids") or []) if str(role_id).strip()}):
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
    return serialize_job(updated)


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
