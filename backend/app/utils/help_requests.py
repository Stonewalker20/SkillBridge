"""Shared helpers for help-request unread-response bookkeeping."""

from __future__ import annotations

from app.core.auth import now_utc


async def refresh_user_help_unread_count(db, user_id) -> int:
    count = await db["help_requests"].count_documents({"user_id": user_id, "user_has_unread_response": True})
    await db["users"].update_one(
        {"_id": user_id},
        {"$set": {"help_unread_response_count": int(count), "updated_at": now_utc()}},
    )
    return int(count)
