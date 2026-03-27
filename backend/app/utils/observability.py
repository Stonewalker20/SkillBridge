"""Lightweight observability helpers for structured app events and request logging."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from fastapi import Request

LOGGER_NAME = "skillbridge.observability"


def configure_logging(level_name: str = "INFO") -> None:
    level = getattr(logging, str(level_name or "INFO").upper(), logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger(LOGGER_NAME).setLevel(level)


def _emit(event: str, **fields: Any) -> None:
    payload = {"event": event, **fields}
    logging.getLogger(LOGGER_NAME).info(json.dumps(payload, default=str, sort_keys=True, separators=(",", ":")))


def emit_app_event(event: str, **fields: Any) -> None:
    _emit(event, **fields)


async def request_logging_middleware(request: Request, call_next):
    request_id = str(request.headers.get("x-request-id") or "").strip() or uuid.uuid4().hex
    started_at = time.perf_counter()
    response = None

    try:
        response = await call_next(request)
    except Exception as exc:
        _emit(
            "http_request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=500,
            duration_ms=round((time.perf_counter() - started_at) * 1000.0, 2),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            error_type=exc.__class__.__name__,
        )
        raise

    if response is not None:
        response.headers["X-Request-ID"] = request_id
        _emit(
            "http_request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round((time.perf_counter() - started_at) * 1000.0, 2),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    return response
