"""MongoDB normalization helpers for converting ObjectIds, building mixed-type queries, and serializing ids safely."""

from __future__ import annotations
from bson import ObjectId
from typing import Any


def oid_str(oid: Any) -> str:
    return "" if oid is None else str(oid)


def try_object_id(value: Any) -> ObjectId | None:
    if isinstance(value, ObjectId):
        return value
    s = str(value or "").strip()
    if not s:
        return None
    try:
        return ObjectId(s)
    except Exception:
        return None


def to_object_id(id_str: str) -> ObjectId:
    oid = try_object_id(id_str)
    if oid is None:
        raise ValueError(f"Invalid ObjectId: {id_str}")
    return oid


def canonical_object_ref(value: Any) -> ObjectId | None:
    return try_object_id(value)


def canonical_object_refs(values: Any) -> list[ObjectId]:
    normalized: list[ObjectId] = []
    seen: set[str] = set()
    for value in values or []:
        oid = canonical_object_ref(value)
        if oid is None:
            continue
        key = str(oid)
        if key in seen:
            continue
        seen.add(key)
        normalized.append(oid)
    return normalized


def unique_strings(values: Any) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def ref_values(value: Any) -> list[Any]:
    oid = try_object_id(value)
    if oid is not None:
        return [oid, str(oid)]
    s = str(value or "").strip()
    return [s] if s else []


def ref_query(field: str, value: Any) -> dict[str, Any]:
    values = ref_values(value)
    if not values:
        return {}
    if len(values) == 1:
        return {field: values[0]}
    return {field: {"$in": values}}
