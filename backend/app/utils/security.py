"""Security helpers for request throttling and audit logging."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request

AUTH_RATE_LIMITS: dict[str, tuple[int, int]] = {
    "register": (5, 60),
    "login": (8, 60),
    "password_change": (5, 60),
    "avatar_upload": (5, 60),
    "subscription": (6, 60),
}

AI_RATE_LIMITS: dict[str, tuple[int, int]] = {
    "evidence_analyze": (10, 60),
    "job_ingest": (20, 60),
    "job_match": (16, 60),
    "tailor_preview": (12, 60),
    "tailor_rewrite": (10, 60),
    "job_reanalyze": (12, 60),
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_request_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"

    forwarded_for = str(request.headers.get("x-forwarded-for") or "").strip()
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first

    real_ip = str(request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip

    client_host = getattr(getattr(request, "client", None), "host", None)
    if client_host:
        return str(client_host)

    return "unknown"


def build_rate_limit_identifier(request: Request | None, *parts: Any) -> str:
    components = [get_request_ip(request)]
    for part in parts:
        value = str(part or "").strip().lower()
        if value:
            components.append(value)
    return "|".join(components)


async def enforce_rate_limit(
    db,
    *,
    scope: str,
    identifier: str,
    limit: int,
    window_seconds: int,
) -> dict[str, Any]:
    if limit <= 0 or window_seconds <= 0:
        return {"limit": limit, "remaining": limit, "reset_at": now_utc()}

    current = now_utc()
    window_start = int(current.timestamp() // window_seconds * window_seconds)
    reset_at = datetime.fromtimestamp(window_start + window_seconds, tz=timezone.utc)
    key = f"{scope}:{identifier}:{window_start}"

    collection = db["request_rate_limits"]
    existing = await collection.find_one({"_id": key})
    if existing:
        count = max(0, int(existing.get("count") or 0))
        if count >= limit:
            retry_after = max(1, int((reset_at - current).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        next_count = count + 1
        await collection.update_one(
            {"_id": key},
            {
                "$set": {
                    "count": next_count,
                    "scope": scope,
                    "identifier": identifier,
                    "window_start": datetime.fromtimestamp(window_start, tz=timezone.utc),
                    "expires_at": reset_at,
                    "updated_at": current,
                }
            },
        )
        return {
            "limit": limit,
            "remaining": max(0, limit - next_count),
            "reset_at": reset_at,
        }

    await collection.insert_one(
        {
            "_id": key,
            "scope": scope,
            "identifier": identifier,
            "count": 1,
            "window_start": datetime.fromtimestamp(window_start, tz=timezone.utc),
            "expires_at": reset_at,
            "created_at": current,
            "updated_at": current,
        }
    )
    return {
        "limit": limit,
        "remaining": max(0, limit - 1),
        "reset_at": reset_at,
    }


async def record_admin_audit_event(
    db,
    *,
    actor: dict[str, Any],
    action: str,
    target_type: str,
    target_id: str | None = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    event = {
        "actor_id": str(actor.get("_id") or ""),
        "actor_email": str(actor.get("email") or ""),
        "actor_role": str(actor.get("role") or "user"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": dict(details or {}),
        "ip_address": get_request_ip(request),
        "user_agent": str((request.headers.get("user-agent") if request else "") or ""),
        "created_at": now_utc(),
    }
    await db["audit_events"].insert_one(event)
