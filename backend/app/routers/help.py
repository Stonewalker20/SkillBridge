"""Authenticated help-request routes for user support submissions."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import require_user
from app.core.db import get_db
from app.models.help import HelpRequestIn, HelpRequestOut
from app.utils.help_requests import refresh_user_help_unread_count
from app.utils.mongo import oid_str

router = APIRouter()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def serialize_help_request(doc: dict) -> HelpRequestOut:
    return HelpRequestOut(
        id=oid_str(doc.get("_id")),
        user_id=oid_str(doc.get("user_id")),
        category=str(doc.get("category") or ""),
        subject=str(doc.get("subject") or ""),
        message=str(doc.get("message") or ""),
        page=str(doc.get("page") or "").strip() or None,
        status=str(doc.get("status") or "open"),
        admin_response=str(doc.get("admin_response") or "").strip() or None,
        user_has_unread_response=bool(doc.get("user_has_unread_response")),
        admin_responded_at=doc.get("admin_responded_at"),
        user_acknowledged_response_at=doc.get("user_acknowledged_response_at"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


@router.post("/requests", response_model=HelpRequestOut)
async def create_help_request(payload: HelpRequestIn, user=Depends(require_user)):
    db = get_db()
    created_at = now_utc()
    doc = {
        "user_id": user["_id"],
        "category": str(payload.category).strip(),
        "subject": str(payload.subject).strip(),
        "message": str(payload.message).strip(),
        "page": str(payload.page or "").strip() or None,
        "status": "open",
        "admin_response": None,
        "user_has_unread_response": False,
        "admin_responded_at": None,
        "user_acknowledged_response_at": None,
        "user_email_snapshot": str(user.get("email") or "").strip(),
        "username_snapshot": str(user.get("username") or "").strip(),
        "created_at": created_at,
        "updated_at": created_at,
    }
    result = await db["help_requests"].insert_one(doc)
    return serialize_help_request({**doc, "_id": result.inserted_id})


@router.get("/requests/mine", response_model=list[HelpRequestOut])
async def list_my_help_requests(user=Depends(require_user)):
    db = get_db()
    docs = await (
        db["help_requests"]
        .find({"user_id": user["_id"]})
        .sort("created_at", -1)
        .limit(100)
        .to_list(length=100)
    )
    return [serialize_help_request(doc) for doc in docs]


@router.post("/requests/{request_id}/acknowledge", response_model=HelpRequestOut)
async def acknowledge_help_request_response(request_id: str, user=Depends(require_user)):
    db = get_db()
    try:
        request_oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request_id")

    doc = await db["help_requests"].find_one({"_id": request_oid, "user_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Help request not found")

    updates = {
        "user_has_unread_response": False,
        "user_acknowledged_response_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db["help_requests"].update_one({"_id": request_oid}, {"$set": updates})
    await refresh_user_help_unread_count(db, user["_id"])
    updated = await db["help_requests"].find_one({"_id": request_oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Help request not found")
    return serialize_help_request(updated)
