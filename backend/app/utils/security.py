"""Security helpers for request throttling and audit logging."""

from __future__ import annotations

from datetime import datetime, timezone
import ipaddress
import socket
from typing import Any

from fastapi import HTTPException, Request
from app.core.config import settings

AUTH_RATE_LIMITS: dict[str, tuple[int, int]] = {
    "register": (5, 60),
    "login": (8, 60),
    "password_change": (5, 60),
    "password_reset_request": (5, 300),
    "password_reset_confirm": (8, 300),
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


def _is_trusted_proxy_host(host: str | None) -> bool:
    candidate = str(host or "").strip()
    if not candidate:
        return False

    trusted_entries = settings.trusted_proxy_cidrs_list
    if not trusted_entries:
        return False

    try:
        address = ipaddress.ip_address(candidate)
    except ValueError:
        return False

    for entry in trusted_entries:
        try:
            if address in ipaddress.ip_network(entry, strict=False):
                return True
        except ValueError:
            continue
    return False


def _is_safe_forwarded_host(value: str) -> bool:
    candidate = str(value or "").strip().lower()
    if not candidate:
        return False
    if candidate in {"localhost", "localhost.localdomain"}:
        return False
    if candidate.endswith(".local"):
        return False

    try:
        address = ipaddress.ip_address(candidate)
    except ValueError:
        try:
            infos = socket.getaddrinfo(candidate, None, type=socket.SOCK_STREAM)
        except OSError:
            return False
        if not infos:
            return False
        for family, _socktype, _proto, _canonname, sockaddr in infos:
            if family not in {socket.AF_INET, socket.AF_INET6}:
                continue
            resolved = ipaddress.ip_address(sockaddr[0])
            if resolved.is_private or resolved.is_loopback or resolved.is_link_local or resolved.is_reserved or resolved.is_multicast:
                return False
        return True

    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def get_request_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"

    client_host = getattr(getattr(request, "client", None), "host", None)
    if client_host and _is_trusted_proxy_host(client_host):
        forwarded_for = str(request.headers.get("x-forwarded-for") or "").strip()
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first and _is_safe_forwarded_host(first):
                return first

        real_ip = str(request.headers.get("x-real-ip") or "").strip()
        if real_ip and _is_safe_forwarded_host(real_ip):
            return real_ip

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
