"""Compatibility routes for structured work-history entries now stored inside the evidence collection."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime, timezone
from bson import ObjectId

from app.core.db import get_db
from app.core.auth import require_user
from app.models.portfolio import PortfolioItemIn, PortfolioItemOut, PortfolioItemPatch
from app.utils.mongo import oid_str, ref_query, to_object_id, ref_values

router = APIRouter()

def now_utc():
    return datetime.now(timezone.utc)


def _portfolio_item_to_evidence_doc(payload: PortfolioItemIn, user_oid: ObjectId) -> dict:
    summary = str(payload.summary or "").strip()
    bullets = [str(value or "").strip() for value in (payload.bullets or []) if str(value or "").strip()]
    links = [str(value or "").strip() for value in (payload.links or []) if str(value or "").strip()]
    tags = [str(value or "").strip() for value in (payload.tags or []) if str(value or "").strip()]
    text_parts = [summary, *bullets]
    return {
        "user_id": user_oid,
        "user_email": None,
        "type": payload.type if payload.type in {"project", "paper", "cert", "other"} else "other",
        "title": payload.title,
        "source": links[0] if links else (payload.org or "structured-evidence"),
        "text_excerpt": "\n".join(part for part in text_parts if part).strip() or payload.title,
        "skill_ids": [to_object_id(sid) for sid in (payload.skill_ids or [])],
        "project_id": None,
        "tags": tags,
        "origin": "user",
        "structured_evidence": True,
        "portfolio_item_type": payload.type,
        "org": payload.org,
        "date_start": payload.date_start,
        "date_end": payload.date_end,
        "summary": summary or None,
        "bullets": bullets,
        "links": links,
        "visibility": payload.visibility,
        "priority": payload.priority,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }


def _serialize_portfolio_item(doc: dict) -> dict:
    return {
        "id": oid_str(doc["_id"]),
        "user_id": oid_str(doc["user_id"]),
        "type": doc.get("portfolio_item_type", doc.get("type", "other")),
        "title": doc.get("title", ""),
        "org": doc.get("org"),
        "date_start": doc.get("date_start"),
        "date_end": doc.get("date_end"),
        "summary": doc.get("summary"),
        "bullets": doc.get("bullets", []),
        "links": doc.get("links", []),
        "skill_ids": [oid_str(x) for x in doc.get("skill_ids", [])],
        "tags": doc.get("tags", []),
        "visibility": doc.get("visibility", "private"),
        "priority": doc.get("priority", 0),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

@router.post("/items", response_model=PortfolioItemOut)
async def create_portfolio_item(payload: PortfolioItemIn, user=Depends(require_user)):
    db = get_db()
    if oid_str(payload.user_id) != oid_str(user.get("_id")):
        raise HTTPException(status_code=403, detail="user_id must match authenticated user")
    doc = _portfolio_item_to_evidence_doc(payload, user["_id"])
    res = await db["evidence"].insert_one(doc)
    return _serialize_portfolio_item({"_id": res.inserted_id, **doc})

@router.get("/items", response_model=list[PortfolioItemOut])
async def list_portfolio_items(
    user_id: str | None = Query(default=None),
    type: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    user=Depends(require_user),
):
    db = get_db()
    effective_user_id = oid_str(user.get("_id"))
    if user_id and oid_str(user_id) != effective_user_id:
        raise HTTPException(status_code=403, detail="You can only list your own portfolio items")
    q = ref_query("user_id", effective_user_id)
    if type:
        q["portfolio_item_type"] = type
    if visibility:
        q["visibility"] = visibility

    q["structured_evidence"] = True
    cursor = db["evidence"].find(q).sort("priority", -1).sort("updated_at", -1)
    docs = await cursor.to_list(length=500)
    return [_serialize_portfolio_item(d) for d in docs]

@router.patch("/items/{item_id}", response_model=PortfolioItemOut)
async def patch_portfolio_item(item_id: str, payload: PortfolioItemPatch, user=Depends(require_user)):
    db = get_db()
    try:
        oid = ObjectId(item_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "skill_ids" in updates:
        updates["skill_ids"] = [to_object_id(sid) for sid in updates["skill_ids"]]
    if "summary" in updates or "bullets" in updates or "title" in updates:
        summary = str(updates.get("summary") or "").strip()
        bullets = [str(value or "").strip() for value in (updates.get("bullets") or []) if str(value or "").strip()]
        title = str(updates.get("title") or "").strip()
        text_parts = [summary, *bullets]
        updates["text_excerpt"] = "\n".join(part for part in text_parts if part).strip() or title or None
    if "type" in updates:
        updates["portfolio_item_type"] = updates["type"]
        if updates["type"] not in {"project", "paper", "cert", "other"}:
            updates["type"] = "other"
    if "links" in updates:
        links = [str(value or "").strip() for value in (updates.get("links") or []) if str(value or "").strip()]
        updates["links"] = links
        if links:
            updates["source"] = links[0]

    updates["updated_at"] = now_utc()
    updates = {key: value for key, value in updates.items() if value is not None}

    res = await db["evidence"].update_one(
        {"_id": oid, "user_id": {"$in": ref_values(user["_id"])}, "structured_evidence": True},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio item not found")

    d = await db["evidence"].find_one({"_id": oid, "user_id": {"$in": ref_values(user["_id"])}, "structured_evidence": True})
    if not d:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
    return _serialize_portfolio_item(d)

@router.delete("/items/{item_id}")
async def delete_portfolio_item(item_id: str, user=Depends(require_user)):
    db = get_db()
    try:
        oid = ObjectId(item_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    res = await db["evidence"].delete_one({"_id": oid, "user_id": {"$in": ref_values(user["_id"])}, "structured_evidence": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
    return {"deleted": True, "id": item_id}
